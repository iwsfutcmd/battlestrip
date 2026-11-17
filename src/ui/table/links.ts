import { cellGroups, type Coord } from '../../engine/index.ts';

/** A line joining two separate parts of one piece: from a square of one part to a square of the other. */
export type PartLink = readonly [Coord, Coord];

const gap = (a: Coord, b: Coord): number => (a.row - b.row) ** 2 + (a.col - b.col) ** 2;

/**
 * How to join a piece's separate parts (parts touch at no edge or corner)
 * so it reads as one piece: the fewest, shortest lines that connect every
 * part, each between the nearest squares of two parts (a minimum spanning
 * tree). Ties go to the part listed first, so the result is stable. A piece in
 * one part needs none.
 */
export function partLinks(cells: readonly Coord[]): PartLink[] {
  const groups = cellGroups(cells);
  const links: PartLink[] = [];
  const joined = [0];
  while (joined.length < groups.length) {
    let best: { link: PartLink; part: number; d: number } | null = null;
    for (const j of joined) {
      for (let k = 0; k < groups.length; k++) {
        if (joined.includes(k)) continue;
        for (const a of groups[j] ?? []) {
          for (const b of groups[k] ?? []) {
            const d = gap(a, b);
            if (!best || d < best.d) best = { link: [a, b], part: k, d };
          }
        }
      }
    }
    if (!best) break;
    links.push(best.link);
    joined.push(best.part);
  }
  return links;
}

/**
 * The visible stretch of a link between two square centres `(x1, y1)` and
 * `(x2, y2)` of side `side`: it starts and ends where the line leaves each
 * square, so it never crosses the piece's own squares or its marker.
 */
export function linkSegment(x1: number, y1: number, x2: number, y2: number, side: number): readonly [number, number, number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [x1, y1, x2, y2];
  const ux = dx / len;
  const uy = dy / len;
  const t = side / 2 / Math.max(Math.abs(ux), Math.abs(uy));
  return [x1 + ux * t, y1 + uy * t, x2 - ux * t, y2 - uy * t];
}
