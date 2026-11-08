import { signal } from '@preact/signals';
import { useEffect, useId, useState } from 'preact/hooks';
import type { Coord } from '../../engine/index.ts';
import { numberingSystemOf } from '../../i18n/labels.ts';
import { parseCoord } from '../../i18n/parse.ts';
import { formatList } from '../../i18n/index.ts';
import { translator, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { isUndoShortcut } from '../keyboard.ts';
import { coordText, labelsFor } from '../table/format.ts';
import type { GridInteraction } from '../table/Grid.tsx';
import { Peek } from './peek/Peek.tsx';
import {
  backToLobby,
  canUndo,
  choosing,
  focusCell,
  game,
  notice,
  replaySameSeed,
  revealing,
  session,
  stage,
  submitCall,
  undo,
} from './store.ts';

/** The call being typed; clicking the grid fills it in. */
export const callText = signal('');

function labels() {
  const s = session.value;
  return s ? labelsFor(s.settings.labels, s.settings.labels2, numberingSystemOf(s.settings.locale)) : null;
}

/** The control grid's keyboard and pointer behaviour (ARIA grid with a roving tabindex). */
export function useGridInteraction(): GridInteraction | undefined {
  const t = translator.value;
  const g = game.value;
  const s = session.value;
  const l = labels();
  if (!t || !g || !s || !l || stage.value !== 'playing') return undefined;
  const view = g.boards;
  const cellName = (c: Coord): string => {
    const coord = coordText(t, l, c);
    const i = c.row * g.rules.cols + c.col;
    const hit = s.seats.flatMap((seat, k) => {
      const v = view[k]?.cells[i] ?? 0;
      return v === 2 ? [s.names[k] ?? seat.id] : [];
    });
    if (hit.length > 0) return t.format('cell.hit', { coord, players: formatList(t.locale, hit) });
    const called = view.some((b) => (b.cells[i] ?? 0) !== 0);
    return t.format(called ? 'cell.miss' : 'cell.unshot', { coord });
  };
  return {
    focus: focusCell.value,
    gridName: t.format('play.grid'),
    cellName,
    onFocus: (c) => {
      focusCell.value = c;
      callText.value = coordText(t, l, c).replaceAll(/[\u2066-\u2069]/gu, '');
    },
    onActivate: (c) => {
      focusCell.value = c;
      if (submitCall(c)) callText.value = '';
    },
  };
}

export function PlayPanel({ displayConnected, tableHere, onToggleTable }: { readonly displayConnected: boolean; readonly tableHere: boolean; readonly onToggleTable: () => void }) {
  const t = useTranslator();
  const inputId = useId();
  const hintId = useId();
  const [peeking, setPeeking] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const g = game.value;
  const s = session.value;
  const l = labels();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!isUndoShortcut(e)) return;
      // In a non-empty text field, Ctrl+Z belongs to the field.
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.value !== '') return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!g || !s || !l) return null;
  const currentName = s.names[g.current] ?? '';
  const nuclear = g.status[g.current]?.sunkOnTurn !== null && g.rules.nuclear;
  const isBot = g.seats[g.current]?.kind === 'bot';
  const example = coordText(t, l, { row: Math.min(3, g.rules.rows - 1), col: Math.min(3, g.rules.cols - 1) }).replaceAll(/[\u2066-\u2069]/gu, '');

  const submit = (e: Event): void => {
    e.preventDefault();
    const parsed = parseCoord(callText.value, { rows: g.rules.rows, cols: g.rules.cols, systems: [s.settings.labels, ...(s.settings.labels2 ? [s.settings.labels2] : [])] });
    if (!parsed.ok) {
      notice.value = { key: parsed.error, values: { example }, tone: 'error' };
      return;
    }
    focusCell.value = parsed.value;
    if (submitCall(parsed.value)) callText.value = '';
  };

  return (
    <aside class={`play-panel ${collapsed ? 'is-collapsed' : ''}`} aria-labelledby="controls-heading">
      <div class="play-panel-head">
        <h2 id="controls-heading">
          <Msg id="play.controls" />
        </h2>
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={collapsed ? 'false' : 'true'}>
          <Msg id={collapsed ? 'play.expand' : 'play.collapse'} />
        </button>
      </div>
      {!collapsed && (
        <div class="play-panel-body">
          {stage.value === 'playing' && (
            <>
              <p class="play-who">
                {choosing.value ? (
                  <Msg id="roster.choosing" values={{ name: currentName }} />
                ) : (
                  <Msg id={nuclear ? 'roster.bombing' : 'roster.calling'} values={{ name: currentName }} />
                )}
              </p>
              <form class="call-form" onSubmit={submit}>
                <label for={inputId}>
                  <Msg id="play.callLabel" />
                </label>
                <div class="call-row">
                  <input
                    id={inputId}
                    class="call-input"
                    type="text"
                    dir="auto"
                    autocomplete="off"
                    spellcheck={false}
                    aria-describedby={hintId}
                    disabled={isBot}
                    value={callText.value}
                    onInput={(e) => (callText.value = e.currentTarget.value)}
                  />
                  <button type="submit" class="primary" disabled={isBot || revealing()}>
                    <Msg id="play.submit" />
                  </button>
                </div>
                <p id={hintId} class="muted">
                  {nuclear ? <Msg id="play.bombHint" values={{ name: currentName }} /> : <Msg id="play.callHint" values={{ example }} />}
                </p>
              </form>
              <div class="actions">
                <button type="button" disabled={!canUndo.value || revealing()} onClick={undo}>
                  <Msg id="play.undo" />
                </button>
              </div>
              <p class="muted small">
                <Msg id="play.undoNote" />
              </p>
            </>
          )}
          {notice.value && (
            <p class={notice.value.tone === 'error' ? 'error' : 'info'} role={notice.value.tone === 'error' ? 'alert' : 'status'}>
              <Msg id={notice.value.key} values={notice.value.values} />
            </p>
          )}
          {stage.value === 'over' && (
            <div class="actions">
              <button type="button" class="primary" onClick={replaySameSeed}>
                <Msg id="over.replay" />
              </button>
              <button type="button" onClick={backToLobby}>
                <Msg id="over.newGame" />
              </button>
            </div>
          )}
          <div class="actions">
            <button type="button" onClick={() => setPeeking(true)}>
              <Msg id="play.peek" />
            </button>
            <button type="button" onClick={() => window.open('display/', 'battlestrip-display', 'popup')}>
              <Msg id="play.openDisplay" />
            </button>
            {displayConnected && (
              <button type="button" onClick={onToggleTable}>
                <Msg id={tableHere ? 'play.hideTable' : 'play.showTable'} />
              </button>
            )}
            {stage.value === 'playing' && (
              <button type="button" class="subtle" onClick={backToLobby}>
                <Msg id="play.endGame" />
              </button>
            )}
          </div>
        </div>
      )}
      {peeking && <Peek onClose={() => setPeeking(false)} />}
    </aside>
  );
}
