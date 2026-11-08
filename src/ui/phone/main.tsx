import { render } from 'preact';
import type { CatalogId } from '../../i18n/index.ts';
import '../common/base.css';
import { LanguagePicker, pseudoRequested } from '../common/LanguagePicker.tsx';
import { activateLocale, requestedLocales, translator, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import './phone.css';

const TITLE = 'title.fleet';

/**
 * M0 placeholder for the phone fleet image. The phone uses its own language
 * (navigator.languages, with a picker); the choice lives only in memory,
 * because the phone page keeps no storage.
 */
function PhoneHello() {
  const t = useTranslator();
  const choose = (id: CatalogId): void => {
    void activateLocale([id, ...navigator.languages], TITLE);
  };
  return (
    <main class="phone">
      <h1>
        <Msg id="route.fleet.heading" />
      </h1>
      <p>
        <Msg id="route.fleet.scanHint" />
      </p>
      <LanguagePicker
        labelKey="language.label"
        value={t.catalog}
        onChange={choose}
        showPseudo={pseudoRequested(location.search)}
      />
      <footer class="phone-footer">
        <Msg id="app.title" />
      </footer>
    </main>
  );
}

function App() {
  return translator.value ? <PhoneHello /> : null;
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), TITLE);
}
