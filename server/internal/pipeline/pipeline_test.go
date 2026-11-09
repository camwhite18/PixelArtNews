package pipeline

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/camwhite18/pixelartnews/server/internal/config"
)

// recordHost records where the first request was sent and fails every
// request, so nothing leaves the process.
type recordHost struct{ got string }

var errStop = errors.New("stop")

func (r *recordHost) RoundTrip(req *http.Request) (*http.Response, error) {
	if r.got == "" {
		r.got = req.URL.Scheme + "://" + req.URL.Host
	}
	return nil, errStop
}

func TestNewClaudeBaseURL(t *testing.T) {
	cases := []struct {
		name, env, cfg, want string
	}{
		{"empty env and config use the default", "", "", "https://api.anthropic.com"},
		{"config overrides an empty env", "", "https://gateway.example/v1/x/anthropic", "https://gateway.example"},
		{"config overrides a stale env", "https://stale.example", "https://gateway.example", "https://gateway.example"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("ANTHROPIC_BASE_URL", tc.env)
			rt := &recordHost{}
			c := newClaude(
				config.Config{AnthropicAPIKey: "test", AnthropicBaseURL: tc.cfg},
				option.WithHTTPClient(&http.Client{Transport: rt}),
				option.WithMaxRetries(0),
			)
			_, err := c.Messages.New(context.Background(), anthropic.MessageNewParams{
				Model:     "m",
				MaxTokens: 1,
				Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("hi"))},
			})
			if err == nil {
				t.Fatal("expected the stubbed transport to fail the request")
			}
			if rt.got != tc.want {
				t.Fatalf("request went to %q, want %q", rt.got, tc.want)
			}
		})
	}
}
