# Battlestrip

N-player, simultaneous-fire Battleship for one shared screen. Every call lands on every board, including the caller's own. A player whose last ship sinks keeps playing as a bomber. The app places every fleet and resolves every call. Each player scans one QR code at the start, which shows a static picture of their own fleet on their phone. There's no server.

The full design is in [`docs/SPEC.md`](docs/SPEC.md); *Indra's Net* was its working title. This README tracks what's built.

## Status

| Milestone | State |
|---|---|
| **M0 Scaffold**: Vite, strict TS, Preact, Vitest, lint guardrails, i18n plumbing, hello-world routes | ✅ done |
| **M1 Engine**: rules, uniform placement, nuclear bombs, views, stats, replay, undo | ✅ done |
| **M2 The table**: TV, control panel, lobby, QR handout, phone fleet image, peek, speech, autosave, two-window sync | ✅ done |
| **M3 Bots and simulation**: RandomBot, DensityBot, `npm run sim`, pacing table | ✅ done |
| **M4 Vertical modes**: `vertical-rl` for zh-Hant/ja tables on the TV and every phone image | ✅ done |
| **M5 Players place their own ships**: placement page, fleet codes, typed or webcam entry | ✅ done (no WASM QR fallback; see below) |

## Quick start

Requires Node ≥ 22.18.

```sh
npm install
npm run dev          # vite --host: also reachable from phones on the LAN
```

| Route | What it is |
|---|---|
| `/` | The control panel (the laptop): lobby, fleet handout, call entry, undo, private peek. In one-window mode it also shows the table. |
| `/display/` | The shared screen (the TV), in its own window. It mirrors the control window over `BroadcastChannel`. |
| `/fleet/#…` | The phone page. Each player's QR code points here, with their fleet packed into the `#fragment`. |
| `/place/#…` | M5: the phone placement page. The TV's QR code points here, with the game parameters in the fragment. |

Add `?lang=<tag>` to any route to override the browser's language, e.g. `/display/?lang=ar-u-nu-latn` or `/fleet/?lang=zh-TW`. The pseudolocales are listed in the language pickers in dev builds, or with `?pseudo`.

| Script | |
|---|---|
| `npm run check` | typecheck + lint + unit tests (what CI runs before e2e) |
| `npm run typecheck` | three projects: app (DOM), engine (ES2022 only, no DOM), node (tooling) |
| `npm run lint` | ESLint and Stylelint |
| `npm test` | Vitest (unit, property and guardrail tests) |
| `npm run e2e` | Playwright: builds, serves the build, and tests every route in every required locale |
| `npm run build` / `npm run preview` | the static site, in `dist/` |

## Playing

1. Open `/` on the laptop. Choose the game language, the players (each in any script; human or bot) and each player's fleet.
2. Press **Deal the fleets**. For each human in seat order, the laptop shows a privacy screen, then a QR code. The player scans it with their phone's ordinary camera, checks that the three-character fleet check matches, and presses **Got it** (or **Reroll**).
3. **Open the TV window** and drag it to the TV. Two-window mode keeps the QR code off the TV; the TV window only ever receives the public table. In one-window mode, the table and the docked controls share the laptop's screen. Don't mirror the laptop to the TV during the handout.
4. Each caller says a square out loud. The operator types it (`D4`, `4d`, `Ｄ７`, `د٤`, `甲7`, …) or picks it on the grid and presses Enter. The TV shows the call, pauses for a beat, then reveals every result at once and reads it aloud where a voice exists. Ctrl/Cmd+Z, on the physical Z key, takes back the last call.
5. **Show a fleet privately** covers players without a phone and lost images. It can also show the QR code again.

The game autosaves to `localStorage` after every action, and a reload offers to resume.

## Layout

```
src/
  engine/   pure TS: no DOM, no i18n, no Math.random, no Date
  bots/     RandomBot, DensityBot (see only viewFor + legalCalls)
  share/    fleet-image payload (QR), game code, fleet check
  i18n/     negotiation, direction, writing modes, MF2 catalogs, pseudolocales, isolation helpers
  ui/
    common/   Msg (catalog messages with <bdi>), LanguagePicker, HoldToReveal, player glyphs, locale state
    table/    the shared screen: Grid, SharedBoard, Roster, LastCall, GameOver, FleetBoard, channel
    control/  the laptop: store (state + actions + autosave + bot driver), Lobby, PlayPanel
      handout/  the private QR handout   (may build fleet images)
      peek/     the private peek          (may build fleet images)
    display/  the TV window
    phone/    the phone page and its PNG export
    speech/   voice choice and spoken callouts
build/      Vite pseudolocale plugin, local ESLint plugin
e2e/        Playwright
test/       guardrail tests (the lint rules themselves are tested)
docs/       the spec
```

