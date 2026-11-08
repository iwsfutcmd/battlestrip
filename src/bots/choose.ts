import { nextInt, seedRng, type Coord, type PlayerView, type Rules, type ShipId } from '../engine/index.ts';
import { densityBotCall } from './density-bot.ts';
import { randomBotCall } from './random-bot.ts';

export type BotKind = 'random' | 'density';
export const BOT_KINDS: readonly BotKind[] = ['density', 'random'];

export type FleetPolicy =
  | { readonly kind: 'full' }
  | { readonly kind: 'random' }
  | { readonly kind: 'fixed'; readonly ships: readonly ShipId[] };

/**
 * Pure and deterministic: same view, legal calls and seed → same call.
 * `view` is viewFor(state, botId): public information plus the bot's own fleet.
 */
export function chooseCall(kind: BotKind, view: PlayerView, legal: readonly Coord[], seed: number): Coord {
  if (legal.length === 0) throw new Error('chooseCall: no legal calls');
  return kind === 'random' ? randomBotCall(view, legal, seed) : densityBotCall(view, legal, seed);
}

/** A non-empty fleet from the shipyard per the policy (random = uniform over non-empty subsets). */
export function chooseFleet(policy: FleetPolicy, rules: Rules, seed: number): ShipId[] {
  const all = rules.shipyard.map((s) => s.id);
  switch (policy.kind) {
    case 'full':
      return all;
    case 'random': {
      const n = all.length;
      if (n > 30) throw new Error('chooseFleet: shipyard too large for subset sampling');
      const [k] = nextInt(seedRng(seed), 2 ** n - 1);
      const mask = k + 1; // 1 … 2^n − 1: every non-empty subset equally likely
      return all.filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1);
    }
    case 'fixed': {
      const chosen = all.filter((id) => policy.ships.includes(id));
      return chosen.length > 0 ? chosen : all;
    }
  }
}
