import type { Coord, Shape } from '../../engine/index.ts';
import { formatNumber } from '../../i18n/labels.ts';

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
 * A piece of any shape, drawn cell by cell on a board's grid: each cell has a
 * border only on sides that face away from the piece. The sides are logical
 * (block = rows, inline = columns), so the outline mirrors in RTL and turns
 * with vertical writing modes along with the grid.
 */
export function PieceOutline({
  piece,
  colour,
  digitsLocale,
  selected = false,
}: {
  readonly piece: BoardPiece;
  readonly colour: string;
  readonly digitsLocale: string;
  readonly selected?: boolean;
}) {
  const inPiece = new Set(piece.cells.map((c) => key(c.row, c.col)));
  const label = labelCell(piece.cells);
  const edge = (open: boolean): string => (open ? 'var(--piece-edge)' : '0');
  return (
    <>
      {piece.cells.map((c) => (
        <div
          key={key(c.row, c.col)}
          class={`piece-cell ${selected ? 'is-selected' : ''}`}
          style={{
            gridRow: String(c.row + 2),
            gridColumn: String(c.col + 2),
            borderColor: colour === '#000000' ? '#ffffff' : colour,
            borderBlockStartWidth: edge(!inPiece.has(key(c.row - 1, c.col))),
            borderBlockEndWidth: edge(!inPiece.has(key(c.row + 1, c.col))),
            borderInlineStartWidth: edge(!inPiece.has(key(c.row, c.col - 1))),
            borderInlineEndWidth: edge(!inPiece.has(key(c.row, c.col + 1))),
          }}
        >
          {label && label.row === c.row && label.col === c.col && <span class="ship-number">{formatNumber(digitsLocale, piece.number)}</span>}
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
  return (
    <svg class="shape-icon" viewBox={`-0.1 -0.1 ${side + 0.2} ${side + 0.2}`} style={{ inlineSize: size, blockSize: size }} aria-hidden="true" focusable="false">
      {shape.map(([r, c]) => (
        <rect key={key(r, c)} x={c + (side - cols) / 2 + 0.06} y={r + (side - rows) / 2 + 0.06} width="0.88" height="0.88" rx="0.15" />
      ))}
    </svg>
  );
}
