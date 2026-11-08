import { describe, expect, it } from 'vitest';
import { WARDROBE } from '../../engine/index.ts';
import { ICON_KINDS } from './clothing.tsx';

describe('clothing icons', () => {
  it('cover every piece in the wardrobe, except where no emoji fits', () => {
    const missing = WARDROBE.map((w) => w.kind).filter((k) => !ICON_KINDS.includes(k));
    expect(missing).toEqual(['belt', 'suspenders']);
  });
});
