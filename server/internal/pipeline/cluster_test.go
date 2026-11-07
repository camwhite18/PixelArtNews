package pipeline

import (
	"testing"
	"time"

	"github.com/camwhite18/pixelartnews/server/internal/store"
)

func art(outlet, headline string, mins int) store.Article {
	t := time.Date(2026, 11, 7, 12, mins, 0, 0, time.UTC)
	return store.Article{URL: "https://" + outlet + "/" + headline, Outlet: outlet, Headline: headline, PublishedAt: &t}
}

func TestClusterGroupsSameStoryAcrossOutlets(t *testing.T) {
	got := ClusterArticles([]store.Article{
		art("bbc", "Leaders agree climate deal at Geneva summit", 1),
		art("guardian", "Geneva summit: leaders agree climate deal after late talks", 2),
		art("bbc", "Local bakery wins national bread award", 3),
	}, 0.3)
	if len(got) != 2 {
		t.Fatalf("expected 2 clusters, got %d", len(got))
	}
	if len(got[0].Outlets) != 2 {
		t.Fatalf("the two-outlet story should rank first, got %+v", got[0].Lead().Headline)
	}
}

func TestTopHashChangesWithStories(t *testing.T) {
	a := ClusterArticles([]store.Article{art("bbc", "Story one about rockets", 1)}, 0.3)
	b := ClusterArticles([]store.Article{art("bbc", "Story two about bread", 1)}, 0.3)
	if TopHash(a, 5) == TopHash(b, 5) {
		t.Fatal("different top stories should hash differently")
	}
	again := ClusterArticles([]store.Article{art("bbc", "Story one about rockets", 1)}, 0.3)
	if TopHash(a, 5) != TopHash(again, 5) {
		t.Fatal("the same stories should hash the same")
	}
}

func TestCleanText(t *testing.T) {
	if got := cleanText("<p>Hello &amp; <b>welcome</b>\n  back</p>"); got != "Hello & welcome back" {
		t.Fatalf("got %q", got)
	}
}
