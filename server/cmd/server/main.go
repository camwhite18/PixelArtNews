// Command server runs the Pixel Art News pipeline scheduler and web server.
//
// Subcommands:
//
//	server            run migrations, the job queue and the HTTP server
//	server run <ch>   run the pipeline once for a channel and exit (debugging)
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/camwhite18/pixelartnews/server/internal/config"
	"github.com/camwhite18/pixelartnews/server/internal/httpapi"
	"github.com/camwhite18/pixelartnews/server/internal/jobs"
	"github.com/camwhite18/pixelartnews/server/internal/pipeline"
	"github.com/camwhite18/pixelartnews/server/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		return err
	}
	pipe := pipeline.New(cfg, st, log)
	if pipe.Claude == nil {
		log.Warn("ANTHROPIC_API_KEY not set: pipeline runs will fail at the script step")
	}

	if len(os.Args) == 3 && os.Args[1] == "run" {
		status, err := pipe.Run(ctx, os.Args[2], true)
		log.Info("one-off run", "channel", os.Args[2], "status", status)
		return err
	}

	queue, err := jobs.NewClient(cfg, st, pipe, log)
	if err != nil {
		return err
	}
	if err := queue.Start(ctx); err != nil {
		return err
	}

	api := &httpapi.Server{Store: st, WebDir: cfg.WebDir, MediaDir: cfg.MediaDir, Log: log}
	go api.Listen(ctx)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
		_ = queue.Stop(shutdown)
	}()

	log.Info("listening", "addr", cfg.HTTPAddr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
