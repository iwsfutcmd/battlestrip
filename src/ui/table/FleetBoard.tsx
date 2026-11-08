import type { WritingMode } from '../../i18n/direction.ts';
import type { Direction } from '../../i18n/direction.ts';
import { formatNumber } from '../../i18n/labels.ts';
import type { FleetImageShip } from '../../share/payload.ts';
import { identityColour } from '../common/identity.tsx';
import type { BoardLabels } from './format.ts';
import { Grid, shipArea } from './Grid.tsx';

export interface FleetBoardProps {
  readonly rows: number;
  readonly cols: number;
  readonly labels: BoardLabels;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  readonly ships: readonly FleetImageShip[];
  readonly identity: number;
  /** Squares already hit, if known (peek during play, game over). */
  readonly hits?: ReadonlySet<string>;
  readonly className?: string;
}

/** A board with ship outlines and each ship's number inside its outline. */
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
        <div
          key={s.number}
          class="ship-outline"
          style={{ ...shipArea(s.origin, s.axis, s.length), borderColor: identityColour(identity) }}
        >
          <span class="ship-number">{formatNumber(labels.digitsLocale, s.number)}</span>
        </div>
      ))}
    />
  );
}
