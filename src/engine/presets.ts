import type { Rules, ShipId, ShipKindId, ShipyardShip } from './types.ts';

function shipyard(entries: readonly (readonly [kind: string, length: number])[]): ShipyardShip[] {
  const total: Record<string, number> = {};
  for (const [kind] of entries) total[kind] = (total[kind] ?? 0) + 1;
  const seen: Record<string, number> = {};
  return entries.map(([kind, length], i) => {
    const copy = (seen[kind] = (seen[kind] ?? 0) + 1);
    const id = (total[kind] ?? 0) > 1 ? `${kind}-${copy}` : kind;
    return { id: id as ShipId, kind: kind as ShipKindId, number: i + 1, length };
  });
}

/*
 * Battlestrip is strip battleship: every "ship" is an item of clothing and a
 * "fleet" is what a player is wearing (their outfit). The engine keeps
 * Battleship's vocabulary; only the kinds below and the message catalogs know
 * about clothes. Sizes are Battleship's, so pacing is unchanged.
 */

/** Everyday wear, with classic Battleship sizes (5, 4, 3, 3, 2). Pieces may touch. */
export const CLASSIC_SHIPYARD: readonly ShipyardShip[] = shipyard([
  ['pants', 5],
  ['shirt', 4],
  ['underwear', 3],
  ['socks', 3],
  ['shoes', 2],
]);

/** Bundled up for winter, with Морской бой sizes (4, 3, 3, 2, 2, 2, 1, 1, 1, 1); nothing may touch. */
export const MORSKOY_BOY_SHIPYARD: readonly ShipyardShip[] = shipyard([
  ['coat', 4],
  ['sweater', 3],
  ['pants', 3],
  ['scarf', 2],
  ['sock', 2],
  ['sock', 2],
  ['glove', 1],
  ['glove', 1],
  ['hat', 1],
  ['underwear', 1],
]);

/** Named after their rule sets: classic Battleship (touching allowed) and Морской бой (no touching). */
export type PresetId = 'classic' | 'morskoyBoy';

export function presetRules(preset: PresetId, overrides: Partial<Rules> = {}): Rules {
  const base: Rules =
    preset === 'classic'
      ? { rows: 10, cols: 10, shipyard: CLASSIC_SHIPYARD, allowTouching: true, selfFire: true, announceShipOnHit: true, nuclear: true }
      : { rows: 10, cols: 10, shipyard: MORSKOY_BOY_SHIPYARD, allowTouching: false, selfFire: true, announceShipOnHit: true, nuclear: true };
  return { ...base, ...overrides };
}

export const MIN_SIDE = 5;
export const MAX_SIDE = 20;

/** Which copy of its kind a piece is (1-based: "sock 2"), or null if its kind is unique in the shipyard. */
export function copyNumber(shipyardShips: readonly ShipyardShip[], id: ShipId): number | null {
  const ship = shipyardShips.find((s) => s.id === id);
  if (!ship) return null;
  const same = shipyardShips.filter((s) => s.kind === ship.kind);
  return same.length > 1 ? same.indexOf(ship) + 1 : null;
}
