// Package httpapi serves the web app, media files, channel list and a
// server-sent events stream of newly published rundowns.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/camwhite18/pixelartnews/server/internal/store"
)

type Server struct {
	Store    *store.Store
	WebDir   string
	MediaDir string
	Log      *slog.Logger

	mu   sync.Mutex
	subs map[chan string]struct{}
}

// Handler builds the routes. Static files are served through os.Root, so a
// request path can never reach outside WEB_DIR or MEDIA_DIR (including via
// symlinks).
func (s *Server) Handler() (http.Handler, error) {
	if err := os.MkdirAll(s.MediaDir, 0o750); err != nil {
		return nil, err
	}
	media, err := os.OpenRoot(s.MediaDir)
	if err != nil {
		return nil, fmt.Errorf("media dir: %w", err)
	}
	web, err := os.OpenRoot(s.WebDir)
	if err != nil {
		return nil, fmt.Errorf("web dir: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/time", s.handleTime)
	mux.HandleFunc("GET /api/channels", s.handleChannels)
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.Handle("GET /media/", http.StripPrefix("/media/", mediaCache(media.FS())))
	mux.Handle("GET /", spa(web.FS()))
	return mux, nil
}

// handleTime lets clients correct their clock; the Date header is too coarse
// for sub-second sync on its own.
func (s *Server) handleTime(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, map[string]int64{"nowMs": time.Now().UnixMilli()})
}

func (s *Server) handleChannels(w http.ResponseWriter, r *http.Request) {
	chs, err := s.Store.Channels(r.Context())
	if err != nil {
		s.Log.Error("channels", "err", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, chs)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// mediaCache sets cache headers: segment audio and versioned rundowns never
// change, so the Cloudflare edge can keep them; latest.json must stay fresh.
// Missing files are never marked immutable, so a 404 (say, for a channel that
// has not published yet) is not pinned at the edge.
func mediaCache(fsys fs.FS) http.Handler {
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "latest.json"):
			w.Header().Set("Cache-Control", "no-cache")
		case isFile(fsys, r.URL.Path):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		default:
			w.Header().Set("Cache-Control", "no-store")
		}
		files.ServeHTTP(w, r)
	})
}

// fsName turns a URL path into an fs.FS name ("/a/../b" -> "b", "/" -> ".").
func fsName(urlPath string) string {
	name := strings.TrimPrefix(path.Clean("/"+urlPath), "/")
	if name == "" {
		return "."
	}
	return name
}

func isFile(fsys fs.FS, urlPath string) bool {
	fi, err := fs.Stat(fsys, fsName(urlPath))
	return err == nil && !fi.IsDir()
}

// spa serves the built front end, falling back to index.html for app routes.
func spa(fsys fs.FS) http.Handler {
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(fsys, fsName(r.URL.Path)); errors.Is(err, fs.ErrNotExist) {
			http.ServeFileFS(w, r, fsys, "index.html")
			return
		}
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}

// handleEvents streams channel ids as their rundowns are republished.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan string, 8)
	s.mu.Lock()
	if s.subs == nil {
		s.subs = map[chan string]struct{}{}
	}
	s.subs[ch] = struct{}{}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.subs, ch)
		s.mu.Unlock()
	}()

	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()
	keepalive := time.NewTicker(25 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			fmt.Fprint(w, ": ping\n\n")
		case id := <-ch:
			fmt.Fprintf(w, "event: rundown\ndata: %s\n\n", id)
		}
		flusher.Flush()
	}
}

func (s *Server) broadcast(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.subs {
		select {
		case ch <- id:
		default: // slow client: it will pick up the change on its next poll
		}
	}
}

// Listen relays Postgres NOTIFY rundown_published to SSE clients until ctx ends.
func (s *Server) Listen(ctx context.Context) {
	for ctx.Err() == nil {
		if err := s.listenOnce(ctx); err != nil && ctx.Err() == nil {
			s.Log.Warn("listen interrupted, retrying", "err", err)
			time.Sleep(3 * time.Second)
		}
	}
}

func (s *Server) listenOnce(ctx context.Context) error {
	conn, err := s.Store.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "LISTEN rundown_published"); err != nil {
		return err
	}
	for {
		n, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return err
		}
		s.broadcast(n.Payload)
	}
}
