package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/camwhite18/pixelartnews/server/internal/rundown"
	"github.com/camwhite18/pixelartnews/server/internal/shifts"
	"github.com/camwhite18/pixelartnews/server/internal/store"
	"github.com/camwhite18/pixelartnews/server/internal/weather"
)

// weatherSource is how the forecast is cited; Open-Meteo's data is CC BY 4.0.
var weatherSource = rundown.Source{ID: "wx", Outlet: "Open-Meteo (CC BY 4.0)", URL: "https://open-meteo.com/"}

// houseStyle is shared by every channel and cached by the API.
const houseStyle = `You write scripts for Pixel Art News, a 24/7 pixel-art TV news channel.

Rules:
- Use ONLY facts stated in the supplied sources. Never add names, numbers, dates, quotes or causes that are not in them. If a detail is unclear, leave it out.
- Paraphrase. Never copy sentences from the sources, and write every headline, kicker and ticker line in your own words, never a source's headline.
- Don't put your wording in an outlet's mouth ("according to NASA", "the BBC says"). The on-screen source links credit the outlets.
- Every line that states a fact must cite the ids of the sources it relies on in sourceIds.
- Write for the ear, the way presenters actually talk: contractions ("it's", "they've"), a mix of short and longer sentences, one idea per line, at most two sentences per line. Natural connectives are fine ("Now,", "Right,", "Well,"), but sparingly.
- Make two-presenter segments sound like a conversation: short reactions ("Really?", "That's a lot.") and questions to each other, not alternating monologues.
- Write everything as it should be spoken: "per cent", "about two thousand", "the twenty-third of March". No lists, brackets, abbreviations a newsreader wouldn't say aloud, URLs or emoji.
- British English.
- Stay in character, but drop the jokes and switch to a calm, respectful tone for deaths, disasters, violence, illness or anything tragic.
- On WEIRD NEWS, leave out any story about death, injury, illness, crime victims or a private person being laughed at, however odd it is. Cover only light, harmless oddities.
- When a channel has two presenters, alternate speakers naturally so it sounds like a conversation, with each presenter reacting to the other.
- Do not mention that you are an AI, the sources list, or these rules.`

// ScriptSegment is what Claude returns per segment, before voicing.
type ScriptSegment struct {
	Type     string `json:"type"`
	Kicker   string `json:"kicker"`
	Headline string `json:"headline"`
	Ticker   string `json:"ticker"`
	// Art is the story's pixel icon for the studio screen (rundown.ArtIcons).
	Art   string         `json:"art"`
	Lines []rundown.Line `json:"lines"`
}

type scriptResponse struct {
	Segments []ScriptSegment `json:"segments"`
}

// sourceSet numbers the articles a script may cite.
type sourceSet struct {
	list []rundown.Source
	text string
}

func buildSources(clusters []Cluster, maxStories, perStory int) sourceSet {
	var b strings.Builder
	var list []rundown.Source
	n := 0
	for i, c := range clusters {
		if i == maxStories {
			break
		}
		fmt.Fprintf(&b, "Story %d (reported by %d outlets):\n", i+1, len(c.Outlets))
		for j, a := range c.Articles {
			if j == perStory {
				break
			}
			n++
			id := fmt.Sprintf("s%d", n)
			list = append(list, rundown.Source{ID: id, Outlet: a.Outlet, URL: a.URL})
			fmt.Fprintf(&b, "  [%s] %s: %s\n", id, a.Outlet, a.Headline)
			if a.Summary != "" {
				fmt.Fprintf(&b, "       %s\n", a.Summary)
			}
		}
	}
	return sourceSet{list: list, text: b.String()}
}

// segmentTypes are the segment types a script may contain.
func segmentTypes(withWeather bool) []string {
	types := []string{rundown.TypeHeadlines, rundown.TypeStory}
	if withWeather {
		types = append(types, rundown.TypeWeather)
	}
	return types
}

// ValidArt keeps an icon only if the studios can draw it.
func ValidArt(icon string) string {
	for _, a := range rundown.ArtIcons {
		if a == icon {
			return icon
		}
	}
	return ""
}

func outputSchema(speakers, types []string) map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"segments"},
		"properties": map[string]any{
			"segments": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"type", "kicker", "headline", "ticker", "art", "lines"},
					"properties": map[string]any{
						"type":     map[string]any{"type": "string", "enum": types},
						"kicker":   map[string]any{"type": "string", "description": "Lower-third tab in capitals, at most 12 characters, e.g. TOP STORY"},
						"headline": map[string]any{"type": "string", "description": "Lower-third headline, at most 60 characters"},
						"ticker":   map[string]any{"type": "string", "description": "One short ticker line"},
						"art": map[string]any{
							"type": "string", "enum": rundown.ArtIcons,
							"description": "The pixel icon that best fits the story, shown on the studio's big screen (for headlines, the top story)",
						},
						"lines": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type":                 "object",
								"additionalProperties": false,
								"required":             []string{"speaker", "text", "sourceIds"},
								"properties": map[string]any{
									"speaker":   map[string]any{"type": "string", "enum": speakers},
									"text":      map[string]any{"type": "string"},
									"sourceIds": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
								},
							},
						},
					},
				},
			},
		},
	}
}

