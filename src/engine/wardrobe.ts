import { parseShape } from './board.ts';
import { presetRules } from './presets.ts';
import type { Rules, ShipId, ShipKindId, ShipyardShip } from './types.ts';

/**
 * The wardrobe: every piece of clothing a player can wear, with its shape.
 * Shapes are drawn as rows of "#" separated by "/", and may be anything:
 * edge-connected, joined only at corners (the sash), or in separate parts
 * (earrings). They're whimsical, not to scale. Numbers are fixed (a
 * piece's number is the same at every table). Numbers and list positions
 * travel in QR codes, invites and outfit codes: whenever a piece is
 * inserted, removed or reshaped, bump PAYLOAD_VERSION (share/payload.ts) and
 * the invite VERSION (share/invite.ts), so codes made before the change are
 * refused.
 *
 * Ids double as kinds and as message keys (ship.name) and icon keys.
 */
export const WARDROBE_CATEGORIES = ['tops', 'bottoms', 'onePieces', 'swimwear', 'underwear', 'footwear', 'outerwear', 'headwear', 'accessories'] as const;
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

/**
 * A piece's size in squares follows how big it is in real life: a ring, a
 * sock or underwear is one square; a coat is nine. Pairs (shoes, gloves,
 * earrings) are two separate parts. The order is fixed (see above); shapes
 * and sizes may change, with a version bump.
 */
const ITEMS: readonly (readonly [id: string, category: WardrobeCategory, shape: string])[] = [
  ['tShirt', 'tops', '###/.#.'], // 4
  ['shirt', 'tops', '###/.#./.#.'], // 5
  ['tankTop', 'tops', '#.#/.#.'], // 3
  ['sweater', 'tops', '###/###'], // 6
  ['hoodie', 'tops', '.#./###/.#./.#.'], // 6
  ['cropTop', 'tops', '##'], // 2
  ['blouse', 'tops', '.##/##.'], // 4
  ['vest', 'tops', '#.#/#.#'], // 4: two open panels
  ['pants', 'bottoms', '###/#.#/#.#'], // 7
  ['jeans', 'bottoms', '###/#.#/#.#'], // 7: the same shape as pants
  ['shorts', 'bottoms', '##/##'], // 4
  ['skirt', 'bottoms', '.#./###'], // 4
  ['leggings', 'bottoms', '####'], // 4
  ['dress', 'onePieces', '.#./###/###'], // 7
  ['swimsuit', 'swimwear', '#.#/.#./.#.'], // 4
  ['robe', 'onePieces', '###/###/.#./.#.'], // 8
  ['jumpsuit', 'onePieces', '.#./###/#.#/#.#'], // 8
  ['underwear', 'underwear', '#'], // 1
  ['boxers', 'underwear', '##'], // 2
  ['bra', 'underwear', '##'], // 2
  ['undershirt', 'underwear', '###'], // 3
  ['tights', 'underwear', '#.#/#.#'], // 4: two legs
  ['leftSock', 'footwear', '#'], // 1
  ['rightSock', 'footwear', '#'], // 1
  ['shoes', 'footwear', '#.#'], // 2: a pair
  ['boots', 'footwear', '#.#/#.#'], // 4: a tall pair
  ['sandals', 'footwear', '#.#'], // 2: a pair
  ['slippers', 'footwear', '#.#'], // 2: a pair
  ['heels', 'footwear', '#./.#'], // 2: a pair, staggered
  ['coat', 'outerwear', '###/###/###'], // 9
  ['jacket', 'outerwear', '.#./###/#.#'], // 6
  ['blazer', 'outerwear', '#.#/###/.#.'], // 6
  ['raincoat', 'outerwear', '.#./###/###/#.#'], // 9
  ['hat', 'headwear', '.#./###'], // 4
  ['cap', 'headwear', '##'], // 2
  ['beanie', 'headwear', '##'], // 2
  ['scarf', 'accessories', '####'], // 4
  ['gloves', 'accessories', '#.#'], // 2: a pair
  ['belt', 'accessories', '###'], // 3
  ['tie', 'accessories', '###'], // 3
  ['watch', 'accessories', '#'], // 1
  ['sunglasses', 'accessories', '#'], // 1
  ['ring', 'accessories', '#'], // 1
  ['necklace', 'accessories', '#.#/.#.'], // 3: a V
  ['bowTie', 'accessories', '#./.#'], // 2: corner to corner
  ['earrings', 'accessories', '#.#'], // 2: a pair
  ['sash', 'accessories', '#../.#./..#'], // 3: a diagonal
  ['suspenders', 'accessories', '#.#/#.#'], // 4: two straps
  ['bikini', 'swimwear', '#.#/.../.#.'], // 3: three parts
  ['legWarmers', 'footwear', '#.#/#.#'], // 4: a pair
  ['cape', 'outerwear', '.##./.##./####'], // 8: narrow at the shoulders, flaring at the hem
];

export const WARDROBE: readonly ShipyardShip[] = ITEMS.map(([id, category, art], i) => {
  const shape = parseShape(art);
  return { id: id as ShipId, kind: id as ShipKindId, number: i + 1, length: shape.length, shape, category };
});

/** Ready-made outfits for the lobby. */
export const OUTFITS = {
  everyday: ['tShirt', 'jeans', 'underwear', 'leftSock', 'rightSock'],
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
