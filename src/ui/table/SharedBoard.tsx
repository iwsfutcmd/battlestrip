import { useState } from 'preact/hooks';
import { bombFootprint, VIEW_UNSHOT, type Coord, type PlayerView } from '../../engine/index.ts';
import type { Direction, WritingMode } from '../../i18n/direction.ts';
import { Glyph } from '../common/identity.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { sharedGrid, type CallSummary } from './derive.ts';
import { coordText, shipNameIn, type BoardLabels } from './format.ts';
import { Grid, type GridInteraction } from './Grid.tsx';
import type { PublicSeat } from './types.ts';

export interface SharedBoardProps {
  readonly view: PlayerView;
  readonly seats: readonly PublicSeat[];
  readonly labels: BoardLabels;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  /** The latest call, and whether its results are revealed yet. */
  readonly last: CallSummary | null;
  readonly revealed: boolean;
  readonly interaction?: GridInteraction | undefined;
  readonly className?: string | undefined;
}

/**
 * The one shared grid: each called square shows a miss mark or the glyphs of
 * everyone hit there, plus a sunk marker. During the beat, the latest call's
 * squares are highlighted but their results stay hidden.
 *
 * Where it can be played (the control window), the highlighted square (under
 * the pointer, or else the one picked) gets a card saying whose clothes were
 * hit there and which piece, and when the caller drops bombs, the four squares
 * the bomb would cover are outlined.
 */
export function SharedBoard({ view, seats, labels, dir, writingMode, last, revealed, interaction, className }: SharedBoardProps) {
  const t = useTranslator();
  const [hover, setHover] = useState<Coord | null>(null);
  const cells = sharedGrid(view);
  const { cols, rows } = view.rules;
  const lastKeys = new Set((last?.cells ?? []).map((c) => c.row * cols + c.col));
  const noOps = new Set((last?.noOps ?? []).map((c) => c.row * cols + c.col));
  const hidden = !revealed && last ? lastKeys : new Set<number>();

  const live = interaction && view.phase === 'playing';
  const highlighted = live ? (hover ?? (interaction.selected ? interaction.focus : null)) : null;
  const bombKeys = new Set(
    highlighted && view.currentShape === 'bomb' ? bombFootprint(view.rules, highlighted).map((c) => c.row * cols + c.col) : [],
  );

  // Whose clothes were hit on the highlighted square, and which piece (public: hits are announced).
  const info = (() => {
    if (!highlighted) return null;
    const i = highlighted.row * cols + highlighted.col;
    const cell = cells[i];
    if (!cell || cell.hits.length === 0 || (hidden.has(i) && !noOps.has(i))) return null;
    const lines = cell.hits.map((seat) => {
      const code = view.boards[seat]?.cells[i] ?? VIEW_UNSHOT;
      const def = code >= 0 ? view.rules.shipyard[code] : undefined;
      const off = def ? view.players[seat]?.ships.find((s) => s.ship === def.id)?.sunk === true : false;
      return { seat, piece: def ? shipNameIn(t, view.rules, def.id) : null, off };
    });
    return { at: highlighted, lines };
  })();

  return (
    <Grid
      rows={rows}
      cols={cols}
      labels={labels}
      dir={dir}
      writingMode={writingMode}
      className={`shared-board ${className ?? ''}`}
      ariaHidden={!interaction}
      interaction={interaction ? { ...interaction, onHover: setHover } : undefined}
      cell={(c) => {
        const i = c.row * cols + c.col;
        const cell = cells[i];
        const classes = [
          lastKeys.has(i) ? 'is-last' : '',
          noOps.has(i) ? 'is-noop' : '',
          last?.shape === 'bomb' && lastKeys.has(i) ? 'is-bomb' : '',
          bombKeys.has(i) ? 'is-bomb-preview' : '',
        ];
        if (!cell?.called || (hidden.has(i) && !noOps.has(i))) return { className: classes.join(' ') };
        if (cell.hits.length === 0) return { className: [...classes, 'is-miss'].join(' '), content: <span class="miss-mark" aria-hidden="true" /> };
        return {
          className: [...classes, 'is-hit', cell.sunk ? 'is-sunk' : ''].join(' '),
          content: (
            <span class="hit-glyphs" aria-hidden="true">
              {cell.hits.map((seat) => (
                <Glyph key={seat} identity={seats[seat]?.identity ?? seat} size="var(--glyph)" />
              ))}
            </span>
          ),
        };
      }}
      overlays={
        info && (
          <div
            class={`cell-info ${info.at.row === 0 ? 'is-below' : ''}`}
            style={{ gridRow: String(info.at.row + 2), gridColumn: String(info.at.col + 2) }}
            aria-hidden="true"
          >
            <div class="cell-info-card">
              <bdi class="cell-info-coord">{coordText(t, labels, info.at)}</bdi>
              {info.lines.map(({ seat, piece, off }) => (
                <span key={seat} class="cell-info-line">
                  <Glyph identity={seats[seat]?.identity ?? seat} size="1em" />{' '}
                  <Msg
                    id={piece === null ? 'board.hitUnnamed' : off ? 'board.hitPieceOff' : 'board.hitPiece'}
                    values={{ player: seats[seat]?.name ?? '', piece: piece ?? '' }}
                  />
                </span>
              ))}
            </div>
          </div>
        )
      }
    />
  );
}

