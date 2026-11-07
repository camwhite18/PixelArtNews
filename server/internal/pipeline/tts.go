package pipeline

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// TTSLine is one presenter line to voice.
type TTSLine struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
	// Speed is the presenter's pace (1 = Kokoro's default); 0 means default.
	Speed float64 `json:"speed,omitempty"`
}

// TTSResult is one encoded segment.
type TTSResult struct {
	Audio      []byte
	DurationS  float64
	LineStarts []float64
}

// TTSClient talks to the Kokoro service in tts/.
type TTSClient struct {
	BaseURL string
	HTTP    *http.Client
}

func NewTTSClient(base string) *TTSClient {
	return &TTSClient{BaseURL: base, HTTP: &http.Client{Timeout: 10 * time.Minute}}
}

// Synthesize voices the lines in order (switching voices per presenter) and
// returns one MP3 with the start offset of each line.
func (c *TTSClient) Synthesize(ctx context.Context, lines []TTSLine) (TTSResult, error) {
	body, err := json.Marshal(map[string]any{"lines": lines, "gap_ms": 300})
	if err != nil {
		return TTSResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/synthesize", bytes.NewReader(body))
	if err != nil {
		return TTSResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return TTSResult{}, fmt.Errorf("tts: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return TTSResult{}, fmt.Errorf("tts: %s: %s", resp.Status, msg)
	}

	var out struct {
		AudioB64   string    `json:"audio_b64"`
		DurationS  float64   `json:"duration_s"`
		LineStarts []float64 `json:"line_starts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return TTSResult{}, fmt.Errorf("tts: bad response: %w", err)
	}
	audio, err := base64.StdEncoding.DecodeString(out.AudioB64)
	if err != nil {
		return TTSResult{}, fmt.Errorf("tts: bad audio: %w", err)
	}
	return TTSResult{Audio: audio, DurationS: out.DurationS, LineStarts: out.LineStarts}, nil
}
