import { useEffect } from 'preact/hooks';
import { numberingSystemOf } from '../../i18n/labels.ts';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { Qr } from '../common/Qr.tsx';
import { summarizeTurn } from './derive.ts';
import { labelsFor } from './format.ts';
import type { GridInteraction } from './Grid.tsx';
import { GameOver } from './GameOver.tsx';
import { LastCall } from './LastCall.tsx';
import { Roster } from './Roster.tsx';
import { SharedBoard } from './SharedBoard.tsx';
import type { PublicTable } from './types.ts';

export interface TableDisplayProps {
  readonly table: PublicTable;
  /** The control window passes a grid interaction; the TV doesn't. */
  readonly interaction?: GridInteraction | undefined;
  readonly showHousekeeping: boolean;
}

/** The shared screen: one grid, the last-call card and the roster. Public information only. */
export function TableDisplay({ table, interaction, showHousekeeping }: TableDisplayProps) {
  const t = useTranslator();
  const view = table.view;
  const labels = labelsFor(table.settings.labels, table.settings.labels2, numberingSystemOf(table.settings.locale));
  const last = view && table.reveal ? summarizeTurn(view.events, table.reveal.turn) : null;
  const revealed = table.reveal?.revealed ?? true;

  return (
    <div class="tv" data-stage={table.stage} data-wm={table.settings.writingMode} style={{ writingMode: table.settings.writingMode }}>
      <header class="tv-bar">
        <h1 class="tv-title">
          <Msg id="app.title" />
        </h1>
        {table.gameCode && (
          <p class="tv-code">
            <Msg id="display.gameCode" /> <bdi dir="ltr" class="code">{table.gameCode}</bdi>
          </p>
        )}
        {showHousekeeping && <Housekeeping />}
      </header>
      {table.stage === 'over' && view ? (
        <div class="tv-over">
          <GameOver view={view} seats={table.seats} stats={table.stats} settings={table.settings} />
          <Roster table={table} view={view} />
        </div>
      ) : (
        <div class="tv-main">
          <div class="tv-board-wrap">
            {view ? (
              <SharedBoard
                view={view}
                seats={table.seats}
                labels={labels}
                dir={t.dir}
                writingMode={table.settings.writingMode}
                last={last}
                revealed={revealed}
                interaction={interaction}
              />
            ) : table.stage === 'placement' && table.invite ? (
              <figure class="tv-invite">
                <Qr text={table.invite} label={t.format('display.placementQr')} />
                <figcaption>
                  <Msg id="display.placementQr" />
                </figcaption>
              </figure>
            ) : (
              <p class="tv-waiting">
                <Msg id={table.stage === 'handout' ? 'display.setup' : 'display.lobby'} />
              </p>
            )}
          </div>
          <aside class="tv-side">
            {view && last && <LastCall view={view} seats={table.seats} labels={labels} last={last} revealed={revealed} />}
            {table.stage === 'handout' && (
              <p class="tv-waiting">
                <Msg id="display.setup" />
              </p>
            )}
            <Roster table={table} view={view} />
          </aside>
        </div>
      )}
    </div>
  );
}

/** Fullscreen toggle, and a screen wake lock so the TV doesn't sleep. */
function Housekeeping() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    const acquire = async (): Promise<void> => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Not supported or not allowed: the TV may dim. Nothing else to do.
      }
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  return (
    <button
      type="button"
      class="tv-fullscreen"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      }}
    >
      <Msg id="display.fullscreen" />
    </button>
  );
}
