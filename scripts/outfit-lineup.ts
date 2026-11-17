/**
 * npm run outfit-lineup -- --games 100 --players 4 --others everyday --seed 1
 *
 * Plays every test outfit (scripts/test-outfits.ts) as one player at a table
 * where everyone else wears the same ready-made outfit, and reports what kind
 * of game that player has. Writes outfit-lineup.json (outfits, pieces and
 * results) and outfit-lineup.md to --out (default sim-out/).
 */
import { MAX_PLAYERS } from '../src/engine/index.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BOT_KINDS, isBotKind } from '../src/bots/index.ts';
import { fleetSquares, OUTFIT_IDS, wardrobeRules, type OutfitId } from '../src/engine/index.ts';
import { playFocusFleet, summarizeCell } from './outfit-experiment-core.ts';
import { TEST_OUTFITS } from './test-outfits.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '100' },
    players: { type: 'string', default: '4' },
    others: { type: 'string', default: 'everyday' },
    target: { type: 'string', default: '0.5' },
    bots: { type: 'string', default: 'density' },
    seed: { type: 'string', default: '1' },
    locale: { type: 'string', default: 'en' },
    out: { type: 'string', default: 'sim-out' },
    quiet: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  process.stderr.write(`outfit-lineup: ${message}\n`);
  process.exit(2);
}
const whole = (spec: string, name: string, min: number, max: number): number => {
  const n = Number(spec);
  if (!Number.isInteger(n) || n < min || n > max) fail(`--${name}: a whole number from ${min} to ${max}`);
  return n;
};
if (!(OUTFIT_IDS as readonly string[]).includes(values.others)) fail(`--others: one of ${OUTFIT_IDS.join(', ')}`);
if (!isBotKind(values.bots)) fail(`--bots: one of ${BOT_KINDS.join(', ')}`);
const target = Number(values.target);
if (!(target > 0 && target < 1)) fail('--target: a share between 0 and 1, like 0.5');
const options = {
  games: whole(values.games, 'games', 1, 100_000),
  seed: whole(values.seed, 'seed', 1, 2 ** 31),
  players: whole(values.players, 'players', 2, MAX_PLAYERS),
  others: values.others as OutfitId,
  target,
  bots: values.bots,
};

const rules = wardrobeRules();
const started = Date.now();
const results = TEST_OUTFITS.map((outfit, k) => {
  const games = Array.from({ length: options.games }, (_, g) => playFocusFleet(options, outfit.pieces, 50_000 + k, g));
  const summary = summarizeCell(games, options.players);
  if (!values.quiet) process.stderr.write(`${outfit.id}: done\n`);
  return { ...outfit, squares: fleetSquares(rules, outfit.pieces), summary };
});
const seconds = (Date.now() - started) / 1000;

const pct = new Intl.NumberFormat(values.locale, { style: 'percent', maximumFractionDigits: 0 });
const n0 = new Intl.NumberFormat(values.locale, { maximumFractionDigits: 0 });
const x2 = (v: number): string => `${new Intl.NumberFormat(values.locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v)}×`;
const label = (r: (typeof results)[number]): string => (r.variant === 'underwearKeptOut' ? `${r.name}, underwear kept out` : r.name);
const report =
  `## Test outfits: ${n0.format(options.games)} games each (seed ${values.seed}, ${new Intl.NumberFormat(values.locale, { maximumFractionDigits: 1 }).format(seconds)} s)\n\n` +
  `Each outfit is worn by one player at a ${options.players}-player table where everyone else wears "${options.others}". The board is sized to all the outfits for a ${pct.format(options.target)} first-shot hit chance, and play goes on until everyone is naked. Times are shares of the way through the game.\n\n` +
  '| Outfit | Pieces | Squares | First piece off | Their clothes off by halfway | Naked from | Time spent naked | Last one dressed, against a fair share |\n|---|---:|---:|---:|---:|---:|---:|---:|\n' +
  results
    .map((r) => `| ${label(r)} | ${r.pieces.length} | ${r.squares} | ${pct.format(r.summary.firstOff)} | ${pct.format(r.summary.offByHalf)} | ${pct.format(r.summary.nakedAt)} | ${pct.format(r.summary.nakedShare)} | ${x2(r.summary.lastDressedMultiplier)} |`)
    .join('\n') +
  '\n';

process.stdout.write(report);
await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'outfit-lineup.json'), JSON.stringify({ options, seconds, results }, null, 1));
await writeFile(join(values.out, 'outfit-lineup.md'), report);
if (!values.quiet) process.stderr.write(`wrote ${join(values.out, 'outfit-lineup.json')} and outfit-lineup.md\n`);
