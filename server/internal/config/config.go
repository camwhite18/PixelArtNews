// Package config reads server settings from the environment.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
	_ "time/tzdata" // the container image has no zoneinfo files
)

type Config struct {
	HTTPAddr    string
	DatabaseURL string
	WebDir      string
	MediaDir    string

	AnthropicAPIKey  string
	AnthropicBaseURL string // optional: Cloudflare AI Gateway endpoint
	ModelMain        string // headlines and story packages
	ModelFast        string // links, recaps, checks

	TTSURL string

	PipelineInterval time.Duration
	BreakingInterval time.Duration
	ScheduleHorizon  time.Duration
	RunOnStart       bool

	// Location is the time zone presenter shifts follow (TIMEZONE).
	Location *time.Location
}

func Load() (Config, error) {
	c := Config{
		HTTPAddr:         env("HTTP_ADDR", ":8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		WebDir:           env("WEB_DIR", "/app/web"),
		MediaDir:         env("MEDIA_DIR", "/data/media"),
		AnthropicAPIKey:  os.Getenv("ANTHROPIC_API_KEY"),
		AnthropicBaseURL: os.Getenv("ANTHROPIC_BASE_URL"),
		ModelMain:        env("MODEL_MAIN", "claude-sonnet-5-5"),
		ModelFast:        env("MODEL_FAST", "claude-haiku-5-5"),
		TTSURL:           env("TTS_URL", "http://tts:8000"),
		PipelineInterval: dur("PIPELINE_INTERVAL", time.Hour),
		BreakingInterval: dur("BREAKING_INTERVAL", 15*time.Minute),
		ScheduleHorizon:  dur("SCHEDULE_HORIZON", 3*time.Hour),
		RunOnStart:       boolean("RUN_ON_START", true),
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	loc, err := time.LoadLocation(env("TIMEZONE", "Europe/London"))
	if err != nil {
		return c, fmt.Errorf("TIMEZONE: %w", err)
	}
	c.Location = loc
	return c, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func dur(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func boolean(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}
