import type { Axis, Coord, PlacedShip, Rules } from './types.ts';

export const coord = (row: number, col: number): Coord => ({ row, col });

export function inBounds(rules: Pick<Rules, 'rows' | 'cols'>, c: Coord): boolean {
  return (
    Number.isInteger(c.row) && Number.isInteger(c.col) && c.row >= 0 && c.col >= 0 && c.row < rules.rows && c.col < rules.cols
  );
}

export const indexOf = (rules: Pick<Rules, 'cols'>, c: Coord): number => c.row * rules.cols + c.col;
export const coordOf = (rules: Pick<Rules, 'cols'>, i: number): Coord => ({ row: Math.floor(i / rules.cols), col: i % rules.cols });

export function shipCells(origin: Coord, axis: Axis, length: number): Coord[] {
  const out: Coord[] = [];
  for (let k = 0; k < length; k++) {
    out.push(axis === 'alongRow' ? { row: origin.row, col: origin.col + k } : { row: origin.row + k, col: origin.col });
  }
  return out;
}

/** The 2×2 bomb footprint whose first corner is `at`. */
export function bombCells(at: Coord): Coord[] {
  return [at, { row: at.row, col: at.col + 1 }, { row: at.row + 1, col: at.col }, { row: at.row + 1, col: at.col + 1 }];
}

/** Every distinct placement of a ship of `length` (one axis only for length 1). */
export function placementsFor(rules: Pick<Rules, 'rows' | 'cols'>, length: number): { origin: Coord; axis: Axis }[] {
  const out: { origin: Coord; axis: Axis }[] = [];
  const axes: readonly Axis[] = length === 1 ? ['alongRow'] : ['alongRow', 'alongCol'];
  for (const axis of axes) {
    const maxRow = axis === 'alongCol' ? rules.rows - length : rules.rows - 1;
    const maxCol = axis === 'alongRow' ? rules.cols - length : rules.cols - 1;
    for (let row = 0; row <= maxRow; row++) for (let col = 0; col <= maxCol; col++) out.push({ origin: { row, col }, axis });
  }
  return out;
}

/**
 * Build the occupancy grid for a layout (shipyard index per cell, -1 for
 * water), or return null if the layout breaks the rules: off the board,
 * overlapping, or touching (including diagonally) when touching is off.
 */
export function occupancy(rules: Rules, fleet: readonly PlacedShip[]): number[] | null {
  const grid = new Array<number>(rules.rows * rules.cols).fill(-1);
  for (const placed of fleet) {
    const idx = rules.shipyard.findIndex((s) => s.id === placed.ship);
    const ship = rules.shipyard[idx];
    if (!ship) return null;
    for (const c of shipCells(placed.origin, placed.axis, ship.length)) {
      if (!inBounds(rules, c)) return null;
      const i = indexOf(rules, c);
      if (grid[i] !== -1) return null;
      if (!rules.allowTouching) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const n = { row: c.row + dr, col: c.col + dc };
            if (!inBounds(rules, n)) continue;
            const o = grid[indexOf(rules, n)];
            if (o !== -1 && o !== idx) return null;
          }
        }
      }
      grid[i] = idx;
    }
  }
  return grid;
}
