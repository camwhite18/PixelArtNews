-- +goose Up
-- Starter channels, presenters and feeds. Voice ids are Kokoro voices; check
-- each feed's terms of use before relying on it.
INSERT INTO channels (id, name, accent, scene, sort_order) VALUES
    ('world',   'WORLD',      '#4aa3ff', 'world',   1),
    ('tech',    'TECH',       '#3fe0b0', 'tech',    2),
    ('science', 'SCIENCE',    '#b48cff', 'science', 3),
    ('sport',   'SPORT',      '#ffb03b', 'sport',   4),
    ('weird',   'WEIRD NEWS', '#ff6fcf', 'weird',   5);

INSERT INTO presenters (id, channel_id, name, persona, voice, sort_order) VALUES
    ('margot', 'world',   'Margot Lane',     'Calm, authoritative world-news anchor. Clear and measured; lets co-host Kofi add context.', 'bf_emma', 1),
    ('kofi',   'world',   'Kofi Mensah',     'Warm foreign-affairs correspondent. Explains why a story matters; asks Margot sharp follow-ups.', 'am_michael', 2),
    ('ray',    'tech',    'Ray Byte',        'Enthusiastic but sceptical tech presenter. Explains jargon in one line, calls out hype.', 'am_adam', 1),
    ('ada',    'science', 'Prof. Ada Quark', 'Delighted, precise science explainer. Loves a good analogy; flags when results are preliminary.', 'bf_isabella', 1),
    ('dee',    'sport',   'Dee Striker',     'Former player turned pundit. Energetic, tactical, quick with a stat from the supplied sources.', 'af_bella', 1),
    ('gus',    'sport',   'Gus Ginger',      'Dry, witty sports anchor. Sets up Dee and keeps the round-up moving.', 'bm_george', 2),
    ('rex',    'weird',   'Rex Fizz',        'Over-excited host of the strange. Treats every odd story as the scoop of the century.', 'am_puck', 1),
    ('zorp',   'weird',   'Zorp',            'Alien co-host baffled by human customs. Deadpan, literal, occasionally profound.', 'am_echo', 2);

INSERT INTO feeds (channel_id, outlet, url) VALUES
    ('world',   'BBC News',     'https://feeds.bbci.co.uk/news/world/rss.xml'),
    ('world',   'The Guardian', 'https://www.theguardian.com/world/rss'),
    ('tech',    'BBC News',     'https://feeds.bbci.co.uk/news/technology/rss.xml'),
    ('tech',    'The Guardian', 'https://www.theguardian.com/technology/rss'),
    ('science', 'BBC News',     'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'),
    ('science', 'The Guardian', 'https://www.theguardian.com/science/rss'),
    ('sport',   'BBC Sport',    'https://feeds.bbci.co.uk/sport/rss.xml'),
    ('sport',   'The Guardian', 'https://www.theguardian.com/sport/rss');
-- Weird News has no starter feeds yet: add some once their terms are checked.

-- +goose Down
DELETE FROM feeds;
DELETE FROM presenters;
DELETE FROM channels;
