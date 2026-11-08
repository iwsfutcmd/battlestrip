import { render } from 'preact';
import { formatList } from '../../i18n/index.ts';
import '../common/base.css';
import { NAME_FIXTURES } from '../common/fixtures.ts';
import { activateLocale, requestedLocales, translator, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import './display.css';

/** M0 placeholder for the TV: proves locale, direction, isolation and plurals. */
function DisplayHello() {
  const t = useTranslator();
  return (
    <main class="tv">
      <header>
        <h1 class="tv-title">
          <Msg id="app.title" />
        </h1>
        <p class="tv-tagline">
          <Msg id="app.tagline" />
        </p>
      </header>
      <section aria-labelledby="sample-table">
        <h2 id="sample-table">
          <Msg id="hello.sampleTable" />
        </h2>
        <p>
          <Msg id="hello.playerCount" values={{ count: NAME_FIXTURES.length }} />
        </p>
        <ol class="tv-roster">
          {NAME_FIXTURES.map((name, i) => (
            <li class="tv-seat" key={name}>
              <span class="tv-seat-number">
                <Msg id="hello.seat" values={{ seat: i + 1 }} />
              </span>
              <bdi class="tv-seat-name">{name}</bdi>
              {i === 0 && (
                <span class="tv-seat-status">
                  <Msg id="roster.calling" values={{ name }} />
                </span>
              )}
              {i === 1 && (
                <span class="tv-seat-status">
                  <Msg id="roster.bombing" values={{ name }} />
                </span>
              )}
            </li>
          ))}
        </ol>
        <p>
          <Msg id="hello.atTheTable" values={{ players: formatList(t.locale, NAME_FIXTURES) }} />
        </p>
      </section>
      <p class="tv-waiting" aria-live="polite">
        <Msg id="route.display.waiting" />
      </p>
    </main>
  );
}

function App() {
  return translator.value ? <DisplayHello /> : null;
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), 'title.display');
}
