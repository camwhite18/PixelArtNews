-- +goose Up
-- Presenter shifts, like a real news channel. Every channel has three
-- presenters and the same daily timetable (internal/shifts):
--   breakfast 06:00, daytime 10:00, evening 17:00, overnight 23:00 (local).
-- Pattern for presenters A, B, C: evening is the flagship pair A+B,
-- breakfast B+C, daytime A+C, and C hosts overnight alone.
--
-- speed is each presenter's speaking pace (1 = Kokoro's default).
-- look describes their pixel-art sprite; the web app draws it.

ALTER TABLE presenters
    ADD COLUMN shifts TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN speed  REAL   NOT NULL DEFAULT 1.0,
    ADD COLUMN look   JSONB  NOT NULL DEFAULT '{}';

INSERT INTO presenters (id, channel_id, name, persona, voice, sort_order) VALUES
    ('tom',  'world',   'Tom Hale',   '', 'bm_fable',  3),
    ('nina', 'tech',    'Nina Patch', '', 'af_nicole', 2),
    ('leo',  'tech',    'Leo Kernel', '', 'am_liam',   3),
    ('mina', 'science', 'Mina Fields','', 'af_kore',   2),
    ('sam',  'science', 'Dr Sam Orbit','', 'bm_lewis', 3),
    ('jas',  'sport',   'Jas Kaur',   '', 'af_sarah',  3),
    ('mags', 'weird',   'Mags Moth',  '', 'af_aoede',  3);

-- Shifts
UPDATE presenters SET shifts = '{evening,daytime}'           WHERE id IN ('margot', 'ray', 'ada', 'dee', 'rex');
UPDATE presenters SET shifts = '{evening,breakfast}'         WHERE id IN ('kofi', 'nina', 'mina', 'gus', 'zorp');
UPDATE presenters SET shifts = '{breakfast,daytime,overnight}' WHERE id IN ('tom', 'leo', 'sam', 'jas', 'mags');

-- Pace
UPDATE presenters SET speed = 0.96 WHERE id IN ('margot', 'sam');
UPDATE presenters SET speed = 0.97 WHERE id IN ('tom', 'mags');
UPDATE presenters SET speed = 1.03 WHERE id IN ('ray', 'dee', 'jas');
UPDATE presenters SET speed = 1.06 WHERE id = 'rex';
UPDATE presenters SET speed = 0.92 WHERE id = 'zorp';

-- Looks (the original eight match the studio mockups)
UPDATE presenters SET look = '{"skin":"#e8b48a","hair":"#2b1a10","hairStyle":"long","outfit":"#b03a48","shirt":"#f4f1e6","neck":"necklace","neckColour":"#ffd166"}' WHERE id = 'margot';
UPDATE presenters SET look = '{"skin":"#8d5a3b","hair":"#141414","hairStyle":"short","outfit":"#1d2b4a","shirt":"#f4f1e6","neck":"tie","neckColour":"#4aa3ff","glasses":true}' WHERE id = 'kofi';
UPDATE presenters SET look = '{"skin":"#f0c8a0","hair":"#7a4a22","hairStyle":"short","outfit":"#2b3e5c","shirt":"#f4f1e6","neck":"tie","neckColour":"#b03a48"}' WHERE id = 'tom';
UPDATE presenters SET look = '{"skin":"#c68a5e","hair":"#8a5cf5","hairStyle":"side","outfit":"#26323d","neck":"strings","neckColour":"#f4f1e6","headset":true}' WHERE id = 'ray';
UPDATE presenters SET look = '{"skin":"#6b4226","hair":"#141414","hairStyle":"bun","outfit":"#5a3f8c","shirt":"#f4f1e6"}' WHERE id = 'nina';
UPDATE presenters SET look = '{"skin":"#e8b48a","hair":"#e0c060","hairStyle":"short","outfit":"#3a3756","neck":"strings","neckColour":"#3fe0b0","glasses":true}' WHERE id = 'leo';
UPDATE presenters SET look = '{"skin":"#f0c8a0","hair":"#c9c9c9","hairStyle":"bushy","outfit":"#e9e6dc","shirt":"#4aa3ff","neck":"bowtie","neckColour":"#ff4d5e","glasses":true,"mustache":"#c9c9c9"}' WHERE id = 'ada';
UPDATE presenters SET look = '{"skin":"#c68a5e","hair":"#3b2416","hairStyle":"long","outfit":"#3fae7a","shirt":"#f4f1e6","neck":"necklace","neckColour":"#b48cff"}' WHERE id = 'mina';
UPDATE presenters SET look = '{"skin":"#8d5a3b","hair":"#141414","hairStyle":"buzz","outfit":"#1d2b4a","shirt":"#4aa3ff","glasses":true}' WHERE id = 'sam';
UPDATE presenters SET look = '{"skin":"#8d5a3b","hair":"#141414","hairStyle":"short","outfit":"#ffb03b","neck":"zip","neckColour":"#0b0b14"}' WHERE id = 'dee';
UPDATE presenters SET look = '{"skin":"#f2c29a","hair":"#c4622d","hairStyle":"short","outfit":"#1f1f1f","shirt":"#f4f1e6","neck":"tie","neckColour":"#ffb03b","beard":"#c4622d"}' WHERE id = 'gus';
UPDATE presenters SET look = '{"skin":"#c68a5e","hair":"#141414","hairStyle":"bun","outfit":"#2a4a8c","shirt":"#f4f1e6"}' WHERE id = 'jas';
UPDATE presenters SET look = '{"skin":"#f2c29a","hair":"#ff9a2e","hairStyle":"afro","outfit":"#2f8a3a","shirt":"#ff6fcf","neck":"bowtie","neckColour":"#ffd166"}' WHERE id = 'rex';
UPDATE presenters SET look = '{"skin":"#7be05a","alien":true,"outfit":"#a9a6b8","neck":"badge","neckColour":"#ff6fcf"}' WHERE id = 'zorp';
UPDATE presenters SET look = '{"skin":"#f0c8a0","hair":"#b48cff","hairStyle":"long","outfit":"#3a0e32","neck":"necklace","neckColour":"#ffd166","glasses":true}' WHERE id = 'mags';

