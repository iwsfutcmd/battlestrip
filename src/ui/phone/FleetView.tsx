import { useState } from 'preact/hooks';
import type { CatalogId } from '../../i18n/index.ts';
import type { FleetImage } from '../../share/payload.ts';
import { HoldToReveal } from '../common/HoldToReveal.tsx';
import { ClothingIcon } from '../common/clothing.tsx';
import { Glyph } from '../common/identity.tsx';
import { LanguagePicker } from '../common/LanguagePicker.tsx';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { FleetBoard } from '../table/FleetBoard.tsx';
import { colText, labelsFor, rowText, shipName } from '../table/format.ts';
import { fleetPng } from './png.ts';
import { ShapeIcon } from '../table/Piece.tsx';
import { WARDROBE } from '../../engine/index.ts';
import { formatNumber } from '../../i18n/labels.ts';

/**
 * The phone's one job: a static picture of your own fleet. Labels follow the
 * game (so they match the TV); the legend is in the phone's own language.
 */
export function FleetView({ image, onLanguage, showPseudo }: { readonly image: FleetImage; readonly onLanguage: (id: CatalogId) => void; readonly showPseudo: boolean }) {
  const t = useTranslator();
  const [always, setAlways] = useState(false);
  const labels = labelsFor(image.labels, image.labels2, image.numbering);
  const ships = [...image.ships].sort((a, b) => a.number - b.number);
  const legend = ships.map((s) => `${formatNumber(t.locale, s.number)} · ${shipName(t, s.kind, null)}`);
  const squares = (s: (typeof ships)[number]): string =>
    s.cells.map((c) => t.format('coord.label', { row: rowText(labels, c.row), col: colText(labels, c.col) })).join(', ');

  const save = async (): Promise<void> => {
    const blob = await fleetPng(image, labels, legend);
    if (!blob) return;
    const file = new File([blob], `battlestrip-${image.gameCode}-${image.fleetCheck}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <main class="phone">
      <header class="phone-header">
        <Glyph identity={image.identity} size="2em" />
        <h1 class="phone-name">
          <bdi>{image.name}</bdi>
        </h1>
      </header>
      <HoldToReveal labelId="phone.hold" always={always}>
        <FleetBoard rows={image.rows} cols={image.cols} labels={labels} dir={image.dir} writingMode={image.writingMode} ships={image.ships} identity={image.identity} className="phone-board" />
        <section class="phone-legend" aria-labelledby="legend-heading">
          <h2 id="legend-heading">
            <Msg id="phone.legend" />
          </h2>
          <ul>
            {ships.map((s) => (
              <li key={s.number}>
                <span class="legend-number">{formatNumber(t.locale, s.number)}</span> <ClothingIcon kind={s.kind} /> <span>{shipName(t, s.kind, null)}</span>{' '}
                <ShapeIcon shape={WARDROBE[s.item]?.shape ?? []} />
              </li>
            ))}
          </ul>
        </section>
        <section class="visually-hidden" aria-label={t.format('phone.shipsAlt')}>
          <ul>
            {ships.map((s) => (
              <li key={s.number}>
                <Msg id="phone.shipLine" values={{ number: s.number, ship: shipName(t, s.kind, null), squares: squares(s) }} />
              </li>
            ))}
          </ul>
        </section>
      </HoldToReveal>
      <div class="phone-tools">
        <label class="check">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.currentTarget.checked)} /> <Msg id="phone.alwaysShow" />
        </label>
        <button type="button" onClick={() => void save()}>
          <Msg id="phone.save" />
        </button>
      </div>
      <p class="phone-codes">
        <span>
          <Msg id="phone.gameCode" /> <bdi dir="ltr" class="code" data-testid="game-code">{image.gameCode}</bdi>
        </span>
        <span>
          <Msg id="phone.fleetCheck" /> <bdi dir="ltr" class="code" data-testid="fleet-check">{image.fleetCheck}</bdi>
        </span>
      </p>
      <LanguagePicker labelKey="language.label" value={t.catalog} onChange={onLanguage} showPseudo={showPseudo} />
    </main>
  );
}
