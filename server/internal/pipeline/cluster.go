package pipeline

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/camwhite18/pixelartnews/server/internal/store"
)

// Cluster is one story as reported by one or more outlets.
type Cluster struct {
	Articles []store.Article
	Outlets  map[string]bool
	Latest   time.Time
}

// Lead is the article used to name the story.
func (c Cluster) Lead() store.Article { return c.Articles[0] }

var stopwords = map[string]bool{
	"the": true, "a": true, "an": true, "and": true, "or": true, "of": true, "to": true, "in": true,
	"on": true, "for": true, "with": true, "at": true, "by": true, "from": true, "as": true, "is": true,
	"are": true, "was": true, "be": true, "after": true, "over": true, "into": true, "its": true,
	"it": true, "says": true, "say": true, "new": true, "how": true, "why": true, "what": true,
}

func tokens(s string) map[string]bool {
	out := map[string]bool{}
	for _, w := range strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}) {
		if len(w) > 2 && !stopwords[w] {
			out[w] = true
		}
	}
	return out
}

func jaccard(a, b map[string]bool) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	inter := 0
	for w := range a {
		if b[w] {
			inter++
		}
	}
	return float64(inter) / float64(len(a)+len(b)-inter)
}

// ClusterArticles groups articles about the same story by headline overlap
// and ranks clusters by how many outlets carry them, then by recency.
//
// This is the dependency-free first pass. Embedding similarity with pgvector
// (or a Claude Haiku grouping call) can replace it without changing callers.
func ClusterArticles(articles []store.Article, threshold float64) []Cluster {
	type entry struct {
		c   Cluster
		tok map[string]bool
	}
	var clusters []*entry
	for _, a := range articles {
		at := tokens(a.Headline + " " + a.Summary)
		var best *entry
		bestScore := threshold
		for _, e := range clusters {
			if s := jaccard(at, e.tok); s >= bestScore {
				best, bestScore = e, s
			}
		}
		t := time.Time{}
		if a.PublishedAt != nil {
			t = *a.PublishedAt
		}
		if best == nil {
			clusters = append(clusters, &entry{
				c:   Cluster{Articles: []store.Article{a}, Outlets: map[string]bool{a.Outlet: true}, Latest: t},
				tok: at,
			})
			continue
		}
		best.c.Articles = append(best.c.Articles, a)
		best.c.Outlets[a.Outlet] = true
		if t.After(best.c.Latest) {
			best.c.Latest = t
		}
		for w := range at {
			best.tok[w] = true
		}
	}

	out := make([]Cluster, len(clusters))
	for i, e := range clusters {
		out[i] = e.c
	}
	sort.SliceStable(out, func(i, j int) bool {
		if len(out[i].Outlets) != len(out[j].Outlets) {
			return len(out[i].Outlets) > len(out[j].Outlets)
		}
		return out[i].Latest.After(out[j].Latest)
	})
	return out
}

// TopHash fingerprints the top n stories so an unchanged channel can skip
// the LLM and TTS steps.
func TopHash(clusters []Cluster, n int) string {
	if len(clusters) < n {
		n = len(clusters)
	}
	var urls []string
	for _, c := range clusters[:n] {
		urls = append(urls, c.Lead().URL)
	}
	sum := sha256.Sum256([]byte(strings.Join(urls, "\n")))
	return hex.EncodeToString(sum[:8])
}
