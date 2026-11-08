/**
 * Battlestrip's pieces are clothes. Each kind gets a decorative emoji next to
 * its number and name (never instead of them: the name always comes from the
 * catalog, and the icon is hidden from assistive technology).
 */
const ICONS: Readonly<Record<string, string>> = {
  pants: '👖',
  shirt: '👕',
  underwear: '🩲',
  socks: '🧦',
  shoes: '👟',
  coat: '🧥',
  sweater: '👚',
  scarf: '🧣',
  sock: '🧦',
  glove: '🧤',
  hat: '🧢',
};

export function ClothingIcon({ kind }: { readonly kind: string }) {
  const icon = ICONS[kind];
  return icon ? (
    <span class="clothing-icon" aria-hidden="true">
      {icon}
    </span>
  ) : null;
}
