/**
 * npm run outfit-experiment -- --games 100 --players 4 --counts 1,2,3,5,8,12 --sizes small,medium,big --others everyday --seed 1
 *
 * One player wears `count` pieces of one size class (small 1–2 squares,
 * medium 3–5, big 6–9); everyone else wears the same ready-made outfit.
 * Prints what kind of game that player has, per cell, in Markdown, and
 * writes outfit-experiment.json and .md to --out (default sim-out/).
 */
import { MAX_PLAYERS } from '../src/engine/index.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BOT_KINDS, isBotKind } from '../src/bots/index.ts';
import { OUTFIT_IDS, type OutfitId } from '../src/engine/index.ts';
import { piecesOfSize, playFocusGame, SIZE_CLASSES, SIZE_RANGE, summarizeCell, type CellSummary, type ExperimentOptions, type SizeClass } from './outfit-experiment-core.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '100' },
    players: { type: 'string', default: '4' },
    counts: { type: 'string', default: '1,2,3,5,8,12' },
    sizes: { type: 'string', default: 'small,medium,big' },
    others: { type: 'string', default: 'everyday' },
    target: { type: 'string', default: '0.5' },
    seed: { type: 'string', default: '1' },
    bots: { type: 'string', default: 'density' },
    locale: { type: 'string', default: 'en' },
    out: { type: 'string', default: 'sim-out' },
    quiet: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  process.stderr.write(`outfit-experiment: ${message}\n`);
  process.exit(2);
}

const whole = (spec: string, name: string, min: number, max: number): number => {
  const n = Number(spec);
  if (!Number.isInteger(n) || n < min || n > max) fail(`--${name}: a whole number from ${min} to ${max}`);
  return n;
};
const sizes = values.sizes.split(',').map((s) => s.trim());
for (const s of sizes) if (!(SIZE_CLASSES as readonly string[]).includes(s)) fail(`--sizes: "${s}" is not one of ${SIZE_CLASSES.join(', ')}`);
if (!(OUTFIT_IDS as readonly string[]).includes(values.others)) fail(`--others: one of ${OUTFIT_IDS.join(', ')}`);
if (!isBotKind(values.bots)) fail(`--bots: one of ${BOT_KINDS.join(', ')}`);
const target = Number(values.target);
if (!(target > 0 && target < 1)) fail('--target: a share between 0 and 1, like 0.5');

const options: ExperimentOptions = {
  games: whole(values.games, 'games', 1, 100_000),
  seed: whole(values.seed, 'seed', 1, 2 ** 31),
  players: whole(values.players, 'players', 2, MAX_PLAYERS),
  counts: values.counts.split(',').map((c) => whole(c.trim(), 'counts', 1, 51)),
  sizes: sizes as SizeClass[],
  others: values.others as OutfitId,
  target,
  bots: values.bots,
};

const n1 = new Intl.NumberFormat(values.locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const n0 = new Intl.NumberFormat(values.locale, { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat(values.locale, { style: 'percent', maximumFractionDigits: 0 });
const x2 = (v: number): string => `${new Intl.NumberFormat(values.locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v)}×`;

const started = Date.now();
const cells: CellSummary[] = [];
for (const size of options.sizes) {
  const pool = piecesOfSize(size).length;
  for (const count of options.counts) {
    if (count > pool) {
      if (!values.quiet) process.stderr.write(`skipping ${size} × ${count}: only ${pool} ${size} pieces in the wardrobe\n`);
      continue;
    }
    const games = Array.from({ length: options.games }, (_, g) => playFocusGame(options, size, count, g));
    cells.push(summarizeCell(games, options.players));
    if (!values.quiet) process.stderr.write(`${size} × ${count}: done\n`);
  }
}
const seconds = (Date.now() - started) / 1000;

const sizeLabel = (s: SizeClass): string => `${s} (${SIZE_RANGE[s][0]}–${SIZE_RANGE[s][1]} squares each)`;
const header =
  '| Their clothes | Pieces | Squares | Board | Turns | First piece off | Their clothes off by halfway | Longest wait for the next piece | Naked from | Time spent naked | Last one dressed | …against a fair share | Out in a joint strip |\n' +
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
const rows = cells
  .map(
    (c) =>
      `| ${c.size} | ${n0.format(c.count)} | ${n1.format(c.squares)} | ${n0.format(c.board)} | ${n0.format(c.turns)} | ${pct.format(c.firstOff)} | ${pct.format(c.offByHalf)} | ${pct.format(c.longestWait)} | ${pct.format(c.nakedAt)} | ${pct.format(c.nakedShare)} | ${pct.format(c.lastDressed)} | ${x2(c.lastDressedMultiplier)} | ${pct.format(c.jointStrip)} |`,
  )
  .join('\n');

function grid(title: string, f: (c: CellSummary) => string): string {
  const counts = [...new Set(cells.map((c) => c.count))].sort((a, b) => a - b);
  return (
    `#### ${title}\n\n| | ${counts.map((k) => `${k} piece${k === 1 ? '' : 's'}`).join(' | ')} |\n|---|${counts.map(() => '---:').join('|')}|\n` +
    options.sizes
      .map((s) => `| ${s} | ${counts.map((k) => { const c = cells.find((x) => x.size === s && x.count === k); return c ? f(c) : '–'; }).join(' | ')} |`)
      .join('\n') +
    '\n'
  );
}

const report = [
  `## One player’s outfit: ${n0.format(options.games)} games per cell (seed ${values.seed}, ${n1.format(seconds)} s)\n`,
  `${options.players}-player tables. The focus player wears the given number of pieces drawn at random from one size class: ${options.sizes.map(sizeLabel).join(', ')}. ` +
    `Everyone else wears the ready-made "${options.others}" outfit. The board is sized to all the outfits for a ${pct.format(options.target)} first-shot hit chance, and the game plays on until everyone is naked. ` +
    `${options.bots === 'finisher' ? 'FinisherBot' : options.bots === 'random' ? 'RandomBot' : 'DensityBot'} in every seat. Times are shares of the way through the game.\n`,
  header + rows + '\n',
  grid('Time spent naked', (c) => pct.format(c.nakedShare)),
  grid('Last one dressed, against a fair share (1.00× is fair)', (c) => x2(c.lastDressedMultiplier)),
  grid('First piece off (how far through the game)', (c) => pct.format(c.firstOff)),
  grid('Longest wait for their next piece to come off', (c) => pct.format(c.longestWait)),
].join('\n');

process.stdout.write(report);
await mkdir(values.out, { recursive: true });
const stem = options.bots === 'density' ? 'outfit-experiment' : `outfit-experiment-${options.bots}`;
await writeFile(join(values.out, `${stem}.json`), JSON.stringify({ options, seconds, cells }, null, 1));
await writeFile(join(values.out, `${stem}.md`), report);
if (!values.quiet) process.stderr.write(`wrote ${join(values.out, `${stem}.json`)} and ${stem}.md\n`);
