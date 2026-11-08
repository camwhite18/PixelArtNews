// Package pipeline turns news feeds into a voiced, scheduled rundown:
// ingest → cluster → script (Claude) → voice (Kokoro) → publish.
package pipeline

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"path/filepath"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/camwhite18/pixelartnews/server/internal/boards"
	"github.com/camwhite18/pixelartnews/server/internal/config"
	"github.com/camwhite18/pixelartnews/server/internal/rundown"
	"github.com/camwhite18/pixelartnews/server/internal/shifts"
	"github.com/camwhite18/pixelartnews/server/internal/store"
	"github.com/camwhite18/pixelartnews/server/internal/weather"
)

type Pipeline struct {
	Cfg    config.Config
	Store  *store.Store
	Claude *anthropic.Client
	TTS    *TTSClient
	Log    *slog.Logger
	// HTTP fetches data for weather segments and studio boards.
	HTTP *http.Client
}

func New(cfg config.Config, st *store.Store, log *slog.Logger) *Pipeline {
	p := &Pipeline{
		Cfg: cfg, Store: st, TTS: NewTTSClient(cfg.TTSURL), Log: log,
		HTTP: &http.Client{Timeout: 20 * time.Second},
	}
	if cfg.AnthropicAPIKey != "" {
		opts := []option.RequestOption{option.WithAPIKey(cfg.AnthropicAPIKey), option.WithMaxRetries(3)}
		if cfg.AnthropicBaseURL != "" {
			opts = append(opts, option.WithBaseURL(cfg.AnthropicBaseURL))
		}
		c := anthropic.NewClient(opts...)
		p.Claude = &c
	}
	return p
}

// Run statuses recorded in the runs table.
const (
	StatusPublished = "published"
	StatusSkipped   = "skipped"
	StatusEmpty     = "empty"
	StatusFailed    = "failed"
)

// Run executes one pipeline pass for a channel. force regenerates even when
// the top stories have not changed.
func (p *Pipeline) Run(ctx context.Context, channelID string, force bool) (status string, err error) {
	runID, err := p.Store.StartRun(ctx, channelID, "hourly")
	if err != nil {
		return StatusFailed, err
	}
	hash := ""
	defer func() {
		if err != nil {
			status = StatusFailed
		}
		if ferr := p.Store.FinishRun(context.WithoutCancel(ctx), runID, status, hash, err); ferr != nil {
			p.Log.Error("recording run", "run", runID, "err", ferr)
		}
	}()

	ch, err := p.Store.Channel(ctx, channelID)
	if err != nil {
		return "", err
	}
	p.refreshBoard(ctx, channelID)

	added, err := p.Ingest(ctx, channelID)
	if err != nil {
		return "", fmt.Errorf("ingest: %w", err)
	}
	articles, err := p.Store.RecentArticles(ctx, channelID, time.Now().Add(-24*time.Hour))
	if err != nil {
		return "", err
	}
	clusters := ClusterArticles(articles, 0.3)
	p.Log.Info("ingested", "channel", channelID, "new", added, "recent", len(articles), "stories", len(clusters))
	if len(clusters) == 0 {
		return StatusEmpty, nil
	}

	// The team on air, and the next one if their shift starts before the
	// following run: that run would be too late to script the handover.
	now := time.Now()
	cur, next := shifts.At(now, p.Cfg.Location)
	handover := next.From.Before(now.Add(p.Cfg.PipelineInterval + 10*time.Minute))

	// A new shift (or an upcoming handover) needs a new script even when
	// the stories haven't changed.
	hash = TopHash(clusters, 5) + "|" + cur.ID
	if handover {
		hash += ">" + next.ID
	}
	if !force {
		last, err := p.Store.LastPublishedHash(ctx, channelID)
		if err != nil {
			return "", err
		}
		if last == hash {
			p.Log.Info("top stories unchanged, skipping", "channel", channelID)
			return StatusSkipped, nil
		}
	}

	slots := []shifts.Slot{cur}
	if handover {
		slots = append(slots, next)
	}
	var blocks []rundown.Block
	fresh := 0
	for i, slot := range slots {
		segs, err := p.produce(ctx, ch, slot, clusters)
		if err != nil {
			return "", fmt.Errorf("%s shift: %w", slot.ID, err)
		}
		from := now
		if i > 0 {
			from = slot.From
		}
		blocks = append(blocks, rundown.Block{From: from, Segments: segs})
		fresh += len(segs)
	}

	prev, err := LoadLatest(p.Cfg.MediaDir, channelID)
	if err != nil {
		p.Log.Warn("ignoring unreadable rundown", "channel", channelID, "err", err)
		prev = nil
	}
	sched := rundown.ExtendBlocks(prev, channelID, blocks, now, p.Cfg.ScheduleHorizon)
	if err := Publish(p.Cfg.MediaDir, runID, sched); err != nil {
		return "", fmt.Errorf("publish: %w", err)
	}
	if err := p.Store.NotifyPublished(ctx, channelID); err != nil {
		p.Log.Warn("notify failed", "err", err)
	}
	p.Log.Info("published", "channel", channelID, "shift", cur.ID, "handover", handover,
		"segments", fresh, "scheduled", len(sched.Segments))
	return StatusPublished, nil
}

