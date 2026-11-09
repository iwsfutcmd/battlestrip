/**
 * Battlestrip's pieces are clothes. Each kind gets a decorative emoji next to
 * its number and name (never instead of them: the name always comes from the
 * catalog, and the icon is hidden from assistive technology).
 */
const ICONS: Readonly<Record<string, string>> = {
  tShirt: '👕',
  shirt: '👔',
  tankTop: '🎽',
  sweater: '🧶',
  hoodie: '🧥',
  cropTop: '👚',
  blouse: '👚',
  vest: '🦺',
  pants: '👖',
  jeans: '👖',
  shorts: '🩳',
  skirt: '👗',
  leggings: '👖',
  dress: '👗',
  swimsuit: '🩱',
  robe: '👘',
  jumpsuit: '🥼',
  underwear: '🩲',
  boxers: '🩳',
  bra: '👙',
  undershirt: '🎽',
  tights: '🧦',
  socks: '🧦',
  leftSock: '🧦',
  rightSock: '🧦',
  shoes: '👟',
  boots: '🥾',
  sandals: '🩴',
  slippers: '🩴',
  heels: '👠',
  coat: '🧥',
  jacket: '🧥',
  blazer: '🧥',
  raincoat: '☔',
  cape: '🦸',
  hat: '🎩',
  cap: '🧢',
  beanie: '🧶',
  scarf: '🧣',
  gloves: '🧤',
  tie: '👔',
  watch: '⌚',
  sunglasses: '🕶️',
  ring: '💍',
  necklace: '📿',
  bowTie: '🎀',
  earrings: '💎',
  sash: '🎗️',
  bikini: '👙',
  legWarmers: '🧦',
  sock: '🧦',
  glove: '🧤',
};

/** Kinds that have an icon (tested against the wardrobe). */
export const ICON_KINDS: readonly string[] = Object.keys(ICONS);

export function ClothingIcon({ kind }: { readonly kind: string }) {
  const icon = ICONS[kind];
  return icon ? (
    <span class="clothing-icon" aria-hidden="true">
      {icon}
    </span>
  ) : null;
}
