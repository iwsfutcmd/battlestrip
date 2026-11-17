import { pieceMarker } from '../common/clothing.tsx';
import { cellGroups, type Coord, type Shape } from '../../engine/index.ts';
import type { Direction, WritingMode } from '../../i18n/direction.ts';
import { linkSegment, partLinks, type PartLink } from './links.ts';

/** What a board needs to draw a piece: its number, its kind and the squares it covers. */
export interface BoardPiece {
  readonly number: number;
  readonly kind: string;
  readonly cells: readonly Coord[];
}

const key = (row: number, col: number): string => `${row},${col}`;

/** The cell nearest the piece's centre: where its number goes. */
export function labelCell(cells: readonly Coord[]): Coord | undefined {
  const r = cells.reduce((a, c) => a + c.row, 0) / Math.max(1, cells.length);
  const c = cells.reduce((a, x) => a + x.col, 0) / Math.max(1, cells.length);
  let best: Coord | undefined;
  let bestD = Infinity;
  for (const cell of cells) {
    const d = (cell.row - r) ** 2 + (cell.col - c) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

/**
 * A line between two separate parts of a piece, laid over the grid area the
 * two squares span. The area is placed with grid lines, so it mirrors and
 * turns with the grid; the line inside is SVG, which is physical, so its ends
 * are mapped from (row, column) for the board's direction and writing mode.
 */
function PartLinkLine({ link, ink, dir, writingMode }: { readonly link: PartLink; readonly ink: string; readonly dir: Direction; readonly writingMode: WritingMode }) {
  const [a, b] = link;
  const r0 = Math.min(a.row, b.row);
  const c0 = Math.min(a.col, b.col);
  const rows = Math.abs(a.row - b.row) + 1;
  const cols = Math.abs(a.col - b.col) + 1;
  const vertical = writingMode !== 'horizontal-tb';
  // Square centres in cell units, block (row) and inline (column) offsets within the area.
  const place = (c: Coord): readonly [number, number] => {
    const block = c.row - r0 + 0.5;
    const inline = dir === 'rtl' ? cols - (c.col - c0 + 0.5) : c.col - c0 + 0.5;
    if (!vertical) return [inline, block];
    return [writingMode === 'vertical-rl' ? rows - block : block, inline];
  };
  const [x1, y1] = place(a);
  const [x2, y2] = place(b);
  const [sx, sy, ex, ey] = linkSegment(x1, y1, x2, y2, 1);
  return (
    <svg
      class="piece-link"
      viewBox={`0 0 ${vertical ? rows : cols} ${vertical ? cols : rows}`}
      preserveAspectRatio="none"
      style={{ gridRow: `${r0 + 2} / span ${rows}`, gridColumn: `${c0 + 2} / span ${cols}` }}
      aria-hidden="true"
      focusable="false"
    >
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={ink} />
    </svg>
  );
}

/**
 * A piece of any shape, drawn cell by cell on a board's grid: each cell has a
 * border only on sides that face away from the piece. The sides are logical
 * (block = rows, inline = columns), so the outline mirrors in RTL and turns
 * with vertical writing modes along with the grid. Separate parts are joined
 * by a line, so a pair of shoes reads as one piece.
 */
export function PieceOutline({
  piece,
  colour,
  digitsLocale,
  dir,
  writingMode,
  selected = false,
}: {
  readonly piece: BoardPiece;
  readonly colour: string;
  readonly digitsLocale: string;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  readonly selected?: boolean;
}) {
  const inPiece = new Set(piece.cells.map((c) => key(c.row, c.col)));
  const has = (row: number, col: number): boolean => inPiece.has(key(row, col));
  // One number per separate part (cells joined at an edge or a corner count as one part).
  const labels = new Set(
    cellGroups(piece.cells)
      .map((g) => labelCell(g))
      .flatMap((c) => (c ? [key(c.row, c.col)] : [])),
  );
  const ink = colour === '#000000' ? '#ffffff' : colour;
  const edge = (open: boolean): string => (open ? 'var(--piece-edge)' : '0');
  return (
    <>
      {partLinks(piece.cells).map((link) => (
        <PartLinkLine key={`${key(link[0].row, link[0].col)}-${key(link[1].row, link[1].col)}`} link={link} ink={ink} dir={dir} writingMode={writingMode} />
      ))}
      {piece.cells.map((c) => (
        <div
          key={key(c.row, c.col)}
          class={`piece-cell ${selected ? 'is-selected' : ''}`}
          style={{
            gridRow: String(c.row + 2),
            gridColumn: String(c.col + 2),
            borderColor: ink,
            borderBlockStartWidth: edge(!has(c.row - 1, c.col)),
            borderBlockEndWidth: edge(!has(c.row + 1, c.col)),
            borderInlineStartWidth: edge(!has(c.row, c.col - 1)),
            borderInlineEndWidth: edge(!has(c.row, c.col + 1)),
          }}
        >
          {labels.has(key(c.row, c.col)) && <span class="ship-number">{pieceMarker(piece.kind, piece.number, digitsLocale)}</span>}
          {/* Cells joined only at a corner get a bridge on that corner (drawn once, from the upper cell). */}
          {([-1, 1] as const).map((dc) =>
            has(c.row + 1, c.col + dc) && !has(c.row + 1, c.col) && !has(c.row, c.col + dc) ? (
              <span
                key={dc}
                class="piece-bridge"
                style={dc < 0 ? { background: ink, insetBlockEnd: 'var(--bridge-offset)', insetInlineStart: 'var(--bridge-offset)' } : { background: ink, insetBlockEnd: 'var(--bridge-offset)', insetInlineEnd: 'var(--bridge-offset)' }}
              />
            ) : null,
          )}
        </div>
      ))}
    </>
  );
}

/** A small, decorative picture of a shape, for pickers and legends. */
export function ShapeIcon({ shape, size = '1.6em' }: { readonly shape: Shape; readonly size?: string }) {
  const rows = Math.max(...shape.map(([r]) => r)) + 1;
  const cols = Math.max(...shape.map(([, c]) => c)) + 1;
  const side = Math.max(rows, cols);
  const x = (c: number): number => c + (side - cols) / 2 + 0.5;
  const y = (r: number): number => r + (side - rows) / 2 + 0.5;
  return (
    <svg class="shape-icon" viewBox={`-0.1 -0.1 ${side + 0.2} ${side + 0.2}`} style={{ inlineSize: size, blockSize: size }} aria-hidden="true" focusable="false">
      {partLinks(shape.map(([row, col]) => ({ row, col }))).map(([a, b]) => {
        const [x1, y1, x2, y2] = linkSegment(x(a.col), y(a.row), x(b.col), y(b.row), 0.88);
        return <line key={`${a.row},${a.col}-${b.row},${b.col}`} class="shape-icon-link" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {shape.map(([r, c]) => (
        <rect key={key(r, c)} x={c + (side - cols) / 2 + 0.06} y={r + (side - rows) / 2 + 0.06} width="0.88" height="0.88" rx="0.15" />
      ))}
    </svg>
  );
}
