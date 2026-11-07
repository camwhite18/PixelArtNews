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
	"path/filepath"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/camwhite18/pixelartnews/server/internal/config"
	"github.com/camwhite18/pixelartnews/server/internal/rundown"
	"github.com/camwhite18/pixelartnews/server/internal/store"
)

type Pipeline struct {
	Cfg    config.Config
	Store  *store.Store
	Claude *anthropic.Client
	TTS    *TTSClient
	Log    *slog.Logger
}

func New(cfg config.Config, st *store.Store, log *slog.Logger) *Pipeline {
	p := &Pipeline{Cfg: cfg, Store: st, TTS: NewTTSClient(cfg.TTSURL), Log: log}
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

	hash = TopHash(clusters, 5)
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

	script, sources, err := p.WriteScript(ctx, ch, clusters)
	if err != nil {
		return "", fmt.Errorf("script: %w", err)
	}
	if len(script) == 0 {
		return "", fmt.Errorf("script: every line failed the grounding check")
	}

	voices := map[string]string{}
	for _, pr := range ch.Presenters {
		voices[pr.ID] = pr.Voice
	}

	var fresh []rundown.Segment
	for _, s := range script {
		seg, err := p.voice(ctx, ch.ID, s, sources, voices)
		if err != nil {
			return "", err
		}
		fresh = append(fresh, seg)
	}

	prev, err := LoadLatest(p.Cfg.MediaDir, channelID)
	if err != nil {
		p.Log.Warn("ignoring unreadable rundown", "channel", channelID, "err", err)
		prev = nil
	}
	next := rundown.Extend(prev, channelID, fresh, time.Now(), p.Cfg.ScheduleHorizon)
	if err := Publish(p.Cfg.MediaDir, runID, next); err != nil {
		return "", fmt.Errorf("publish: %w", err)
	}
	if err := p.Store.NotifyPublished(ctx, channelID); err != nil {
		p.Log.Warn("notify failed", "err", err)
	}
	p.Log.Info("published", "channel", channelID, "segments", len(fresh), "scheduled", len(next.Segments))
	return StatusPublished, nil
}

func (p *Pipeline) voice(ctx context.Context, channelID string, s ScriptSegment, sources []rundown.Source, voices map[string]string) (rundown.Segment, error) {
	var lines []TTSLine
	for _, l := range s.Lines {
		lines = append(lines, TTSLine{Text: l.Text, Voice: voices[l.Speaker]})
	}
	res, err := p.TTS.Synthesize(ctx, lines)
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
	scriptJSON, _ := json.Marshal(s)
	if err := p.Store.SaveSegment(ctx, id, channelID, s.Type, scriptJSON, key, res.DurationS); err != nil {
		return rundown.Segment{}, err
	}
	return rundown.Segment{
		ID:        id,
		Type:      s.Type,
		DurationS: res.DurationS,
		Audio:     key,
		Kicker:    s.Kicker,
		Headline:  s.Headline,
		Ticker:    s.Ticker,
		Lines:     s.Lines,
		Sources:   SourcesFor(s, sources),
	}, nil
}

func newSegmentID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "seg_" + hex.EncodeToString(b)
}
