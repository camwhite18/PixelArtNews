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

	// WeatherChannel gets a weather segment at breakfast (Open-Meteo).
	WeatherChannel string
	WeatherURL     string

	// Studio boards: the football table needs a free football-data.org key;
	// without one the board stays decorative. F1 standings need no key.
	FootballDataKey     string
	FootballDataURL     string
	FootballCompetition string
	JolpicaURL          string
	BoardsTTL           time.Duration
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

		WeatherChannel: env("WEATHER_CHANNEL", "world"),
		WeatherURL:     env("WEATHER_URL", "https://api.open-meteo.com/v1/forecast"),

		FootballDataKey:     os.Getenv("FOOTBALL_DATA_KEY"),
		FootballDataURL:     env("FOOTBALL_DATA_URL", "https://api.football-data.org"),
		FootballCompetition: env("FOOTBALL_COMPETITION", "PL"),
		JolpicaURL:          env("JOLPICA_URL", "https://api.jolpi.ca"),
		BoardsTTL:           dur("BOARDS_TTL", 3*time.Hour),
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
