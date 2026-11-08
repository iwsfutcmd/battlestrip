import { effect, signal } from '@preact/signals';
import { render } from 'preact';
import '../common/base.css';
import '../table/table.css';
import { activateLocale, requestedLocales, translator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { openChannel } from '../table/channel.ts';
import { TableDisplay } from '../table/TableDisplay.tsx';
import type { PublicTable } from '../table/types.ts';
import './display.css';

/** The TV window: renders whatever public table the control window posts. */
const table = signal<PublicTable | null>(null);

function App() {
  const t = translator.value;
  if (!t) return null;
  const current = table.value;
  if (!current) {
    return (
      <main class="tv tv-waiting-screen">
        <h1 class="tv-title">
          <Msg id="app.title" />
        </h1>
        <p class="tv-waiting">
          <Msg id="route.display.waiting" />
        </p>
      </main>
    );
  }
  return <TableDisplay table={current} showHousekeeping />;
}

const root = document.getElementById('app');
if (root) {
  const channel = openChannel((m) => {
    if (m.type === 'table') table.value = m.table;
  });
  channel.post({ type: 'hello' });
  addEventListener('pagehide', () => channel.post({ type: 'bye' }));
  // The game language comes from the control window once it posts the table.
  effect(() => {
    const locale = table.value?.settings.locale;
    if (locale && locale !== translator.value?.locale) void activateLocale([locale], 'title.display');
  });
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), 'title.display');
}
