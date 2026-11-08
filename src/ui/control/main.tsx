import { render } from 'preact';
import type { CatalogId } from '../../i18n/index.ts';
import '../common/base.css';
import { LanguagePicker, pseudoRequested } from '../common/LanguagePicker.tsx';
import { activateLocale, requestedLocales, translator, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import './control.css';

const TITLE = 'title.control';

/** M0 placeholder for the laptop: game-language picker and links to the other routes. */
function ControlHello() {
  const t = useTranslator();
  const choose = (id: CatalogId): void => {
    void activateLocale([id, ...navigator.languages], TITLE);
  };
  const displayHref = `display/?${new URLSearchParams({ lang: t.locale }).toString()}`;
  return (
    <main class="control">
      <header>
        <h1>
          <Msg id="app.title" />
        </h1>
        <p class="control-tagline">
          <Msg id="app.tagline" />
        </p>
      </header>
      <h2>
        <Msg id="route.control.heading" />
      </h2>
      <p>
        <Msg id="route.control.intro" />
      </p>
      <LanguagePicker
        labelKey="language.gameLabel"
        value={t.catalog}
        onChange={choose}
        showPseudo={pseudoRequested(location.search)}
      />
      <nav>
        <ul class="control-links">
          <li>
            <a href={displayHref} target="_blank" rel="noopener">
              <Msg id="route.control.openDisplay" />
            </a>
          </li>
          <li>
            <a href="fleet/" target="_blank" rel="noopener">
              <Msg id="route.control.openPhone" />
            </a>
          </li>
        </ul>
      </nav>
    </main>
  );
}

function App() {
  return translator.value ? <ControlHello /> : null;
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), TITLE);
}
