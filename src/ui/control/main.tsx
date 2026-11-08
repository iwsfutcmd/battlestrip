import { effect, signal } from '@preact/signals';
import { render } from 'preact';
import '../common/base.css';
import '../table/table.css';
import { pseudoRequested } from '../common/LanguagePicker.tsx';
import { activateLocale, requestedLocales, translator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { openChannel } from '../table/channel.ts';
import { TableDisplay } from '../table/TableDisplay.tsx';
import './control.css';
import { Handout } from './handout/Handout.tsx';
import { Lobby } from './Lobby.tsx';
import { Placement } from './placement/Placement.tsx';
import { PlayPanel, useGridInteraction } from './PlayPanel.tsx';
import { lobby, publicTable, stage, startAutosave, startBotDriver, updateLobby } from './store.ts';
import { defaultLabelSystem } from '../../i18n/labels.ts';
import { writingModesFor } from '../../i18n/index.ts';

const displayConnected = signal(false);
const tableHere = signal(true);

function App() {
  const t = translator.value;
  const table = publicTable.value;
  const interaction = useGridInteraction();
  if (!t || !table) return null;
  if (stage.value === 'lobby') return <Lobby showPseudo={pseudoRequested(location.search)} />;
  if (stage.value === 'handout' || stage.value === 'placement') {
    return (
      <main class="control-handout">
        {stage.value === 'handout' ? <Handout /> : <Placement />}
        <p class="muted small">
          <button type="button" class="subtle" onClick={() => window.open('display/', 'battlestrip-display', 'popup')}>
            <Msg id="play.openDisplay" />
          </button>
        </p>
      </main>
    );
  }
  const showTable = tableHere.value || !displayConnected.value;
  return (
    <main class={`control-play ${showTable ? '' : 'is-controls-only'}`}>
      {showTable && <TableDisplay table={table} interaction={interaction} showHousekeeping={false} />}
      <PlayPanel displayConnected={displayConnected.value} tableHere={tableHere.value} onToggleTable={() => (tableHere.value = !tableHere.value)} />
    </main>
  );
}

const root = document.getElementById('app');
if (root) {
  const channel = openChannel((m) => {
    if (m.type === 'hello') {
      displayConnected.value = true;
      const table = publicTable.value;
      if (table) channel.post({ type: 'table', table });
    } else if (m.type === 'bye') {
      displayConnected.value = false;
    }
  });
  effect(() => {
    const table = publicTable.value;
    if (table) channel.post({ type: 'table', table });
  });
  startBotDriver();
  startAutosave();
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), 'title.control').then((t) => {
    if (t && lobby.value.seats.every((s) => s.name === '')) {
      updateLobby({ labels: defaultLabelSystem(t.locale), writingMode: writingModesFor(t.locale).default });
    }
  });
}
