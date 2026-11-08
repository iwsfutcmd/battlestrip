import { render } from 'preact';
import { decodeInvite } from '../../share/invite.ts';
import '../common/base.css';
import { activateLocale, requestedLocales, translator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import '../table/table.css';
import { PlaceEditor } from './PlaceEditor.tsx';
import './phone.css';

/** The placement page (M5): game parameters come from the fragment; the UI is in the phone's language. */
const fragment = location.hash.slice(1);
const invite = fragment === '' ? null : decodeInvite(decodeURIComponent(fragment));

function App() {
  if (!translator.value) return null;
  if (invite) return <PlaceEditor invite={invite} />;
  return (
    <main class="phone">
      <h1>
        <Msg id="place.heading" />
      </h1>
      <p>
        <Msg id="place.invalidLink" />
      </p>
    </main>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  void activateLocale(requestedLocales(location.search, navigator.languages), 'title.place');
}
