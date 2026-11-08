import { describe, expect, it } from 'vitest';
import { arrowDelta, isUndoShortcut } from './keyboard.ts';

describe('arrow keys move visually', () => {
  it.each([
    ['horizontal-tb', 'ltr', { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }],
    ['horizontal-tb', 'rtl', { ArrowRight: [0, -1], ArrowLeft: [0, 1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }],
    ['vertical-rl', 'ltr', { ArrowRight: [-1, 0], ArrowLeft: [1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }],
    ['vertical-rl', 'rtl', { ArrowRight: [-1, 0], ArrowLeft: [1, 0], ArrowDown: [0, -1], ArrowUp: [0, 1] }],
    ['vertical-lr', 'ltr', { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }],
    ['vertical-lr', 'rtl', { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, -1], ArrowUp: [0, 1] }],
  ] as const)('%s %s', (mode, dir, expected) => {
    for (const [key, [dRow, dCol]] of Object.entries(expected)) {
      expect(arrowDelta(key as 'ArrowUp', dir, mode), key).toEqual({ dRow, dCol });
    }
  });

  it('binds undo to the physical Z key', () => {
    expect(isUndoShortcut({ code: 'KeyZ', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe(true);
    expect(isUndoShortcut({ code: 'KeyZ', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false })).toBe(true);
    expect(isUndoShortcut({ code: 'KeyY', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe(false);
    expect(isUndoShortcut({ code: 'KeyZ', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })).toBe(false);
  });
});
