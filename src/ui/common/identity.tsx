/**
 * Player identity: an Okabe–Ito colour plus an SVG shape, so identity never
 * rests on colour alone (colour-blind players, the phone image, print).
 */
export const PALETTE: readonly string[] = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000'];

/** Path data in a 0–10 box. */
export const SHAPES: readonly string[] = [
  'M5 0.6a4.4 4.4 0 1 0 0.001 0Z', // circle
  'M1 1H9V9H1Z', // square
  'M5 0.6L9.6 9H0.4Z', // triangle
  'M5 0.3L9.7 5L5 9.7L0.3 5Z', // diamond
  'M5 0.3L6.2 3.6L9.7 3.7L6.9 5.8L7.9 9.2L5 7.2L2.1 9.2L3.1 5.8L0.3 3.7L3.8 3.6Z', // star
  'M2.6 0.8H7.4L9.8 5L7.4 9.2H2.6L0.2 5Z', // hexagon
  'M3.5 0.5H6.5V3.5H9.5V6.5H6.5V9.5H3.5V6.5H0.5V3.5H3.5Z', // plus
  'M5 0.5L9.5 3.8L7.8 9.3H2.2L0.5 3.8Z', // pentagon
];

export function identityColour(i: number): string {
  return PALETTE[((i % 8) + 8) % 8] ?? '#ffffff';
}

export function identityShape(i: number): string {
  return SHAPES[((i % 8) + 8) % 8] ?? SHAPES[0] ?? '';
}

/** A decorative glyph; the player's name always appears next to it, so it is aria-hidden. */
export function Glyph({ identity, size = '1em' }: { readonly identity: number; readonly size?: string }) {
  const colour = identityColour(identity);
  return (
    <svg class="glyph" viewBox="-0.5 -0.5 11 11" style={{ inlineSize: size, blockSize: size }} aria-hidden="true" focusable="false">
      <path d={identityShape(identity)} fill={colour} stroke={colour === '#000000' ? '#ffffff' : '#0b0f14'} stroke-width="0.7" />
    </svg>
  );
}
