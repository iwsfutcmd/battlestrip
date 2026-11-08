import { render } from 'preact';
import type { CatalogId } from '../../i18n/index.ts';
import { decodeFleetImage } from '../../share/payload.ts';
import '../common/base.css';
import { LanguagePicker, pseudoRequested } from '../common/LanguagePicker.tsx';
import { activateLocale, requestedLocales, translator, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import '../table/table.css';
import { FleetView } from './FleetView.tsx';
import './phone.css';

const TITLE = 'title.fleet';

/**
 * The phone page is static: everything comes from the URL fragment, which
 * browsers never send to the server. No network after load, no storage, no
 * updates; reopening the URL shows the same image.
 */
const fragment = location.hash.slice(1);
const decoded = fragment === '' ? null : decodeFleetImage(decodeURIComponent(fragment));

function choose(id: CatalogId): void {
  void activateLocale([id, ...navigator.languages], TITLE);
}

function Intro({ invalid }: { readonly invalid: boolean }) {
  const t = useTranslator();
  return (
    <main class="phone">
      <h1>
        <Msg id="route.fleet.heading" />
      </h1>
      <p>
        <Msg id={invalid ? 'phone.invalid' : 'route.fleet.scanHint'} />
      </p>
      <LanguagePicker labelKey="language.label" value={t.catalog} onChange={choose} showPseudo={pseudoRequested(location.search)} />
      <footer class="phone-footer">
        <Msg id="app.title" />
      </footer>
    </main>
  );
}

function App() {
  if (!translator.value) return null;
  if (decoded?.ok) return <FleetView image={decoded.value} onLanguage={choose} showPseudo={pseudoRequested(location.search)} />;
  return <Intro invalid={decoded !== null} />;
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), TITLE);
}