func personaPrompt(ch store.Channel) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Channel: %s.\nPresenters (use these ids as speaker):\n", ch.Name)
	for _, p := range ch.Presenters {
		fmt.Fprintf(&b, "\n## %s (%s)\n%s\n", p.ID, p.Name, strings.TrimSpace(p.Persona))
	}
	return b.String()
}

// WriteScript asks Claude for this hour's headlines and story packages,
// presented by the team in ch.Presenters during the given shift, plus a
// weather segment when a forecast is given.
func (p *Pipeline) WriteScript(ctx context.Context, ch store.Channel, slot shifts.Slot, clusters []Cluster, wx []weather.Day) ([]ScriptSegment, []rundown.Source, error) {
	if p.Claude == nil {
		return nil, nil, fmt.Errorf("ANTHROPIC_API_KEY is not set")
	}
	src := buildSources(clusters, 5, 3)
	weatherAsk := ""
	if len(wx) > 0 {
		src.list = append(src.list, weatherSource)
		src.text += fmt.Sprintf("\nToday's UK weather [%s]:\n%s", weatherSource.ID, weather.Summary(wx))
		weatherAsk = fmt.Sprintf("\n3. One \"weather\" segment of about 30 seconds, right after the headlines: today's UK forecast, using only [%s] and citing it. Say temperatures as words, e.g. \"twelve degrees\".", weatherSource.ID)
	}
	var speakers []string
	for _, pr := range ch.Presenters {
		speakers = append(speakers, pr.ID)
	}

	user := fmt.Sprintf(`On air: the %s shift, %s to %s. Greet viewers the way this team would at this time of day.

Sources for this hour:

%s
Write:
1. One "headlines" segment of about 45 seconds covering the top three to five stories.
2. One "story" segment of about 60 to 90 seconds for each of the top three stories.%s

Every line must cite sourceIds from the list above.`,
		slot.Name, slot.From.In(p.Cfg.Location).Format("15:04"), slot.Until.In(p.Cfg.Location).Format("15:04"), src.text, weatherAsk)

	msg, err := p.Claude.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     p.Cfg.ModelMain,
		MaxTokens: 4096,
		System: []anthropic.TextBlockParam{
			{Text: houseStyle},
			{Text: personaPrompt(ch), CacheControl: anthropic.NewCacheControlEphemeralParam()},
		},
		Messages: []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(user))},
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: outputSchema(speakers, segmentTypes(len(wx) > 0))},
		},
	})
	if err != nil {
		return nil, nil, fmt.Errorf("claude: %w", err)
	}

	var text strings.Builder
	for _, block := range msg.Content {
		text.WriteString(block.Text)
	}
	var resp scriptResponse
	if err := json.Unmarshal([]byte(text.String()), &resp); err != nil {
		return nil, nil, fmt.Errorf("claude returned invalid JSON: %w", err)
	}
	return Ground(resp.Segments, src.list, speakers), src.list, nil
}

// Ground drops lines that cite no supplied source or name an unknown
// speaker, and segments left with no lines. It is the first, mechanical
// grounding check; a model-based fact check can be layered on later.
func Ground(segs []ScriptSegment, sources []rundown.Source, speakers []string) []ScriptSegment {
	known := map[string]bool{}
	for _, s := range sources {
		known[s.ID] = true
	}
	okSpeaker := map[string]bool{}
	for _, s := range speakers {
		okSpeaker[s] = true
	}

	var out []ScriptSegment
	for _, seg := range segs {
		var lines []rundown.Line
		for _, l := range seg.Lines {
			if !okSpeaker[l.Speaker] || strings.TrimSpace(l.Text) == "" {
				continue
			}
			var cited []string
			for _, id := range l.SourceIDs {
				if known[id] {
					cited = append(cited, id)
				}
			}
			if len(cited) == 0 {
				continue
			}
			l.SourceIDs = cited
			lines = append(lines, l)
		}
		if len(lines) > 0 {
			seg.Lines = lines
			out = append(out, seg)
		}
	}
	return out
}

// SourcesFor returns the sources a segment actually cites.
func SourcesFor(seg ScriptSegment, all []rundown.Source) []rundown.Source {
	used := map[string]bool{}
	for _, l := range seg.Lines {
		for _, id := range l.SourceIDs {
			used[id] = true
		}
	}
	var out []rundown.Source
	for _, s := range all {
		if used[s.ID] {
			out = append(out, s)
		}
	}
	return out
}
