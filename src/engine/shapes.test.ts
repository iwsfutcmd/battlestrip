import { describe, expect, it } from 'vitest';
import { canonicalOrientation, occupancy, orient, orientations, parseShape, placementsFor, placedCells } from './board.ts';
import { randomLayout } from './placement.ts';
import { seedRng, type RngState } from './rng.ts';
import type { PlacedShip, Rules, ShipId, ShipKindId } from './types.ts';

describe('shapes', () => {
  it('counts distinct orientations', () => {
    expect(orientations(parseShape('#'))).toHaveLength(1);
    expect(orientations(parseShape('###'))).toHaveLength(2);
    expect(orientations(parseShape('##/##'))).toHaveLength(1);
    expect(orientations(parseShape('###/.#.'))).toHaveLength(4); // T
    expect(orientations(parseShape('#./##'))).toHaveLength(4); // small L
    expect(orientations(parseShape('#./#./##'))).toHaveLength(8); // L: mirrors differ
    expect(orientations(parseShape('##./.##'))).toHaveLength(4); // S/Z
    expect(orientations(parseShape('###/###'))).toHaveLength(2); // 2×3 rectangle
  });

  it('turns lines the way the spec names them: 0 along a row, 1 along a column', () => {
    expect(placedCells({ length: 3 }, { row: 2, col: 2 }, 0)).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
    ]);
    expect(placedCells({ length: 3 }, { row: 2, col: 2 }, 1)).toEqual([
      { row: 2, col: 2 },
      { row: 3, col: 2 },
      { row: 4, col: 2 },
    ]);
  });

  it('turns clockwise and keeps the bounding box at the origin', () => {
    const t = parseShape('###/.#.');
    expect(orient(t, 1)).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ]);
    expect(canonicalOrientation(parseShape('##/##'), 5)).toBe(0);
  });

  it('places every orientation everywhere it fits, and only there', () => {
    const rules = { rows: 5, cols: 6 };
    // T: 4 orientations, two 3×2 and two 2×3 bounding boxes.
    expect(placementsFor(rules, { length: 4, shape: parseShape('###/.#.') })).toHaveLength(2 * (4 * 4) + 2 * (3 * 5));
    for (const p of placementsFor(rules, { length: 4, shape: parseShape('#./#./##') })) {
      expect(p.cells.every((c) => c.row >= 0 && c.col >= 0 && c.row < 5 && c.col < 6)).toBe(true);
    }
  });
});

function shapedRules(arts: readonly string[], allowTouching: boolean): Rules {
  return {
    rows: 5,
    cols: 5,
    shipyard: arts.map((art, i) => {
      const shape = parseShape(art);
      return { id: `p${i}` as ShipId, kind: 'piece' as ShipKindId, number: i + 1, length: shape.length, shape };
    }),
    allowTouching,
    selfFire: true,
    announceShipOnHit: true,
    nuclear: true,
  };
}

function exactOccupancy(rules: Rules): number[] {
  const counts = new Array<number>(25).fill(0);
  let layouts = 0;
  const recurse = (k: number, chosen: PlacedShip[]): void => {
    const ship = rules.shipyard[k];
    if (!ship) {
      const occ = occupancy(rules, chosen);
      if (!occ) return;
      layouts++;
      occ.forEach((o, i) => {
        if (o >= 0) counts[i] = (counts[i] ?? 0) + 1;
      });
      return;
    }
    for (const p of placementsFor(rules, ship)) recurse(k + 1, [...chosen, { ship: ship.id, origin: p.origin, orientation: p.orientation }]);
  };
  recurse(0, []);
  return counts.map((c) => c / layouts);
}

describe('random placement of shapes', () => {
  it.each([
    ['L and T, touching allowed', ['#./#./##', '###/.#.'], true],
    ['square and S, no touching', ['##/##', '##./.##'], false],
  ] as const)('is uniform over legal layouts: %s', (_label, arts, touching) => {
    const rules = shapedRules(arts, touching);
    const exact = exactOccupancy(rules);
    const n = 20_000;
    const counts = new Array<number>(25).fill(0);
    let rng: RngState = seedRng(99);
    for (let i = 0; i < n; i++) {
      const [layout, next] = randomLayout(rules, rules.shipyard.map((s) => s.id), rng);
      rng = next;
      const occ = layout && occupancy(rules, layout);
      if (!occ) throw new Error('illegal layout');
      occ.forEach((o, j) => {
        if (o >= 0) counts[j] = (counts[j] ?? 0) + 1;
      });
    }
    exact.forEach((p, j) => {
      const sigma = Math.sqrt((p * (1 - p)) / n);
      expect(Math.abs((counts[j] ?? 0) / n - p), `cell ${j}`).toBeLessThan(5 * sigma + 1e-9);
    });
  });
});

describe('the wardrobe', () => {
  it('has unique ids, numbers in order, and connected shapes', async () => {
    const { WARDROBE, OUTFITS } = await import('./wardrobe.ts');
    const ids = WARDROBE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    WARDROBE.forEach((s, i) => expect(s.number).toBe(i + 1));
    for (const s of WARDROBE) {
      const cells = (s.shape ?? []).map(([r, c]) => `${r},${c}`);
      // Flood fill from the first cell reaches every cell.
      const seen = new Set([cells[0]]);
      const stack = [s.shape?.[0]];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur) continue;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = `${cur[0] + dr},${cur[1] + dc}`;
          if (cells.includes(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([cur[0] + dr, cur[1] + dc]);
          }
        }
      }
      expect(seen.size, s.id).toBe(cells.length);
      expect(s.length).toBe(cells.length);
    }
    for (const outfit of Object.values(OUTFITS)) for (const id of outfit) expect(ids).toContain(id);
  });
});
