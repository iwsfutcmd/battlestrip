import { useState } from 'preact/hooks';
import { Glyph } from '../../common/identity.tsx';
import { Msg } from '../../common/Msg.tsx';
import { beginPlay, confirmReady, game, ready, reroll, session } from '../store.ts';
import { PrivateFleet } from './PrivateFleet.tsx';

/**
 * One human player at a time, in seat order: a privacy screen, then their QR
 * code (scanned with the phone's ordinary camera) with a preview and fleet
 * check, then Got it or Reroll.
 */
export function Handout() {
  const g = game.value;
  const s = session.value;
  const [shown, setShown] = useState(false);
  if (!g || !s) return null;
  const nextIndex = s.seats.findIndex((seat) => seat.kind === 'human' && !ready.value.includes(seat.id));
  const next = s.seats[nextIndex];
  const humans = s.seats.filter((x) => x.kind === 'human');
  const done = humans.filter((x) => ready.value.includes(x.id)).length;

  if (!next) {
    return (
      <section class="handout handout-done">
        <h2>
          <Msg id="handout.heading" />
        </h2>
        <p>
          <Msg id="handout.progress" values={{ done, total: humans.length }} />
        </p>
        <button type="button" class="primary" onClick={beginPlay}>
          <Msg id="handout.start" />
        </button>
      </section>
    );
  }

  const name = s.names[nextIndex] ?? '';
  if (!shown) {
    return (
      <section class="handout handout-privacy">
        <p class="handout-progress">
          <Msg id="handout.progress" values={{ done, total: humans.length }} />
        </p>
        <h2 class="handout-pass">
          <Glyph identity={nextIndex} size="1.2em" /> <Msg id="handout.passTo" values={{ name }} />
        </h2>
        <p>
          <Msg id="handout.lookAway" />
        </p>
        <button type="button" class="primary" onClick={() => setShown(true)}>
          <Msg id="handout.show" />
        </button>
      </section>
    );
  }

  return (
    <section class="handout handout-qr">
      <PrivateFleet g={g} s={s} player={next.id} showQr showBoard />
      <div class="actions">
        <button
          type="button"
          class="primary"
          onClick={() => {
            confirmReady(next.id);
            setShown(false);
          }}
        >
          <Msg id="handout.gotIt" />
        </button>
        <button type="button" onClick={() => reroll(next.id)}>
          <Msg id="handout.reroll" />
        </button>
      </div>
    </section>
  );
}
