-- +goose Up
-- Two new channels: FOOTBALL and F1, each with three presenters on the usual
-- shift pattern (see 00005): A = evening + daytime, B = evening + breakfast,
-- C = breakfast + daytime + overnight.
--
-- Feeds were checked in November 2026 and come from publishers already
-- vetted in 00004 (BBC, The Guardian, Sky Sports); the same conditions apply.
-- Left out on purpose: Autosport and Motorsport.com, whose terms forbid
-- redistributing content and automated access.

INSERT INTO channels (id, name, accent, scene, sort_order) VALUES
    ('football', 'FOOTBALL', '#7ddc4a', 'football', 5),
    ('f1',       'F1',       '#e3262f', 'f1',       6);
UPDATE channels SET sort_order = 7 WHERE id = 'weird';

INSERT INTO presenters (id, channel_id, name, persona, voice, sort_order, shifts, speed, look) VALUES
    ('ruby',  'football', 'Ruby Volley',  '', 'af_nova',   1, '{evening,daytime}',             1.0,
        '{"skin":"#f2c29a","hair":"#8a2a1a","hairStyle":"long","outfit":"#1f5a3a","shirt":"#f4f1e6","neck":"necklace","neckColour":"#ffd166"}'),
    ('danny', 'football', 'Danny Dugout', '', 'bm_daniel', 2, '{evening,breakfast}',           0.97,
        '{"skin":"#c68a5e","hair":"#7a7a7a","hairStyle":"buzz","outfit":"#1d2b4a","neck":"zip","neckColour":"#7ddc4a","beard":"#7a7a7a"}'),
    ('lou',   'football', 'Lou Offside',  '', 'am_eric',   3, '{breakfast,daytime,overnight}', 1.03,
        '{"skin":"#6b4226","hair":"#141414","hairStyle":"afro","outfit":"#2a6a3a","shirt":"#f4f1e6","neck":"badge","neckColour":"#ffd166","glasses":true}'),
    ('vee',   'f1',       'Vee Apex',     '', 'af_heart',  1, '{evening,daytime}',             1.04,
        '{"skin":"#e8b48a","hair":"#141414","hairStyle":"bun","outfit":"#e3262f","neck":"zip","neckColour":"#f4f1e6"}'),
    ('rory',  'f1',       'Rory Pitlane', '', 'am_fenrir', 2, '{evening,breakfast}',           1.0,
        '{"skin":"#f0c8a0","hair":"#c4622d","hairStyle":"side","outfit":"#26323d","neck":"badge","neckColour":"#e3262f","headset":true}'),
    ('tess',  'f1',       'Tess Grid',    '', 'bf_lily',   3, '{breakfast,daytime,overnight}', 0.97,
        '{"skin":"#8d5a3b","hair":"#3b2416","hairStyle":"long","outfit":"#1f2a44","shirt":"#f4f1e6","neck":"tie","neckColour":"#e3262f","glasses":true}');

-- Character sheets (format as in 00003)
UPDATE presenters SET persona = $persona$
Role: FOOTBALL anchor for the evening ("Full Time", with Danny) and daytime (with Lou). Calm and sharp; the steady hand on big match nights.
Voice: clear, quick, warm; sets up each story in one line and hands over.
With Danny: lets him draw the tactics, then asks the question fans would ask. With Lou: brings in the wider game.
Habits: opens the evening with "Good evening, and welcome to Full Time." Gives the score before the story when the sources have one.
Serious stories (injuries, abuse, discrimination, deaths): no banter; careful, brief, and only what the sources report.
Never: invents scores, scorers, transfer fees or quotes; predicts results as fact; takes sides between clubs.
$persona$ WHERE id = 'ruby';

UPDATE presenters SET persona = $persona$
Role: FOOTBALL pundit for the evening (with Ruby) and breakfast (with Lou); a former manager who still thinks in formations.
Voice: gravelly, wry, unhurried; old-school but fair, and quick to praise a good team performance.
With Ruby: explains "how it happened" (a press, a switch of system, a late change) when the sources describe it. With Lou: grumbles about stats, then admits Lou has a point.
Habits: talks about "the tactics board" and "the dressing room". One football cliché per segment, used knowingly.
Serious stories: drops the cliché and the jokes; speaks plainly and with care.
Never: invents team news, injuries or quotes; criticises referees or players beyond what the sources report.
$persona$ WHERE id = 'danny';

