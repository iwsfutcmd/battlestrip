import { useId } from 'preact/hooks';
import { presetRules, type ShipId } from '../../engine/index.ts';
import { writingModesFor, type CatalogId } from '../../i18n/index.ts';
import { fits, LABEL_SYSTEMS, systemForRows, defaultLabelSystem, type LabelSystemId } from '../../i18n/labels.ts';
import { cleanName, sameName } from '../../i18n/text.ts';
import { ClothingIcon } from '../common/clothing.tsx';
import { Glyph } from '../common/identity.tsx';
import { LanguagePicker } from '../common/LanguagePicker.tsx';
import { activateLocale, useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { shipName } from '../table/format.ts';
import {
  addSeat,
  clearSave,
  deal,
  lobby,
  MAX_SEATS,
  moveSeat,
  notice,
  readSave,
  removeSeat,
  resume,
  rulesForLobby,
  updateLobby,
  updateSeat,
  type SeatConfig,
} from './store.ts';
import { signal } from '@preact/signals';

const SYSTEMS = Object.keys(LABEL_SYSTEMS) as LabelSystemId[];
const savedGame = signal(readSave());

export function Lobby({ showPseudo }: { readonly showPseudo: boolean }) {
  const t = useTranslator();
  const c = lobby.value;
  const rules = rulesForLobby(c);
  const names = c.seats.map((s, i) => s.name.trim() || t.format('lobby.defaultName', { n: i + 1 }));
  const duplicate = names.some((n, i) => names.some((m, j) => j > i && sameName(n, m, t.locale)));
  const emptyFleet = c.seats.some((s) => (s.kind === 'human' || s.policy === 'fixed') && s.fleet.length === 0);
  const usedLabels = systemForRows(c.labels, c.rows);
  const modes = writingModesFor(t.locale);

  const chooseLanguage = (id: CatalogId): void => {
    void activateLocale([id, ...navigator.languages], 'title.control').then((next) => {
      if (next) updateLobby({ labels: defaultLabelSystem(next.locale), writingMode: writingModesFor(next.locale).default });
    });
  };

  return (
    <main class="lobby">
      <header class="lobby-header">
        <h1>
          <Msg id="app.title" />
        </h1>
        <p class="muted">
          <Msg id="app.tagline" />
        </p>
      </header>

      {savedGame.value && (
        <div class="banner" role="status">
          <Msg id="lobby.resume" />
          <button
            type="button"
            class="primary"
            onClick={() => {
              const file = savedGame.value;
              if (file) void activateLocale([file.session.settings.locale], 'title.control').then(() => resume(file));
              savedGame.value = null;
            }}
          >
            <Msg id="lobby.resumeYes" />
          </button>
          <button
            type="button"
            onClick={() => {
              clearSave();
              savedGame.value = null;
            }}
          >
            <Msg id="lobby.resumeNo" />
          </button>
        </div>
      )}

      <LanguagePicker labelKey="language.gameLabel" value={t.catalog} onChange={chooseLanguage} showPseudo={showPseudo} />

      <section aria-labelledby="players-heading" class="lobby-section">
        <h2 id="players-heading">
          <Msg id="lobby.players" /> <span class="muted">(<Msg id="lobby.playerCount" values={{ count: c.seats.length }} />)</span>
        </h2>
        <ol class="seat-list">
          {c.seats.map((seat, i) => (
            <SeatEditor key={seat.key} seat={seat} index={i} count={c.seats.length} shipyard={rules.shipyard} />
          ))}
        </ol>
        <div class="actions">
          <button type="button" disabled={c.seats.length >= MAX_SEATS} onClick={() => addSeat('human')}>
            <Msg id="lobby.addPlayer" /> · <Msg id="lobby.human" />
          </button>
          <button type="button" disabled={c.seats.length >= MAX_SEATS} onClick={() => addSeat('bot')}>
            <Msg id="lobby.addPlayer" /> · <Msg id="lobby.bot" />
          </button>
        </div>
        {duplicate && (
          <p class="warning" role="status">
            <Msg id="lobby.duplicateName" />
          </p>
        )}
      </section>

      <section aria-labelledby="settings-heading" class="lobby-section">
        <h2 id="settings-heading">
          <Msg id="lobby.settings" />
        </h2>
        <div class="settings-grid">
          <Field labelId="lobby.preset">
            {(id) => (
              <select id={id} value={c.preset} onChange={(e) => updateLobby({ preset: e.currentTarget.value === 'morskoyBoy' ? 'morskoyBoy' : 'classic' })}>
                <option value="classic">{t.format('preset.classic')}</option>
                <option value="morskoyBoy" lang="ru">
                  {t.format('preset.morskoyBoy')}
                </option>
              </select>
            )}
          </Field>
          <Field labelId="lobby.placement">
            {(id) => (
              <select id={id} value={c.placement} onChange={(e) => updateLobby({ placement: e.currentTarget.value === 'phones' ? 'phones' : 'random' })}>
                <option value="random">{t.format('placement.random')}</option>
                <option value="phones">{t.format('placement.phones')}</option>
              </select>
            )}
          </Field>
          <Field labelId="lobby.rows">
            {(id) => <NumberInput id={id} value={c.rows} min={5} max={20} onChange={(rows) => updateLobby({ rows })} />}
          </Field>
          <Field labelId="lobby.cols">
            {(id) => <NumberInput id={id} value={c.cols} min={5} max={20} onChange={(cols) => updateLobby({ cols })} />}
          </Field>
          <label class="check">
            <input type="checkbox" checked={c.allowTouching} onChange={(e) => updateLobby({ allowTouching: e.currentTarget.checked })} />{' '}
            <Msg id="lobby.touching" />
          </label>
          <label class="check">
            <input type="checkbox" checked={c.playOut ?? true} onChange={(e) => updateLobby({ playOut: e.currentTarget.checked })} />{' '}
            <Msg id="lobby.playOut" />
          </label>
          <Field labelId="lobby.labels">
            {(id) => (
              <select id={id} value={c.labels} onChange={(e) => updateLobby({ labels: e.currentTarget.value as LabelSystemId })}>
                {SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {t.format('labels.system', { id: s })}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field labelId="lobby.labels2">
            {(id) => (
              <select
                id={id}
                value={c.labels2 ?? ''}
                onChange={(e) => updateLobby({ labels2: e.currentTarget.value === '' ? null : (e.currentTarget.value as LabelSystemId) })}
              >
                <option value="">{t.format('labels.none')}</option>
                {SYSTEMS.filter((s) => s !== 'numeric').map((s) => (
                  <option key={s} value={s}>
                    {t.format('labels.system', { id: s })}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!fits(c.labels, c.rows) && (
            <p class="warning">
              <Msg id="lobby.labelsFallback" values={{ used: t.format('labels.system', { id: usedLabels }) }} />
            </p>
          )}
          {modes.options.length > 1 && (
            <Field labelId="lobby.writingMode">
              {(id) => (
                <select id={id} value={c.writingMode} onChange={(e) => updateLobby({ writingMode: e.currentTarget.value as typeof c.writingMode })}>
                  {modes.options.map((m) => (
                    <option key={m} value={m}>
                      {t.format(m === 'horizontal-tb' ? 'wm.horizontal' : 'wm.vertical')}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field labelId="lobby.beat">
            {(id) => <NumberInput id={id} value={c.beatSeconds} min={0} max={5} step={0.5} onChange={(beatSeconds) => updateLobby({ beatSeconds })} />}
          </Field>
          <Field labelId="lobby.botDelay">
            {(id) => <NumberInput id={id} value={c.botSeconds} min={0} max={5} step={0.1} onChange={(botSeconds) => updateLobby({ botSeconds })} />}
          </Field>
          <label class="check">
            <input type="checkbox" checked={c.speech} onChange={(e) => updateLobby({ speech: e.currentTarget.checked })} /> <Msg id="lobby.speech" />
          </label>
          <Field labelId="lobby.seed">
            {(id) => <input id={id} type="text" inputMode="numeric" value={c.seed} dir="ltr" onInput={(e) => updateLobby({ seed: e.currentTarget.value })} />}
          </Field>
        </div>
      </section>

      {notice.value?.tone === 'error' && (
        <p class="error" role="alert">
          <Msg id={notice.value.key} values={notice.value.values} />
        </p>
      )}
      {emptyFleet && (
        <p class="warning">
          <Msg id="lobby.fleetEmpty" />
        </p>
      )}
      <div class="actions">
        <button type="button" class="primary big" disabled={emptyFleet} onClick={() => deal(names, t.locale)}>
          <Msg id="lobby.start" />
        </button>
      </div>
    </main>
  );
}

function Field({ labelId, children }: { readonly labelId: Parameters<typeof Msg>[0]['id']; readonly children: (id: string) => preact.ComponentChildren }) {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>
        <Msg id={labelId} />
      </label>
      {children(id)}
    </div>
  );
}

function NumberInput({ id, value, min, max, step = 1, onChange }: { readonly id: string; readonly value: number; readonly min: number; readonly max: number; readonly step?: number; readonly onChange: (n: number) => void }) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.currentTarget.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

function SeatEditor({ seat, index, count, shipyard }: { readonly seat: SeatConfig; readonly index: number; readonly count: number; readonly shipyard: ReturnType<typeof presetRules>['shipyard'] }) {
  const t = useTranslator();
  const nameId = useId();
  const kindId = useId();
  const botId = useId();
  const policyId = useId();
  const displayName = seat.name.trim() || t.format('lobby.defaultName', { n: index + 1 });
  const toggle = (id: ShipId): void => {
    updateSeat(seat.key, { fleet: seat.fleet.includes(id) ? seat.fleet.filter((x) => x !== id) : shipyard.filter((s) => s.id === id || seat.fleet.includes(s.id)).map((s) => s.id) });
  };
  const showFleet = seat.kind === 'human' || seat.policy === 'fixed';
  return (
    <li class="seat">
      <div class="seat-head">
        <Glyph identity={index} size="1.5em" />
        <span class="muted">
          <Msg id="lobby.seatNumber" values={{ seat: index + 1 }} />
        </span>
        <label for={nameId} class="visually-hidden">
          <Msg id="lobby.name" />
        </label>
        <input
          id={nameId}
          class="seat-name"
          type="text"
          dir="auto"
          autocomplete="off"
          value={seat.name}
          placeholder={t.format('lobby.defaultName', { n: index + 1 })}
          onInput={(e) => updateSeat(seat.key, { name: cleanName(e.currentTarget.value) })}
        />
        <label for={kindId} class="visually-hidden">
          <Msg id="lobby.kind" />
        </label>
        <select id={kindId} value={seat.kind} onChange={(e) => updateSeat(seat.key, { kind: e.currentTarget.value === 'bot' ? 'bot' : 'human' })}>
          <option value="human">{t.format('lobby.human')}</option>
          <option value="bot">{t.format('lobby.bot')}</option>
        </select>
        <span class="seat-move">
          <button type="button" disabled={index === 0} onClick={() => moveSeat(seat.key, -1)} aria-label={t.format('lobby.seatNumber', { seat: index })}>
            ↑
          </button>
          <button type="button" disabled={index === count - 1} onClick={() => moveSeat(seat.key, 1)} aria-label={t.format('lobby.seatNumber', { seat: index + 2 })}>
            ↓
          </button>
        </span>
        <button type="button" disabled={count <= 2} onClick={() => removeSeat(seat.key)} aria-label={t.format('lobby.removePlayer', { name: displayName })}>
          ✕
        </button>
      </div>
      {seat.kind === 'bot' && (
        <div class="seat-bot">
          <label for={botId}>
            <Msg id="lobby.botKind" />
          </label>
          <select id={botId} value={seat.bot} onChange={(e) => updateSeat(seat.key, { bot: e.currentTarget.value === 'random' ? 'random' : 'density' })}>
            <option value="density">{t.format('bot.density')}</option>
            <option value="random">{t.format('bot.random')}</option>
          </select>
          <label for={policyId}>
            <Msg id="lobby.policy" />
          </label>
          <select id={policyId} value={seat.policy} onChange={(e) => updateSeat(seat.key, { policy: e.currentTarget.value as SeatConfig['policy'] })}>
            <option value="full">{t.format('policy.full')}</option>
            <option value="random">{t.format('policy.random')}</option>
            <option value="fixed">{t.format('policy.fixed')}</option>
          </select>
        </div>
      )}
      {showFleet && (
        <fieldset class="fleet-picker">
          <legend>
            <Msg id="lobby.fleet" />
          </legend>
          {shipyard.map((s) => {
            const on = seat.fleet.includes(s.id);
            const name = shipName(t, s.kind, shipyard.filter((x) => x.kind === s.kind).length > 1 ? shipyard.filter((x) => x.kind === s.kind).indexOf(s) + 1 : null);
            return (
              <button key={s.id} type="button" class={`ship-toggle ${on ? 'is-on' : ''}`} aria-pressed={on ? 'true' : 'false'} onClick={() => toggle(s.id)}>
                <span class="ship-toggle-number">{new Intl.NumberFormat(t.locale).format(s.number)}</span>
                <ClothingIcon kind={s.kind} />
                <span class="ship-toggle-name">{name}</span>
                <span class="ship-pic-hull" aria-hidden="true">
                  {Array.from({ length: s.length }, (_, k) => (
                    <span key={k} class="ship-seg" />
                  ))}
                </span>
              </button>
            );
          })}
        </fieldset>
      )}
    </li>
  );
}
