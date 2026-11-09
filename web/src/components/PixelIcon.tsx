// Tiny bitmap icons for the pixel fonts, which have no arrow glyphs. Each
// icon pixel is one font pixel (1/8 em), so icons stay on the text's grid.
const SHAPES = {
  up: ['..#..', '.###.', '#####'],
  down: ['#####', '.###.', '..#..'],
  left: ['..#', '.##', '###', '.##', '..#'],
  right: ['#..', '##.', '###', '##.', '#..'],
  play: ['#..', '##.', '###', '##.', '#..'],
  out: ['..###', '...##', '..#.#', '.#...', '#....'],
} as const;

export type IconName = keyof typeof SHAPES;

export function PixelIcon({ name }: { name: IconName }) {
  const rows = SHAPES[name];
  const w = rows[0].length;
  const h = rows.length;
  const d = rows
    .flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return (
    <svg
      className="pixel-icon"
      viewBox={`0 0 ${w} ${h}`}
      width={`${w / 8}em`}
      height={`${h / 8}em`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
