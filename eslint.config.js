// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import battlestrip from './build/eslint-plugin-battlestrip.js';

/*
 * Guardrails (§8). Flat config replaces, not merges, a rule's options when
 * several blocks configure it, so the restriction lists are built from shared
 * pieces and every block that sets a `no-restricted-*` rule includes them all.
 */

/** User text is never case-mapped without a locale (§8). */
const caseMappingProperties = [
  { property: 'toUpperCase', message: 'Use toLocaleUpperCase(locale). Never case-map user text without a locale.' },
  { property: 'toLowerCase', message: 'Use toLocaleLowerCase(locale). Never case-map user text without a locale.' },
];
const textSyntax = [
  {
    selector: "CallExpression[callee.property.name=/^toLocale(Upper|Lower)Case$/][arguments.length=0]",
    message: 'Pass the locale explicitly.',
  },
  {
    selector: "CallExpression[callee.property.name='split'][arguments.length=1][arguments.0.value='']",
    message: "split('') breaks surrogate pairs and grapheme clusters; use Intl.Segmenter.",
  },
];
/** Inline styles must use logical properties too (stylelint covers .css files). */
const physicalStyleSyntax = [
  {
    selector:
      "JSXAttribute[name.name='style'] Property > Identifier.key[name=/^((margin|padding|border|inset)(Left|Right|Top|Bottom)|left|right|top|bottom|width|height|(min|max)(Width|Height))$/]",
    message: 'Use logical properties (marginInlineStart, insetBlockEnd, inlineSize, …).',
  },
  {
    selector: "JSXAttribute[name.name='style'] Property[key.name=/^(textAlign|float|clear)$/][value.value=/^(left|right)$/]",
    message: 'Use start/end (or inline-start/inline-end), not left/right.',
  },
];

/** Who may see a hidden fleet (§4.4, §8). */
const FLEET_ALLOWED = ['src/ui/control/handout/**', 'src/ui/control/peek/**', 'src/share/**', 'src/engine/**'];
const fleetOfPattern = {
  regex: '(^|/)engine(/|$)',
  importNames: ['fleetOf'],
  message:
    'fleetOf reveals a hidden fleet. Only the private handout and peek screens and share/ may call it (§4.4). Shared screens use viewFor(s, "spectator").',
};

/** The engine is pure (§4.1, §8). */
const enginePatterns = [
  {
    regex: '(^|/)(ui|i18n|bots|share)(/|$)',
    message: 'The engine must not import ui/, i18n/, bots/ or share/.',
  },
  {
    regex: '^(?!\\.\\.?/)',
    message: 'The engine has no dependencies: relative imports within src/engine only.',
  },
];

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'test-results/', 'playwright-report/', 'blob-report/', 'test/guardrails/fixtures/']),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.config.ts', 'build/**', 'scripts/**', 'e2e/**', 'test/**'],
    languageOptions: { globals: globals.node },
  },

  // ---- All app code -------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { battlestrip },
    languageOptions: { globals: globals.browser },
    rules: {
      'battlestrip/no-string-length': 'error',
      'no-restricted-properties': ['error', ...caseMappingProperties],
      'no-restricted-syntax': ['error', ...textSyntax, ...physicalStyleSyntax],
      'no-restricted-imports': ['error', { patterns: [fleetOfPattern] }],
    },
  },
  {
    files: FLEET_ALLOWED,
    ignores: ['src/engine/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ---- UI strings ---------------------------------------------------------
  {
    files: ['src/ui/**/*.tsx'],
    plugins: { battlestrip },
    rules: { 'battlestrip/no-literal-ui-string': 'error' },
  },

  // ---- The engine ---------------------------------------------------------
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: enginePatterns }],
      'no-restricted-globals': [
        'error',
        ...['Date', 'Intl', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'performance', 'crypto', 'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'process'].map(
          (name) => ({ name, message: `The engine is pure: no ${name} (§4.1).` }),
        ),
      ],
      'no-restricted-properties': [
        'error',
        ...caseMappingProperties,
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG in the game state (engine/rng.ts).' },
        { object: 'Date', message: 'The engine never reads the clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        ...textSyntax,
        {
          selector: "NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet|Date)$/]",
          message: 'Engine state is plain objects and arrays only (JSON-serialisable).',
        },
        { selector: 'ClassDeclaration, ClassExpression', message: 'Engine state is plain objects and arrays only.' },
      ],
    },
  },

  // ---- Bots (§6.1) --------------------------------------------------------
  // Bots see only viewFor(…) and legalCalls: the engine's public index, never
  // its internals, never fleetOf, and nothing from the UI.
  {
    files: ['src/bots/**/*.ts'],
    ignores: ['src/bots/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            fleetOfPattern,
            {
              regex: '(^|/)engine/(?!index\\.ts$)',
              message: 'Bots may import only the engine’s public surface (engine/index.ts), not its internals.',
            },
            { regex: '(^|/)(ui|i18n|share)(/|$)', message: 'Bots must not import ui/, i18n/ or share/.' },
            { regex: '^(?!\\.\\.?/)', message: 'Bots have no dependencies beyond the engine.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        ...caseMappingProperties,
        { object: 'Math', property: 'random', message: 'Bots are deterministic: use the seed they are given.' },
      ],
    },
  },
);