// produce scripts and voices this hour's segments for one shift's team.
func (p *Pipeline) produce(ctx context.Context, ch store.Channel, slot shifts.Slot, clusters []Cluster) ([]rundown.Segment, error) {
	team := ch.OnShift(slot.ID)
	onSet := ch
	onSet.Presenters = team

	wx := p.forecast(ctx, ch.ID, slot.ID)
	script, sources, err := p.WriteScript(ctx, onSet, slot, clusters, wx, p.memory(ctx, ch.ID))
	if err != nil {
		return nil, fmt.Errorf("script: %w", err)
	}
	if len(script) == 0 {
		return nil, fmt.Errorf("script: every line failed the grounding check")
	}

	var segs []rundown.Segment
	for _, s := range script {
		seg, err := p.voice(ctx, ch.ID, slot.ID, s, sources, team, wx)
		if err != nil {
			return nil, err
		}
		segs = append(segs, seg)
	}
	return segs, nil
}

func (p *Pipeline) voice(ctx context.Context, channelID, show string, s ScriptSegment, sources []rundown.Source, team []store.Presenter, wx []weather.Day) (rundown.Segment, error) {
	byID := map[string]store.Presenter{}
	var onSet []string
	for _, pr := range team {
		byID[pr.ID] = pr
		onSet = append(onSet, pr.ID)
	}
	var lines []TTSLine
	for _, l := range s.Lines {
		pr := byID[l.Speaker]
		lines = append(lines, TTSLine{Text: l.Text, Voice: pr.Voice, Speed: pr.Speed})
	}
	// The show opens with the channel's ident; each story with a sting.
	intro := TTSIntro{Style: "sting", Seed: channelID}
	if s.Type == rundown.TypeHeadlines {
		intro.Style = "ident"
	}
	res, err := p.TTS.Synthesize(ctx, lines, intro)
	if err != nil {
		return rundown.Segment{}, err
	}

	id := newSegmentID()
	key := audioKey(channelID, id)
	if err := writeFileAtomic(filepath.Join(p.Cfg.MediaDir, key), res.Audio); err != nil {
		return rundown.Segment{}, err
	}
	for i := range s.Lines {
		if i < len(res.LineStarts) {
			s.Lines[i].StartS = res.LineStarts[i]
		}
	}
	s.Art = ValidArt(s.Art)
	var places []rundown.WeatherPlace
	if s.Type == rundown.TypeWeather {
		places = weatherPlaces(wx)
	}
	scriptJSON, _ := json.Marshal(s)
	if err := p.Store.SaveSegment(ctx, id, channelID, s.Type, scriptJSON, key, res.DurationS); err != nil {
		return rundown.Segment{}, err
	}
	return rundown.Segment{
		ID:         id,
		Type:       s.Type,
		DurationS:  res.DurationS,
		Audio:      key,
		Kicker:     s.Kicker,
		Headline:   s.Headline,
		Ticker:     s.Ticker,
		Presenters: onSet,
		Show:       show,
		Art:        s.Art,
		IntroS:     res.IntroS,
		Weather:    places,
		Lines:      s.Lines,
		Sources:    SourcesFor(s, sources),
	}, nil
}

func newSegmentID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "seg_" + hex.EncodeToString(b)
}

// forecast fetches today's weather for the weather channel's breakfast
// show. A failed fetch only costs the weather segment, so it is logged and
// the show goes on without it.
func (p *Pipeline) forecast(ctx context.Context, channelID, showID string) []weather.Day {
	if channelID != p.Cfg.WeatherChannel || showID != "breakfast" {
		return nil
	}
	days, err := weather.Fetch(ctx, p.HTTP, p.Cfg.WeatherURL, weather.UK, p.Cfg.Location)
	if err != nil {
		p.Log.Warn("weather unavailable", "err", err)
		return nil
	}
	return days
}

func weatherPlaces(days []weather.Day) []rundown.WeatherPlace {
	out := make([]rundown.WeatherPlace, 0, len(days))
	for _, d := range days {
		out = append(out, rundown.WeatherPlace{
			Place: d.Place.ID, Code: d.Code, MaxC: math.Round(d.MaxC), MinC: math.Round(d.MinC),
		})
	}
	return out
}

// refreshBoard updates a channel's studio board (the football table or the
// F1 standings) when it is older than BoardsTTL. Boards are decoration, so
// failures are logged and the old board stays up.
func (p *Pipeline) refreshBoard(ctx context.Context, channelID string) {
	if boards.Fresh(p.Cfg.MediaDir, channelID, p.Cfg.BoardsTTL) {
		return
	}
	var (
		b   boards.Board
		err error
	)
	switch channelID {
	case "football":
		if p.Cfg.FootballDataKey == "" {
			return
		}
		b, err = boards.FootballTable(ctx, p.HTTP, p.Cfg.FootballDataURL, p.Cfg.FootballDataKey, p.Cfg.FootballCompetition)
	case "f1":
		b, err = boards.F1Drivers(ctx, p.HTTP, p.Cfg.JolpicaURL, time.Now().In(p.Cfg.Location).Year())
	default:
		return
	}
	if err == nil {
		err = boards.Write(p.Cfg.MediaDir, channelID, b)
	}
	if err != nil {
		p.Log.Warn("board not updated", "channel", channelID, "err", err)
	}
}

// memory is what the channel covered recently, for the script prompt. It
// only adds continuity, so a failed lookup is logged and skipped.
func (p *Pipeline) memory(ctx context.Context, channelID string) string {
	now := time.Now()
	past, err := p.Store.RecentSegments(ctx, channelID, now.Add(-memoryWindow))
	if err != nil {
		p.Log.Warn("memory unavailable", "channel", channelID, "err", err)
		return ""
	}
	return MemoryNote(past, now, p.Cfg.Location)
}
