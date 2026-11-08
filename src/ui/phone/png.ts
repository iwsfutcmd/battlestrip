import { firstStrongDirection } from '../../i18n/isolate.ts';
import type { FleetImage } from '../../share/payload.ts';
import { identityColour, identityShape } from '../common/identity.tsx';
import { colText, row2Text, rowText, type BoardLabels } from '../table/format.ts';

const CELL = 56;

interface Layout {
  readonly width: number;
  readonly height: number;
  /** Top-left corner of a logical cell; -1 and rows/cols address the label bands. */
  readonly at: (row: number, col: number) => { readonly x: number; readonly y: number };
}

/** Logical (row, col) to pixels for the game's direction and writing mode. */
function layout(image: FleetImage, top: number): Layout {
  const { rows, cols, dir, writingMode } = image;
  const inline = (col: number): number => (dir === 'rtl' ? cols - col : col + 1);
  if (writingMode === 'horizontal-tb') {
    return { width: (cols + 2) * CELL, height: top + (rows + 2) * CELL, at: (r, c) => ({ x: inline(c) * CELL, y: top + (r + 1) * CELL }) };
  }
  const block = (row: number): number => (writingMode === 'vertical-rl' ? rows - row : row + 1);
  return { width: (rows + 2) * CELL, height: top + (cols + 2) * CELL, at: (r, c) => ({ x: block(r) * CELL, y: top + inline(c) * CELL }) };
}

/** Draw one text run with the right base direction (Canvas doesn't run the bidi algorithm across runs). */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = 'center'): void {
  ctx.font = `${size}px system-ui, "Noto Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans TC", sans-serif`;
  ctx.direction = firstStrongDirection(s) ?? 'ltr';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/**
 * The fleet image as a PNG, for the camera roll. Labels are single tokens,
 * drawn upright in their cell positions, so vertical modes need no line layout.
 */
export async function fleetPng(image: FleetImage, labels: BoardLabels, legend: readonly string[]): Promise<Blob | null> {
  await document.fonts.ready;
  const top = CELL * 2;
  const L = layout(image, top);
  const legendHeight = legend.length * CELL * 0.7 + CELL;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = Math.max(L.width, CELL * 8) * scale;
  canvas.height = (L.height + legendHeight) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header: glyph, name, codes.
  const colour = identityColour(image.identity);
  ctx.save();
  ctx.translate(CELL * 0.3, CELL * 0.3);
  ctx.scale(CELL / 14, CELL / 14);
  ctx.fillStyle = colour;
  ctx.fill(new Path2D(identityShape(image.identity)));
  ctx.restore();
  ctx.fillStyle = '#f5f7fa';
  text(ctx, image.name, CELL * 1.2, CELL * 0.65, CELL * 0.5, 'start');
  ctx.fillStyle = '#c9d1db';
  text(ctx, `${image.gameCode} · ${image.fleetCheck}`, CELL * 1.2, CELL * 1.35, CELL * 0.35, 'start');

  // Grid and labels.
  ctx.strokeStyle = '#3a4656';
  ctx.lineWidth = 1;
  for (let r = 0; r < image.rows; r++) {
    for (let c = 0; c < image.cols; c++) {
      const p = L.at(r, c);
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, CELL - 1, CELL - 1);
    }
  }
  ctx.fillStyle = '#c9d1db';
  for (let r = 0; r < image.rows; r++) {
    const second = row2Text(labels, r);
    for (const c of [-1, image.cols]) {
      const p = L.at(r, c);
      text(ctx, rowText(labels, r), p.x + CELL / 2, p.y + CELL / 2 - (second ? CELL * 0.12 : 0), CELL * 0.4);
      if (second) text(ctx, second, p.x + CELL / 2, p.y + CELL * 0.78, CELL * 0.22);
    }
  }
  for (let c = 0; c < image.cols; c++) {
    for (const r of [-1, image.rows]) {
      const p = L.at(r, c);
      text(ctx, colText(labels, c), p.x + CELL / 2, p.y + CELL / 2, CELL * 0.4);
    }
  }

  // Ships: outline and number.
  for (const s of image.ships) {
    const end = s.axis === 'alongRow' ? { row: s.origin.row, col: s.origin.col + s.length - 1 } : { row: s.origin.row + s.length - 1, col: s.origin.col };
    const a = L.at(s.origin.row, s.origin.col);
    const b = L.at(end.row, end.col);
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x) + CELL;
    const h = Math.abs(a.y - b.y) + CELL;
    ctx.fillStyle = 'rgba(86, 180, 233, 0.18)';
    ctx.fillRect(x0 + 5, y0 + 5, w - 10, h - 10);
    ctx.strokeStyle = colour === '#000000' ? '#ffffff' : colour;
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
    ctx.fillStyle = '#f5f7fa';
    text(ctx, new Intl.NumberFormat(labels.digitsLocale).format(s.number), x0 + w / 2, y0 + h / 2, CELL * 0.45);
  }

  // Legend, in the phone's language.
  ctx.fillStyle = '#f5f7fa';
  legend.forEach((line, i) => {
    const dir = firstStrongDirection(line) ?? 'ltr';
    text(ctx, line, dir === 'rtl' ? canvas.width / scale - CELL * 0.5 : CELL * 0.5, L.height + CELL * 0.6 + i * CELL * 0.7, CELL * 0.38, 'start');
  });

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
