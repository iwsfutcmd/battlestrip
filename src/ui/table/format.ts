import { copyNumber, type Coord, type Rules, type ShipId } from '../../engine/index.ts';
import type { Translator } from '../../i18n/index.ts';
import { colLabel, rowLabel, type LabelSystemId } from '../../i18n/labels.ts';

/** Labels for a board: the game's systems and digits, whatever language the UI is in. */
export interface BoardLabels {
  readonly system: LabelSystemId;
  readonly system2: LabelSystemId | null;
  /** A locale whose only job is choosing digits (e.g. "en-u-nu-arab"). */
  readonly digitsLocale: string;
}

export function labelsFor(system: LabelSystemId, system2: LabelSystemId | null, numbering: string): BoardLabels {
  return { system, system2, digitsLocale: `en-u-nu-${numbering}` };
}

export const rowText = (l: BoardLabels, row: number): string => rowLabel(l.system, l.digitsLocale, row);
export const row2Text = (l: BoardLabels, row: number): string | null => (l.system2 ? rowLabel(l.system2, l.digitsLocale, row) : null);
export const colText = (l: BoardLabels, col: number): string => colLabel(l.digitsLocale, col);

/** A coordinate as the game writes it ("D4", "د٤", "甲7", "4-7"). Plain string, isolated placeholders. */
export function coordText(t: Translator, l: BoardLabels, c: Coord): string {
  const key = l.system === 'numeric' ? 'coord.bothNumeric' : 'coord.label';
  return t.format(key, { row: rowText(l, c.row), col: colText(l, c.col) });
}

/** What speech says for a coordinate ("D 4"). */
export function coordSpoken(t: Translator, l: BoardLabels, c: Coord): string {
  return t.format('coord.spoken', { row: rowText(l, c.row), col: colText(l, c.col) });
}

/** "cruiser", or "cruiser 2" when the shipyard repeats the kind. */
export function shipName(t: Translator, kind: string, copy: number | null): string {
  const name = t.format('ship.name', { kind });
  return copy === null ? name : t.format('ship.withCopy', { name, copy });
}

export function shipNameIn(t: Translator, rules: Rules, id: ShipId): string {
  const def = rules.shipyard.find((s) => s.id === id);
  return shipName(t, def?.kind ?? '', copyNumber(rules.shipyard, id));
}
