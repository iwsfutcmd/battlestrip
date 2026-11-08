import type { ComponentChildren, CSSProperties, TargetedKeyboardEvent } from 'preact';
import { useRef } from 'preact/hooks';
import type { Coord } from '../../engine/index.ts';
import type { Direction, WritingMode } from '../../i18n/direction.ts';
import { arrowDelta, isArrowKey } from '../keyboard.ts';
import { colText, row2Text, rowText, type BoardLabels } from './format.ts';

export interface CellRender {
  readonly content?: ComponentChildren;
  readonly className?: string | undefined;
}

export interface GridInteraction {
  readonly focus: Coord;
  /** The focused square was picked on purpose: shown as selected, and clicking it again activates it. */
  readonly selected: boolean;
  readonly onFocus: (c: Coord) => void;
  readonly onActivate: (c: Coord) => void;
  /** Accessible name for a cell (from a message). */
  readonly cellName: (c: Coord) => string;
  readonly gridName: string;
}

export interface GridProps {
  readonly rows: number;
  readonly cols: number;
  readonly labels: BoardLabels;
  /** The game's direction and writing mode, not the UI's. */
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  readonly cell: (c: Coord) => CellRender;
  readonly overlays?: ComponentChildren | undefined;
  readonly interaction?: GridInteraction | undefined;
  readonly className?: string | undefined;
  readonly ariaHidden?: boolean | undefined;
}

const at = (row: number, col: number): CSSProperties => ({ gridRow: String(row), gridColumn: String(col) });

/**
 * A board labelled on all four sides. It is a CSS grid on logical axes, so
 * RTL mirrors it (column 1 at the inline-start edge) and vertical writing
 * modes transpose it, with no special cases here.
 */
export function Grid({ rows, cols, labels, dir, writingMode, cell, overlays, interaction, className, ariaHidden }: GridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rowIdx = Array.from({ length: rows }, (_, r) => r);
  const colIdx = Array.from({ length: cols }, (_, c) => c);

  const move = (e: TargetedKeyboardEvent<HTMLDivElement>): void => {
    if (!interaction) return;
    const { focus } = interaction;
    let next: Coord | undefined;
    if (isArrowKey(e.key)) {
      const d = arrowDelta(e.key, dir, writingMode);
      next = { row: Math.min(rows - 1, Math.max(0, focus.row + d.dRow)), col: Math.min(cols - 1, Math.max(0, focus.col + d.dCol)) };
    } else if (e.key === 'Home') {
      next = e.ctrlKey ? { row: 0, col: 0 } : { row: focus.row, col: 0 };
    } else if (e.key === 'End') {
      next = e.ctrlKey ? { row: rows - 1, col: cols - 1 } : { row: focus.row, col: cols - 1 };
    } else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      interaction.onActivate(focus);
      return;
    }
    if (!next) return;
    e.preventDefault();
    interaction.onFocus(next);
    ref.current?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.col}"]`)?.focus();
  };

  const colLabelCell = (c: number, gridRow: number, hidden: boolean) => (
    <div
      key={`c${gridRow}-${c}`}
      class="board-label board-col-label"
      role={hidden ? undefined : 'columnheader'}
      aria-hidden={hidden ? 'true' : undefined}
      style={at(gridRow, c + 2)}
    >
      <span>{colText(labels, c)}</span>
    </div>
  );

  const rowLabelCell = (r: number, gridCol: number, hidden: boolean) => {
    const second = row2Text(labels, r);
    return (
      <div
        key={`r${r}-${gridCol}`}
        class="board-label board-row-label"
        role={hidden ? undefined : 'rowheader'}
        aria-hidden={hidden ? 'true' : undefined}
        style={at(r + 2, gridCol)}
      >
        <span>{rowText(labels, r)}</span>
        {second !== null && <span class="board-label-second">{second}</span>}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      class={`board ${className ?? ''}`}
      dir={dir}
      data-wm={writingMode}
      style={{ writingMode, '--rows': String(rows), '--cols': String(cols) }}
      role={interaction ? 'grid' : undefined}
      aria-label={interaction?.gridName}
      aria-hidden={ariaHidden ? 'true' : undefined}
      onKeyDown={interaction ? move : undefined}
    >
      <div role={interaction ? 'row' : undefined} class="board-row">
        <div class="board-corner" style={at(1, 1)} />
        {colIdx.map((c) => colLabelCell(c, 1, !interaction))}
      </div>
      {rowIdx.map((r) => (
        <div key={r} role={interaction ? 'row' : undefined} class="board-row">
          {rowLabelCell(r, 1, !interaction)}
          {colIdx.map((c) => {
            const render = cell({ row: r, col: c });
            const focused = interaction && interaction.focus.row === r && interaction.focus.col === c;
            const selected = focused && interaction.selected;
            return (
              <div
                key={c}
                class={`board-cell ${render.className ?? ''} ${selected ? 'is-focused' : ''}`}
                style={at(r + 2, c + 2)}
                data-cell={`${r}-${c}`}
                role={interaction ? 'gridcell' : undefined}
                tabIndex={interaction ? (focused ? 0 : -1) : undefined}
                aria-label={interaction?.cellName({ row: r, col: c })}
                aria-selected={interaction ? (selected ? 'true' : 'false') : undefined}
                // First click picks the square; a click on the picked square calls it (so a double click does both).
                onClick={interaction ? () => (selected ? interaction.onActivate({ row: r, col: c }) : interaction.onFocus({ row: r, col: c })) : undefined}
              >
                {render.content}
              </div>
            );
          })}
          {rowLabelCell(r, cols + 2, true)}
        </div>
      ))}
      <div class="board-row" aria-hidden="true">
        {colIdx.map((c) => colLabelCell(c, rows + 2, true))}
      </div>
      {overlays}
    </div>
  );
}
