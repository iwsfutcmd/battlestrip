/**
 * npm run balance -- --games 500 --players 2..8 --dress matched,mixed,random --maxPieces 12 --seed 1
 *
 * Plays all-bot games of the game as it is now (wardrobe outfits, the board
 * sized to the outfits, play on after one player is left dressed), each with
 * its own randomly drawn table, and prints balance tables in Markdown. Writes
 * every game to --out (default sim-out/) as balance.json, and one row per
 * player to balance-players.csv. Numbers go through Intl.NumberFormat in --locale.
 */
import { MAX_PLAYERS } from '../src/engine/index.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  DRESS,
  fairness,
  groupRow,
  playBalanceGame,
  RATIO_BUCKETS,
  ratioBucket,
  type BalanceOptions,
  type Dress,
  type GameRecord,
  type GroupRow,
  type Spread,
} from './balance-core.ts';
import { BOT_KINDS, isBotKind } from '../src/bots/index.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '500' },
    players: { type: 'string', default: '2..8' },
    dress: { type: 'string', default: 'matched,mixed,random' },
    // also: realistic (the realistic test outfits, scripts/test-outfits.ts)
    maxPieces: { type: 'string', default: '12' },
    seed: { type: 'string', default: '1' },
    target: { type: 'string', default: '0.5' },
    bots: { type: 'string', default: 'density' },
    locale: { type: 'string', default: 'en' },
    out: { type: 'string', default: 'sim-out' },
    quiet: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  process.stderr.write(`balance: ${message}\n`);
  process.exit(2);
}

function parseInts(spec: string, name: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(',')) {
    const range = /^(\d+)\.\.(\d+)$/u.exec(part.trim());
    if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) out.push(n);
    else if (/^\d+$/u.test(part.trim())) out.push(Number(part.trim()));
    else fail(`--${name}: cannot read "${part}"`);
  }
  return out;
}

const positive = (spec: string, name: string): number => {
  const n = Number(spec);
  if (!Number.isInteger(n) || n < 1) fail(`--${name}: expected a whole number of at least 1`);
  return n;
};

const players = parseInts(values.players, 'players');
if (players.some((n) => n < 2 || n > MAX_PLAYERS)) fail(`--players: 2 to ${MAX_PLAYERS}`);
const dress = values.dress.split(',').map((d) => d.trim());
for (const d of dress) if (!(DRESS as readonly string[]).includes(d)) fail(`--dress: "${d}" is not one of ${DRESS.join(', ')}`);

const options: BalanceOptions = {
  games: positive(values.games, 'games'),
  seed: positive(values.seed, 'seed'),
  players,
  dress: dress as Dress[],
  maxPieces: positive(values.maxPieces, 'maxPieces'),
  target: Number(values.target),
  bots: isBotKind(values.bots) ? values.bots : fail(`--bots: one of ${BOT_KINDS.join(', ')}`),
};
if (!(options.target !== undefined && options.target > 0 && options.target < 1)) fail('--target: a share between 0 and 1, like 0.5');

const nf = (digits: number) => new Intl.NumberFormat(values.locale, { maximumFractionDigits: digits, minimumFractionDigits: digits });
const n0 = nf(0);
const n1 = nf(1);
const pct = new Intl.NumberFormat(values.locale, { style: 'percent', maximumFractionDigits: 0 });
const x2 = (v: number): string => (Number.isNaN(v) ? '–' : `${nf(2).format(v)}×`);
const sp = (s: Spread): string => (Number.isNaN(s.mean) ? '–' : `${n1.format(s.mean)} · ${n0.format(s.median)} · ${n0.format(s.p95)}`);
const p = (v: number): string => (Number.isNaN(v) ? '–' : pct.format(v));

const games: GameRecord[] = [];
const started = Date.now();
for (let g = 0; g < options.games; g++) {
  games.push(playBalanceGame(options, g));
  if (!values.quiet && (g + 1) % 50 === 0) process.stderr.write(`${n0.format(g + 1)}/${n0.format(options.games)} games\n`);
}
const seconds = (Date.now() - started) / 1000;

function groupTable(title: string, rows: readonly GroupRow[]): string {
  const head =
    `### ${title}\n\n` +
    '| | Games | Board squares: mean · median · p95 | Squares covered | Turns: mean · median · p95 | Calls each | First piece off | Pieces off by ¼ · ½ · ¾ of the game | First naked | Time spent naked | Last one dressed holds out (turns): mean · median · p95 | Everyone stripped on one call | Self-hit turns |\n' +
    '|---|---:|---|---:|---|---:|---:|---|---:|---:|---|---:|---:|\n';
  return (
    head +
    rows
      .map(
        (r) =>
          `| ${r.key} | ${n0.format(r.games)} | ${sp(r.boardSquares)} | ${p(r.coveredShare)} | ${sp(r.turns)} | ${n1.format(r.callsPerPlayer)} | ${p(r.firstPieceOff)} | ${r.piecesOffBy.map(p).join(' · ')} | ${p(r.firstNakedShare)} | ${p(r.nakedShare)} | ${sp(r.holdOut)} | ${p(r.allStrippedTogether)} | ${p(r.selfHitTurnShare)} |`,
      )
      .join('\n') +
    '\n'
  );
}

