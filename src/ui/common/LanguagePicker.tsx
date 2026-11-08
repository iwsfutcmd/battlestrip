import { useId } from 'preact/hooks';
import { autonym, CATALOGS, directionOf, type CatalogId, type MessageKey } from '../../i18n/index.ts';
import { Msg } from './Msg.tsx';

export interface LanguagePickerProps {
  readonly labelKey: MessageKey;
  readonly value: CatalogId;
  readonly onChange: (id: CatalogId) => void;
  /** Offer the pseudolocales (dev builds, `?pseudo`, or when one is active). */
  readonly showPseudo: boolean;
}

/** Each language is listed by its own name for itself. No flags. */
export function LanguagePicker({ labelKey, value, onChange, showPseudo }: LanguagePickerProps) {
  const id = useId();
  const options = CATALOGS.filter((c) => showPseudo || c.pseudo === false || c.id === value);
  return (
    <div class="language-picker">
      <label for={id}>
        <Msg id={labelKey} />
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((c) => c.id === e.currentTarget.value);
          if (next) onChange(next.id);
        }}
      >
        {options.map((c) => (
          <option key={c.id} value={c.id} lang={c.id} dir={directionOf(c.id)}>
            {autonym(c.id)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function pseudoRequested(search: string): boolean {
  return import.meta.env.DEV || new URLSearchParams(search).has('pseudo');
}
