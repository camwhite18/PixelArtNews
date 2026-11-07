-- +goose Up
-- More feeds per channel, and Weird News's first. Researched November 2026:
-- each feed was working, and each publisher's terms allow (or don't forbid)
-- non-commercial use of headlines and summaries with attribution and links.
-- Left out on purpose: TechCrunch and Fox News (terms ban modifying feed
-- content), The Independent (needs a licence), ESA (needs written permission).
-- Conditions to keep: no ads or monetisation; outlet name and link on screen
-- for every story; paraphrase headlines too; never say "according to NASA".

-- The Guardian's unprefixed section feeds redirect to an edition; pin the UK one.
UPDATE feeds SET url = 'https://www.theguardian.com/uk/technology/rss'
    WHERE url = 'https://www.theguardian.com/technology/rss';
UPDATE feeds SET url = 'https://www.theguardian.com/uk/sport/rss'
    WHERE url = 'https://www.theguardian.com/sport/rss';

INSERT INTO feeds (channel_id, outlet, url) VALUES
    -- World: non-UK perspectives
    ('world',   'Al Jazeera',          'https://www.aljazeera.com/xml/rss/all.xml'),
    ('world',   'DW',                  'https://rss.dw.com/rdf/rss-en-world'),
    ('world',   'France 24',           'https://www.france24.com/en/rss'),
    ('world',   'NPR',                 'https://feeds.npr.org/1004/rss.xml'),
    -- Tech
    ('tech',    'Ars Technica',        'https://feeds.arstechnica.com/arstechnica/index'),
    ('tech',    'The Verge',           'https://www.theverge.com/rss/index.xml'),
    ('tech',    'Sky News',            'https://feeds.skynews.com/feeds/rss/technology.xml'),
    -- Science
    ('science', 'NASA',                'https://www.nasa.gov/news-release/feed/'),
    ('science', 'ScienceDaily',        'https://www.sciencedaily.com/rss/all.xml'),
    ('science', 'Space.com',           'https://www.space.com/feeds/all'),
    -- Sport
    ('sport',   'Sky Sports',          'https://www.skysports.com/rss/12040'),
    ('sport',   'Sky Sports Football', 'https://www.skysports.com/rss/11095'),
    ('sport',   'BBC Sport Football',  'https://feeds.bbci.co.uk/sport/football/rss.xml'),
    -- Weird News. UPI's terms are strict: summaries in our own words only.
    ('weird',   'UPI Odd News',        'https://rss.upi.com/news/odd_news.rss'),
    ('weird',   'Sky News',            'https://feeds.skynews.com/feeds/rss/strange.xml'),
    ('weird',   'NPR',                 'https://feeds.npr.org/1146/rss.xml')
ON CONFLICT (channel_id, url) DO NOTHING;

-- A backup for Weird News, off until it's needed: a one-person curation blog,
-- so vet its stories more carefully.
INSERT INTO feeds (channel_id, outlet, url, enabled) VALUES
    ('weird',   'Oddity Central',      'https://www.odditycentral.com/feed', FALSE)
ON CONFLICT (channel_id, url) DO NOTHING;

-- +goose Down
DELETE FROM feeds WHERE url IN (
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.dw.com/rdf/rss-en-world',
    'https://www.france24.com/en/rss',
    'https://feeds.npr.org/1004/rss.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.skynews.com/feeds/rss/technology.xml',
    'https://www.nasa.gov/news-release/feed/',
    'https://www.sciencedaily.com/rss/all.xml',
    'https://www.space.com/feeds/all',
    'https://www.skysports.com/rss/12040',
    'https://www.skysports.com/rss/11095',
    'https://feeds.bbci.co.uk/sport/football/rss.xml',
    'https://rss.upi.com/news/odd_news.rss',
    'https://feeds.skynews.com/feeds/rss/strange.xml',
    'https://feeds.npr.org/1146/rss.xml',
    'https://www.odditycentral.com/feed'
);
UPDATE feeds SET url = 'https://www.theguardian.com/technology/rss'
    WHERE url = 'https://www.theguardian.com/uk/technology/rss';
UPDATE feeds SET url = 'https://www.theguardian.com/sport/rss'
    WHERE url = 'https://www.theguardian.com/uk/sport/rss';
