// Package jobs schedules pipeline runs on the River queue (backed by Postgres).
package jobs

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"github.com/camwhite18/pixelartnews/server/internal/config"
	"github.com/camwhite18/pixelartnews/server/internal/pipeline"
	"github.com/camwhite18/pixelartnews/server/internal/store"
)

// TickArgs fans out one pipeline job per enabled channel.
type TickArgs struct {
	Force bool `json:"force"`
}

func (TickArgs) Kind() string { return "tick" }

// ChannelArgs runs the pipeline for one channel.
type ChannelArgs struct {
	ChannelID string `json:"channel_id"`
	Force     bool   `json:"force"`
}

func (ChannelArgs) Kind() string { return "channel_pipeline" }

func (ChannelArgs) InsertOpts() river.InsertOpts {
	// Script + TTS failures are worth a few retries, not dozens.
	return river.InsertOpts{MaxAttempts: 4}
}

type tickWorker struct {
	river.WorkerDefaults[TickArgs]
	store *store.Store
}

func (w *tickWorker) Work(ctx context.Context, job *river.Job[TickArgs]) error {
	chs, err := w.store.Channels(ctx)
	if err != nil {
		return err
	}
	client, err := river.ClientFromContextSafely[pgx.Tx](ctx)
	if err != nil {
		return err
	}
	for _, ch := range chs {
		if _, err := client.Insert(ctx, ChannelArgs{ChannelID: ch.ID, Force: job.Args.Force}, nil); err != nil {
			return fmt.Errorf("enqueue %s: %w", ch.ID, err)
		}
	}
	return nil
}

type channelWorker struct {
	river.WorkerDefaults[ChannelArgs]
	pipe *pipeline.Pipeline
}

func (w *channelWorker) Work(ctx context.Context, job *river.Job[ChannelArgs]) error {
	status, err := w.pipe.Run(ctx, job.Args.ChannelID, job.Args.Force)
	w.pipe.Log.Info("pipeline run", "channel", job.Args.ChannelID, "status", status, "attempt", job.Attempt, "err", err)
	return err
}

// NewClient builds the River client with the hourly schedule. Breaking-news
// checks (every BREAKING_INTERVAL) are not wired up yet.
func NewClient(cfg config.Config, st *store.Store, pipe *pipeline.Pipeline, log *slog.Logger) (*river.Client[pgx.Tx], error) {
	workers := river.NewWorkers()
	river.AddWorker(workers, &tickWorker{store: st})
	river.AddWorker(workers, &channelWorker{pipe: pipe})

	periodic := []*river.PeriodicJob{
		river.NewPeriodicJob(
			river.PeriodicInterval(cfg.PipelineInterval),
			func() (river.JobArgs, *river.InsertOpts) { return TickArgs{}, nil },
			&river.PeriodicJobOpts{RunOnStart: cfg.RunOnStart},
		),
	}

	return river.NewClient(riverpgxv5.New(st.Pool), &river.Config{
		Logger: log,
		// TTS is CPU-bound on the home server: one channel at a time.
		Queues:       map[string]river.QueueConfig{river.QueueDefault: {MaxWorkers: 1}},
		Workers:      workers,
		PeriodicJobs: periodic,
	})
}
