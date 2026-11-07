# Pixel Art News: notes for Claude

Self-hosted 24/7 pixel-art AI news channels. See README.md for the architecture.

## Layout
- `server/` Go 1.27: `cmd/server` entrypoint; `internal/pipeline` (ingest → cluster → script → voice → publish), `internal/jobs` (River queue), `internal/httpapi`, `internal/store` (pgx), `internal/rundown` (schedule format and `Extend`/`ExtendBlocks`), `internal/shifts` (presenter timetable).
- `web/` Preact + Vite + TypeScript. Studios are canvas drawings in `src/scenes/data.ts` (set and desk layers plus seats); presenters are sprites built from their `look` in `src/scenes/presenters.ts`. `src/team.ts` picks who's on set. Overlays are HTML/CSS sized in container units (`cqw`).
- `tts/` FastAPI + Kokoro. `/synthesize` takes lines with voices and returns one MP3, its duration and per-line start offsets.
- `schema/rundown.schema.json` is the source of truth for the rundown format.

## Rules
- Never change the segment currently on air; schedule changes go through `rundown.Extend`.
- Every scripted line must cite supplied source ids; keep `pipeline.Ground` in the path.
- Rundown changes: edit the schema, run `pnpm gen:types` in `web/`, update Go structs; `go test ./internal/rundown` checks they match.
- Keep TTS single-threaded (CPU-bound home server); River runs one channel at a time.
- Secrets live in `.env` on the server only.

## Checks
- `cd server && go vet ./... && go test ./... && golangci-lint run ./...` (config: `server/.golangci.yml`)
- `cd web && pnpm lint && pnpm test && pnpm build` (ESLint with Airbnb style; `pnpm format` fixes style)
- `cd tts && pytest`
- Security: `make govulncheck` and `make trivy` (`trivy fs`); CI runs both
- Web stays on TypeScript 6 until typescript-eslint supports TS 7.
