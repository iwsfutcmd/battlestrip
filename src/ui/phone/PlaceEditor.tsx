import { useState } from 'preact/hooks';
import { occupancy, presetRules, seedRng, type Axis, type Coord, type PlacedShip, type Rules } from '../../engine/index.ts';
import { randomLayout } from '../../engine/placement.ts';
import { fleetCheck } from '../../share/codes.ts';
import { encodeFleetCode, groupCode } from '../../share/fleet-code.ts';
import type { PlacementInvite } from '../../share/invite.ts';
import { encodeFleetImage, type FleetImage } from '../../share/payload.ts';
import { Glyph, identityColour } from '../common/identity.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { Qr } from '../common/Qr.tsx';
import { labelsFor, shipName } from '../table/format.ts';
import { Grid, shipArea } from '../table/Grid.tsx';
import { copyNumber } from '../../engine/index.ts';
import { formatNumber } from '../../i18n/labels.ts';

type Layout = Partial<Record<number, { readonly origin: Coord; readonly axis: Axis }>>;

export function rulesOf(inv: PlacementInvite): Rules {
  return presetRules(inv.preset, { rows: inv.rows, cols: inv.cols, allowTouching: inv.allowTouching });
}

function placedShips(rules: Rules, layout: Layout): PlacedShip[] {
  return Object.entries(layout).flatMap(([k, p]) => {
    const def = rules.shipyard[Number(k)];
    return def && p ? [{ ship: def.id, origin: p.origin, axis: p.axis }] : [];
  });
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 7;
}

