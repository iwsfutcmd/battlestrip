import { describe, expect, it } from 'vitest';
import { orient, shapeOf, WARDROBE } from '../../engine/index.ts';
import { ICON_KINDS, pieceMarker } from './clothing.tsx';

describe('clothing icons', () => {
  it('cover every piece in the wardrobe', () => {
    const missing = WARDROBE.map((w) => w.kind).filter((k) => !ICON_KINDS.includes(k));
    expect(missing).toEqual([]);
  });
});

describe('pieces that share an emoji', () => {
  it('never share a shape too, turned or flipped (the left and right sock are the one pair)', () => {
    const anyWay = (id: string): string => {
      const def = WARDROBE.find((w) => w.id === id);
      if (!def) throw new Error(id);
      return Array.from({ length: 8 }, (_, k) => JSON.stringify(orient(shapeOf(def), k as 0)))
        .sort()[0] ?? '';
    };
    const clashes: string[] = [];
    for (const [i, a] of WARDROBE.entries()) {
      for (const b of WARDROBE.slice(i + 1)) {
        if (pieceMarker(a.kind, a.number, 'en') === pieceMarker(b.kind, b.number, 'en') && anyWay(a.id) === anyWay(b.id)) clashes.push(`${a.id}/${b.id}`);
      }
    }
    expect(clashes).toEqual(['leftSock/rightSock']);
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
