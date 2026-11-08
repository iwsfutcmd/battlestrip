import type { Direction, WritingMode } from '../i18n/direction.ts';

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export interface Delta {
  readonly dRow: number;
  readonly dCol: number;
}

/**
 * Arrow keys move *visually* (the ARIA grid convention). Rows run along the
 * block axis and columns along the inline axis, so the visual meaning of each
 * arrow depends on direction and writing mode. One table, unit-tested for all
 * six combinations.
 */
const TABLE: Readonly<Record<WritingMode, Readonly<Record<Direction, Readonly<Record<ArrowKey, Delta>>>>>> = {
  'horizontal-tb': {
    ltr: { ArrowUp: { dRow: -1, dCol: 0 }, ArrowDown: { dRow: 1, dCol: 0 }, ArrowLeft: { dRow: 0, dCol: -1 }, ArrowRight: { dRow: 0, dCol: 1 } },
    rtl: { ArrowUp: { dRow: -1, dCol: 0 }, ArrowDown: { dRow: 1, dCol: 0 }, ArrowLeft: { dRow: 0, dCol: 1 }, ArrowRight: { dRow: 0, dCol: -1 } },
  },
  // Inline axis top→bottom (bottom→top in rtl); block axis right→left.
  'vertical-rl': {
    ltr: { ArrowUp: { dRow: 0, dCol: -1 }, ArrowDown: { dRow: 0, dCol: 1 }, ArrowLeft: { dRow: 1, dCol: 0 }, ArrowRight: { dRow: -1, dCol: 0 } },
    rtl: { ArrowUp: { dRow: 0, dCol: 1 }, ArrowDown: { dRow: 0, dCol: -1 }, ArrowLeft: { dRow: 1, dCol: 0 }, ArrowRight: { dRow: -1, dCol: 0 } },
  },
  // Inline axis top→bottom (bottom→top in rtl); block axis left→right.
  'vertical-lr': {
    ltr: { ArrowUp: { dRow: 0, dCol: -1 }, ArrowDown: { dRow: 0, dCol: 1 }, ArrowLeft: { dRow: -1, dCol: 0 }, ArrowRight: { dRow: 1, dCol: 0 } },
    rtl: { ArrowUp: { dRow: 0, dCol: 1 }, ArrowDown: { dRow: 0, dCol: -1 }, ArrowLeft: { dRow: -1, dCol: 0 }, ArrowRight: { dRow: 1, dCol: 0 } },
  },
};

export function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function arrowDelta(key: ArrowKey, dir: Direction, mode: WritingMode): Delta {
  return TABLE[mode][dir][key];
}

/** Ctrl/Cmd + the physical Z key, whatever the keyboard layout (Arabic, Hebrew, Russian, …). */
export function isUndoShortcut(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  return e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
}
