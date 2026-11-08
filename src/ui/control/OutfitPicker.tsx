import { useId, useState } from 'preact/hooks';
import { OUTFIT_IDS, outfit, shapeOf, WARDROBE, WARDROBE_CATEGORIES, type ShipId, type ShipyardShip } from '../../engine/index.ts';
import { searchKey } from '../../i18n/text.ts';
import { ClothingIcon } from '../common/clothing.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { shipName } from '../table/format.ts';
import { ShapeIcon } from '../table/Piece.tsx';

const MAX_RESULTS = 12;

/**
 * Choose an outfit from the whole wardrobe: chips for what's chosen,
 * one-click ready-made outfits, and search by name (in the game language,
 * and in English), category or number, ignoring case and accents.
 */
export function OutfitPicker({ value, onChange }: { readonly value: readonly ShipId[]; readonly onChange: (next: ShipId[]) => void }) {
  const t = useTranslator();
  const searchId = useId();
  const categoryId = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const chosen = WARDROBE.filter((w) => value.includes(w.id));
  const squares = chosen.reduce((n, w) => n + w.length, 0);

  const name = (w: ShipyardShip): string => shipName(t, w.kind, null);
  const q = searchKey(query.trim(), t.locale);
  const matches = (w: ShipyardShip): boolean => {
    if (category && w.category !== category) return false;
    if (q === '') return category !== '';
    const haystack = [name(w), w.kind, t.format('category.name', { id: w.category ?? '' }), String(w.number), new Intl.NumberFormat(t.locale).format(w.number)];
    return haystack.some((h) => searchKey(h, t.locale).includes(q));
  };
  const results = WARDROBE.filter((w) => !value.includes(w.id) && matches(w));

  // Keep the outfit in wardrobe order, so numbers read in order.
  const add = (id: ShipId): void => onChange(WARDROBE.filter((w) => w.id === id || value.includes(w.id)).map((w) => w.id));
  const remove = (id: ShipId): void => onChange(value.filter((x) => x !== id));

  return (
    <fieldset class="outfit-picker">
      <legend>
        <Msg id="lobby.fleet" /> <span class="muted">(<Msg id="lobby.squares" values={{ count: squares }} />)</span>
      </legend>
      <ul class="outfit-chips">
        {chosen.map((w) => (
          <li key={w.id}>
            <button type="button" class="chip" onClick={() => remove(w.id)} aria-label={t.format('lobby.removeItem', { item: name(w) })}>
              <span class="ship-toggle-number">{new Intl.NumberFormat(t.locale).format(w.number)}</span>
              <ClothingIcon kind={w.kind} />
              <span>{name(w)}</span>
              <ShapeIcon shape={shapeOf(w)} size="1.2em" />
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>
      <div class="outfit-presets">
        <span class="muted">
          <Msg id="lobby.outfits" />
        </span>
        {OUTFIT_IDS.map((id) => (
          <button key={id} type="button" class="small-button" onClick={() => onChange(outfit(id))}>
            <Msg id="outfit.name" values={{ id }} />
          </button>
        ))}
      </div>
      <div class="outfit-search">
        <label for={searchId} class="visually-hidden">
          <Msg id="lobby.search" />
        </label>
        <input
          id={searchId}
          type="search"
          dir="auto"
          autocomplete="off"
          placeholder={t.format('lobby.search')}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <label for={categoryId} class="visually-hidden">
          <Msg id="lobby.category" />
        </label>
        <select id={categoryId} value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
          <option value="">{t.format('category.all')}</option>
          {WARDROBE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.format('category.name', { id: c })}
            </option>
          ))}
        </select>
      </div>
      {(q !== '' || category !== '') && (
        <ul class="outfit-results" aria-live="polite">
          {results.length === 0 && (
            <li class="muted">
              <Msg id="lobby.noResults" />
            </li>
          )}
          {results.slice(0, MAX_RESULTS).map((w) => (
            <li key={w.id}>
              <button type="button" class="ship-toggle" onClick={() => add(w.id)} aria-label={t.format('lobby.addItem', { item: name(w) })}>
                <span class="ship-toggle-number">{new Intl.NumberFormat(t.locale).format(w.number)}</span>
                <ClothingIcon kind={w.kind} />
                <span>{name(w)}</span>
                <ShapeIcon shape={shapeOf(w)} size="1.2em" />
                <span aria-hidden="true">+</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
