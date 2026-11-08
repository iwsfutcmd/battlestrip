/**
 * npm run sim -- --players 2..8 --games 5000 --bots density --fleets full,random \
 *   --nuclear both --selfFire both --announce both --seed 1
 *
 * Plays all-bot games for every combination of the options and reports
 * pacing (§6.2). Prints a table; writes JSON and CSV to --out (sim-out/).
 * `--markdown` also prints the README pacing table. Every number is formatted
 * with Intl.NumberFormat in --locale (default en).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { BotKind } from '../src/bots/index.ts';
import type { PresetId } from '../src/engine/index.ts';
import { runConfig, type ConfigResult, type SimConfig, type SimOptions } from './sim-core.ts';

const { values } = parseArgs({
  options: {
    players: { type: 'string', default: '2..8' },
    games: { type: 'string', default: '1000' },
    bots: { type: 'string', default: 'density' },
    fleets: { type: 'string', default: 'full,random' },
    nuclear: { type: 'string', default: 'both' },
    selfFire: { type: 'string', default: 'on' },
    announce: { type: 'string', default: 'on' },
    seed: { type: 'string', default: '1' },
    preset: { type: 'string', default: 'classic' },
    rows: { type: 'string', default: '10' },
    cols: { type: 'string', default: '10' },
    locale: { type: 'string', default: 'en' },
    out: { type: 'string', default: 'sim-out' },
    markdown: { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  process.stderr.write(`simulate: ${message}\n`);
  process.exit(2);
}

/** "2..8", "2,4,6" or "5". */
function parseInts(spec: string, name: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(',')) {
    const range = /^(\d+)\.\.(\d+)$/u.exec(part.trim());
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let n = from; n <= to; n++) out.push(n);
    } else if (/^\d+$/u.test(part.trim())) {
      out.push(Number(part.trim()));
    } else {
      fail(`--${name}: cannot read "${part}"`);
    }
  }
  return out;
}

/** on | off | both (also true/false/yes/no). */
function parseSwitch(spec: string, name: string): boolean[] {
  switch (spec.trim().toLocaleLowerCase('en')) {
    case 'both':
      return [true, false];
    case 'on':
    case 'true':
    case 'yes':
      return [true];
    case 'off':
    case 'false':
    case 'no':
      return [false];
    default:
      return fail(`--${name}: expected on, off or both`);
  }
}

function parseList<T extends string>(spec: string, allowed: readonly T[], name: string): T[] {
  return spec.split(',').map((s) => {
    const v = s.trim() as T;
    return allowed.includes(v) ? v : fail(`--${name}: "${s}" is not one of ${allowed.join(', ')}`);
  });
}

const players = parseInts(values.players, 'players');
if (players.some((n) => n < 2)) fail('--players: at least 2');
const options: SimOptions = {
  games: parseInts(values.games, 'games')[0] ?? 1000,
  seed: parseInts(values.seed, 'seed')[0] ?? 1,
  preset: parseList<PresetId>(values.preset, ['classic', 'morskoyBoy'], 'preset')[0] ?? 'classic',
  rows: parseInts(values.rows, 'rows')[0] ?? 10,
  cols: parseInts(values.cols, 'cols')[0] ?? 10,
};
const bots = parseList<BotKind>(values.bots, ['density', 'random'], 'bots');
const fleets = parseList<'full' | 'random'>(values.fleets, ['full', 'random'], 'fleets');
const nuclear = parseSwitch(values.nuclear, 'nuclear');
const selfFire = parseSwitch(values.selfFire, 'selfFire');
const announce = parseSwitch(values.announce, 'announce');

const configs: SimConfig[] = [];
for (const p of players)
  for (const b of bots)
    for (const f of fleets)
      for (const n of nuclear)
        for (const sf of selfFire) for (const a of announce) configs.push({ players: p, bots: b, fleets: f, nuclear: n, selfFire: sf, announce: a });

// ---- Formatting -------------------------------------------------------------

