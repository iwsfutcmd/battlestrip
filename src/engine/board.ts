import type { Coord, Orientation, PlacedShip, Rules, Shape, ShipyardShip } from './types.ts';

export const coord = (row: number, col: number): Coord => ({ row, col });

export function inBounds(rules: Pick<Rules, 'rows' | 'cols'>, c: Coord): boolean {
  return (
    Number.isInteger(c.row) && Number.isInteger(c.col) && c.row >= 0 && c.col >= 0 && c.row < rules.rows && c.col < rules.cols
  );
}

export const indexOf = (rules: Pick<Rules, 'cols'>, c: Coord): number => c.row * rules.cols + c.col;
export const coordOf = (rules: Pick<Rules, 'cols'>, i: number): Coord => ({ row: Math.floor(i / rules.cols), col: i % rules.cols });

/** A straight line of `length` along a row. */
export function lineShape(length: number): Shape {
  return Array.from({ length }, (_, k) => [0, k] as const);
}

/** A piece's shape: its own, or a line of its length. */
export function shapeOf(ship: Pick<ShipyardShip, 'length' | 'shape'>): Shape {
  return ship.shape ?? lineShape(ship.length);
}

/** Parse "###/.#." (rows separated by "/", "#" for a cell) into a shape. Data helper for catalogs. */
export function parseShape(art: string): Shape {
  const out: [number, number][] = [];
  art.split('/').forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') out.push([r, c]);
    });
  });
  return out;
}

/**
 * Turn a shape: mirror (orientation & 4), then quarter turns clockwise
 * (orientation & 3), then move it so its bounding box starts at [0, 0].
 * Cells come back sorted by row, then column.
 */
export function orient(shape: Shape, orientation: Orientation): [number, number][] {
  let cells = shape.map(([r, c]): [number, number] => (orientation & 4 ? [r, -c] : [r, c]));
  for (let q = 0; q < (orientation & 3); q++) cells = cells.map(([r, c]): [number, number] => [c, -r]);
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]): [number, number] => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const shapeKey = (cells: readonly (readonly [number, number])[]): string => cells.map(([r, c]) => `${r},${c}`).join(';');

/** The distinct orientations of a shape: the first of each set that look the same. */
export function orientations(shape: Shape): Orientation[] {
  const seen: string[] = [];
  const out: Orientation[] = [];
  for (let k = 0; k < 8; k++) {
    const key = shapeKey(orient(shape, k));
    if (seen.includes(key)) continue;
    seen.push(key);
    out.push(k);
  }
  return out;
}

/** The orientation `placementsFor` uses for whatever `orientation` looks like. */
export function canonicalOrientation(shape: Shape, orientation: Orientation): Orientation {
  const key = shapeKey(orient(shape, orientation));
  return orientations(shape).find((k) => shapeKey(orient(shape, k)) === key) ?? 0;
}

/** The board squares a piece covers, sorted by row, then column. */
export function placedCells(ship: Pick<ShipyardShip, 'length' | 'shape'>, origin: Coord, orientation: Orientation): Coord[] {
  return orient(shapeOf(ship), orientation).map(([r, c]) => ({ row: origin.row + r, col: origin.col + c }));
}

/** The cells of a placed piece, looked up in the shipyard (empty if the piece isn't in it). */
export function cellsOf(rules: Pick<Rules, 'shipyard'>, placed: PlacedShip): Coord[] {
  const def = rules.shipyard.find((s) => s.id === placed.ship);
  return def ? placedCells(def, placed.origin, placed.orientation) : [];
}

/** The 2×2 bomb footprint whose first corner is `at`. */
export function bombCells(at: Coord): Coord[] {
  return [at, { row: at.row, col: at.col + 1 }, { row: at.row + 1, col: at.col }, { row: at.row + 1, col: at.col + 1 }];
}

export interface Placement {
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly cells: readonly Coord[];
}

/**
 * Every distinct placement of a piece on the board: each distinct
 * orientation, at every origin where it fits. Its order is fixed (fleet
 * codes index into it).
 */
export function placementsFor(rules: Pick<Rules, 'rows' | 'cols'>, ship: Pick<ShipyardShip, 'length' | 'shape'>): Placement[] {
  const shape = shapeOf(ship);
  const out: Placement[] = [];
  for (const orientation of orientations(shape)) {
    const cells = orient(shape, orientation);
    const height = Math.max(...cells.map(([r]) => r)) + 1;
    const width = Math.max(...cells.map(([, c]) => c)) + 1;
    for (let row = 0; row + height <= rules.rows; row++) {
      for (let col = 0; col + width <= rules.cols; col++) {
        out.push({ origin: { row, col }, orientation, cells: cells.map(([r, c]) => ({ row: row + r, col: col + c })) });
      }
    }
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
    if (!Number.isInteger(placed.orientation) || placed.orientation < 0 || placed.orientation > 7) return null;
    for (const c of placedCells(ship, placed.origin, placed.orientation)) {
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
