import { useId } from 'preact/hooks';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { THEME_IDS, type ThemeId } from '../common/themes.ts';
import { currentTheme, setTheme } from './store.ts';

/** The table's theme: in the lobby, and any time during a game (the TV follows). */
export function ThemePicker() {
  const t = useTranslator();
  const id = useId();
  return (
    <div class="language-picker theme-picker">
      <label for={id}>
        <Msg id="lobby.theme" />
      </label>
      <select id={id} value={currentTheme()} onChange={(e) => setTheme(e.currentTarget.value as ThemeId)}>
        {THEME_IDS.map((th) => (
          <option key={th} value={th}>
            {t.format('theme.name', { id: th })}
          </option>
        ))}
      </select>
    </div>
  );
}