const locale = values.locale;
const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
const width = (s: string): number => Array.from(segmenter.segment(s)).length;
const onOff = (b: boolean): string => (b ? 'on' : 'off');

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i] ?? ''))));
  const line = (cells: readonly string[]): string =>
    cells.map((c, i) => (i < 2 ? c + ' '.repeat((widths[i] ?? 0) - width(c)) : ' '.repeat((widths[i] ?? 0) - width(c)) + c)).join('  ');
  return [line(header), widths.map((w) => '─'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

const MAIN_HEADER = [
  'players',
  'config',
  'games',
  'turns mean',
  'median',
  'p95',
  'calls/player',
  'endgame mean',
  'p95',
  'fleetless',
  'bombs',
  'self-hit turns',
  'no last fleet',
];

function configLabel(c: SimConfig): string {
  return `${c.bots} · ${c.fleets} fleets · nuclear ${onOff(c.nuclear)} · selfFire ${onOff(c.selfFire)} · named ${onOff(c.announce)}`;
}

function mainRow(r: ConfigResult): string[] {
  return [
    int.format(r.config.players),
    configLabel(r.config),
    int.format(r.games),
    one.format(r.turns.mean),
    int.format(r.turns.median),
    int.format(r.turns.p95),
    one.format(r.callsPerPlayer.mean),
    one.format(r.endgame.mean),
    int.format(r.endgame.p95),
    pct.format(r.fleetlessShare),
    pct.format(r.bombShare),
    pct1.format(r.selfHitTurnShare),
    pct1.format(r.noLastFleetShare),
  ];
}

function markdown(results: readonly ConfigResult[]): string {
  const head =
    '| Players | Fleets | Bombs | Turns: mean · median · p95 | Calls per player | Endgame (≤2 afloat → end): mean · p95 | Game spent without a fleet | Self-hit turns | No last fleet |';
  const sep = '|---:|---|---|---|---:|---|---:|---:|---:|';
  const rows = results.map((r) =>
    [
      int.format(r.config.players),
      r.config.fleets,
      r.config.nuclear ? 'on' : 'off',
      `${one.format(r.turns.mean)} · ${int.format(r.turns.median)} · ${int.format(r.turns.p95)}`,
      one.format(r.callsPerPlayer.mean),
      `${one.format(r.endgame.mean)} · ${int.format(r.endgame.p95)}`,
      pct.format(r.fleetlessShare),
      pct1.format(r.selfHitTurnShare),
      pct1.format(r.noLastFleetShare),
    ].join(' | '),
  );
  return [head, sep, ...rows.map((r) => `| ${r} |`)].join('\n');
}

// ---- Run --------------------------------------------------------------------

const started = performance.now();
const results: ConfigResult[] = [];
configs.forEach((config, i) => {
  const t = performance.now();
  results.push(runConfig(config, options));
  if (!values.quiet) {
    process.stderr.write(
      `[${int.format(i + 1)}/${int.format(configs.length)}] ${int.format(config.players)} players · ${configLabel(config)}: ${one.format((performance.now() - t) / 1000)} s\n`,
    );
  }
});

console.log(table(MAIN_HEADER, results.map(mainRow)));

const random = results.filter((r) => r.config.fleets === 'random');
if (random.length > 0) {
  const sizes = [...new Set(random.flatMap((r) => Object.keys(r.byFleetSize).map(Number)))].sort((a, b) => a - b);
  console.log('\nRandom fleets, by fleet size (ships): share of the game spent without a fleet / last-fleet rate');
  console.log(
    table(
      ['players', 'config', ...sizes.map((s) => int.format(s))],
      random.map((r) => [
        int.format(r.config.players),
        configLabel(r.config),
        ...sizes.map((s) => {
          const e = r.byFleetSize[s];
          return e ? `${pct.format(e.fleetlessShare)} / ${pct.format(e.lastFleetRate)}` : '';
        }),
      ]),
    ),
  );
}

const maxPlayers = Math.max(...results.map((r) => r.config.players));
console.log('\nLast-fleet rate by position in turn order (1 = called first)');
console.log(
  table(
    ['players', 'config', ...Array.from({ length: maxPlayers }, (_, i) => int.format(i + 1))],
    results.map((r) => [
      int.format(r.config.players),
      configLabel(r.config),
      ...Array.from({ length: maxPlayers }, (_, i) => (i < r.lastFleetByPosition.length ? pct.format(r.lastFleetByPosition[i] ?? 0) : '')),
    ]),
  ),
);

if (values.markdown) console.log(`\n${markdown(results)}`);

await mkdir(values.out, { recursive: true });
const csvHeader = [
  'players', 'bots', 'fleets', 'nuclear', 'selfFire', 'announce', 'games',
  'turns_mean', 'turns_median', 'turns_p95', 'calls_per_player_mean', 'calls_per_player_median', 'calls_per_player_p95',
  'endgame_mean', 'endgame_median', 'endgame_p95', 'fleetless_share', 'bomb_share', 'self_hit_turn_share', 'no_last_fleet_share',
];
const csvRows = results.map((r) =>
  [
    r.config.players, r.config.bots, r.config.fleets, r.config.nuclear, r.config.selfFire, r.config.announce, r.games,
    r.turns.mean, r.turns.median, r.turns.p95, r.callsPerPlayer.mean, r.callsPerPlayer.median, r.callsPerPlayer.p95,
    r.endgame.mean, r.endgame.median, r.endgame.p95, r.fleetlessShare, r.bombShare, r.selfHitTurnShare, r.noLastFleetShare,
  ].join(','),
);
await writeFile(join(values.out, 'pacing.csv'), [csvHeader.join(','), ...csvRows].join('\n') + '\n');
await writeFile(join(values.out, 'pacing.json'), JSON.stringify({ options, results }, null, 2) + '\n');
process.stderr.write(
  `\nWrote ${join(values.out, 'pacing.json')} and pacing.csv in ${one.format((performance.now() - started) / 1000)} s.\n`,
);
