import { copyNumber, type PlayerView } from '../../engine/index.ts';
import { PieceMarker } from '../common/clothing.tsx';
import { Glyph } from '../common/identity.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { shipName } from './format.ts';
import type { PublicTable } from './types.ts';

/** Tables bigger than this get the compact roster. */
export const COMPACT_FROM = 6;

/** Each player: glyph, name, chosen fleet as numbered pictograms (one segment per square). */
export function Roster({ table, view }: { readonly table: PublicTable; readonly view: PlayerView | null }) {
  const t = useTranslator();
  const rules = view?.rules;
  // Past six players the side column can't hold every card: one short row each, in columns.
  const compact = table.seats.length > COMPACT_FROM;
  return (
    <section class="roster" aria-labelledby="roster-heading">
      <h2 id="roster-heading" class="visually-hidden">
        <Msg id="roster.heading" />
      </h2>
      <ul class={`roster-list ${compact ? 'is-compact' : ''}`}>
        {table.seats.map((seat, i) => {
          const p = view?.players[i];
          const current = view?.current === seat.id;
          const nuclear = p ? !p.afloat : false;
          const ready = table.ready.includes(seat.id);
          return (
            <li key={seat.id} class={`roster-row ${current ? 'is-current' : ''} ${nuclear ? 'is-nuclear' : ''}`} aria-current={current ? 'true' : undefined}>
              <Glyph identity={seat.identity} size="1.4em" />
              <div class="roster-main">
                <div class="roster-name-line">
                  <bdi class="roster-name">{seat.name}</bdi>
                  {seat.kind === 'bot' && (
                    <span class="badge">
                      <Msg id="roster.bot" />
                    </span>
                  )}
                  {view?.standing?.player === seat.id && (
                    <span class="badge badge-last">
                      <span aria-hidden="true">★ </span>
                      <Msg id="roster.lastFleet" />
                    </span>
                  )}
                  {nuclear && (
                    <span class="badge badge-nuclear">
                      <span aria-hidden="true">☢ </span>
                      <Msg id="roster.nuclear" />
                    </span>
                  )}
                  {(table.stage === 'handout' || table.stage === 'placement') && ready && (
                    <span class="badge badge-ready">
                      <span aria-hidden="true">✓ </span>
                      <Msg id="roster.ready" />
                    </span>
                  )}
                </div>
                {current && (
                  <div class="roster-status">
                    {table.choosing === seat.id ? (
                      <Msg id="roster.choosing" values={{ name: seat.name }} />
                    ) : view?.currentShape === 'bomb' ? (
                      <Msg id="roster.bombing" values={{ name: seat.name }} />
                    ) : (
                      <Msg id="roster.calling" values={{ name: seat.name }} />
                    )}
                  </div>
                )}
                {rules && p && compact && (
                  <span
                    class="roster-pips"
                    role="img"
                    aria-label={t.format('roster.piecesOff', { off: p.ships.filter((s) => s.sunk).length, total: p.ships.length })}
                  >
                    {p.ships.map((s) => (
                      <span key={s.ship} class={`roster-pip ${s.sunk ? 'is-off' : (s.hits ?? 0) > 0 ? 'is-hit' : ''}`} />
                    ))}
                  </span>
                )}
                {rules && p && !compact && (
                  <ul class="fleet-pics">
                    {p.ships.map((s) => {
                      const def = rules.shipyard.find((x) => x.id === s.ship);
                      const name = shipName(t, def?.kind ?? '', copyNumber(rules.shipyard, s.ship));
                      const hits = s.hits ?? 0;
                      return (
                        <li
                          key={s.ship}
                          class={`ship-pic ${s.sunk ? 'is-sunk' : ''}`}
                          aria-label={
                            s.sunk ? t.format('ship.sunkStatus', { ship: name }) : t.format('ship.status', { ship: name, length: s.length, hits })
                          }
                        >
                          <PieceMarker kind={def?.kind ?? ''} number={def?.number ?? 0} locale={table.settings.locale} className="ship-pic-number" />
                          <span class="ship-pic-hull" aria-hidden="true">
                            {Array.from({ length: s.length }, (_, k) => (
                              <span key={k} class={`ship-seg ${k < hits ? 'is-hit' : ''}`} />
                            ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
