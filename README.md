# Battlestrip

N-player, simultaneous-fire Battleship for one shared screen. Every call lands on every board, including the caller's own. A player whose last ship sinks keeps playing as a bomber. The app places every fleet and resolves every call. Each player scans one QR code at the start, which shows a static picture of their own fleet on their phone. There's no server.

The full design is in [`docs/SPEC.md`](docs/SPEC.md); *Indra's Net* was its working title. This README tracks what's built.

## Status

| Milestone | State |
|---|---|
| **M0 Scaffold**: Vite, strict TS, Preact, Vitest, lint guardrails, i18n plumbing, hello-world routes | ✅ done, awaiting review |
| M1 Engine | not started |
| M2 The table | not started |
| M3 Bots and simulation | not started |
| M4 Vertical modes | not started |
| M5 Players place their own ships | designed, not started |

## Quick start

Requires Node ≥ 22.18.

```sh
npm install
npm run dev          # vite --host: also reachable from phones on the LAN
```

| Route | What it is (M0: a placeholder) |
|---|---|
| `/` | Control panel (the laptop). Picks the game language. |
| `/display/` | The shared screen (the TV). |
| `/fleet/` | The phone page. The QR will point here, with the fleet in the `#fragment`. |

Add `?lang=<tag>` to any route to override the browser's language, e.g. `/display/?lang=ar-u-nu-latn` or `/fleet/?lang=zh-TW`. The pseudolocales are listed in the language pickers in dev builds, or with `?pseudo`.

| Script | |
|---|---|
| `npm run check` | typecheck + lint + unit tests (what CI runs before e2e) |
| `npm run typecheck` | three projects: app (DOM), engine (ES2022 only, no DOM), node (tooling) |
| `npm run lint` | ESLint and Stylelint |
| `npm test` | Vitest (unit, property and guardrail tests) |
| `npm run e2e` | Playwright: builds, serves the build, and tests every route in every required locale |
| `npm run build` / `npm run preview` | the static site, in `dist/` |

## Layout

```
src/
  engine/   pure TS: no DOM, no i18n, no Math.random, no Date. M0: Result type and the seeded sfc32 PRNG.
  bots/     (M3)
  share/    (M2) fleet-image payload
  i18n/     negotiation, direction, writing modes, MF2 catalogs, pseudolocales, isolation helpers
  ui/
    common/   Msg (renders catalog messages with <bdi>), LanguagePicker, locale state, base CSS
    control/  the laptop
    display/  the TV
    phone/    the phone page
build/      Vite pseudolocale plugin, local ESLint plugin
e2e/        Playwright
test/       guardrail tests (the lint rules themselves are tested)
docs/       the spec
```

`index.html`, `display/index.html` and `fleet/index.html` are separate entry points, so the phone page is small and needs no host rewrites. The build uses relative URLs and works from any static host and sub-path.

## Internationalisation

Every screen is built in `en`, `ar`, `zh-Hant`, `en-XA` and `ar-XB` at once. Nothing is English-only and then translated.

- **Catalogs** are JSON files in `src/i18n/catalogs/`, one per locale. Each maps a key to an MF2 message, either as one string or as an array of lines for `.match` messages. `MessageKey` is the type of `en.json`'s keys, so a missing or misspelt key is a compile error.
- **Formatting** uses `messageformat` v4 (Unicode MessageFormat 2) with `bidiIsolation: 'default'`. Plain strings get FSI…PDI around placeholders. `<Msg>` turns the same isolates into `<bdi>`.
- **Catalog and formatting locale are separate.** `negotiateLocale` picks a catalog, but formatting keeps the user's region and `-u-` extensions. `zh-TW` reads `zh-Hant` and formats as `zh-Hant-TW`, and `ar-u-nu-latn` keeps Latin digits. Matching respects script: `[zh-CN, en]` gives English, while `[zh-CN]` alone gives `zh-Hant`. Pseudolocales match only by region (`en-XA`, `ar-XB`). No numbering system is hard-coded: `ar` gets whatever the browser's ICU says.
- **Direction** comes from `Intl.Locale#getTextInfo()`, or the older `textInfo` getter (Node 22 only has the getter). Otherwise it falls back to the maximised script against the full list of RTL scripts.
- **Pseudolocales** are generated from `en.json` at build time by `build/vite-plugin-pseudolocales.ts`. The plugin rewrites only the literal text in each MF2 pattern, leaving placeholders and selectors alone.
  - `en-XA` is accented, bracketed, and 35% longer.
  - `ar-XB` wraps each word in RLM RLO…PDF RLM, so English is drawn reversed in an RTL page.
