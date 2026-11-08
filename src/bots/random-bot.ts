import type { Coord, PlayerView } from '../engine/index.ts';
import { coordIndex, ownUnhitSquares, pick, viewerSeat } from './common.ts';

/**
 * Uniform over legal calls. While afloat (single calls) with self-fire on, it
 * avoids its own unhit ship squares unless nothing else is legal. Bombs are
 * uniform over legal corners.
 */
export function randomBotCall(view: PlayerView, legal: readonly Coord[], seed: number): Coord {
  const me = viewerSeat(view);
  if (view.currentShape === 'single' && view.rules.selfFire && me >= 0) {
    const own = ownUnhitSquares(view, me);
    const safe = legal.filter((c) => own[coordIndex(view, c)] !== 1);
    if (safe.length > 0) return pick(safe, seed);
  }
  return pick(legal, seed);
}
