import { copyNumber, type Award, type GameStats, type PlayerView } from '../../engine/index.ts';
import { formatList } from '../../i18n/index.ts';
import { numberingSystemOf } from '../../i18n/labels.ts';
import { Glyph } from '../common/identity.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { FleetBoard } from './FleetBoard.tsx';
import { labelsFor, shipNameIn } from './format.ts';
import type { PublicSeat, TableSettings } from './types.ts';

/** A celebration, not a ranking: the last fleet (if any), every fleet revealed, and earned awards. */
export function GameOver({
  view,
  seats,
  stats,
  settings,
}: {
  readonly view: PlayerView;
  readonly seats: readonly PublicSeat[];
  readonly stats: GameStats | null;
  readonly settings: TableSettings;
}) {
  const t = useTranslator();
  const name = (id: string): string => seats.find((s) => s.id === id)?.name ?? id;
  const labels = labelsFor(settings.labels, settings.labels2, numberingSystemOf(settings.locale));
  const players = (a: Award): string => formatList(t.locale, a.winners.map((w) => name(w.player)));
  const ships = (a: Award): string =>
    formatList(
      t.locale,
      a.winners.map((w) => t.format('award.shipOf', { player: name(w.player), ship: w.ship ? shipNameIn(t, view.rules, w.ship) : '' })),
    );
  const result = view.result;
  return (
    <section class="game-over" aria-labelledby="over-heading">
      <h2 id="over-heading">
        <Msg id="over.heading" />
      </h2>
      <p class="over-result" aria-live="assertive">
        {result?.kind === 'lastFleet' ? (
          <Msg id="over.lastFleet" values={{ player: name(result.player) }} />
        ) : result?.kind === 'playedOut' ? (
          // Turns after the one that made them the last fleet, up to the call that sank them.
          <Msg id="over.playedOut" values={{ player: name(result.player), turns: Math.max(0, view.turn - result.standingFrom - 1) }} />
        ) : (
          <Msg id="over.allNuclear" />
        )}
      </p>
      {stats && stats.awards.length > 0 && (
        <>
          <h3>
            <Msg id="over.awards" />
          </h3>
          <ul class="awards">
            {stats.awards.map((a) => (
              <li key={a.kind}>
                {a.kind === 'longestSurvivor' ? (
                  <Msg id="award.longestSurvivor" values={{ ships: ships(a), count: a.count }} />
                ) : (
                  <Msg id={`award.${a.kind}`} values={{ players: players(a), count: a.count }} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {view.revealed && (
        <>
          <h3>
            <Msg id="over.fleets" />
          </h3>
          <ul class="revealed-fleets">
            {seats.map((seat, i) => {
              const fleet = view.revealed?.[i] ?? [];
              const board = view.boards[i];
              const hits = new Set<string>();
              board?.cells.forEach((v, j) => {
                if (v >= 0 || v === -3) hits.add(`${Math.floor(j / view.rules.cols)},${j % view.rules.cols}`);
              });
              return (
                <li key={seat.id} class="revealed-fleet">
                  <p class="revealed-name">
                    <Glyph identity={seat.identity} /> <bdi>{seat.name}</bdi>
                  </p>
                  <FleetBoard
                    rows={view.rules.rows}
                    cols={view.rules.cols}
                    labels={labels}
                    dir={t.dir}
                    writingMode={settings.writingMode}
                    identity={seat.identity}
                    hits={hits}
                    className="is-small"
                    ships={fleet.map((p) => {
                      const def = view.rules.shipyard.find((s) => s.id === p.ship);
                      return {
                        number: def?.number ?? 0,
                        kind: def?.kind ?? '',
                        copy: copyNumber(view.rules.shipyard, p.ship),
                        length: def?.length ?? 1,
                        origin: p.origin,
                        axis: p.axis,
                      };
                    })}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
