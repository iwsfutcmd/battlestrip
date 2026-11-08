import type { PlayerView } from '../../engine/index.ts';
import type { Direction, WritingMode } from '../../i18n/direction.ts';
import { Glyph } from '../common/identity.tsx';
import { sharedGrid, type CallSummary } from './derive.ts';
import type { BoardLabels } from './format.ts';
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
 */
export function SharedBoard({ view, seats, labels, dir, writingMode, last, revealed, interaction, className }: SharedBoardProps) {
  const cells = sharedGrid(view);
  const { cols } = view.rules;
  const lastKeys = new Set((last?.cells ?? []).map((c) => c.row * cols + c.col));
  const noOps = new Set((last?.noOps ?? []).map((c) => c.row * cols + c.col));
  const hidden = !revealed && last ? lastKeys : new Set<number>();
  return (
    <Grid
      rows={view.rules.rows}
      cols={cols}
      labels={labels}
      dir={dir}
      writingMode={writingMode}
      className={`shared-board ${className ?? ''}`}
      ariaHidden={!interaction}
      interaction={interaction}
      cell={(c) => {
        const i = c.row * cols + c.col;
        const cell = cells[i];
        const classes = [
          lastKeys.has(i) ? 'is-last' : '',
          noOps.has(i) ? 'is-noop' : '',
          last?.shape === 'bomb' && lastKeys.has(i) ? 'is-bomb' : '',
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
    />
  );
}
