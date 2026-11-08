import { describe, expect, it } from 'vitest';
import { decodeInvite, encodeInvite, type PlacementInvite } from './invite.ts';

describe('placement invite', () => {
  it('round-trips', () => {
    const inv: PlacementInvite = {
      gameCode: 'K7Q2',
      preset: 'morskoyBoy',
      rows: 12,
      cols: 10,
      allowTouching: false,
      labels: 'morskoyBoy',
      labels2: 'latin',
      numbering: 'latn',
      dir: 'ltr',
      writingMode: 'horizontal-tb',
      seats: [
        { name: 'Лена', human: true, fleet: [0, 1, 2, 9] },
        { name: '👩🏽‍🚀 Ada', human: true, fleet: [3] },
        { name: 'Robo', human: false, fleet: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      ],
    };
    expect(decodeInvite(encodeInvite(inv))).toEqual(inv);
    expect(decodeInvite('garbage!')).toBeNull();
  });
});
