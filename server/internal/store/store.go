// Package store holds the Postgres connection, migrations and queries.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"

	"github.com/camwhite18/pixelartnews/server/migrations"
)

type Store struct {
	Pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	// Postgres may still be starting when the stack comes up.
	for i := 0; ; i++ {
		if err = pool.Ping(ctx); err == nil {
			break
		}
		if i == 30 {
			pool.Close()
			return nil, fmt.Errorf("postgres not reachable: %w", err)
		}
		time.Sleep(time.Second)
	}
	return &Store{Pool: pool}, nil
}

func (s *Store) Close() { s.Pool.Close() }

// Migrate applies the app's goose migrations, then River's own tables.
func (s *Store) Migrate(ctx context.Context) error {
	db := stdlib.OpenDBFromPool(s.Pool)
	defer db.Close()
	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("app migrations: %w", err)
	}

	m, err := rivermigrate.New(riverpgxv5.New(s.Pool), nil)
	if err != nil {
		return err
	}
	if _, err := m.Migrate(ctx, rivermigrate.DirectionUp, nil); err != nil {
		return fmt.Errorf("river migrations: %w", err)
	}
	return nil
}

type Channel struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Accent     string      `json:"accent"`
	Scene      string      `json:"scene"`
	Presenters []Presenter `json:"presenters"`
}

type Presenter struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Persona string `json:"-"`
	Voice   string `json:"-"`
}

// Channels returns the enabled channels with their presenters, in display order.
func (s *Store) Channels(ctx context.Context) ([]Channel, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT c.id, c.name, c.accent, c.scene, p.id, p.name, p.persona, p.voice
		FROM channels c
		LEFT JOIN presenters p ON p.channel_id = c.id
		WHERE c.enabled
		ORDER BY c.sort_order, p.sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Channel
	for rows.Next() {
		var c Channel
		var pid, pname, persona, voice *string
		if err := rows.Scan(&c.ID, &c.Name, &c.Accent, &c.Scene, &pid, &pname, &persona, &voice); err != nil {
			return nil, err
		}
		if len(out) == 0 || out[len(out)-1].ID != c.ID {
			out = append(out, c)
		}
		if pid != nil {
			last := &out[len(out)-1]
			last.Presenters = append(last.Presenters, Presenter{ID: *pid, Name: *pname, Persona: *persona, Voice: *voice})
		}
	}
	return out, rows.Err()
}

func (s *Store) Channel(ctx context.Context, id string) (Channel, error) {
	all, err := s.Channels(ctx)
	if err != nil {
		return Channel{}, err
	}
	for _, c := range all {
		if c.ID == id {
			return c, nil
		}
	}
	return Channel{}, fmt.Errorf("channel %q not found or disabled", id)
}

type Feed struct {
	ID     int64
	Outlet string
	URL    string
}

func (s *Store) Feeds(ctx context.Context, channelID string) ([]Feed, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, outlet, url FROM feeds WHERE channel_id = $1 AND enabled ORDER BY id`, channelID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Feed])
}

func (s *Store) MarkFeed(ctx context.Context, feedID int64, fetchErr error) error {
	if fetchErr != nil {
		_, err := s.Pool.Exec(ctx, `UPDATE feeds SET last_error = $2 WHERE id = $1`, feedID, fetchErr.Error())
		return err
	}
	_, err := s.Pool.Exec(ctx, `UPDATE feeds SET last_ok_at = now(), last_error = NULL WHERE id = $1`, feedID)
	return err
}

type Article struct {
	ID          int64
	ChannelID   string
	FeedID      int64
	URL         string
	Outlet      string
	Headline    string
	Summary     string
	PublishedAt *time.Time
}

// InsertArticle stores an article, ignoring URLs already seen. It reports
// whether the article was new.
func (s *Store) InsertArticle(ctx context.Context, a Article) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `
		INSERT INTO articles (channel_id, feed_id, url, outlet, headline, summary, published_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (channel_id, url) DO NOTHING`,
		a.ChannelID, a.FeedID, a.URL, a.Outlet, a.Headline, a.Summary, a.PublishedAt)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// RecentArticles returns a channel's articles published (or fetched) since t.
func (s *Store) RecentArticles(ctx context.Context, channelID string, since time.Time) ([]Article, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, channel_id, COALESCE(feed_id, 0), url, outlet, headline, summary, published_at
		FROM articles
		WHERE channel_id = $1 AND COALESCE(published_at, fetched_at) >= $2
		ORDER BY COALESCE(published_at, fetched_at) DESC
		LIMIT 200`, channelID, since)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Article])
}

func (s *Store) StartRun(ctx context.Context, channelID, kind string) (int64, error) {
	var id int64
	err := s.Pool.QueryRow(ctx, `INSERT INTO runs (channel_id, kind) VALUES ($1, $2) RETURNING id`, channelID, kind).Scan(&id)
	return id, err
}

func (s *Store) FinishRun(ctx context.Context, runID int64, status, topHash string, runErr error) error {
	var msg *string
	if runErr != nil {
		m := runErr.Error()
		msg = &m
	}
	_, err := s.Pool.Exec(ctx, `
		UPDATE runs SET finished_at = now(), status = $2, top_hash = NULLIF($3, ''), error = $4
		WHERE id = $1`, runID, status, topHash, msg)
	return err
}

// LastPublishedHash returns the top-story hash of the channel's last
// published run, or "" if there is none.
func (s *Store) LastPublishedHash(ctx context.Context, channelID string) (string, error) {
	var h *string
	err := s.Pool.QueryRow(ctx, `
		SELECT top_hash FROM runs
		WHERE channel_id = $1 AND status = 'published'
		ORDER BY started_at DESC LIMIT 1`, channelID).Scan(&h)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if h == nil {
		return "", nil
	}
	return *h, nil
}

func (s *Store) SaveSegment(ctx context.Context, id, channelID, typ string, script []byte, audioKey string, durationS float64) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO segments (id, channel_id, type, script, audio_key, duration_s)
		VALUES ($1, $2, $3, $4, $5, $6)`, id, channelID, typ, script, audioKey, durationS)
	return err
}

// NotifyPublished tells listening web servers that a channel has a new rundown.
func (s *Store) NotifyPublished(ctx context.Context, channelID string) error {
	_, err := s.Pool.Exec(ctx, `SELECT pg_notify('rundown_published', $1)`, channelID)
	return err
}