`index.html`, `display/index.html` and `fleet/index.html` are separate entry points, so the phone page is small and needs no host rewrites. The build uses relative URLs and works from any static host and sub-path.

## Engine

`src/engine/` is pure and deterministic. Everything in and out is plain JSON. The seeded sfc32 PRNG state lives inside `GameState`, so the same seed and the same actions always give an identical state and event log.

| Function | |
|---|---|
| `newGame(rules, seats, seed)` | validates, then places every fleet at random; phase `setup` |
| `reduce(state, action)` | `reroll` / `place` (setup), `start`, `call` → `{ state, events }` or a violation code |
| `legalCalls(state, player)` | squares (or bomb corners) the current player may call |
| `viewFor(state, viewer)` | the public projection; a player also gets their own fleet. What the TV, laptop and bots see. |
| `fleetOf(state, player)` | a hidden layout: only the handout and peek screens and `share/` (lint-enforced) |
| `gameStats(state)` | per-player numbers and the earned awards |
| `replay(rules, seats, seed, actions)`, `undoLastCall(state)` | undo replays the log without the last call |

- **Placement** is uniform over all legal layouts. Each ship's placement is drawn independently, and the *whole* layout is rejected on any overlap (or touch). The test compares the empirical occupancy of every cell with an exact enumeration on 5×5 boards, and shows that a naive one-ship-at-a-time placer fails the same test. Classic fleets take about 0.07 ms. Морской бой on 10×10 takes about 13 ms. An impossible setup returns `noLegalLayout` after a million attempts, in about 2 s.
- **Bombs:** a nuclear player's call is a 2×2 bomb. The called square is the first corner (D4 covers D4, D5, E4, E5). Squares already called on every target board are skipped.
- **Additions to the spec's API:**
  - a `place` action (a player's own layout: needed for M5, and used by tests)
  - a `knockedOut` event: with `nuclear: false` (simulation only), a sunk player is out and loses their turns, which is the classic rule the simulation compares against
  - violations `badRules`, `tooFewPlayers`, `duplicatePlayer`, `badLayout`, `nothingToUndo`
- **Tests:**
  - the §2.4 examples, verbatim
  - property tests (fast-check) for every M1 property in the spec: termination, identical shot sets, nuclear timing and no skipped turns, bomb order, sinking, no leaks in the spectator view, determinism/replay/undo, and `legalCalls` ⇔ `reduce`
- **Reading of the spec's end-of-game example:** its first sentence puts both last squares on G7, which contradicts the sentence after it. The test reads it as "Bo's last square is G7".

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

## The table (M2)

- **One shared grid.** Each called square shows a miss mark, or the glyph of everyone hit there, plus a sunk marker. The latest call is outlined. For bombs, the squares that were already called are hatched as no-ops. Which ship was hit appears in the last-call card and the roster, not in the cells.
- **The beat.** The TV shows the call, waits (1.5 s by default, none under `prefers-reduced-motion`), then reveals every result at once. Results go to an `aria-live="polite"` region, and going nuclear goes to an `assertive` one.
- **The roster.** Each player's glyph (one of 8 Okabe–Ito colours plus one of 8 SVG shapes, so identity never rests on colour alone), name, and chosen fleet as numbered pictograms with one segment per square. Nuclear players get a badge and a striped row, not a grey one.
- **The game-over screen** celebrates: the last fleet standing (or "everyone went nuclear"), the earned awards, and every fleet revealed.
- **Labels.** Coordinate labels (`src/i18n/labels.ts`) implement the CSS Counter Styles `alphabetic` and `fixed` algorithms for 13 systems. The heh in the Arabic systems is always written هـ. If a fixed system is too short for the board, the rows switch to the next system that fits (天干 → 地支), or to numerals for the whole axis; systems are never mixed. An optional second system is drawn smaller beside the first.
- **Typed calls** (`src/i18n/parse.ts`) are read with NFKC normalisation and accept any `\p{Nd}` digit, as well as hanidec digits. They can be row-first or column-first. Arabic keyboard variants are smoothed over (أ/ا, tatweel, ي/ی, ك/ک). Latin letters typed under Cyrillic or Greek are read as their homoglyphs. A property test checks that `parse(format(c))` round-trips for every system, several digit scripts and every board size.
- **The phone page** reads everything from the URL fragment, so there's no network after load and no storage.
  - The board uses the game's labels, direction and writing mode, so it matches the TV. The legend is in the phone's own language, and there's a picker.
  - It's hidden until you press and hold, unless you tick "always show". A text alternative lists each ship's squares while it's shown.
  - **Save image** draws a PNG with Canvas 2D. Each text run gets its own `ctx.direction`, and labels stay upright in vertical modes. The phone shares it where the share sheet allows, and downloads it otherwise.
- **The QR payload** (`src/share/payload.ts`) is version-tagged packed bytes in base64url. Classic fleets come to about 100 characters of URL. A long name is cut at a grapheme boundary at 160 UTF-8 bytes, which keeps the worst case (24 emoji ZWJ sequences, 10 ships, 20×20) under 400 characters. `decode(encode(x))` is property-tested.
- **QR library:** [`uqr`](https://github.com/unjs/uqr) (unjs, zero dependencies, TypeScript). It returns a boolean matrix, which `Qr.tsx` draws as SVG.
- **Speech:** `speechSynthesis`, with the voice chosen by BCP 47 lookup on matching language *and script*. A `zh-Hant` table never gets a Simplified voice, and no table ever gets a voice for another language. With no matching voice, it stays silent and says so once. Spoken text has its own messages (`spoken.*`).
- **Keyboard:** the control grid follows the ARIA grid pattern with a roving tabindex. Arrows move visually: `src/ui/keyboard.ts` holds one table for ltr/rtl × the three writing modes, and all six combinations are tested. Undo is bound to `KeyboardEvent.code === 'KeyZ'`.
- **The TV window** offers a fullscreen toggle and takes a Screen Wake Lock where the browser allows it.
- **End-to-end tests** (`e2e/game.spec.ts`):
  - The spec's exit test: four phones each scan exactly once, a TV window syncs, the game is played to game over, and no QR code or fleet ever reaches the TV.
  - Bots, undo, autosave, and the private peek.
  - An Arabic table: mirrored grid, abjad labels on the TV and the phones, and an English phone with Arabic labels.
  - A Chinese table: 天干 labels, and typing `甲７`.

## Vertical writing modes (M4)

- **Who gets it.** A `zh-Hant` or `ja` table can switch the board orientation to vertical in the lobby. Mongolian script defaults to `vertical-lr` (`writingModesFor` in `src/i18n/direction.ts`), but there's no `mn-Mong` catalog yet. The choice travels in the QR payload, so the TV and every phone image switch together.
- **The TV goes fully vertical.** Its root takes the writing mode; because every layout rule is logical, the grid simply transposes:
  - In `vertical-rl`, cell (0,0) is top-right, columns run down, and rows (甲 乙 丙 …) run right to left. The bar, board and side panel stack right to left like the columns of a page.
  - Labels are upright.
  - Column numbers, ship numbers and roster numbers use `text-combine-upright: all`; boards never exceed 20, so that's at most two digits.
  - The big coordinate in the last-call card is upright.
- **The laptop controls stay horizontal.** The spec allows this. The embedded table follows the game's mode, and arrow keys still move visually (`src/ui/keyboard.ts`).
- **The phone image** draws its board in the game's mode, while the rest of the page follows the phone's language. The PNG export lays cells out per mode and draws each label upright in its cell.
- **Sizing gotcha:** Chromium resolves logical viewport and container units (`vi`, `vb`, `cqi`, `cqb`) against the *element's own* writing mode. So:
  - the vertical TV is pinned with `position: fixed; inset: 0`
  - the phone board is sized by its container's physical width (`cqw`), the one physical unit in the CSS, with a comment saying why
- **Screenshots** (`e2e/screenshots.spec.ts`) cover the TV at setup, mid-game and game over, and the phone, in `en`, `ar`, `ar-XB`, `en-XA`, `zh-Hant` and vertical `zh-Hant`, plus an Arabic phone showing a Latin-labelled game. They go to `test-results/screenshots/` for review, and each asserts there's no overflow. They aren't pixel baselines, because fonts differ between machines.

## Players place their own ships (M5)

Choose **Ship placement → Players place their own on their phones** in the lobby. After **Deal the fleets**, the TV shows a single QR code. It's public, carrying only the game parameters, the seat names and the public fleets (`src/share/invite.ts`).

1. **On the phone** (`/place/`, in the phone's own language, with the game's labels, direction and writing mode):
   - Pick your name.
   - Place your ships: pick a ship and tap its starting square, rotate the selected ship, or press Random (the engine's uniform placer).
   - Overlap and touching are checked with the engine's own `occupancy` rules.
2. **The fleet code.** The phone shows it as a QR code and as text, grouped 4-4-4-1 in an LTR isolate (`src/share/fleet-code.ts`).
   - It's mixed radix, low digits first: a 10-bit game check, the seat, the fleet subset, and each ship's index into `placementsFor(rules, length)`. The digits are obfuscated with a keystream keyed by the game code, then written in Crockford Base32 with Crockford's mod-37 check symbol.
   - Classic fleets need 12 characters. Morskoy boy fleets on 10×10 need 20, since a code is as long as the largest fleet the shipyard allows.
3. **Back on the laptop**, the code is typed or shown to the webcam.
   - Decoding applies NFKC, accepts any `\p{Nd}` digit, ignores case, hyphens and spaces, and maps I/L → 1 and O → 0.
   - A typo, a code from another game, or a code that doesn't match the player's lobby fleet is rejected with a localised message.
   - Property tests show that every single substitution and every adjacent transposition is caught: 37 is prime and larger than 32.
4. **The phone then links to the same static fleet image as M2.** Its fleet check matches the laptop's private peek: both sides compute checks for phone-placed layouts as version 0.

**Not done:** webcam scanning uses `BarcodeDetector`, which Chromium supports on macOS, ChromeOS and Android but not on Windows or Linux desktops. The spec's WASM decoder fallback would need another dependency. Typing the code always works.

## Hidden information

The laptop's state holds every fleet. Anyone with devtools could peek. That's fine for a game among friends, and it's the price of having no server.

## Open questions for review

1. **The name in other languages.** Every catalog uses "Battlestrip" (Latin). I kept the default; localised titles are a one-line catalog change.
2. **zh-Hant spacing around names.** This is left to `text-autospace`, which Chromium doesn't apply next to Arabic or Hebrew names.
3. **Translations.** The `ar` and `zh-Hant` catalogs are quick drafts. The Arabic avoids gendered verbs next to player names, using masdar constructions such as «غرق: …» and «تم إغراق …».
4. **Two-player games** usually end with no last fleet: see the M3 findings below.

## Bots and simulation (M3)

### Bots

`src/bots/` is pure and deterministic. Bots get `viewFor(state, botId)` (public information plus their own fleet) and the legal calls, nothing else. ESLint restricts `src/bots/` to the engine's public `index.ts`: no engine internals, no `fleetOf`, no `ui/`/`i18n/`/`share/`, no packages, no `Math.random`. `test/guardrails/lint.test.ts` proves it.

```ts
chooseCall(kind: 'density' | 'random', view, legal, seed): Coord   // same inputs → same call
chooseFleet({ kind: 'full' } | { kind: 'random' } | { kind: 'fixed', ships }, rules, seed): ShipId[]
playBotGame({ rules, seats, seed, bots }): GameState                // a whole all-bot game
```

- **RandomBot:** uniform over legal calls. While afloat it avoids its own unhit ship squares, unless nothing else is legal.
- **DensityBot** (the default), per §6.1:
  - For each target board, it counts every placement of each unsunk ship that fits the public information. A placement must cover *all* of that ship's named hits, and may not cover a miss or another ship's hit (nor touch one, when ships may not touch).
  - Each ship is normalised on its own, giving an expected number of hits per square.
  - A single call scores Σ (expected hits on others) − 1 if the square is one of its own unhit ship squares.
  - A bomb scores the expected hits over its four squares.
  - Ties are broken by the seed.
  - With hit-only reporting (`announceShipOnHit: false`), placements covering unattributed hits are weighted ×30 per hit.
  - Speed: about 10 ms for a whole 8-player game.

### Simulation

```sh
npm run sim -- --players 2..8 --games 5000 --bots density --fleets full,random --nuclear both --selfFire both --announce both --seed 1
```

- **Options:** `--players` takes `2..8`, `2,4,6` or `5`. Every other list option takes a comma list. The switches take `on`, `off` or `both`. Also `--preset classic|morskoyBoy`, `--rows`, `--cols`, `--locale` (all numbers go through `Intl.NumberFormat`), `--out` (default `sim-out/`), and `--markdown`.
- **Output:** a table, a breakdown by fleet size, and last-fleet rate by turn-order position. It writes `pacing.json` and `pacing.csv`.
- **Seeding:** game seeds depend on the player count, fleet policy, bot and game number, but not on the rule switches. Bombs on/off, self-fire on/off and named hits on/off therefore replay the *same* fleets and starting layouts, so the comparisons are paired.
- **Definitions:**
  - *Endgame*: turns from the moment at most two fleets are afloat until the end.
  - *Game spent without a fleet*: the mean over players of the share of the game's turns after their last ship sank, spent nuclear (or knocked out, without bombs).
  - *Self-hit turns*: turns on which the caller hit their own board.

### Pacing table

DensityBot in every seat, classic shipyard, 10×10, self-fire on, named hits on, **2,000 games per row** (`--players 2..8 --games 2000 --fleets full,random --nuclear both --seed 1`, about 4 minutes). "Random" fleets are uniform over non-empty subsets of the five classic ships.

| Players | Fleets | Bombs | Turns: mean · median · p95 | Calls per player | Endgame (≤2 afloat → end): mean · p95 | Game spent without a fleet | Self-hit turns | No last fleet |
|---:|---|---|---|---:|---|---:|---:|---:|
| 2 | full | on | 85.6 · 89 · 100 | 42.8 | 85.6 · 100 | 0% | 3.4% | 87.6% |
| 2 | full | off | 85.6 · 89 · 100 | 42.8 | 85.6 · 100 | 0% | 3.4% | 87.6% |
| 2 | random | on | 53.0 · 46 · 97 | 26.5 | 53.0 · 97 | 0% | 1.6% | 39.3% |
| 2 | random | off | 53.0 · 46 · 97 | 26.5 | 53.0 · 97 | 0% | 1.6% | 39.3% |
| 3 | full | on | 56.9 · 57 · 67 | 19.0 | 5.5 · 14 | 3% | 1.0% | 8.7% |
| 3 | full | off | 66.6 · 63 · 96 | 22.2 | 15.2 · 48 | 7% | 1.4% | 23.3% |
| 3 | random | on | 37.0 · 37 · 53 | 12.3 | 8.3 · 20 | 8% | 0.2% | 3.9% |
| 3 | random | off | 50.5 · 47 · 93 | 16.8 | 21.9 · 68 | 13% | 0.9% | 18.6% |
| 4 | full | on | 59.7 · 60 · 69 | 14.9 | 3.7 · 9 | 5% | 0.4% | 5.3% |
| 4 | full | off | 69.5 · 67 · 94 | 17.4 | 11.1 · 37 | 10% | 0.8% | 17.3% |
| 4 | random | on | 39.5 · 40 · 53 | 9.9 | 5.3 · 13 | 13% | 0.1% | 3.9% |
| 4 | random | off | 54.5 · 52 · 93 | 13.6 | 16.3 · 56 | 19% | 0.6% | 15.5% |
| 5 | full | on | 63.6 · 64 · 72 | 12.7 | 2.7 · 7 | 6% | 0.3% | 5.7% |
| 5 | full | off | 73.4 · 72 · 95 | 14.7 | 8.7 · 30 | 12% | 0.6% | 15.9% |
| 5 | random | on | 42.0 · 42 · 55 | 8.4 | 3.9 · 10 | 15% | 0.1% | 3.9% |
| 5 | random | off | 57.9 · 56 · 89 | 11.6 | 13.1 · 46 | 22% | 0.5% | 13.6% |
| 6 | full | on | 67.4 · 67 · 76 | 11.2 | 2.2 · 5 | 7% | 0.3% | 4.3% |
| 6 | full | off | 76.4 · 75 · 95 | 12.7 | 6.8 · 25 | 12% | 0.6% | 13.4% |
| 6 | random | on | 44.3 · 44 · 57 | 7.4 | 3.2 · 8 | 16% | 0.1% | 4.5% |
| 6 | random | off | 61.6 · 60 · 91 | 10.3 | 11.7 · 41 | 25% | 0.5% | 13.7% |
| 7 | full | on | 70.6 · 71 · 78 | 10.1 | 1.8 · 4 | 8% | 0.3% | 4.7% |
| 7 | full | off | 79.5 · 78 · 96 | 11.4 | 6.1 · 23 | 12% | 0.6% | 14.2% |
| 7 | random | on | 46.7 · 47 · 60 | 6.7 | 2.7 · 7 | 17% | 0.1% | 5.1% |
| 7 | random | off | 64.3 · 63 · 91 | 9.2 | 10.1 · 37 | 26% | 0.5% | 12.8% |
| 8 | full | on | 73.9 · 74 · 82 | 9.2 | 1.6 · 4 | 8% | 0.3% | 3.5% |
| 8 | full | off | 82.0 · 81 · 95 | 10.3 | 4.9 · 18 | 12% | 0.5% | 12.9% |
| 8 | random | on | 49.0 · 49 · 61 | 6.1 | 2.3 · 6 | 18% | 0.1% | 5.0% |
| 8 | random | off | 67.1 · 65 · 93 | 8.4 | 9.3 · 34 | 27% | 0.4% | 13.5% |

Named hits and self-fire, with bombs on, 1,000 games per cell (`--players 3,4,6,8 --games 1000 --nuclear on --announce both --selfFire both`). Mean turns:

| Players | Fleets | Named hits, self-fire (the game) | Hit-only reporting | No self-fire | Neither |
|---:|---|---:|---:|---:|---:|
| 3 | full | 56.9 | 73.5 | 71.5 | 93.3 |
| 4 | full | 59.8 | 74.2 | 71.4 | 94.8 |
| 6 | full | 67.4 | 79.4 | 75.8 | 97.1 |
| 8 | full | 74.0 | 82.7 | 81.7 | 99.2 |
| 4 | random | 39.1 | 47.5 | 45.1 | 55.1 |
| 8 | random | 49.1 | 58.5 | 52.5 | 64.2 |

### Findings

- **Game length.** With bombs, a full-fleet game takes 57–74 turns from 3 to 8 players. That's 19 calls each at 3 players and 9 at 8, so turns come round quickly at a big table. Random fleets are about a third shorter (37–49 turns). The p95 is within 8–16 turns of the median: games rarely run long.
- **Time spent nuclear.** With full fleets, players spend 3–8% of the game nuclear; with random fleets, 8–18%. Fleet size dominates. With bombs, a one-ship fleet spends 24–38% of the game bombing and a five-ship fleet 1–5%. Bigger fleets are also the last fleet standing far more often: 46% vs 9% at 4 players. That's fine for a game about fun, not winning, but don't expect small fleets to be a winning strategy, at least against these bots.
- **The endgame doesn't drag with bombs.** From two fleets afloat to the end takes 2–8 turns on average with bombs (p95 4–20), against 5–22 without (p95 18–68). Without bombs, the p95 game uses 89–96 of the 100 squares. Bombs also cut games that end with no last fleet from 13–23% to 3–9%.
- **Named hits** shorten games by 11–23% (fewer blind shots once a ship's line is known). **Self-fire** shortens them by 6–20%. Together they are why the game takes about 60 turns rather than about 95 at 4 players.
- **Two players is a different game.** Each player avoids their own ship squares, so the last squares left are the ones that hold ships on *both* boards. One call then sinks both fleets: 88% of 2-player full-fleet games (39% with random fleets) end with no last fleet. That supports the spec's 3–8 target; a 2-player variant would need a rule of its own.
- **Turn order doesn't matter.** The last-fleet rate by position in turn order is flat within noise at every player count.
- **Self-hits** are rare with DensityBot (0.1–3.4% of turns), because it only hits itself when that sinks someone. Humans will do it more.
