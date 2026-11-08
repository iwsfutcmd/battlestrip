import type { WritingMode } from '../../i18n/direction.ts';
import type { Direction } from '../../i18n/direction.ts';
import { identityColour } from '../common/identity.tsx';
import type { BoardLabels } from './format.ts';
import { Grid } from './Grid.tsx';
import { PieceOutline, type BoardPiece } from './Piece.tsx';

export interface FleetBoardProps {
  readonly rows: number;
  readonly cols: number;
  readonly labels: BoardLabels;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  readonly ships: readonly BoardPiece[];
  readonly identity: number;
  /** Squares already hit, if known (peek during play, game over). */
  readonly hits?: ReadonlySet<string>;
  readonly className?: string;
}

/** A board with each piece outlined (any shape) and its number inside the outline. */
export function FleetBoard({ rows, cols, labels, dir, writingMode, ships, identity, hits, className }: FleetBoardProps) {
  return (
    <Grid
      rows={rows}
      cols={cols}
      labels={labels}
      dir={dir}
      writingMode={writingMode}
      className={`fleet-board ${className ?? ''}`}
      ariaHidden
      cell={(c) => ({ className: hits?.has(`${c.row},${c.col}`) ? 'is-hit' : '' })}
      overlays={ships.map((s) => (
        <PieceOutline key={s.number} piece={s} colour={identityColour(identity)} digitsLocale={labels.digitsLocale} />
      ))}
    />
  );
}
