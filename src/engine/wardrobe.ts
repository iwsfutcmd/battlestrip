import { parseShape } from './board.ts';
import { presetRules } from './presets.ts';
import type { Rules, ShipId, ShipKindId, ShipyardShip } from './types.ts';

/**
 * The wardrobe: every piece of clothing a player can wear, with its shape.
 * Shapes are drawn as rows of "#" separated by "/", and may be anything:
 * edge-connected, joined only at corners (the sash), or in separate parts
 * (earrings). They're whimsical, not to scale. Numbers are fixed (a piece's number is the same at
 * every table), so append new pieces at the end of their list and never
 * reorder: numbers and indices travel in QR codes and fleet codes.
 *
 * Ids double as kinds and as message keys (ship.name) and icon keys.
 */
export const WARDROBE_CATEGORIES = ['tops', 'bottoms', 'onePieces', 'swimwear', 'underwear', 'footwear', 'outerwear', 'headwear', 'accessories'] as const;
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

const ITEMS: readonly (readonly [id: string, category: WardrobeCategory, shape: string])[] = [
  ['tShirt', 'tops', '###/.#.'],
  ['shirt', 'tops', '###/.#./.#.'],
  ['tankTop', 'tops', '##/##'],
  ['sweater', 'tops', '###/###'],
  ['hoodie', 'tops', '.#./###/.#.'],
  ['cropTop', 'tops', '###'],
  ['blouse', 'tops', '.##/###'],
  ['vest', 'tops', '#.#/###'],
  ['pants', 'bottoms', '###/#.#/#.#'],
  ['jeans', 'bottoms', '##/##/##'],
  ['shorts', 'bottoms', '###/#.#'],
  ['skirt', 'bottoms', '.#./###'],
  ['leggings', 'bottoms', '####'],
  ['dress', 'onePieces', '.#./.#./###'],
  ['swimsuit', 'swimwear', '#.#/###/.#.'],
  ['robe', 'onePieces', '###/.#./###'],
  ['jumpsuit', 'onePieces', '.#./###/#.#'],
  ['underwear', 'underwear', '###/.#.'],
  ['boxers', 'underwear', '##/##'],
  ['bra', 'underwear', '#.#/###'],
  ['undershirt', 'underwear', '##/##/##'],
  ['tights', 'underwear', '##/#./#.'],
  ['socks', 'footwear', '#./##'],
  ['shoes', 'footwear', '##'],
  ['boots', 'footwear', '#./#./##'],
  ['sandals', 'footwear', '#'],
  ['slippers', 'footwear', '##'],
  ['heels', 'footwear', '##/.#'],
  ['coat', 'outerwear', '.#./###/###'],
  ['jacket', 'outerwear', '##./###'],
  ['blazer', 'outerwear', '#.#/###/.#.'],
  ['raincoat', 'outerwear', '.#./###/#.#/#.#'],
  ['hat', 'headwear', '.#./###'],
  ['cap', 'headwear', '##./.##'],
  ['beanie', 'headwear', '#'],
  ['scarf', 'accessories', '#####'],
  ['gloves', 'accessories', '##/#.'],
  ['belt', 'accessories', '####'],
  ['tie', 'accessories', '###'],
  ['watch', 'accessories', '#'],
  ['sunglasses', 'accessories', '##'],
  ['ring', 'accessories', '#'],
  // Shapes that aren't edge-connected.
  ['necklace', 'accessories', '#...#/.#.#./..#..'],
  ['bowTie', 'accessories', '#.#/.#./#.#'],
  ['earrings', 'accessories', '#.#'],
  ['sash', 'accessories', '#../.#./..#'],
  ['suspenders', 'accessories', '#.#/#.#/#.#'],
  ['bikini', 'swimwear', '#.#/.../.#.'],
  ['legWarmers', 'footwear', '#.#/#.#'],
];

export const WARDROBE: readonly ShipyardShip[] = ITEMS.map(([id, category, art], i) => {
  const shape = parseShape(art);
  return { id: id as ShipId, kind: id as ShipKindId, number: i + 1, length: shape.length, shape, category };
});

/** Ready-made outfits for the lobby. */
export const OUTFITS = {
  everyday: ['tShirt', 'jeans', 'underwear', 'socks', 'shoes'],
  bundledUp: ['coat', 'sweater', 'pants', 'scarf', 'gloves', 'beanie', 'boots'],
  beachDay: ['bikini', 'sunglasses', 'sandals', 'cap', 'necklace'],
  dressedUp: ['shirt', 'blazer', 'pants', 'bowTie', 'suspenders', 'shoes', 'watch'],
  nightIn: ['robe', 'boxers', 'tankTop', 'slippers'],
} as const satisfies Record<string, readonly string[]>;
export type OutfitId = keyof typeof OUTFITS;
export const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];

export function outfit(id: OutfitId): ShipId[] {
  return OUTFITS[id].map((x) => x as ShipId);
}

/** Rules for a table that dresses from the whole wardrobe. */
export function wardrobeRules(overrides: Partial<Rules> = {}): Rules {
  return presetRules('classic', { shipyard: WARDROBE, ...overrides });
}
