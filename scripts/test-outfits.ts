/**
 * Realistic outfits to test with: what people actually wear on a given day,
 * built from the wardrobe. Each comes "as worn" and, where it has any, with
 * the intimate pieces (underwear, boxers, bra) kept out, for a player who
 * doesn't want to put those in the game. A few experiments push one idea
 * further. Pieces are listed in wardrobe order.
 */
import { WARDROBE, type ShipId } from '../src/engine/index.ts';

export type TestOutfitGroup = 'realistic' | 'experiment';
export type TestOutfitVariant = 'asWorn' | 'underwearKeptOut';

export interface TestOutfit {
  /** Unique: the base id, plus "-private" for the underwear-kept-out variant. */
  readonly id: string;
  readonly base: string;
  readonly name: string;
  readonly blurb: string;
  readonly group: TestOutfitGroup;
  readonly variant: TestOutfitVariant;
  readonly pieces: readonly ShipId[];
}

/** The pieces a player might not want to put in the game. Undershirts and tights stay. */
export const INTIMATE: readonly ShipId[] = ['underwear', 'boxers', 'bra'] as ShipId[];

interface Base {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly pieces: readonly string[];
}

const REALISTIC: readonly Base[] = [
  { id: 'office', name: 'Office day', blurb: 'Business casual: a button-up, trousers and a belt, an undershirt beneath.', pieces: ['shirt', 'pants', 'belt', 'undershirt', 'boxers', 'leftSock', 'rightSock', 'shoes', 'watch'] },
  { id: 'interview', name: 'Job interview', blurb: 'The full suit, tie and all.', pieces: ['shirt', 'blazer', 'pants', 'tie', 'belt', 'boxers', 'leftSock', 'rightSock', 'shoes', 'watch'] },
  { id: 'errands', name: 'Weekend errands', blurb: 'T-shirt, jeans, trainers and a cap.', pieces: ['tShirt', 'pants', 'underwear', 'bra', 'leftSock', 'rightSock', 'shoes', 'cap'] },
  { id: 'heatwave', name: 'Heatwave', blurb: 'As little as decency allows: a tank top and shorts.', pieces: ['tankTop', 'shorts', 'underwear', 'bra', 'sandals', 'sunglasses'] },
  { id: 'winter', name: 'Winter commute', blurb: 'Coat, sweater, scarf, gloves, hat and boots.', pieces: ['coat', 'sweater', 'pants', 'underwear', 'bra', 'leftSock', 'rightSock', 'boots', 'scarf', 'gloves', 'beanie'] },
  { id: 'gym', name: 'Gym session', blurb: 'Leggings, a tank top and a sports bra.', pieces: ['tankTop', 'leggings', 'underwear', 'bra', 'leftSock', 'rightSock', 'shoes', 'watch'] },
  { id: 'dateNight', name: 'Date night', blurb: 'A dress, heels and jewelry.', pieces: ['dress', 'underwear', 'bra', 'heels', 'ring', 'necklace', 'earrings'] },
  { id: 'wedding', name: 'Wedding guest', blurb: 'Blazer, bow tie and suspenders.', pieces: ['shirt', 'blazer', 'pants', 'boxers', 'leftSock', 'rightSock', 'shoes', 'watch', 'bowTie', 'suspenders'] },
  { id: 'beach', name: 'At the beach', blurb: 'A bikini, a sun hat and sandals. Swimwear isn’t underwear, so nothing is kept out.', pieces: ['sandals', 'hat', 'sunglasses', 'bikini'] },
  { id: 'pajamas', name: 'Pajama night', blurb: 'A robe over a T-shirt and boxers, and slippers.', pieces: ['tShirt', 'robe', 'boxers', 'slippers'] },
  { id: 'lazySunday', name: 'Lazy Sunday', blurb: 'Hoodie and leggings, never left the couch.', pieces: ['hoodie', 'leggings', 'underwear', 'leftSock', 'rightSock'] },
  { id: 'rainy', name: 'Rainy walk', blurb: 'Raincoat over a sweater, and boots.', pieces: ['sweater', 'pants', 'underwear', 'bra', 'leftSock', 'rightSock', 'boots', 'raincoat'] },
  { id: 'festival', name: 'Music festival', blurb: 'Crop top, shorts, boots, a hat and sunglasses.', pieces: ['cropTop', 'shorts', 'underwear', 'bra', 'boots', 'hat', 'sunglasses', 'earrings'] },
  { id: 'hike', name: 'Day hike', blurb: 'T-shirt and shorts, a light jacket, boots and a cap.', pieces: ['tShirt', 'shorts', 'underwear', 'leftSock', 'rightSock', 'boots', 'jacket', 'cap', 'watch', 'sunglasses'] },
  { id: 'superhero', name: 'Superhero costume', blurb: 'Jumpsuit and cape, with the underwear on the outside, of course.', pieces: ['jumpsuit', 'underwear', 'boots', 'cape', 'gloves', 'belt'] },
  { id: 'aerobics', name: '80s aerobics', blurb: 'Crop top, leggings and leg warmers.', pieces: ['cropTop', 'leggings', 'underwear', 'bra', 'shoes', 'legWarmers'] },
];

const EXPERIMENTS: readonly Base[] = [
  { id: 'accessorized', name: 'Everyday, accessorized', blurb: 'The default outfit plus every small accessory: lots of one- and two-square pieces.', pieces: ['tShirt', 'pants', 'underwear', 'leftSock', 'rightSock', 'watch', 'sunglasses', 'ring', 'necklace', 'earrings'] },
  { id: 'jewelryBox', name: 'Jewelry box', blurb: 'No clothes at all, only accessories.', pieces: ['watch', 'sunglasses', 'ring', 'necklace', 'earrings', 'belt'] },
  { id: 'underwearOnly', name: 'Underwear only', blurb: 'The opposite choice: only the intimate pieces.', pieces: ['underwear', 'bra', 'leftSock', 'rightSock'] },
  { id: 'layers', name: 'Every layer', blurb: 'Everything for the cold, at once.', pieces: ['shirt', 'sweater', 'pants', 'undershirt', 'boxers', 'tights', 'leftSock', 'rightSock', 'boots', 'coat', 'beanie', 'scarf', 'gloves'] },
];

const order = (ids: readonly string[]): ShipId[] => WARDROBE.map((w) => w.id).filter((id) => ids.includes(id));

function build(base: Base, group: TestOutfitGroup): TestOutfit[] {
  const pieces = order(base.pieces);
  const out: TestOutfit[] = [{ id: base.id, base: base.id, name: base.name, blurb: base.blurb, group, variant: 'asWorn', pieces }];
  const kept = pieces.filter((p) => !INTIMATE.includes(p));
  // A variant only where something is kept out and something is left to wear.
  if (group === 'realistic' && kept.length < pieces.length && kept.length > 0) {
    out.push({ id: `${base.id}-private`, base: base.id, name: base.name, blurb: base.blurb, group, variant: 'underwearKeptOut', pieces: kept });
  }
  return out;
}

export const TEST_OUTFITS: readonly TestOutfit[] = [...REALISTIC.flatMap((b) => build(b, 'realistic')), ...EXPERIMENTS.flatMap((b) => build(b, 'experiment'))];

/** The ids as written above, for a check that every one is in the wardrobe. */
export const WRITTEN_PIECES: readonly string[] = [...REALISTIC, ...EXPERIMENTS].flatMap((b) => b.pieces);
