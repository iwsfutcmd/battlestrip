import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import battlestrip from '../../build/eslint-plugin-battlestrip.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The real config, minus type information, so snippets can be linted in
 * memory at paths that do not exist. Every §8 guardrail except the
 * type-aware `.length` rule is syntactic, so this tests them as configured.
 */
let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: root, overrideConfig: tseslint.configs.disableTypeChecked });
});

async function rulesFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  const fatal = messages.find((m) => m.fatal);
  if (fatal) throw new Error(`Parse error in snippet: ${fatal.message}`);
  return messages.map((m) => m.ruleId ?? 'unknown');
}

describe('engine purity (§4.1, §8)', () => {
  it.each([
    ['imports from ui/', "import { a } from '../ui/foo.ts'; export const x = a;", 'no-restricted-imports'],
    ['imports from i18n/', "import { a } from '../i18n/index.ts'; export const x = a;", 'no-restricted-imports'],
    ['imports from bots/', "import { a } from '../bots/density.ts'; export const x = a;", 'no-restricted-imports'],
    ['imports from share/', "import { a } from '../share/payload.ts'; export const x = a;", 'no-restricted-imports'],
    ['imports a package', "import { signal } from '@preact/signals'; export const s = signal(1);", 'no-restricted-imports'],
    ['uses Math.random', 'export const r = Math.random();', 'no-restricted-properties'],
    ['reads the clock', 'export const t = Date.now();', 'no-restricted-properties'],
    ['constructs a Date', 'export const t = new Date();', 'no-restricted-globals'],
    ['uses Intl', "export const l = new Intl.Locale('en');", 'no-restricted-globals'],
    ['touches the DOM', 'export const d = document.title;', 'no-restricted-globals'],
    ['builds a Map', 'export const m = new Map<string, number>();', 'no-restricted-syntax'],
    ['declares a class', 'export class Board {}', 'no-restricted-syntax'],
  ])('rejects an engine module that %s', async (_label, code, rule) => {
    expect(await rulesFor('src/engine/probe.ts', code)).toContain(rule);
  });

  it('accepts relative imports inside the engine', async () => {
    expect(await rulesFor('src/engine/probe.ts', "import { seedRng } from './rng.ts'; export const s = seedRng(1);")).toEqual([]);
  });
});

describe('hidden fleets (§4.4, §8)', () => {
  const importFleetOf = (depth: number): string =>
    `import { fleetOf } from '${'../'.repeat(depth)}engine/index.ts'; export const f = fleetOf;`;

  it.each([
    ['src/ui/display/probe.tsx', 2],
    ['src/ui/control/lobby/probe.tsx', 3],
    ['src/ui/speech/probe.ts', 2],
    ['src/bots/probe.ts', 1],
  ])('forbids fleetOf in %s', async (path, depth) => {
    expect(await rulesFor(path, importFleetOf(depth))).toContain('no-restricted-imports');
  });

  it('also forbids a namespace import of the engine outside the allowlist', async () => {
    expect(
      await rulesFor('src/ui/display/probe.tsx', "import * as engine from '../../engine/index.ts'; export const e = engine;"),
    ).toContain('no-restricted-imports');
  });

  it.each([
    ['src/ui/control/handout/probe.tsx', 3],
    ['src/ui/control/peek/probe.tsx', 3],
    ['src/share/probe.ts', 1],
  ])('allows fleetOf in %s', async (path, depth) => {
    expect(await rulesFor(path, importFleetOf(depth))).toEqual([]);
  });
});

describe('UI strings (§8)', () => {
  const file = 'src/ui/display/probe.tsx';
  it.each([
    ['JSX text', 'export const X = () => <p>Hello</p>;'],
    ['JSX text in any script', 'export const X = () => <p>مرحبا 你好</p>;'],
    ['a literal in a child expression', "export const X = (b: boolean) => <p>{b ? 'Yes' : 'No'}</p>;"],
    ['a template literal child', 'export const X = (n: number) => <p>{`${n} hits`}</p>;'],
    ['an aria-label', 'export const X = () => <button aria-label="Close" />;'],
    ['a title', 'export const X = () => <abbr title="Bomb">☢</abbr>;'],
  ])('rejects %s', async (_label, code) => {
    expect(await rulesFor(file, code)).toContain('battlestrip/no-literal-ui-string');
  });

  it('allows punctuation, digits, symbols and non-text attributes', async () => {
    expect(
      await rulesFor(file, 'export const X = (n: string) => <p class="tv-seat" dir="ltr" lang="ar">{n} · 3 ☢ —</p>;'),
    ).toEqual([]);
  });
});

