package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPA(t *testing.T) {
	fsys := fstest.MapFS{
		"index.html":         {Data: []byte("<!doctype html>app")},
		"favicon.ico":        {Data: []byte("\x00\x00\x01\x00icon")},
		"assets/index-1.js":  {Data: []byte("console.log(1)")},
		"assets/index-1.css": {Data: []byte("body{}")},
	}
	h := spa(fsys)

	cases := []struct {
		path   string
		status int
		body   string // substring the body must contain
		cache  string // expected Cache-Control, "" for none
	}{
		{"/", http.StatusOK, "app", ""},
		{"/ch/world", http.StatusOK, "app", ""},
		{"/text/101", http.StatusOK, "app", ""},
		{"/favicon.ico", http.StatusOK, "icon", ""},
		{"/assets/index-1.js", http.StatusOK, "console.log", "public, max-age=31536000, immutable"},
		// Missing files must not get index.html: a CDN would cache the HTML
		// under the file's URL (this happened to /favicon.ico).
		{"/missing.png", http.StatusNotFound, "404", "no-store"},
		{"/assets/index-old.js", http.StatusNotFound, "404", "no-store"},
		{"/apple-touch-icon-precomposed.png", http.StatusNotFound, "404", "no-store"},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tc.path, nil))
			if rec.Code != tc.status {
				t.Fatalf("status %d, want %d", rec.Code, tc.status)
			}
			if !strings.Contains(rec.Body.String(), tc.body) {
				t.Fatalf("body %q does not contain %q", rec.Body.String(), tc.body)
			}
			if got := rec.Header().Get("Cache-Control"); got != tc.cache {
				t.Fatalf("Cache-Control %q, want %q", got, tc.cache)
			}
		})
	}
}
