-- +goose Up
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE channels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    accent      TEXT NOT NULL,
    scene       TEXT NOT NULL,
    sort_order  INT  NOT NULL DEFAULT 0,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE
);

-- One or two presenters per channel. persona is the cached system-prompt
-- character sheet; voice is the TTS voice id.
CREATE TABLE presenters (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    persona     TEXT NOT NULL,
    voice       TEXT NOT NULL,
    sort_order  INT  NOT NULL DEFAULT 0
);

CREATE TABLE feeds (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    outlet      TEXT NOT NULL,
    url         TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    last_ok_at  TIMESTAMPTZ,
    last_error  TEXT,
    UNIQUE (channel_id, url)
);

CREATE TABLE articles (
    id            BIGSERIAL PRIMARY KEY,
    channel_id    TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    feed_id       BIGINT REFERENCES feeds(id) ON DELETE SET NULL,
    url           TEXT NOT NULL UNIQUE,
    outlet        TEXT NOT NULL,
    headline      TEXT NOT NULL,
    summary       TEXT NOT NULL DEFAULT '',
    published_at  TIMESTAMPTZ,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding     vector(384)
);
CREATE INDEX articles_channel_recent ON articles (channel_id, published_at DESC);

CREATE TABLE clusters (
    id            BIGSERIAL PRIMARY KEY,
    channel_id    TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    article_ids   BIGINT[] NOT NULL,
    outlet_count  INT NOT NULL,
    first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding     vector(384)
);
CREATE INDEX clusters_channel_recent ON clusters (channel_id, last_seen DESC);

-- Generated segments are reusable across hours (story packages re-air).
CREATE TABLE segments (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    cluster_id  BIGINT REFERENCES clusters(id) ON DELETE SET NULL,
    script      JSONB NOT NULL,
    audio_key   TEXT,
    duration_s  DOUBLE PRECISION,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per pipeline run per channel; top_hash drives skip-if-unchanged.
CREATE TABLE runs (
    id           BIGSERIAL PRIMARY KEY,
    channel_id   TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL DEFAULT 'hourly',
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'running',
    top_hash     TEXT,
    error        TEXT
);
CREATE INDEX runs_channel_recent ON runs (channel_id, started_at DESC);

-- +goose Down
DROP TABLE runs;
DROP TABLE segments;
DROP TABLE clusters;
DROP TABLE articles;
DROP TABLE feeds;
DROP TABLE presenters;
DROP TABLE channels;
