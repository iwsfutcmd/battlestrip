import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/ui/common/themes.ts';

/**
 * Every theme keeps the table readable: each text colour meets WCAG AA
 * (4.5:1) on the surfaces it is drawn on, and the markers and outlines that
 * carry meaning on the board meet 3:1 (WCAG 1.4.11).
 */

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--bs-[\w-]+)\s*:\s*([^;]+);/gu)) {
    const [, name, value] = m;
    if (name && value) out[name] = value.trim();
  }
  return out;
}

const base = declarations(/:root\s*\{([^}]*)\}/u.exec(read('src/ui/common/base.css'))?.[1] ?? '');
const themesCss = read('src/ui/common/themes.css');

function theme(id: string): Record<string, string> {
  if (id === 'classic') return base;
  const block = new RegExp(`:root\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`, 'u').exec(themesCss)?.[1];
  if (block === undefined) throw new Error(`no block for theme ${id}`);
  return { ...base, ...declarations(block) };
}

function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(hex);
  if (!m?.[1]) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) throw new Error(`not a hex colour: ${a} / ${b}`);
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio]: background `cell` is the cell fill, or the page if cells are transparent. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ['fg', 'bg', 4.5],
  ['fg', 'surface', 4.5],
  ['fg', 'surface-strong', 4.5],
  ['fg', 'cell', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'surface-strong', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['focus', 'surface', 4.5],
  ['focus', 'surface-strong', 4.5],
  ['warning', 'bg', 4.5],
  ['warning', 'surface', 4.5],
  ['error', 'bg', 4.5],
  ['error', 'surface', 4.5],
  ['hit', 'surface', 4.5],
  ['sunk-text', 'surface', 4.5],
  ['bomb', 'surface', 4.5],
  ['on-bomb', 'bomb', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-ready', 'ready-bg', 4.5],
  ['on-primary', 'primary', 4.5],
  // On the board: the last-call outline, miss marks, and a sunk piece's outline.
  ['focus', 'cell', 3],
  ['muted', 'cell', 3],
  ['sunk', 'sunk-bg', 3],
];

describe('themes', () => {
  it('has a CSS block for every theme but classic, and nothing else', () => {
    const blocks = [...themesCss.matchAll(/:root\[data-theme="(\w+)"\]\s*\{/gu)].map((m) => m[1]);
    expect(new Set(blocks)).toEqual(new Set(THEME_IDS.filter((t) => t !== 'classic')));
  });

  for (const id of THEME_IDS) {
    it(`${id}: text and board marks have enough contrast`, () => {
      const vars = theme(id);
      const colour = (name: string): string => {
        if (name === 'cell') {
          const cell = vars['--bs-cell-bg'];
          return cell && cell !== 'transparent' ? cell : (vars['--bs-bg'] ?? '');
        }
        return vars[`--bs-${name}`] ?? '';
      };
      const failures = PAIRS.flatMap(([fg, bg, min]) => {
        const ratio = contrast(colour(fg), colour(bg));
        return ratio >= min ? [] : [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`];
      });
      expect(failures).toEqual([]);
    });
  }
});
