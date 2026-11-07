package pipeline

import (
	"context"
	"html"
	"regexp"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"

	"github.com/camwhite18/pixelartnews/server/internal/store"
)

var tagRE = regexp.MustCompile(`<[^>]*>`)

// cleanText strips markup and collapses whitespace in feed summaries.
func cleanText(s string) string {
	s = tagRE.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return strings.Join(strings.Fields(s), " ")
}

// Ingest fetches every enabled feed for a channel and stores new articles.
// A failing feed is logged on its row and skipped; it never fails the run.
func (p *Pipeline) Ingest(ctx context.Context, channelID string) (int, error) {
	feeds, err := p.Store.Feeds(ctx, channelID)
	if err != nil {
		return 0, err
	}
	parser := gofeed.NewParser()
	parser.UserAgent = "PixelArtNews/0.1 (+self-hosted news reader)"

	added := 0
	for _, f := range feeds {
		fctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		feed, ferr := parser.ParseURLWithContext(f.URL, fctx)
		cancel()
		_ = p.Store.MarkFeed(ctx, f.ID, ferr)
		if ferr != nil {
			p.Log.Warn("feed failed", "channel", channelID, "url", f.URL, "err", ferr)
			continue
		}
		for _, it := range feed.Items {
			if it.Link == "" || it.Title == "" {
				continue
			}
			a := store.Article{
				ChannelID:   channelID,
				FeedID:      f.ID,
				URL:         it.Link,
				Outlet:      f.Outlet,
				Headline:    cleanText(it.Title),
				Summary:     cleanText(it.Description),
				PublishedAt: it.PublishedParsed,
			}
			isNew, err := p.Store.InsertArticle(ctx, a)
			if err != nil {
				return added, err
			}
			if isNew {
				added++
			}
		}
	}
	return added, nil
}