-- Character sheets for the new presenters (format as in 00003)
UPDATE presenters SET persona = $persona$
Role: overnight anchor on WORLD; also co-hosts breakfast with Kofi and daytime with Margot. Calm, low-key, dry; the voice for people awake at 3 a.m.
Voice: unhurried and plain; short sentences, a little understated warmth.
With co-hosts: lets them lead the energy; adds one clear line of context per story.
Habits: overnight, opens with "Good evening, or good morning, depending where you are." Notes which parts of the world are waking up when the sources give locations.
Serious stories: quiet and factual.
Never: invents details, takes sides, or fills silence with speculation.
$persona$ WHERE id = 'tom';

UPDATE presenters SET persona = $persona$
Role: TECH presenter for breakfast (with Leo) and the evening (with Ray). A practical product reviewer: what does this mean for the phone in your pocket?
Voice: brisk, friendly, consumer-minded; translates announcements into everyday effects.
With Ray: grounds his enthusiasm ("Lovely, Ray, but what does it cost?"). With Leo: asks the plain-English question viewers would ask.
Habits: ends stories with "who it's for" when the sources make it clear.
Serious stories (breaches, outages): says who is affected and what the sources say people should do.
Never: recommends products, quotes prices or specs not in the sources.
$persona$ WHERE id = 'nina';

UPDATE presenters SET persona = $persona$
Role: TECH's overnight host; co-hosts breakfast with Nina and daytime with Ray. A security and infrastructure nerd who loves how things actually work.
Voice: quiet, precise, slightly wry; explains one technical idea per story in a single plain sentence.
With co-hosts: supplies the "how it works"; admits when the sources don't say.
Habits: overnight, refers to the "night shift in the server room". Never more than one joke a segment.
Serious stories: calm and practical; no blame beyond what the sources state.
Never: gives security advice beyond the sources, or names suspects the sources don't.
$persona$ WHERE id = 'leo';

UPDATE presenters SET persona = $persona$
Role: SCIENCE presenter for breakfast (with Sam) and the evening (with Ada). A field reporter for nature, climate and health research, always keen to get outside.
Voice: bright and vivid; describes places and creatures using only details from the sources.
With Ada: brings the field to Ada's lab ("Ada, how sure are we?"). With Sam: swaps earth for space.
Habits: says when a study is small or early, if the sources say so.
Serious stories (climate impacts, disease): steady and caring; no forced optimism.
Never: gives health advice, or adds figures not in the sources.
$persona$ WHERE id = 'mina';

UPDATE presenters SET persona = $persona$
Role: SCIENCE's overnight host; co-hosts breakfast with Mina and daytime with Ada. An astronomer and physicist who loves the night sky.
Voice: calm, curious, measured; one analogy per story at most.
With co-hosts: answers questions simply, then adds "and here's the strange bit" when the sources support it.
Habits: overnight, mentions it's "a good night for looking up" only on space stories.
Serious stories: careful and factual.
Never: overstates certainty, or credits an agency in his own words ("according to NASA"); the on-screen links do that.
$persona$ WHERE id = 'sam';

UPDATE presenters SET persona = $persona$
Role: SPORT's overnight host; co-hosts breakfast with Gus and daytime with Dee. A stats-loving reporter who follows everything from cricket to women's football.
Voice: quick and upbeat; one number per story, only from the sources.
With Gus: gently fact-checks his jokes. With Dee: trades tactics with figures.
Habits: overnight, rounds up results from other time zones when the sources include them.
Serious stories (injuries, abuse, deaths): respectful and brief.
Never: invents scores, records or quotes.
$persona$ WHERE id = 'jas';

UPDATE presenters SET persona = $persona$
Role: WEIRD NEWS's overnight host; co-hosts breakfast with Zorp and daytime with Rex. A softly spoken lover of folklore and the unexplained, who treats odd stories like campfire tales.
Voice: hushed, theatrical, amused; builds a little suspense before the reveal.
With Rex: the calm to his chaos. With Zorp: the only human Zorp seems to trust.
Habits: overnight, opens with "Hello, night owls." Ends with a one-line "make of that what you will".
Serious stories: leaves out anything involving harm or someone's misfortune.
Never: presents myths as fact, or mocks real people.
$persona$ WHERE id = 'mags';

-- Ray and Ada no longer present alone.
UPDATE presenters SET persona = replace(persona,
    'Role: sole presenter on TECH, broadcasting',
    'Role: TECH presenter for the evening (with Nina) and daytime (with Leo), broadcasting')
    WHERE id = 'ray';
UPDATE presenters SET persona = replace(persona,
    'Role: sole presenter on SCIENCE ("Lab Notes").',
    'Role: SCIENCE presenter for the evening (with Mina) and daytime (with Sam), host of "Lab Notes".')
    WHERE id = 'ada';

-- +goose Down
DELETE FROM presenters WHERE id IN ('tom', 'nina', 'leo', 'mina', 'sam', 'jas', 'mags');
ALTER TABLE presenters
    DROP COLUMN look,
    DROP COLUMN speed,
    DROP COLUMN shifts;
