# Pixel Art News

24/7 pixel-art news channels. AI anchors present current news curated from multiple sources, scripted by Claude and voiced by a local TTS model, self-hosted and published through a Cloudflare Tunnel.

## How it works

```
feeds ──► ingest ──► cluster ──► script (Claude) ──► voice (Kokoro) ──► publish
                                                                         │
 browser ◄── web app + /media (Go server) ◄── rundowns/{channel}/latest.json + MP3s
```

- **Virtual live.** Each channel has a *rundown*: segments with absolute UTC start times. The browser plays whatever is on air *now*, seeking into the audio, so every viewer hears the same moment. Nothing is streamed.
- **Rolling schedule.** Each hourly run queues fresh segments after the one airing and repeats them up to `SCHEDULE_HORIZON`. It never changes what is on air, and a failed run leaves the old schedule playing.
- **Skip if unchanged.** If a channel's top stories haven't changed, the run stops before calling Claude or TTS.
- **Grounding.** Claude only sees feed headlines and summaries, must cite a source id on every line, and lines citing nothing real are dropped before voicing.

## Repo layout

| Path | What |
| --- | --- |
| `server/` | Go: scheduler (River on Postgres), pipeline, HTTP server for the site, API and media |
| `server/migrations/` | Postgres schema and seed channels, presenters and feeds (goose, applied on boot) |
| `web/` | TypeScript + Preact + Vite front end; studios drawn on a 320×180 canvas |
| `tts/` | Python + FastAPI wrapper around Kokoro, plus `benchmark.py` |
| `schema/rundown.schema.json` | The rundown format shared by Go and TypeScript |
| `docker-compose.yml` | `postgres` (pgvector), `tts`, `server`, `cloudflared` |

## Running it on the server

1. **Host.** A Proxmox LXC or VM with Docker, 4 vCPUs and 8–16 GB RAM is plenty.
2. **Tunnel.** In the Cloudflare dashboard, create a tunnel, add a public hostname for your domain pointing at `http://server:8080`, and copy the tunnel token.
3. **Configure.**
   ```sh
   git clone https://github.com/camwhite18/PixelArtNews.git && cd PixelArtNews
   cp .env.example .env   # set POSTGRES_PASSWORD, ANTHROPIC_API_KEY, CLOUDFLARE_TUNNEL_TOKEN
   ```
4. **Benchmark TTS first** (decides how much fresh audio per hour this CPU can afford):
   ```sh
   docker compose build tts
   docker compose run --rm tts python benchmark.py
   ```
   You want a real-time factor of at least **1.25×** for 5 channels × 15 minutes of fresh audio an hour. If it's lower, the script says how much fits.
5. **Start.**
   ```sh
   docker compose up -d --build
   docker compose logs -f server
   ```
   The first pipeline run starts immediately. Check `http://<server>:8080` locally, then your domain.

To run one channel's pipeline by hand (forces a fresh script):

```sh
docker compose exec server /app/server run world
```

### First build: commit `go.sum`

This scaffold was written in a sandbox that couldn't reach the Go checksum database, so `go.sum` isn't committed yet and the Docker build generates it. Run `make tidy` (or `cd server && go mod tidy`) once and commit the resulting `go.sum` to pin module hashes; the Go lint and vulnerability checks need it.

## Development

### Demo build (no server needed)

`cd web && pnpm build:demo` builds the real front end into `web/dist-demo/` with five sample broadcasts bundled in, so it runs from any static host or `python3 -m http.server`. It routes on the URL hash (`#tech`) and loops each channel's sample segments on a clock shared by every viewer, like the live channels.

The sample scripts are in `web/demo/script.json` (invented stories, labelled as samples). Their audio in `web/demo/out/` is generated with Kokoro via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx); after editing a script, regenerate it with `python web/demo/generate.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin`.

### Running the stack locally

```sh
# Postgres with pgvector
docker compose up -d postgres

# Go server on :8080 (needs DATABASE_URL; ANTHROPIC_API_KEY and a running tts for real runs)
cd server && DATABASE_URL=postgres://pixelnews:<password>@localhost:5432/pixelnews?sslmode=disable \
  MEDIA_DIR=../data/media WEB_DIR=../web/dist go run ./cmd/server

# Front end with hot reload on :5173, proxying /api and /media to :8080
cd web && pnpm install && pnpm dev
```

Postgres isn't published to the host by default; add `ports: ["127.0.0.1:5432:5432"]` to the `postgres` service for local development.

Checks (CI runs all of these on every push and pull request, in `.github/workflows/ci.yml`):

| Check | What | Run locally |
| --- | --- | --- |
| Web lint | ESLint with the Airbnb style ([eslint-config-airbnb-extended](https://www.npmjs.com/package/eslint-config-airbnb-extended)); also the formatter (`pnpm format`) | `make lint-web` |
| Go lint | golangci-lint v2, configured in `server/.golangci.yml` | `make lint-go` |
| Tests | Vitest, `go test`, pytest | `make test` |
| Go vulnerabilities | govulncheck: known vulnerabilities in code paths the server actually calls | `make govulncheck` |
| Filesystem scan | `trivy fs`: vulnerable dependencies in every lockfile, committed secrets, Dockerfile and Compose misconfigurations (HIGH and CRITICAL, fixed upstream) | `make trivy` |

`make check` runs everything. The Go and Trivy targets run in Docker, so the server only needs Docker and pnpm.

The web app stays on TypeScript 6 because typescript-eslint doesn't support TypeScript 7 yet.

After changing `schema/rundown.schema.json`, run `pnpm gen:types` in `web/` and update the Go structs in `server/internal/rundown`; a Go test fails if they drift.

## Content and legal notes

- Only RSS headlines and summaries are used; anchors paraphrase and link back to the outlets.
- Check each feed's terms before relying on it. Weird News has no starter feeds yet.
- The site labels itself as AI-generated and not a news organisation.

## Not built yet

- Breaking-news check every 15 minutes (`BREAKING_INTERVAL` is reserved for it)
- Haiku "links" and filler between segments, and a model-based fact and tone check
- Embedding-based clustering with pgvector (the column exists; clustering currently uses headline overlap)
- Admin page behind Cloudflare Access
