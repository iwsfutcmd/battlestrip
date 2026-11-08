import { useState } from 'preact/hooks';
import { cellsOf, occupancy, orient, shapeOf, seedRng, wardrobeRules, type Coord, type PlacedShip, type Rules } from '../../engine/index.ts';
import { randomLayout } from '../../engine/placement.ts';
import { fleetCheck } from '../../share/codes.ts';
import { encodeFleetCode, groupCode } from '../../share/fleet-code.ts';
import type { PlacementInvite } from '../../share/invite.ts';
import { encodeFleetImage, type FleetImage } from '../../share/payload.ts';
import { ClothingIcon } from '../common/clothing.tsx';
import { Glyph, identityColour } from '../common/identity.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { Qr } from '../common/Qr.tsx';
import { labelsFor, shipName } from '../table/format.ts';
import { Grid } from '../table/Grid.tsx';
import { PieceOutline, ShapeIcon } from '../table/Piece.tsx';
import { formatNumber } from '../../i18n/labels.ts';
import { wardrobePiece } from '../../share/payload.ts';

type Layout = Partial<Record<number, { readonly origin: Coord; readonly orientation: number }>>;

export function rulesOf(inv: PlacementInvite): Rules {
  return wardrobeRules({ rows: inv.rows, cols: inv.cols, allowTouching: inv.allowTouching });
}

function placedShips(rules: Rules, layout: Layout): PlacedShip[] {
  return Object.entries(layout).flatMap(([k, p]) => {
    const def = rules.shipyard[Number(k)];
    return def && p ? [{ ship: def.id, origin: p.origin, orientation: p.orientation }] : [];
  });
}

/** Orientation after a quarter turn clockwise, or after a mirror (keeps the other part). */
const turned = (o: number): number => (o & 4) | ((o + 1) & 3);
const flipped = (o: number): number => o ^ 4;

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
  const [orientation, setOrientation] = useState(0);
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

  /** Where to put a piece so that its first filled cell lands on `c`. */
  const originFor = (k: number, o: number, c: Coord): Coord => {
    const def = rules.shipyard[k];
    const first = def ? orient(shapeOf(def), o)[0] : undefined;
    return { row: c.row - (first?.[0] ?? 0), col: c.col - (first?.[1] ?? 0) };
  };

  const pieceAt = (c: Coord): number | undefined =>
    fleet.find((k) => {
      const p = layout[k];
      const def = rules.shipyard[k];
      return p && def && cellsOf(rules, { ship: def.id, origin: p.origin, orientation: p.orientation }).some((x) => x.row === c.row && x.col === c.col);
    });

  const tap = (c: Coord): void => {
    setFocus(c);
    // Tapping a placed piece selects it.
    const there = pieceAt(c);
    if (there !== undefined && there !== selected) {
      setSelected(there);
      setOrientation(layout[there]?.orientation ?? 0);
      return;
    }
    if (selected === null) return;
    if (tryPlace({ ...layout, [selected]: { origin: originFor(selected, orientation, c), orientation } })) {
      const nextShip = fleet.find((k) => k !== selected && layout[k] === undefined);
      if (nextShip !== undefined) {
        setSelected(nextShip);
        setOrientation(0);
      }
    }
  };

  /** Turn or flip the selected piece in place (about its first filled cell). */
  const reorient = (next: number): void => {
    setOrientation(next);
    const p = selected === null ? undefined : layout[selected];
    if (selected === null || !p) return;
    const def = rules.shipyard[selected];
    const anchor = def ? orient(shapeOf(def), p.orientation)[0] : undefined;
    const at = { row: p.origin.row + (anchor?.[0] ?? 0), col: p.origin.col + (anchor?.[1] ?? 0) };
    tryPlace({ ...layout, [selected]: { origin: originFor(selected, next, at), orientation: next } });
  };

  const random = (): void => {
    const [placed] = randomLayout(rules, fleet.map((k) => rules.shipyard[k]?.id).filter((x) => x !== undefined), seedRng(randomSeed()));
    if (!placed) return;
    const next: Layout = {};
    for (const p of placed) next[rules.shipyard.findIndex((s) => s.id === p.ship)] = { origin: p.origin, orientation: p.orientation };
    setError(false);
    setLayout(next);
  };

  if (done && complete) {
    const ships = fleet.flatMap((k) => {
      const p = layout[k];
      return p ? [{ ship: k, origin: p.origin, orientation: p.orientation }] : [];
    });
    const code = encodeFleetCode({ gameCode: invite.gameCode, rules, fleets: invite.seats.map((x) => x.fleet) }, { seat, ships });
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
      ships: ships.flatMap((s) => {
        const piece = wardrobePiece(s.ship, s.origin, s.orientation);
        return piece ? [piece] : [];
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
            <PieceOutline
              key={k}
              piece={{ number: def.number, kind: def.kind, cells: cellsOf(rules, { ship: def.id, origin: p.origin, orientation: p.orientation }) }}
              colour={identityColour(seat)}
              digitsLocale={labels.digitsLocale}
              selected={selected === k}
            />
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
              <button type="button" class={`ship-toggle ${selected === k ? 'is-on' : ''} ${layout[k] ? 'is-placed' : ''}`} aria-pressed={selected === k ? 'true' : 'false'}
                onClick={() => {
                  setSelected(k);
                  setOrientation(layout[k]?.orientation ?? 0);
                }}
              >
                <span class="ship-toggle-number">{formatNumber(t.locale, def.number)}</span>
                <ClothingIcon kind={def.kind} />
                <span>{shipName(t, def.kind, null)}</span>
                <ShapeIcon shape={orient(shapeOf(def), selected === k ? orientation : 0)} />
                {layout[k] && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div class="actions">
        <button type="button" onClick={() => reorient(turned(orientation))}>
          <Msg id="place.rotate" />
        </button>
        <button type="button" onClick={() => reorient(flipped(orientation))}>
          <Msg id="place.flip" />
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
