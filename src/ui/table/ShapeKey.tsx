import { shapeOf, type PlayerView } from '../../engine/index.ts';
import { formatNumber } from '../../i18n/labels.ts';
import { useTranslator } from '../common/locale-state.ts';
import { Msg } from '../common/Msg.tsx';
import { shipNameIn } from './format.ts';
import { ShapeIcon } from './Piece.tsx';

/**
 * A key to the shapes in play: every piece anyone is wearing, once, in
 * wardrobe order, with its number, shape and name. Public information (the
 * outfits are chosen in the open, and every shape is in the wardrobe); it
 * says nothing about where anything is. A piece may lie turned or flipped
 * on a board, so the drawing is one way it can look.
 */
export function ShapeKey({ view, locale }: { readonly view: PlayerView; readonly locale: string }) {
  const t = useTranslator();
  const worn = new Set(view.players.flatMap((p) => p.ships.map((s) => s.ship)));
  const pieces = view.rules.shipyard.filter((s) => worn.has(s.id));
  if (pieces.length === 0) return null;
  return (
    <section class="shape-key" aria-labelledby="shape-key-heading">
      <h2 id="shape-key-heading" class="shape-key-heading">
        <Msg id="shapeKey.heading" />
      </h2>
      <ul class="shape-key-list">
        {pieces.map((def) => (
          <li key={def.id} class="shape-key-item">
            <span class="ship-pic-number" aria-hidden="true">
              {formatNumber(locale, def.number)}
            </span>
            <ShapeIcon shape={shapeOf(def)} size="1.5em" />
            <span class="shape-key-name">{shipNameIn(t, view.rules, def.id)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
