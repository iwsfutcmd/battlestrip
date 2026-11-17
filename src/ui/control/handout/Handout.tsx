import { Msg } from '../../common/Msg.tsx';
import { beginPlay, confirmReady, game, ready, reroll, session } from '../store.ts';
import { PrivateFleet } from './PrivateFleet.tsx';

/**
 * One human player at a time, in seat order: their name and QR code (scanned
 * with the phone's ordinary camera) and fleet check, then Got it or Reroll.
 * The laptop never draws the layout here, so there's nothing to look away
 * from: scanning someone else's code is on the scanner.
 */
export function Handout() {
  const g = game.value;
  const s = session.value;
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

  return (
    <section class="handout handout-qr">
      <p class="handout-progress">
        <Msg id="handout.progress" values={{ done, total: humans.length }} />
      </p>
      {/* Only the QR code: the layout itself is for the player's phone, not the laptop's screen. */}
      <PrivateFleet g={g} s={s} player={next.id} showQr showBoard={false} />
      <div class="actions">
        <button
          type="button"
          class="primary"
          onClick={() => confirmReady(next.id)}
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
