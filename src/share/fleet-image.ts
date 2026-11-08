import { copyNumber, fleetOf, type GameState, type PlayerId } from '../engine/index.ts';
import type { Direction, WritingMode } from '../i18n/direction.ts';
import type { LabelSystemId } from '../i18n/labels.ts';
import { fleetCheck, gameCode } from './codes.ts';
import type { FleetImage } from './payload.ts';

export interface ImageSettings {
  readonly labels: LabelSystemId;
  readonly labels2: LabelSystemId | null;
  readonly numbering: string;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
}

/** The fleet check for a seat's current layout (also shown on the laptop's preview). */
export function checkFor(s: GameState, player: PlayerId, placedOnPhone = false): string {
  const seat = s.seats.findIndex((x) => x.id === player);
  // A layout placed on the phone is checked as version 0 on both sides (the phone can't know the laptop's count).
  return fleetCheck(gameCode(s.seed), seat, placedOnPhone ? 0 : (s.layoutVersions[seat] ?? 0), fleetOf(s, player));
}

/** Build a player's fleet image. share/ is one of the three places allowed to call fleetOf. */
export function fleetImageFor(s: GameState, player: PlayerId, name: string, settings: ImageSettings, placedOnPhone = false): FleetImage {
  const seat = s.seats.findIndex((x) => x.id === player);
  return {
    gameCode: gameCode(s.seed),
    fleetCheck: checkFor(s, player, placedOnPhone),
    rows: s.rules.rows,
    cols: s.rules.cols,
    ...settings,
    name,
    identity: seat,
    ships: fleetOf(s, player).map((p) => {
      const def = s.rules.shipyard.find((x) => x.id === p.ship);
      return {
        number: def?.number ?? 0,
        kind: def?.kind ?? 'carrier',
        copy: copyNumber(s.rules.shipyard, p.ship),
        length: def?.length ?? 1,
        origin: p.origin,
        axis: p.axis,
      };
    }),
  };
}
