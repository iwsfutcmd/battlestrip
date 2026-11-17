import { describe, expect, it } from 'vitest';
import { WARDROBE } from '../../engine/index.ts';
import { ICON_KINDS, pieceMarker } from './clothing.tsx';

describe('clothing icons', () => {
  it('cover every piece in the wardrobe', () => {
    const missing = WARDROBE.map((w) => w.kind).filter((k) => !ICON_KINDS.includes(k));
    expect(missing).toEqual([]);
  });
});

describe('piece markers', () => {
  it('are the emoji, or the number in the table\u2019s digits for a piece without one', () => {
    expect(pieceMarker('pants', 9, 'en')).toBe('\u{1F456}');
    expect(pieceMarker('belt', 37, 'en')).toBe('\u27B0');
    expect(pieceMarker('newPiece', 51, 'en')).toBe('51');
    expect(pieceMarker('newPiece', 51, 'ar-u-nu-arab')).toBe('\u0665\u0661');
  });
});