describe('user text handling (§8)', () => {
  const file = 'src/ui/common/probe.ts';
  it.each([
    ['toUpperCase()', 'export const f = (s: string) => s.toUpperCase();', 'no-restricted-properties'],
    ['toLowerCase()', 'export const f = (s: string) => s.toLowerCase();', 'no-restricted-properties'],
    ['toLocaleUpperCase() without a locale', 'export const f = (s: string) => s.toLocaleUpperCase();', 'no-restricted-syntax'],
    ["split('')", "export const f = (s: string) => s.split('');", 'no-restricted-syntax'],
  ])('rejects %s', async (_label, code, rule) => {
    expect(await rulesFor(file, code)).toContain(rule);
  });

  it('allows toLocaleUpperCase(locale)', async () => {
    expect(await rulesFor(file, "export const f = (s: string) => s.toLocaleUpperCase('tr');")).toEqual([]);
  });

  it('rejects physical properties in inline styles', async () => {
    const rules = await rulesFor(
      'src/ui/display/probe.tsx',
      "export const X = () => <div style={{ marginLeft: 1, width: 2, textAlign: 'right' }} />;",
    );
    expect(rules.filter((r) => r === 'no-restricted-syntax')).toHaveLength(3);
  });
});

describe('battlestrip/no-string-length (type-aware)', () => {
  it('reports .length on strings, and only on strings', async () => {
    const cwd = fileURLToPath(new URL('./fixtures/', import.meta.url));
    const linter = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { project: './tsconfig.json', tsconfigRootDir: cwd },
          },
          plugins: { battlestrip },
          rules: { 'battlestrip/no-string-length': 'error' },
        },
      ],
    });
    const file = `${cwd}src/lengths.ts`;
    const [result] = await linter.lintFiles([file]);
    const source = await readFile(file, 'utf8');
    const expected = source
      .split('\n')
      .flatMap((line, i) => (line.includes('// expect-error') ? [i + 1] : []));
    expect(result?.messages.map((m) => m.line)).toEqual(expected);
  });
});

describe('logical CSS only (§7.3, §8)', () => {
  it.each([
    ['margin-left', '.a { margin-left: 1px; }'],
    ['width', '.a { inline-size: 1px; width: 2px; }'],
    ['height', '.a { height: 2px; }'],
    ['left (inset)', '.a { left: 0; }'],
    ['padding-right', '.a { padding-right: 1em; }'],
    ['border-top', '.a { border-top: 1px solid; }'],
    ['text-align: left', '.a { text-align: left; }'],
    ['float: right', '.a { float: right; }'],
    ['resize: horizontal', '.a { resize: horizontal; }'],
    ['vw units', '.a { inline-size: 50vw; }'],
  ])('rejects %s', async (_label, code) => {
    const { results } = await stylelint.lint({ code, codeFilename: `${root}src/ui/probe.css`, cwd: root });
    expect(results[0]?.warnings.length).toBeGreaterThan(0);
  });

  it('accepts logical properties', async () => {
    const code = '.a {\n  margin-inline-start: 1px;\n  inline-size: 50vi;\n  text-align: start;\n  inset-block-end: 0;\n}\n';
    const { results } = await stylelint.lint({ code, codeFilename: `${root}src/ui/probe.css`, cwd: root });
    expect(results[0]?.warnings).toEqual([]);
  });
});

describe('bots see only the engine’s public surface (§6.1)', () => {
  const file = 'src/bots/probe.ts';
  it.each([
    ['engine internals (game.ts)', "import { resolveCells } from '../engine/game.ts'; export const r = resolveCells;"],
    ['engine internals (placement.ts)', "import { randomLayout } from '../engine/placement.ts'; export const r = randomLayout;"],
    ['fleetOf from the public index', "import { fleetOf } from '../engine/index.ts'; export const f = fleetOf;"],
    ['the whole engine as a namespace (it contains fleetOf)', "import * as engine from '../engine/index.ts'; export const e = engine;"],
    ['ui/', "import { translator } from '../ui/common/locale-state.ts'; export const t = translator;"],
    ['i18n/', "import { isolate } from '../i18n/isolate.ts'; export const i = isolate;"],
    ['share/', "import { encode } from '../share/payload.ts'; export const e = encode;"],
    ['a package', "import fc from 'fast-check'; export const f = fc;"],
  ])('rejects importing %s', async (_label, code) => {
    expect(await rulesFor(file, code)).toContain('no-restricted-imports');
  });

  it('rejects Math.random', async () => {
    expect(await rulesFor(file, 'export const r = Math.random();')).toContain('no-restricted-properties');
  });

  it('accepts named imports from the engine’s public index', async () => {
    expect(
      await rulesFor(file, "import { viewFor, legalCalls } from '../engine/index.ts'; export const v = [viewFor, legalCalls];"),
    ).toEqual([]);
  });
});
