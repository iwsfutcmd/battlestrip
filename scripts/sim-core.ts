/**
 * The simulation (§6.2): many all-bot games per configuration, summarised for
 * pacing. Pure apart from the clock-free bookkeeping, so it is unit-tested.
 */
import { chooseFleet, playBotGame, type BotKind, type FleetPolicy } from '../src/bots/index.ts';
import { gameStats, presetRules, type PresetId, type Rules, type Seat, type PlayerId } from '../src/engine/index.ts';

export interface SimConfig {
  readonly players: number;
  readonly bots: BotKind;
  readonly fleets: 'full' | 'random';
  readonly nuclear: boolean;
  readonly selfFire: boolean;
  readonly announce: boolean;
}

export interface SimOptions {
  readonly games: number;
  readonly seed: number;
  readonly preset: PresetId;
  readonly rows: number;
  readonly cols: number;
}

export interface GameRecord {
  readonly turns: number;
  /** Turns from when at most two fleets were afloat until the end. */
  readonly endgame: number;
  readonly selfHitTurns: number;
  readonly noLastFleet: boolean;
  /** Seat index of the last fleet standing, and its position in turn order (0 = called first). */
  readonly winnerSeat: number | null;
  readonly winnerPosition: number | null;
  readonly players: readonly {
    readonly fleetSize: number;
    readonly singles: number;
    readonly bombs: number;
    /** Share of the game's turns after this player's fleet was gone. */
    readonly fleetlessShare: number;
    readonly won: boolean;
    readonly position: number;
  }[];
}

export interface Summary {
  readonly mean: number;
  readonly median: number;
  readonly p95: number;
}

export interface ConfigResult {
  readonly config: SimConfig;
  readonly games: number;
  readonly turns: Summary;
  readonly callsPerPlayer: Summary;
  readonly endgame: Summary;
  /** Mean over players of the share of the game spent without a fleet (nuclear, or knocked out). */
  readonly fleetlessShare: number;
  /** Share of all calls that were bombs. */
  readonly bombShare: number;
  /** Share of turns where the caller hit their own board. */
  readonly selfHitTurnShare: number;
  readonly noLastFleetShare: number;
  /** By fleet size (number of ships): players, mean fleetless share, last-fleet rate. */
  readonly byFleetSize: Readonly<Record<number, { readonly players: number; readonly fleetlessShare: number; readonly lastFleetRate: number }>>;
  /** Last-fleet rate by position in turn order (0 = called first). */
  readonly lastFleetByPosition: readonly number[];
}

/** A well-mixed 32-bit seed from several integers. */
export function mixSeed(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

export function rulesFor(config: SimConfig, options: SimOptions): Rules {
  return presetRules(options.preset, {
    rows: options.rows,
    cols: options.cols,
    nuclear: config.nuclear,
    selfFire: config.selfFire,
    announceShipOnHit: config.announce,
  });
}

export function playOne(config: SimConfig, rules: Rules, gameSeed: number): GameRecord {
  const policy: FleetPolicy = { kind: config.fleets };
  const seats: Seat[] = Array.from({ length: config.players }, (_, i) => ({
    id: `p${i}` as PlayerId,
    kind: 'bot',
    fleet: chooseFleet(policy, rules, mixSeed(gameSeed, i, 0xf1ee7)),
  }));
  const s = playBotGame({ rules, seats, seed: gameSeed, bots: seats.map(() => config.bots) });
  if (typeof s === 'string') throw new Error(`simulation setup failed: ${s} (${JSON.stringify(config)})`);
  const stats = gameStats(s);
  const n = seats.length;
  const winnerSeat = s.result?.kind === 'lastFleet' ? seats.findIndex((x) => s.result?.kind === 'lastFleet' && x.id === s.result.player) : null;
  const position = (seat: number): number => (seat - s.firstPlayer + n) % n;
  return {
    turns: stats.turns,
    endgame: stats.turns - (stats.endgameFromTurn ?? stats.turns),
    selfHitTurns: stats.selfHitTurns,
    noLastFleet: s.result?.kind !== 'lastFleet',
    winnerSeat,
    winnerPosition: winnerSeat === null ? null : position(winnerSeat),
    players: stats.players.map((p, i) => ({
      fleetSize: seats[i]?.fleet.length ?? 0,
      singles: p.singles,
      bombs: p.bombs,
      fleetlessShare: p.sunkOnTurn === null || stats.turns === 0 ? 0 : (stats.turns - p.sunkOnTurn) / stats.turns,
      won: winnerSeat === i,
      position: position(i),
    })),
  };
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) return { mean: 0, median: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? 0;
  return { mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, median: q(0.5), p95: q(0.95) };
}

export function aggregate(config: SimConfig, records: readonly GameRecord[]): ConfigResult {
  const allPlayers = records.flatMap((r) => r.players);
  const totalCalls = allPlayers.reduce((a, p) => a + p.singles + p.bombs, 0);
  const totalTurns = records.reduce((a, r) => a + r.turns, 0);
  const sizes: Record<number, { players: number; fleetless: number; wins: number }> = {};
  for (const p of allPlayers) {
    const e = (sizes[p.fleetSize] ??= { players: 0, fleetless: 0, wins: 0 });
    e.players++;
    e.fleetless += p.fleetlessShare;
    if (p.won) e.wins++;
  }
  const byPosition = Array.from({ length: config.players }, () => 0);
  for (const r of records) if (r.winnerPosition !== null) byPosition[r.winnerPosition] = (byPosition[r.winnerPosition] ?? 0) + 1;
  return {
    config,
    games: records.length,
    turns: summarize(records.map((r) => r.turns)),
    callsPerPlayer: summarize(records.map((r) => r.turns / config.players)),
    endgame: summarize(records.map((r) => r.endgame)),
    fleetlessShare: allPlayers.reduce((a, p) => a + p.fleetlessShare, 0) / Math.max(1, allPlayers.length),
    bombShare: allPlayers.reduce((a, p) => a + p.bombs, 0) / Math.max(1, totalCalls),
    selfHitTurnShare: records.reduce((a, r) => a + r.selfHitTurns, 0) / Math.max(1, totalTurns),
    noLastFleetShare: records.filter((r) => r.noLastFleet).length / Math.max(1, records.length),
    byFleetSize: Object.fromEntries(
      Object.entries(sizes).map(([size, e]) => [
        Number(size),
        { players: e.players, fleetlessShare: e.fleetless / e.players, lastFleetRate: e.wins / e.players },
      ]),
    ),
    lastFleetByPosition: byPosition.map((w) => w / Math.max(1, records.length)),
  };
}

/**
 * Game seeds depend on the player count, fleet policy, bot and game number,
 * but not on the rule switches. So "nuclear on" and "nuclear off" (or named
 * hits on and off) replay the same fleets and the same starting layouts: the
 * comparisons are paired.
 */
export function gameSeed(config: SimConfig, options: SimOptions, game: number): number {
  return mixSeed(options.seed, config.players, config.fleets === 'full' ? 1 : 2, config.bots === 'density' ? 1 : 2, game);
}

export function runConfig(config: SimConfig, options: SimOptions): ConfigResult {
  const rules = rulesFor(config, options);
  const records: GameRecord[] = [];
  for (let g = 0; g < options.games; g++) records.push(playOne(config, rules, gameSeed(config, options, g)));
  return aggregate(config, records);
}