- **Fonts**: the system UI stack, plus `:lang()` fallbacks naming Noto and platform fonts. Nothing is downloaded yet; whether to bundle Noto subsets is an M2 decision.
- **Translations:** `ar` and `zh-Hant` are drafts and need native review (`needsNativeReview` in `src/i18n/locales.ts`).

## Guardrails

Each one is enforced by a tool, and `test/guardrails/` checks that the tool really rejects the forbidden patterns.

| Rule (spec §8) | Enforced by |
|---|---|
| Engine is pure | `tsconfig.engine.json` (`lib: ES2022`, `types: []`); ESLint bans imports of `ui/`, `i18n/`, `bots/`, `share/` and any package, plus `Date`, `Intl`, DOM globals, `Math.random`, `Map`/`Set` and classes |
| Only handout, peek and `share/` see hidden fleets | ESLint `no-restricted-imports` on `fleetOf`, including namespace imports |
| No literal UI strings | `battlestrip/no-literal-ui-string`: JSX text, child expressions, and user-facing attributes (`title`, `alt`, `aria-label`, …) containing any `\p{L}` letter |
| Logical CSS only | `stylelint-use-logical`, plus `resize` values and `vw`/`vh` units; also a JSX `style={{…}}` check |
| No locale-less case mapping | ESLint bans `toUpperCase`, `toLowerCase`, and `toLocale*Case()` without arguments |
| No code-unit counting of text | `battlestrip/no-string-length` (type-aware: `.length` on anything string-typed) and a ban on `split('')` |
| No invisible bidi controls in source | a test scans the code for literal U+202A–E, U+2066–9, LRM, RLM and ALM ("Trojan Source"). Write them as `\u` escapes. |

### Review checklist (what lint can't see)

- User text is measured in graphemes (`Intl.Segmenter`), never by slicing or indexing strings.
- No sentence is assembled in code, and no possessive is built in code. Lists of names use `formatList` (`Intl.ListFormat`, with each item isolated).
- Player names are `<bdi>` in markup and FSI…PDI in plain strings: `aria-live`, `document.title`, speech, CLI.
- Codes and fleet checks are LTR isolates (`<bdi dir="ltr">`, `isolateLtr`).
- Arrow keys and shortcuts use `KeyboardEvent.code`, and the logical direction table in `ui/keyboard.ts` (M2).
- Nothing shared reacts to a hidden fleet: no warnings, no timing differences, no disabled cells.

## Decisions and deviations

- **TypeScript 6.0, not 7.** TS 7 is the current release, but `typescript-eslint` supports `<6.1`. Type-aware linting (including the `.length` rule) matters more here than the faster compiler.
- **Stylelint 17, not 18.** `stylelint-use-logical` supports `<18`.
- **`@playwright/test` is pinned to 1.63.0** to match the Chromium already installed in the dev container. CI installs the matching browser.
- **`eslint-plugin-i18next` was replaced by a local rule.** Its `no-literal-string` skips everything inside any variable whose name is all capitals, so `const X = () => <p>Hello</p>` passed. Its word filter also isn't Unicode-aware. The local rule is about 40 lines and is tested.
- **Small head start on M1:** `engine/result.ts` and `engine/rng.ts` (sfc32 as immutable, JSON-serialisable state, cross-checked against the reference closure) exist so that the engine project and its guardrails have something real to check.
- **zh-Hant spacing:** `text-autospace` is on for `zh`/`ja`, which spaces Latin and digits from Han where browsers support it. Chromium doesn't add space next to Arabic or Hebrew names (`輪到لينا投彈`). See open questions.

## Hidden information

The laptop's state holds every fleet. Anyone with devtools could peek. That's fine for a game among friends, and it's the price of having no server.

## Open questions for review

1. **The name in other languages.** Every catalog uses "Battlestrip" (Latin). Should `ar` and `zh-Hant` get localised titles? The spec offered 因陀羅網 for *Indra's Net*.
2. **zh-Hant spacing around names.** Leave it to `text-autospace`, or add explicit spaces around `{$name}` (which would also space Han names)?
