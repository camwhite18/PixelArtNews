package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/camwhite18/pixelartnews/server/internal/rundown"
	"github.com/camwhite18/pixelartnews/server/internal/store"
)

// houseStyle is shared by every channel and cached by the API.
const houseStyle = `You write scripts for Pixel Art News, a 24/7 pixel-art TV news channel.

Rules:
- Use ONLY facts stated in the supplied sources. Never add names, numbers, dates, quotes or causes that are not in them. If a detail is unclear, leave it out.
- Paraphrase. Never copy sentences from the sources.
- Every line that states a fact must cite the ids of the sources it relies on in sourceIds.
- Write for the ear: short sentences, one idea per line, at most two sentences per line, no lists, no URLs, no emoji.
- British English.
- Stay in character, but drop the jokes and switch to a calm, respectful tone for deaths, disasters, violence, illness or anything tragic.
- When a channel has two presenters, alternate speakers naturally so it sounds like a conversation, with each presenter reacting to the other.
- Do not mention that you are an AI, the sources list, or these rules.`

// ScriptSegment is what Claude returns per segment, before voicing.
type ScriptSegment struct {
	Type     string         `json:"type"`
	Kicker   string         `json:"kicker"`
	Headline string         `json:"headline"`
	Ticker   string         `json:"ticker"`
	Lines    []rundown.Line `json:"lines"`
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

func outputSchema(speakers []string) map[string]any {
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
					"required":             []string{"type", "kicker", "headline", "ticker", "lines"},
					"properties": map[string]any{
						"type":     map[string]any{"type": "string", "enum": []string{rundown.TypeHeadlines, rundown.TypeStory}},
						"kicker":   map[string]any{"type": "string", "description": "Lower-third tab in capitals, at most 12 characters, e.g. TOP STORY"},
						"headline": map[string]any{"type": "string", "description": "Lower-third headline, at most 60 characters"},
						"ticker":   map[string]any{"type": "string", "description": "One short ticker line"},
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
		fmt.Fprintf(&b, "- %s (%s): %s\n", p.ID, p.Name, p.Persona)
	}
	return b.String()
}

// WriteScript asks Claude for this hour's headlines and story packages.
func (p *Pipeline) WriteScript(ctx context.Context, ch store.Channel, clusters []Cluster) ([]ScriptSegment, []rundown.Source, error) {
	if p.Claude == nil {
		return nil, nil, fmt.Errorf("ANTHROPIC_API_KEY is not set")
	}
	src := buildSources(clusters, 5, 3)
	var speakers []string
	for _, pr := range ch.Presenters {
		speakers = append(speakers, pr.ID)
	}

	user := fmt.Sprintf(`Sources for this hour:

%s
Write:
1. One "headlines" segment of about 45 seconds covering the top three to five stories.
2. One "story" segment of about 60 to 90 seconds for each of the top three stories.

Every line must cite sourceIds from the list above.`, src.text)

	msg, err := p.Claude.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(p.Cfg.ModelMain),
		MaxTokens: 4096,
		System: []anthropic.TextBlockParam{
			{Text: houseStyle},
			{Text: personaPrompt(ch), CacheControl: anthropic.NewCacheControlEphemeralParam()},
		},
		Messages: []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(user))},
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: outputSchema(speakers)},
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