const byPlayers = [...new Set(games.map((g) => g.players))]
  .sort((a, b) => a - b)
  .map((n) => groupRow(String(n), games.filter((g) => g.players === n)));
const byDress = DRESS.filter((d) => options.dress.includes(d)).map((d) => groupRow(d, games.filter((g) => g.dress === d)));

const unequal = games.filter((g) => g.dress !== 'matched');
const bySquares = fairness(unequal, (pl) => ratioBucket(pl.squaresRatio), RATIO_BUCKETS);
const rankKeys = ['most clothes at the table', 'in between', 'least clothes at the table'];
const byRank = fairness(
  unequal,
  (pl, g) => {
    const max = Math.max(...g.seats.map((s) => s.squares));
    const min = Math.min(...g.seats.map((s) => s.squares));
    if (max === min) return null;
    return pl.squares === max ? rankKeys[0] ?? null : pl.squares === min ? rankKeys[2] ?? null : rankKeys[1] ?? null;
  },
  rankKeys,
);
const matched = games.filter((g) => g.dress === 'matched');
const positions = [...new Set(matched.flatMap((g) => g.seats.map((s) => s.position)))].sort((a, b) => a - b).map(String);
const byPosition = fairness(matched, (pl) => String(pl.position), positions);

const fairTable = (title: string, label: string, rows: ReturnType<typeof fairness>): string =>
  `### ${title}\n\n| ${label} | Players | Last one dressed, against a fair share | Time spent naked |\n|---|---:|---:|---:|\n` +
  rows.map((r) => `| ${r.key} | ${n0.format(r.players)} | ${x2(r.lastDressedMultiplier)} | ${p(r.nakedShare)} |`).join('\n') +
  '\n';

const all = groupRow('all', games);
const report = [
  `## Balance: ${n0.format(games.length)} games (seed ${values.seed}, ${n1.format(seconds)} s)\n`,
  `${options.bots === 'finisher' ? 'FinisherBot' : options.bots === 'random' ? 'RandomBot' : 'DensityBot'} in every seat. Wardrobe outfits, the board sized to the outfits for a ${pct.format(options.target ?? 0.5)} first-shot hit chance, clothes may touch, play on after one player is left dressed. ` +
    `Each game draws its own table: ${options.players.length > 1 ? `${options.players[0]}–${options.players[options.players.length - 1]}` : options.players[0]} players, dressed ${options.dress.join(' / ')} ` +
    `(matched: everyone in the same ready-made outfit; mixed: a ready-made outfit each; random: 1–${options.maxPieces} pieces each from the whole wardrobe).\n`,
  groupTable('Overall', [all]),
  groupTable('By number of players', byPlayers),
  groupTable('By how the table dressed', byDress),
  fairTable('Wearing more or less than the rest of the table (mixed and random tables)', 'Squares worn, over the table mean', bySquares),
  fairTable('Most and least dressed at the table (mixed and random tables)', 'At the table', byRank),
  fairTable('Turn order (matched tables)', 'Position (0 calls first)', byPosition),
  '"First piece off" and "First naked" are shares of the way through the game. "Pieces off by ¼ · ½ · ¾" is the share of all the clothes at the table that are off a quarter, half and three-quarters of the way through. ' +
    'A multiplier of 1.00× is fair: that group is the last one dressed exactly as often as its share of seats. "Squares covered" is the share of the board under at least one piece, so the chance a truly random first shot hits someone; the board is sized to make that about 50%.\n',
].join('\n');

process.stdout.write(report);

await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'balance.json'), JSON.stringify({ options, seconds, games }, null, 1));
const csv = [
  'game,dress,players,rows,cols,turns,pieces,squares,squaresRatio,position,nakedOnTurn,nakedShare,lastDressed,selfHits',
  ...games.flatMap((g) =>
    g.seats.map((s) =>
      [g.game, g.dress, g.players, g.rows, g.cols, g.turns, s.pieces, s.squares, s.squaresRatio.toFixed(3), s.position, s.nakedOnTurn ?? '', s.nakedShare.toFixed(3), s.lastDressed ? 1 : 0, s.selfHits].join(','),
    ),
  ),
].join('\n');
await writeFile(join(values.out, 'balance-players.csv'), csv + '\n');
await writeFile(join(values.out, 'balance.md'), report);
if (!values.quiet) process.stderr.write(`wrote ${join(values.out, 'balance.json')}, balance-players.csv and balance.md\n`);
