import type { GameState, PlayerId } from '../../../engine/index.ts';
import { Glyph } from '../../common/identity.tsx';
import { useTranslator } from '../../common/locale-state.ts';
import { Msg } from '../../common/Msg.tsx';
import { FleetBoard } from '../../table/FleetBoard.tsx';
import { labelsFor } from '../../table/format.ts';
import type { Session } from '../store.ts';
import { fleetImage, fleetUrl } from './fleet-url.ts';
import { Qr } from '../../common/Qr.tsx';

/** A player's QR code, preview board and fleet check. Private: never on the TV. */
export function PrivateFleet({ g, s, player, showQr, showBoard }: { readonly g: GameState; readonly s: Session; readonly player: PlayerId; readonly showQr: boolean; readonly showBoard: boolean }) {
  const t = useTranslator();
  const image = fleetImage(g, s, player);
  const i = s.seats.findIndex((x) => x.id === player);
  const board = g.boards[i];
  const hits = new Set<string>();
  board?.cells.forEach((c, j) => {
    if (c === 2) hits.add(`${Math.floor(j / g.rules.cols)},${j % g.rules.cols}`);
  });
  return (
    <div class="private-fleet">
      <p class="private-name">
        <Glyph identity={i} size="1.5em" /> <bdi>{image.name}</bdi>
      </p>
      <div class="private-body">
        {showQr && (
          <figure class="private-qr">
            <Qr text={fleetUrl(image)} label={t.format('handout.scan')} />
            <figcaption>
              <Msg id="handout.scan" />
            </figcaption>
          </figure>
        )}
        {showBoard && (
          <FleetBoard
            rows={image.rows}
            cols={image.cols}
            labels={labelsFor(image.labels, image.labels2, image.numbering)}
            dir={image.dir}
            writingMode={image.writingMode}
            ships={image.ships}
            identity={i}
            hits={hits}
            className={showQr ? 'is-small' : ''}
          />
        )}
      </div>
      <p class="private-check">
        <Msg id="handout.check" />{' '}
        <bdi dir="ltr" class="code" data-testid="fleet-check">
          {image.fleetCheck}
        </bdi>
      </p>
    </div>
  );
}
