import type { GameState, PlayerId } from '../../../engine/index.ts';
import { directionOf } from '../../../i18n/direction.ts';
import { numberingSystemOf } from '../../../i18n/labels.ts';
import { checkFor, fleetImageFor } from '../../../share/fleet-image.ts';
import { encodeFleetImage, type FleetImage } from '../../../share/payload.ts';
import { placedOnPhone, type Session } from '../store.ts';

/** The private fleet image for a player, and the phone URL that carries it in its fragment. */
export function fleetImage(g: GameState, s: Session, player: PlayerId): FleetImage {
  const i = s.seats.findIndex((x) => x.id === player);
  return fleetImageFor(g, player, s.names[i] ?? '', {
    labels: s.settings.labels,
    labels2: s.settings.labels2,
    numbering: numberingSystemOf(s.settings.locale),
    dir: directionOf(s.settings.locale),
    writingMode: s.settings.writingMode,
  }, placedOnPhone.value.includes(player));
}

export function fleetUrl(image: FleetImage): string {
  return new URL(`fleet/#${encodeFleetImage(image)}`, location.href).toString();
}

export { checkFor };
