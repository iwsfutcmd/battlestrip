import { describe, expect, it } from 'vitest';
import { WARDROBE } from '../../engine/index.ts';
import { ICON_KINDS, pieceMarker } from './clothing.tsx';

describe('clothing icons', () => {
  it('cover every piece in the wardrobe, except where no emoji fits', () => {
    const missing = WARDROBE.map((w) => w.kind).filter((k) => !ICON_KINDS.includes(k));
    expect(missing).toEqual(['belt', 'suspenders']);
  });
});

describe('piece markers', () => {
  it('are the emoji, or the number in the table’s digits for pieces without one', () => {
    expect(pieceMarker('jeans', 2, 'en')).toBe('\u{1F456}');
    expect(pieceMarker('belt', 11, 'en')).toBe('11');
    expect(pieceMarker('belt', 11, 'ar-u-nu-arab')).toBe('١١');
  });
});