/** The phone placement editor (M5): pick your seat, place your ships, get your fleet code. */
export function PlaceEditor({ invite }: { readonly invite: PlacementInvite }) {
  const t = useTranslator();
  const rules = rulesOf(invite);
  const [seat, setSeat] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [axis, setAxis] = useState<Axis>('alongRow');
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [focus, setFocus] = useState<Coord>({ row: 0, col: 0 });
  const labels = labelsFor(invite.labels, invite.labels2, invite.numbering);

  if (seat === null) {
    return (
      <main class="phone place">
        <h1>
          <Msg id="place.who" />
        </h1>
        <ul class="place-seats">
          {invite.seats.map((s, i) =>
            s.human ? (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setSeat(i);
                    setSelected(s.fleet[0] ?? null);
                  }}
                >
                  <Glyph identity={i} size="1.4em" /> <bdi>{s.name}</bdi>
                </button>
              </li>
            ) : null,
          )}
        </ul>
      </main>
    );
  }

  const me = invite.seats[seat];
  const fleet = me?.fleet ?? [];
  const complete = fleet.every((k) => layout[k] !== undefined);

  const tryPlace = (next: Layout): boolean => {
    const ok = occupancy(rules, placedShips(rules, next)) !== null;
    setError(!ok);
    if (ok) setLayout(next);
    return ok;
  };

  const tap = (c: Coord): void => {
    setFocus(c);
    // Tapping a placed ship selects it.
    for (const k of fleet) {
      const p = layout[k];
      const def = rules.shipyard[k];
      if (!p || !def) continue;
      const along = p.axis === 'alongRow' ? c.row === p.origin.row && c.col >= p.origin.col && c.col < p.origin.col + def.length : c.col === p.origin.col && c.row >= p.origin.row && c.row < p.origin.row + def.length;
      if (along && selected !== k) {
        setSelected(k);
        setAxis(p.axis);
        return;
      }
    }
    if (selected === null) return;
    if (tryPlace({ ...layout, [selected]: { origin: c, axis } })) {
      const nextShip = fleet.find((k) => k !== selected && layout[k] === undefined);
      if (nextShip !== undefined) setSelected(nextShip);
    }
  };

  const rotate = (): void => {
    const nextAxis: Axis = axis === 'alongRow' ? 'alongCol' : 'alongRow';
    setAxis(nextAxis);
    const p = selected === null ? undefined : layout[selected];
    if (selected !== null && p) tryPlace({ ...layout, [selected]: { origin: p.origin, axis: nextAxis } });
  };

  const random = (): void => {
    const [placed] = randomLayout(rules, fleet.map((k) => rules.shipyard[k]?.id).filter((x) => x !== undefined), seedRng(randomSeed()));
    if (!placed) return;
    const next: Layout = {};
    for (const p of placed) next[rules.shipyard.findIndex((s) => s.id === p.ship)] = { origin: p.origin, axis: p.axis };
    setError(false);
    setLayout(next);
  };

  if (done && complete) {
    const ships = fleet.flatMap((k) => {
      const p = layout[k];
      return p ? [{ ship: k, origin: p.origin, axis: p.axis }] : [];
    });
    const code = encodeFleetCode({ gameCode: invite.gameCode, rules }, { seat, ships });
    const placed = placedShips(rules, layout);
    const image: FleetImage = {
      gameCode: invite.gameCode,
      fleetCheck: fleetCheck(invite.gameCode, seat, 0, placed),
      rows: rules.rows,
      cols: rules.cols,
      labels: invite.labels,
      labels2: invite.labels2,
      numbering: invite.numbering,
      dir: invite.dir,
      writingMode: invite.writingMode,
      name: me?.name ?? '',
      identity: seat,
      ships: ships.map((s) => {
        const def = rules.shipyard[s.ship];
        return { number: def?.number ?? 0, kind: def?.kind ?? '', copy: copyNumber(rules.shipyard, def?.id ?? ('' as never)), length: def?.length ?? 1, origin: s.origin, axis: s.axis };
      }),
    };
    return (
      <main class="phone place">
        <h1>
          <Msg id="place.codeHeading" />
        </h1>
        <Qr text={code} label={t.format('place.codeHeading')} />
        <p class="fleet-code">
          <bdi dir="ltr" class="code" data-testid="fleet-code">
            {groupCode(code)}
          </bdi>
        </p>
        <p>
          <Msg id="place.codeHint" />
        </p>
        <div class="actions">
          <a class="button primary" href={new URL(`../fleet/#${encodeFleetImage(image)}`, location.href).toString()}>
            <Msg id="place.showFleet" />
          </a>
          <button type="button" onClick={() => setDone(false)}>
            <Msg id="place.change" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main class="phone place">
      <header class="phone-header">
        <Glyph identity={seat} size="2em" />
        <h1 class="phone-name">
          <bdi>{me?.name}</bdi>
        </h1>
      </header>
      <p class="muted">
        <Msg id="place.hint" />
      </p>
      <Grid
        rows={rules.rows}
        cols={rules.cols}
        labels={labels}
        dir={invite.dir}
        writingMode={invite.writingMode}
        className="fleet-board phone-board"
        cell={() => ({})}
        interaction={{ focus, onFocus: tap, onActivate: tap, cellName: () => '', gridName: t.format('place.heading') }}
        overlays={fleet.map((k) => {
          const p = layout[k];
          const def = rules.shipyard[k];
          if (!p || !def) return null;
          return (
            <div key={k} class={`ship-outline ${selected === k ? 'is-selected' : ''}`} style={{ ...shipArea(p.origin, p.axis, def.length), borderColor: identityColour(seat) }}>
              <span class="ship-number">{formatNumber(labels.digitsLocale, def.number)}</span>
            </div>
          );
        })}
      />
      {error && (
        <p class="error" role="alert">
          <Msg id="place.invalid" />
        </p>
      )}
      <ul class="place-ships">
        {fleet.map((k) => {
          const def = rules.shipyard[k];
          if (!def) return null;
          return (
            <li key={k}>
              <button type="button" class={`ship-toggle ${selected === k ? 'is-on' : ''} ${layout[k] ? 'is-placed' : ''}`} aria-pressed={selected === k ? 'true' : 'false'} onClick={() => setSelected(k)}>
                <span class="ship-toggle-number">{formatNumber(t.locale, def.number)}</span>
                <span>{shipName(t, def.kind, copyNumber(rules.shipyard, def.id))}</span>
                <span class="ship-pic-hull" aria-hidden="true">
                  {Array.from({ length: def.length }, (_, i) => (
                    <span key={i} class="ship-seg" />
                  ))}
                </span>
                {layout[k] && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div class="actions">
        <button type="button" onClick={rotate}>
          <Msg id="place.rotate" />
        </button>
        <button type="button" onClick={random}>
          <Msg id="place.random" />
        </button>
        <button
          type="button"
          onClick={() => {
            setLayout({});
            setError(false);
          }}
        >
          <Msg id="place.clear" />
        </button>
        <button type="button" class="primary" disabled={!complete} onClick={() => setDone(true)}>
          <Msg id="place.done" />
        </button>
      </div>
    </main>
  );
}