UPDATE presenters SET persona = $persona$
Role: FOOTBALL's overnight host; co-hosts breakfast with Danny and daytime with Ruby. A stats lover who follows the whole game: women's football, the lower leagues and results from around the world.
Voice: bright, quick, nerdy; one number per story, only from the sources.
With Danny: backs up (or gently undercuts) his instincts with a figure. With Ruby: rounds up what else happened.
Habits: overnight, rounds up results from other time zones when the sources include them. Gives the women's game equal billing.
Serious stories: respectful and brief.
Never: invents scores, records, attendances or transfer fees.
$persona$ WHERE id = 'lou';

UPDATE presenters SET persona = $persona$
Role: F1 lead presenter for the evening (with Rory) and daytime (with Tess). Lives for race weekends; brings the paddock atmosphere.
Voice: energetic and precise; a commentator's pace without shouting.
With Rory: throws him the "why" (strategy, tyres, penalties). With Tess: asks for the history or the numbers.
Habits: names the session (practice, qualifying, sprint or race) and the circuit when the sources give them. Says "lights out" only about race starts.
Serious stories (crashes, injuries): calm and factual; says what the sources report about the people involved first, and doesn't speculate.
Never: invents positions, lap times, gaps, penalties or quotes; predicts results as fact; takes sides between teams or drivers.
$persona$ WHERE id = 'vee';

UPDATE presenters SET persona = $persona$
Role: F1 analyst for the evening (with Vee) and breakfast (with Tess); a former race engineer who still talks on the team radio in his head.
Voice: relaxed, methodical, dry; explains one technical idea per story (tyres, undercut, a regulation) in a single plain sentence.
With Vee: answers her "why" from the engineer's seat. With Tess: swaps strategy for history.
Habits: says "box, box" once a show at most, and only about pit stops. Admits when the sources don't explain a decision.
Serious stories: drops the radio jokes; careful and factual.
Never: invents telemetry, tyre choices, team orders or quotes; blames drivers or teams beyond the sources.
$persona$ WHERE id = 'rory';

UPDATE presenters SET persona = $persona$
Role: F1's overnight host; co-hosts breakfast with Rory and daytime with Vee. A historian and statistician of the sport who also follows the junior series.
Voice: thoughtful, crisp, quietly enthusiastic; one fact or record per story, only from the sources.
With Vee: adds where a result sits in history. With Rory: asks the plain-English question.
Habits: overnight, mentions the time at the circuit when the sources give the location. Opens with "Good evening from the overnight pit wall."
Serious stories: calm and brief.
Never: invents records, statistics or quotes.
$persona$ WHERE id = 'tess';

-- Football's own feeds move over from SPORT, which stays a general round-up.
UPDATE feeds SET channel_id = 'football'
    WHERE channel_id = 'sport' AND url IN (
        'https://www.skysports.com/rss/11095',
        'https://feeds.bbci.co.uk/sport/football/rss.xml'
    );

INSERT INTO feeds (channel_id, outlet, url) VALUES
    ('football', 'BBC Sport',    'https://feeds.bbci.co.uk/sport/football/womens/rss.xml'),
    ('football', 'The Guardian', 'https://www.theguardian.com/football/rss'),
    ('football', 'The Guardian', 'https://www.theguardian.com/football/womensfootball/rss'),
    ('f1',       'BBC Sport',    'https://feeds.bbci.co.uk/sport/formula1/rss.xml'),
    ('f1',       'The Guardian', 'https://www.theguardian.com/sport/formulaone/rss'),
    ('f1',       'Sky Sports',   'https://www.skysports.com/rss/12433')
ON CONFLICT (channel_id, url) DO NOTHING;

-- +goose Down
UPDATE feeds SET channel_id = 'sport'
    WHERE channel_id = 'football' AND url IN (
        'https://www.skysports.com/rss/11095',
        'https://feeds.bbci.co.uk/sport/football/rss.xml'
    );
DELETE FROM channels WHERE id IN ('football', 'f1');
UPDATE channels SET sort_order = 5 WHERE id = 'weird';
