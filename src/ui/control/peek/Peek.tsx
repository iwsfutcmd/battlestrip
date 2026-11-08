import { useState } from 'preact/hooks';
import type { PlayerId } from '../../../engine/index.ts';
import { HoldToReveal } from '../../common/HoldToReveal.tsx';
import { Glyph } from '../../common/identity.tsx';
import { Msg } from '../../common/Msg.tsx';
import { PrivateFleet } from '../handout/PrivateFleet.tsx';
import { game, session } from '../store.ts';

/**
 * Show one player's fleet privately on the laptop, for players without a
 * phone or anyone who closed their image: pick a player, a privacy screen,
 * then hold to view. The handout QR can be shown again (same fleet, same check).
 */
export function Peek({ onClose }: { readonly onClose: () => void }) {
  const g = game.value;
  const s = session.value;
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [passed, setPassed] = useState(false);
  const [qr, setQr] = useState(false);
  if (!g || !s) return null;
  const i = player ? s.seats.findIndex((x) => x.id === player) : -1;
  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="peek-heading">
      <section class="peek">
        <h2 id="peek-heading">
          <Msg id="peek.heading" />
        </h2>
        {!player && (
          <>
            <p>
              <Msg id="peek.choose" />
            </p>
            <ul class="peek-players">
              {s.seats.map((seat, k) => (
                <li key={seat.id}>
                  <button type="button" onClick={() => setPlayer(seat.id)}>
                    <Glyph identity={k} /> <bdi>{s.names[k]}</bdi>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {player && !passed && (
          <>
            <p class="handout-pass">
              <Msg id="handout.passTo" values={{ name: s.names[i] ?? '' }} />
            </p>
            <p>
              <Msg id="handout.lookAway" />
            </p>
            <button type="button" class="primary" onClick={() => setPassed(true)}>
              <Msg id="handout.show" />
            </button>
          </>
        )}
        {player && passed && (
          <>
            <HoldToReveal labelId="peek.hold">
              <PrivateFleet g={g} s={s} player={player} showQr={qr} showBoard />
            </HoldToReveal>
            <label class="check">
              <input type="checkbox" checked={qr} onChange={(e) => setQr(e.currentTarget.checked)} /> <Msg id="peek.showQr" />
            </label>
          </>
        )}
        <div class="actions">
          <button type="button" onClick={onClose}>
            <Msg id="common.done" />
          </button>
        </div>
      </section>
    </div>
  );
}
