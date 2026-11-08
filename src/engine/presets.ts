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

export const CLASSIC_SHIPYARD: readonly ShipyardShip[] = shipyard([
  ['carrier', 5],
  ['battleship', 4],
  ['cruiser', 3],
  ['submarine', 3],
  ['destroyer', 2],
]);

/** Морской бой: 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, and ships may not touch. */
export const MORSKOY_BOY_SHIPYARD: readonly ShipyardShip[] = shipyard([
  ['battleship', 4],
  ['cruiser', 3],
  ['cruiser', 3],
  ['destroyer', 2],
  ['destroyer', 2],
  ['destroyer', 2],
  ['torpedoBoat', 1],
  ['torpedoBoat', 1],
  ['torpedoBoat', 1],
  ['torpedoBoat', 1],
]);

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

/** Which copy of its kind a ship is (1-based), or null if its kind is unique in the shipyard. */
export function copyNumber(shipyardShips: readonly ShipyardShip[], id: ShipId): number | null {
  const ship = shipyardShips.find((s) => s.id === id);
  if (!ship) return null;
  const same = shipyardShips.filter((s) => s.kind === ship.kind);
  return same.length > 1 ? same.indexOf(ship) + 1 : null;
}
