import { describe, expect, it } from 'vitest';
import { decodeInvite, encodeInvite, type PlacementInvite } from './invite.ts';

describe('placement invite', () => {
  it('round-trips', () => {
    const inv: PlacementInvite = {
      gameCode: 'K7Q2',
      rows: 12,
      cols: 10,
      allowTouching: false,
      labels: 'morskoyBoy',
      labels2: 'latin',
      numbering: 'latn',
      dir: 'ltr',
      writingMode: 'horizontal-tb',
      seats: [
        { name: 'Лена', human: true, fleet: [0, 1, 2, 41] },
        { name: '👩🏽‍🚀 Ada', human: true, fleet: [3] },
        { name: 'Robo', human: false, fleet: [28, 3, 8, 35, 36, 34, 24] },
      ],
    };
    expect(decodeInvite(encodeInvite(inv))).toEqual(inv);
    expect(decodeInvite('garbage!')).toBeNull();
  });
});
