import { useEffect, useState } from 'preact/hooks';
import {
  type Board, type Channel, fetchBoard, fetchRundown, serverNow,
} from '../api';
import { PixelIcon } from '../components/PixelIcon';
import type { Rundown } from '../rundown';
import { href, navigate } from '../router';
import {
  buildPage,
  COLS,
  CONTENT_ROWS,
  INDEX,
  pageNumbers,
  type Row,
  type Span,
  type TextData,
} from '../teletext/pages';

/** How long each subpage shows before the next, as on Ceefax. */
const SUBPAGE_MS = 12_000;
const FASTEXT: Span['fg'][] = ['red', 'green', 'yellow', 'cyan'];

interface Props {
  channels: Channel[];
  num: number;
}

const go = (num: number) => navigate(`/text/${num}`);

function header(entry: string, num: number, now: number): string {
  const page = `P${(entry || String(num)).padEnd(3, '-')}`;
  const d = new Date(now);
  const date = d
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'Europe/London',
    })
    .replace(',', '');
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false });
  const left = `${page} PXN TEXT ${num}`;
  const right = `${date} ${time}`;
  return `${left}${' '.repeat(Math.max(1, COLS - left.length - right.length))}${right}`.slice(
    0,
    COLS,
  );
}

function SpanView({ span }: { span: Span }) {
  const cls = `tt-fg-${span.fg ?? 'white'}${span.bg ? ` tt-bg-${span.bg}` : ''}`;
  if (span.link) {
    const target = span.link;
    return (
      <a
        className={`${cls} tt-link`}
        href={href(`/text/${target}`)}
        onClick={(e) => {
          e.preventDefault();
          go(target);
        }}
      >
        {span.text}
      </a>
    );
  }
  return <span className={cls}>{span.text}</span>;
}

function RowView({ row }: { row: Row }) {
  return (
    <div className={`tt-row${row.double ? ' tt-double' : ''}`}>
      {row.spans.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key -- spans are positional
        <SpanView key={i} span={s} />
      ))}
    </div>
  );
}

/** PXN TEXT: the teletext service, built from the channels' rundowns. */
export function Teletext({ channels, num }: Props) {
  const [data, setData] = useState<TextData | null>(null);
  const [entry, setEntry] = useState('');
  const [now, setNow] = useState(serverNow());

  useEffect(() => {
    if (channels.length === 0) return undefined;
    let alive = true;
    const load = async () => {
      const rundowns: Record<string, Rundown | null> = {};
      await Promise.all(
        channels.map(async (c) => {
          rundowns[c.id] = await fetchRundown(c.id).catch(() => null);
        }),
      );
      const boards: Record<string, Board | null> = {};
      await Promise.all(
        ['football', 'f1'].map(async (id) => {
          boards[id] = await fetchBoard(id).catch(() => null);
        }),
      );
      if (alive) {
        setData({
          channels,
          rundowns,
          boards,
          now: serverNow(),
        });
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [channels]);

  useEffect(() => {
    const clock = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(clock);
  }, []);

  const view = data ? { ...data, now } : null;
  const page = view ? buildPage(num, view) : null;
  const numbers = view ? pageNumbers(view) : [INDEX];
  const step = (dir: 1 | -1) => {
    const i = numbers.findIndex((n) => n >= num);
    const at = i < 0 ? numbers.length - 1 : i;
    const exact = numbers[at] === num;
    const next = dir > 0
      ? numbers[(exact ? at + 1 : at) % numbers.length]
      : numbers[(at - 1 + numbers.length) % numbers.length];
    go(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        const next = `${entry}${e.key}`;
        if (next.length === 3) {
          setEntry('');
          go(Number(next));
        } else {
          setEntry(next);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
      else if (e.key === 'Escape') navigate('/');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let rows: Row[];
  let sub = 0;
  let subCount = 1;
  if (!data) {
    rows = [{ spans: [{ text: ' Searching...', fg: 'yellow' }] }];
  } else if (!page) {
    rows = [
      { spans: [] },
      { spans: [{ text: ` Page ${num} is not in service.`, fg: 'yellow' }] },
      { spans: [] },
      {
        spans: [
          { text: ' Go to the index, ', fg: 'white' },
          { text: 'page 100', fg: 'cyan', link: INDEX },
        ],
      },
    ];
  } else {
    subCount = page.subpages.length;
    sub = Math.floor(now / SUBPAGE_MS) % subCount;
    rows = page.subpages[sub];
  }
  const filled = [...rows.slice(0, CONTENT_ROWS)];
  while (filled.length < CONTENT_ROWS) filled.push({ spans: [] });
  if (subCount > 1) {
    filled[0] = {
      ...filled[0],
      spans: [
        ...filled[0].spans,
        {
          text: ` ${sub + 1}/${subCount}`.padStart(
            COLS - filled[0].spans.reduce((n, s) => n + s.text.length, 0),
          ),
          fg: 'white',
        },
      ],
    };
  }
  const fastext = page?.fastext ?? [[INDEX, 'Index']];

  return (
    <main className="tt-wrap">
      <div className="tt" aria-label={`PXN TEXT page ${num}`}>
        <div className="tt-row tt-header">{header(entry, num, now)}</div>
        {filled.map((r, i) => (
          // eslint-disable-next-line react/no-array-index-key -- rows are positional
          <RowView key={i} row={r} />
        ))}
        <div className="tt-row tt-fastext">
          {fastext.map(([target, label], i) => (
            <a
              key={target + label}
              className={`tt-fg-${FASTEXT[i]} tt-link`}
              href={href(`/text/${target}`)}
              onClick={(e) => {
                e.preventDefault();
                go(target);
              }}
            >
              {label.slice(0, 9)}
            </a>
          ))}
        </div>
      </div>
      <nav className="tt-controls" aria-label="Teletext controls">
        <a
          className="ctl"
          href={href('/')}
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <PixelIcon name="left" />
          GUIDE
        </a>
        <button type="button" className="ctl" aria-label="Previous page" onClick={() => step(-1)}>
          <PixelIcon name="left" />
        </button>
        <form
          className="tt-goto"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('page') as HTMLInputElement;
            if (/^\d{3}$/.test(input.value)) go(Number(input.value));
            input.value = '';
          }}
        >
          <label htmlFor="tt-page">
            PAGE
            <input
              id="tt-page"
              name="page"
              inputMode="numeric"
              pattern="[0-9]{3}"
              maxLength={3}
              placeholder={String(num)}
            />
          </label>
        </form>
        <button type="button" className="ctl" aria-label="Next page" onClick={() => step(1)}>
          <PixelIcon name="play" />
        </button>
      </nav>
    </main>
  );
}
