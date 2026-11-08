# Pixel Art News: notes for Claude

Self-hosted 24/7 pixel-art AI news channels. See README.md for the architecture.

## Layout
- `server/` Go 1.27: `cmd/server` entrypoint; `internal/pipeline` (ingest → cluster → script → voice → publish), `internal/jobs` (River queue), `internal/httpapi`, `internal/store` (pgx), `internal/rundown` (schedule format and `Extend`/`ExtendBlocks`), `internal/shifts` (presenter timetable).
- `web/` Preact + Vite + TypeScript. Studios are 320x180 canvas drawings in `src/scenes/data.ts` (set and desk layers plus seats); each show (shift) dresses them differently in `src/scenes/shows.ts` (sky, screen art, lighting), using helpers in `src/scenes/draw.ts`. Newer studios keep their set and shows together in one file (`football.ts`, `f1.ts`). Camera shots (`camera.ts`), real-time wall clocks (`clocks.ts`), seasonal dressing (`seasons.ts`), story art (`art.ts`), the weather map (`weathermap.ts`), idents and stings (`ident.ts`) and real board data (each studio's `board`) are layered on in `render.ts`. Presenters are sprites built from their `look` in `src/scenes/presenters.ts`. `src/team.ts` picks who's on set and which show. Overlays are HTML/CSS on the studio's pixel grid (`--px` = one studio pixel).
- Fonts are the bitmap fonts Tiny5 and Press Start 2P, bundled via `@fontsource`. Keep text at multiples of 8px (canvas text goes through `bitmapText` in `render.ts`) or it blurs; the fonts have no arrow glyphs, so use `PixelIcon`.
- `tts/` FastAPI + Kokoro. `/synthesize` takes lines with voices (and optionally a channel jingle, `jingle.py`) and returns one MP3, its duration, per-line start offsets and the jingle's length.
- Data for the screens: `internal/weather` (Open-Meteo, CC BY 4.0, credited on air) and `internal/boards` (football-data.org table, which needs `FOOTBALL_DATA_KEY` and its credit line; Jolpica-F1 standings). Boards are written to `/media/boards/<channel>.json`.
- Story art icons: the list lives in the schema's `art` enum; `rundown.ArtIcons` and `web/src/scenes/art.ts` must match it (tests check both).
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
