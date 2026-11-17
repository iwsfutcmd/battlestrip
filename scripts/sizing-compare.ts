/**
 * npm run sizing-compare -- --games 400 --players 2..8 --dress realistic,mixed,random --sizings hit:0.5,length:60,length:80,length:100
 *
 * The same tables (same seeds) under different ways of sizing the board,
 * judged on two failure modes:
 * - downtime: how long games run, how long players spend naked, and the
 *   longest stretch a dressed player goes without being hit;
 * - the most-dressed player winning: how often whoever wears the most squares
 *   at the table is the last one dressed, against a fair share.
 * Prints Markdown and writes sizing-compare.md and .json to --out.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DRESS, playBalanceGame, spread, type BalanceOptions, type Dress, type GameRecord } from './balance-core.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '400' },
    players: { type: 'string', default: '2..8' },
    dress: { type: 'string', default: 'realistic,mixed,random' },
    sizings: { type: 'string', default: 'hit:0.5,length:60,length:80,length:100' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string', default: 'sim-out' },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  process.stderr.write(`sizing-compare: ${message}\n`);
  process.exit(2);
}
const players: number[] = [];
for (const part of values.players.split(',')) {
  const m = /^(\d+)\.\.(\d+)$/u.exec(part.trim());
  if (m) for (let n = Number(m[1]); n <= Number(m[2]); n++) players.push(n);
  else players.push(Number(part));
}
if (players.some((n) => !Number.isInteger(n) || n < 2 || n > 8)) fail('--players: 2 to 8');
const dress = values.dress.split(',').map((d) => d.trim()) as Dress[];
for (const d of dress) if (!DRESS.includes(d)) fail(`--dress: one of ${DRESS.join(', ')}`);
const sizings = values.sizings.split(',').map((spec) => {
  const [kind, num] = spec.split(':');
  const value = Number(num);
  if (!((kind === 'hit' && value > 0 && value < 1) || (kind === 'length' && value >= 10))) fail(`--sizings: "${spec}" should be hit:<share> or length:<calls>`);
  return { label: kind === 'hit' ? `first shot hits ${Math.round(value * 100)}%` : `about ${value} calls`, kind, value };
});
const games = Number(values.games);
const seed = Number(values.seed);

interface Row {
  readonly label: string;
  readonly board: number;
  readonly turns: ReturnType<typeof spread>;
  readonly turnsByPlayers: Record<number, number>;
  readonly nakedTurns: number;
  readonly nakedShare: number;
  readonly longestQuiet: number;
  readonly longestQuietP90: number;
  readonly mostDressed: number;
  readonly leastDressed: number;
  readonly together: number;
  /** By number of players: of games where one player wears the most squares, the share in which they're the last one dressed. */
  readonly mostWinsByPlayers: Record<number, number>;
}

function judge(label: string, records: readonly GameRecord[]): Row {
  const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const seats = records.flatMap((g) => g.seats.map((s) => ({ g, s })));
  const quiet = seats.map(({ s }) => s.longestQuiet).sort((a, b) => a - b);
  // Most and least dressed at tables where outfits differ, leaving out joint strips (nobody is last dressed).
  const rank = (which: 'most' | 'least'): number => {
    let won = 0;
    let fair = 0;
    for (const g of records) {
      if (g.allStrippedTogether) continue;
      const sq = g.seats.map((s) => s.squares);
      const top = Math.max(...sq);
      const bottom = Math.min(...sq);
      if (top === bottom) continue;
      for (const s of g.seats) {
        if (s.squares !== (which === 'most' ? top : bottom)) continue;
        won += s.lastDressed ? 1 : 0;
        fair += 1 / g.players;
      }
    }
    return fair === 0 ? NaN : won / fair;
  };
  const mostWins: Record<number, number> = {};
  for (const n of players) {
    let games = 0;
    let won = 0;
    for (const g of records) {
      if (g.players !== n) continue;
      const sq = g.seats.map((s) => s.squares);
      const top = Math.max(...sq);
      if (sq.filter((q) => q === top).length !== 1) continue;
      games += 1;
      won += g.seats.some((s) => s.squares === top && s.lastDressed) ? 1 : 0;
    }
    mostWins[n] = games === 0 ? NaN : won / games;
  }
  const byPlayers: Record<number, number> = {};
  for (const n of players) byPlayers[n] = mean(records.filter((g) => g.players === n).map((g) => g.turns));
  return {
    label,
    board: mean(records.map((g) => g.rows * g.cols)),
    turns: spread(records.map((g) => g.turns)),
    turnsByPlayers: byPlayers,
    nakedTurns: mean(seats.map(({ s }) => s.nakedTurns)),
    nakedShare: mean(seats.map(({ s }) => s.nakedShare)),
    longestQuiet: mean(quiet),
    longestQuietP90: quiet[Math.floor(0.9 * quiet.length)] ?? NaN,
    mostDressed: rank('most'),
    leastDressed: rank('least'),
    together: mean(records.map((g) => (g.allStrippedTogether ? 1 : 0))),
    mostWinsByPlayers: mostWins,
  };
}

