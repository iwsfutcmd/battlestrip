import { describe, expect, it } from 'vitest';
import { cellGroups, shapeOf, WARDROBE, type Coord } from '../../engine/index.ts';
import { linkSegment, partLinks } from './links.ts';

const cellsOf = (id: string): Coord[] => {
  const def = WARDROBE.find((w) => w.id === id);
  if (!def) throw new Error(id);
  return shapeOf(def).map(([row, col]) => ({ row, col }));
};

describe('lines between separate parts', () => {
  it('join every part of every piece, with one line fewer than there are parts', () => {
    for (const def of WARDROBE) {
      const cells = cellsOf(def.id);
      const parts = cellGroups(cells);
      const links = partLinks(cells);
      expect(links).toHaveLength(parts.length - 1);
      // Following the links from the first part reaches every part.
      const partOf = (c: Coord): number => parts.findIndex((p) => p.some((x) => x.row === c.row && x.col === c.col));
      const reached = new Set([0]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const [a, b] of links) {
          const [pa, pb] = [partOf(a), partOf(b)];
          if (reached.has(pa) !== reached.has(pb)) {
            reached.add(pa).add(pb);
            grew = true;
          }
        }
      }
      expect(reached.size).toBe(parts.length);
    }
  });

  it('take the nearest squares: shoes straight across, the bikini cups then the bottom', () => {
    expect(partLinks(cellsOf('shoes'))).toEqual([[{ row: 0, col: 0 }, { row: 0, col: 2 }]]);
    expect(partLinks(cellsOf('bikini'))).toEqual([
      [{ row: 0, col: 0 }, { row: 0, col: 2 }],
      [{ row: 0, col: 0 }, { row: 2, col: 1 }],
    ]);
    expect(partLinks(cellsOf('tShirt'))).toEqual([]);
  });

  it('are drawn only outside the squares they join', () => {
    // Straight across one empty square: exactly that square's width.
    expect(linkSegment(0.5, 0.5, 2.5, 0.5, 1)).toEqual([1, 0.5, 2, 0.5]);
    // A knight's move leaves each square through its side, not its corner.
    const [x1, y1, x2, y2] = linkSegment(0.5, 0.5, 2.5, 1.5, 1);
    expect(x1).toBeCloseTo(1);
    expect(y1).toBeCloseTo(0.75);
    expect(x2).toBeCloseTo(2);
    expect(y2).toBeCloseTo(1.25);
  });
});
