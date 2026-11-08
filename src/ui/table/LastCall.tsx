import type { PlayerView } from '../../engine/index.ts';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import type { CallSummary } from './derive.ts';
import { coordText, shipNameIn, type BoardLabels } from './format.ts';
import type { PublicSeat } from './types.ts';

const nameOf = (seats: readonly PublicSeat[], id: string): string => seats.find((s) => s.id === id)?.name ?? id;

/** The last call in huge type, then (after the beat) every result at once. */
export function LastCall({
  view,
  seats,
  labels,
  last,
  revealed,
}: {
  readonly view: PlayerView;
  readonly seats: readonly PublicSeat[];
  readonly labels: BoardLabels;
  readonly last: CallSummary;
  readonly revealed: boolean;
}) {
  const t = useTranslator();
  const caller = nameOf(seats, last.by);
  return (
    <section class={`last-call ${last.shape === 'bomb' ? 'is-bomb' : ''}`}>
      <p class="last-call-by">
        <Msg id="call.turn" values={{ turn: last.turn }} />
        {' · '}
        <bdi>{caller}</bdi>
      </p>
      <p class="last-call-coord">
        {last.shape === 'bomb' && (
          <span class="bomb-tag">
            <span class="bomb-mini" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span aria-hidden="true">☢</span> <Msg id="call.bomb" />
          </span>
        )}
        <bdi class="coord-big">{coordText(t, labels, last.at)}</bdi>
      </p>
      <div class="last-call-results" aria-live="polite" aria-atomic="true">
        {revealed && (
          <ul class="results">
            {last.hits.length === 0 && (
              <li class="result-none">
                <Msg id="result.noHits" />
              </li>
            )}
            {last.hits.map((h, i) => (
              <li key={i} class="result-hit">
                <Msg
                  id="result.hit"
                  values={{
                    player: nameOf(seats, h.board),
                    ship: h.ship ? shipNameIn(t, view.rules, h.ship) : '?',
                    square: coordText(t, labels, h.at),
                  }}
                />
              </li>
            ))}
            {last.sunk.map((s, i) => (
              <li key={`s${i}`} class="result-sunk">
                <Msg id="result.sunk" values={{ player: nameOf(seats, s.board), ship: shipNameIn(t, view.rules, s.ship) }} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div class="last-call-nuclear" aria-live="assertive" aria-atomic="true">
        {revealed &&
          last.nuclear.map((p) => (
            <p key={p} class="result-nuclear">
              <span aria-hidden="true">☢ </span>
              <Msg id="result.nuclear" values={{ player: nameOf(seats, p) }} />
            </p>
          ))}
        {revealed && last.lastFleet && (
          <p class="result-last-fleet">
            <span aria-hidden="true">★ </span>
            <Msg id="result.lastFleet" values={{ player: nameOf(seats, last.lastFleet) }} />
          </p>
        )}
      </div>
    </section>
  );
}