const started = Date.now();
const rows = sizings.map((z) => {
  const options: BalanceOptions = { games, seed, players, dress, maxPieces: 12, ...(z.kind === 'hit' ? { target: z.value } : { length: z.value }) };
  const records = Array.from({ length: games }, (_, g) => playBalanceGame(options, g));
  process.stderr.write(`${z.label}: done\n`);
  return judge(z.label, records);
});
const seconds = (Date.now() - started) / 1000;

const f0 = (v: number): string => (Number.isNaN(v) ? '–' : Math.round(v).toString());
const f1 = (v: number): string => (Number.isNaN(v) ? '–' : v.toFixed(1));
const pc = (v: number): string => (Number.isNaN(v) ? '–' : `${Math.round(v * 100)}%`);
const x2 = (v: number): string => (Number.isNaN(v) ? '–' : `${v.toFixed(2)}×`);
const report = [
  `## Board sizing compared: ${games} games each (seed ${seed}, ${seconds.toFixed(0)} s)\n`,
  `The same tables under each sizing: ${players[0]}–${players[players.length - 1]} players, dressed ${dress.join(' / ')}. DensityBot, play on until everyone is naked. "Calls" are every player's turns together.\n`,
  '| Board sized for | Board squares (mean) | Calls: mean · median · p95 | Time spent naked: turns (share) | Longest wait without a hit: mean · p90 turns | Most dressed at the table is last dressed | Least dressed | Joint strip |',
  '|---|---:|---|---|---|---:|---:|---:|',
  ...rows.map((r) => `| ${r.label} | ${f0(r.board)} | ${f1(r.turns.mean)} · ${f0(r.turns.median)} · ${f0(r.turns.p95)} | ${f1(r.nakedTurns)} (${pc(r.nakedShare)}) | ${f1(r.longestQuiet)} · ${f0(r.longestQuietP90)} | ${x2(r.mostDressed)} | ${x2(r.leastDressed)} | ${pc(r.together)} |`),
  '',
  '### Mean calls by number of players\n',
  `| Board sized for | ${players.map((n) => `${n}p`).join(' | ')} |`,
  `|---|${players.map(() => '---:').join('|')}|`,
  ...rows.map((r) => `| ${r.label} | ${players.map((n) => f0(r.turnsByPlayers[n] ?? NaN)).join(' | ')} |`),
  '',
  '### How often the most-dressed player is the last one dressed\n',
  'Of games where one player wears the most squares (joint strips count as nobody). A fair share is 1 in the number of players.\n',
  `| Board sized for | ${players.map((n) => `${n}p (fair ${Math.round(100 / n)}%)`).join(' | ')} |`,
  `|---|${players.map(() => '---:').join('|')}|`,
  ...rows.map((r) => `| ${r.label} | ${players.map((n) => pc(r.mostWinsByPlayers[n] ?? NaN)).join(' | ')} |`),
  '',
].join('\n');
process.stdout.write(report);
await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'sizing-compare.md'), report);
await writeFile(join(values.out, 'sizing-compare.json'), JSON.stringify({ games, seed, players, dress, sizings, seconds, rows }, null, 1));
