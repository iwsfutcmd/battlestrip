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

/**
 * What marks a piece, on a board and beside its name: its emoji, or its
 * number for the few pieces without one (belt, suspenders).
 */
export function pieceMarker(kind: string, number: number, locale: string): string {
  return ICONS[kind] ?? new Intl.NumberFormat(locale).format(number);
}

export function PieceMarker({ kind, number, locale, className }: { readonly kind: string; readonly number: number; readonly locale: string; readonly className?: string | undefined }) {
  const icon = ICONS[kind];
  return (
    <span class={`${icon ? 'clothing-icon' : 'piece-number'} ${className ?? ''}`} aria-hidden="true">
      {icon ?? new Intl.NumberFormat(locale).format(number)}
    </span>
  );
}
