import type { GameState, PlayerId, ShipId } from './types.ts';

export interface PlayerStats {
  readonly player: PlayerId;
  /** Calls made while afloat / while nuclear. */
  readonly singles: number;
  readonly bombs: number;
  /** Hits this player's calls landed on other players' boards. */
  readonly hitsDealt: number;
  /** Hits this player's calls landed on their own board. */
  readonly selfHits: number;
  /** Other players' ships this player's calls sank, and how many of those were by bomb. */
  readonly shipsSunk: number;
  readonly shipsSunkByBombs: number;
  /** Most hits (on all boards) from one of this player's bombs. */
  readonly bestBomb: number;
  readonly sunkOnTurn: number | null;
}

export type AwardKind = 'friendlyFire' | 'biggestBomb' | 'longestSurvivor' | 'firstNuclear' | 'bombSinker' | 'sharpshooter';

/** An award someone actually earned. `count` is the measure (hits, turns, ships, or the turn number). */
export interface Award {
  readonly kind: AwardKind;
  readonly winners: readonly { readonly player: PlayerId; readonly ship?: ShipId }[];
  readonly count: number;
}

export interface GameStats {
  readonly turns: number;
  readonly players: readonly PlayerStats[];
  /** Turns on which the caller hit their own board. */
  readonly selfHitTurns: number;
  /** The turn after which at most two fleets were afloat (0 if the game began that way). */
  readonly endgameFromTurn: number | null;
  readonly awards: readonly Award[];
}

function topBy<T>(items: readonly T[], score: (t: T) => number): { winners: T[]; count: number } {
  let best = 0;
  let winners: T[] = [];
  for (const item of items) {
    const v = score(item);
    if (v > best) {
      best = v;
      winners = [item];
    } else if (v === best && v > 0) {
      winners.push(item);
    }
  }
  return { winners, count: best };
}

/** Per-player numbers and the awards for the game-over screen. Only awards someone earned are listed. */
export function gameStats(s: GameState): GameStats {
  const ids = s.seats.map((seat) => seat.id);
  const acc = ids.map((player) => ({
    player,
    singles: 0,
    bombs: 0,
    hitsDealt: 0,
    selfHits: 0,
    shipsSunk: 0,
    shipsSunkByBombs: 0,
    bestBomb: 0,
    sunkOnTurn: null as number | null,
  }));
  const at = (p: PlayerId): (typeof acc)[number] | undefined => acc[ids.indexOf(p)];

  const callers: Record<number, { by: PlayerId; shape: 'single' | 'bomb' }> = {};
  const hitsThisTurn: Record<number, number> = {};
  const selfHitTurn: Record<number, true> = {};
  const sunkShips: { player: PlayerId; ship: ShipId; turn: number }[] = [];
  let firstNuclear: { player: PlayerId; turn: number } | null = null;
  let afloat = ids.length;
  let endgameFromTurn: number | null = afloat <= 2 ? 0 : null;

  for (const e of s.events) {
    switch (e.kind) {
      case 'shotCalled': {
        callers[e.turn] = { by: e.by, shape: e.shape };
        const a = at(e.by);
        if (a) a[e.shape === 'bomb' ? 'bombs' : 'singles']++;
        break;
      }
      case 'shotResolved': {
        if (e.outcome !== 'hit') break;
        const call = callers[e.turn];
        const a = call ? at(call.by) : undefined;
        if (!call || !a) break;
        hitsThisTurn[e.turn] = (hitsThisTurn[e.turn] ?? 0) + 1;
        if (e.board === call.by) {
          a.selfHits++;
          selfHitTurn[e.turn] = true;
        } else {
          a.hitsDealt++;
        }
        break;
      }
      case 'shipSunk': {
        sunkShips.push({ player: e.board, ship: e.ship, turn: e.turn });
        const call = callers[e.turn];
        const a = call ? at(call.by) : undefined;
        if (call && a && e.board !== call.by) {
          a.shipsSunk++;
          if (call.shape === 'bomb') a.shipsSunkByBombs++;
        }
        break;
      }
      case 'wentNuclear':
      case 'knockedOut': {
        const a = at(e.player);
        if (a) a.sunkOnTurn = e.turn;
        firstNuclear ??= { player: e.player, turn: e.turn };
        afloat--;
        if (afloat <= 2) endgameFromTurn ??= e.turn;
        break;
      }
      case 'gameOver':
      case 'lastFleetStanding':
        break;
    }
  }
  for (const [turn, call] of Object.entries(callers)) {
    if (call.shape !== 'bomb') continue;
    const a = at(call.by);
    const n = hitsThisTurn[Number(turn)] ?? 0;
    if (a && n > a.bestBomb) a.bestBomb = n;
  }

  const awards: Award[] = [];
  const add = (kind: AwardKind, pick: { winners: { player: PlayerId; ship?: ShipId }[]; count: number }): void => {
    if (pick.count > 0 && pick.winners.length > 0) awards.push({ kind, winners: pick.winners, count: pick.count });
  };
  const players = (score: (a: (typeof acc)[number]) => number) => {
    const t = topBy(acc, score);
    return { winners: t.winners.map((a) => ({ player: a.player })), count: t.count };
  };
  add('friendlyFire', players((a) => a.selfHits));
  add('biggestBomb', players((a) => a.bestBomb));
  add('bombSinker', players((a) => a.shipsSunkByBombs));
  add('sharpshooter', players((a) => a.hitsDealt));
  if (firstNuclear && s.rules.nuclear) add('firstNuclear', { winners: [{ player: firstNuclear.player }], count: firstNuclear.turn });
  const survivor = topBy(sunkShips, (x) => x.turn);
  add('longestSurvivor', { winners: survivor.winners.map(({ player, ship }) => ({ player, ship })), count: survivor.count });

  return {
    turns: s.turn,
    players: acc,
    selfHitTurns: Object.keys(selfHitTurn).length,
    endgameFromTurn,
    awards,
  };
}
