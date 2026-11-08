# Indra's Net — N-player simultaneous-fire Battleship (proof of concept)

> **For Claude Code.** This is the whole spec. Build it milestone by milestone (§9). At the end of each milestone, run the tests, update the README, commit (initialize git if needed), and **stop for review**. If anything is ambiguous or contradicts itself, ask rather than guess. Items marked *opinion* are deliberate design calls. Follow them unless something technical blocks one, and say so if it does. Don't add dependencies beyond §3 without explaining why.

Working title: *Indra's Net*. In the Flower Garland Sutra, Indra's net has a jewel at every knot, and each jewel reflects every other one, the way each call here lands on every board. zh-Hant title: 因陀羅網 (Jyutping: jan1 to4 lo4 mong5).

**The table in one sentence:** everyone watches **one big shared screen**. The app places every fleet and resolves every call. Each player scans **one QR code at the start** to get a static picture of where their own ships are, and after that only glances at it.

---

## 0. Assumptions (the human may edit these before handing off)

**Guiding principle (confirmed):** the game is about having fun while playing, not about winning. When a rule question comes up, pick whatever keeps more people doing something interesting. Kingmaking is fine. There's no scoring, and the game-over screen celebrates instead of ranking.

| # | Assumption | Default | Config key |
|---|---|---|---|
| A1 | **A call also hits the caller's own board.** Confirmed core rule. `selfFire: false` exists only in the engine and the simulation, for comparison. | yes | `selfFire` |
| A2 | Ships may touch. The random placer follows this setting. | yes | `allowTouching` |
| A3 | **Every hit names the ship** ("hit: Bo's cruiser"). Confirmed. A ship sinks automatically when its hits reach its length, and everyone then knows where it was. Classic hit-only reporting exists only in the simulation. | yes | `announceShipOnHit` |
| A4 | One call per turn. No bonus call on a hit. No passing. | — | — |
| A5 | **The app knows every fleet and resolves everything.** Nobody reports hits and there's no paper. | — | — |
| A6 | **Placement is random for now** (confirmed). The app places each fleet. Before confirming, a player may reroll their own fleet. Players placing their own ships comes later (M5). | — | — |
| A7 | **Phones do one thing.** At the start, each player privately scans a QR code on the laptop. Their phone then shows a **static image** of their own fleet. No live updates, no network connection between devices, no server, no app to install. | — | — |
| A8 | **Players choose their own fleet** (confirmed). *Assumed details:* each player picks any non-empty set of ships from the shipyard, each ship at most once. Fleets are chosen in the lobby and are **public**. | — | per-seat `fleet` |
| A9 | **Going nuclear** (confirmed). When your last ship sinks, you stay in the game: you keep your turns, and every call you make is a **2×2 bomb**. *Assumed details:* bombs are unlimited, one per turn. The called square is a corner: D4 covers D4, D5, E4, E5. The bomb must fit on the board, and it's legal if at least one of its squares is uncalled. | yes | `nuclear` |
| A10 | The game ends when at most one player still has ships afloat; that player is the last fleet standing. If one call sinks every remaining fleet, everyone is nuclear and the game ends with no last fleet. | — | — |
| A11 | One laptop drives the big screen. Its only job during play is entering each call. The keyboard can stay with a fixed host or pass to whoever is calling. | — | — |

## 1. What this PoC must prove

1. 3–8 people can play a full game around one shared screen and have fun. Each phone is used once to scan, then only glanced at.
2. The engine is pure and deterministic, places fleets fairly at random, and never leaks hidden information to the shared screens.
3. Bot simulations answer the **pacing** questions:
   - How long do games run at each player count?
   - How much of the game do people spend nuclear?
   - Does the endgame drag?
   - How do fleet size and bombs change all of this?
4. The i18n architecture holds across three outputs: the shared screen, the phone image, and the spoken callouts.

**Non-goals:** servers or networking of any kind, accounts, live phone updates, paper, scoring, sound effects (spoken callouts are in scope), native packaging.

---

## 2. Rules

**Terms:** a player is **afloat** while they have at least one unsunk ship, and **nuclear** after that. Everyone takes turns, afloat or nuclear.

### 2.1 Setup
- **Players:** 2–8. The engine supports any N ≥ 2; the UI caps it at 8.
- **Boards:** each player has their own board. The default is 10×10. Each axis can be 5–20, and boards don't have to be square.
- **Shipyard presets:**
  - **Classic** (default): carrier 5, battleship 4, cruiser 3, submarine 3, destroyer 2.
  - **Морской бой**: ships of length 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, with `allowTouching: false`.
- **Fleets:** each player chooses their own fleet from the shipyard in the lobby. It can be any non-empty set, with each ship used at most once. Fleets are public.
- **Ship numbers:** every shipyard ship has a fixed number (1, 2, 3, …), the same for everyone, shown on the screen and on the phone image.
  - A shipyard with several ships of the same kind gives them numbered names ("patrol boat 2").
  - Numbers also work across languages: "3" means the cruiser for every player at a mixed-language table.
- **Ship shape:** a straight line along one row or one column. Ships can't overlap and must fit on the board.
- **Placement:** the app places each fleet uniformly at random among all legal layouts, using the seeded RNG. Each player gets their fleet privately as a QR code (§5.3). They may reroll it any number of times until they confirm.
- **Turn order:** seat order is set in the lobby, and the seeded RNG picks who goes first.

### 2.2 A turn
1. **The call.** The active player says a coordinate out loud, and it gets entered on the laptop.
   - An afloat player's call is a **single square**.
   - A nuclear player's call is a **2×2 bomb**: the called square plus the next square along each axis.
2. **Target set:** the board of every afloat player, including the caller's own board if they're afloat (self-hits, A1). Nuclear players have no ships, so their boards aren't targets.
3. **Legality:**
   - A single call is legal if that square is unshot on at least one target board.
   - A bomb must fit on the board, and at least one of its squares must be unshot on some target board. Bomb squares that were already called are skipped.
   - With `selfFire` on, every afloat board has the same shot history, so both checks reduce to "has this square been called yet?"
   - An illegal call is rejected with a code and doesn't use up the turn.
4. **Resolution:** the app resolves every board, then reveals all results on the screen at once. Each result is a miss or a hit, and every hit names its ship. A ship that reaches its length sinks, and the app announces it.
5. **Going nuclear:** any afloat player whose whole fleet is now sunk goes nuclear, and their next turn is a bomb.
6. **End check:** if at most one player is afloat, the game is over (A10). Otherwise, play passes to the next player in seat order.

**Progress is guaranteed:**
- While two or more players are afloat, a legal call always exists. This holds for bombs too, because any uncalled square sits inside some 2×2 that fits on the board (both sides are at least 5).
- Every turn shoots at least one new square.
- So with `selfFire` on, a game lasts at most rows × cols turns.

### 2.3 Information
- **Public:**
  - every player's fleet (which ships), from the start
  - every call, including a bomb's full footprint
  - every result square by square, **including which ship was hit**
  - every sinking, and who went nuclear

  Because every hit is named, a sunk ship's footprint is exactly its hit squares.
- **Private:** where each player's ships are. Only the app and that player's phone image know this.
- **At game over,** every fleet is revealed.

### 2.4 Worked examples (3 players, 10×10)

Seat order: Amani → Bo → Chen. Fleets: Amani takes the full classic fleet; Bo takes battleship, cruiser and submarine; Chen takes only a destroyer.

| Turn | Caller | Call | Amani | Bo | Chen | Note |
|---|---|---|---|---|---|---|
| 1 | Amani | D4 | miss | hit: cruiser | hit: destroyer | |
| 2 | Bo | D5 | miss | hit: cruiser (own) | hit: destroyer → **sunk** | Bo's phone shows his cruiser on D5, and he calls it anyway to sink Chen's destroyer. That's legal and sometimes the right move. **Chen goes nuclear.** |
| 3 | Chen ☢ | J10 | — | — | — | **Illegal**: the bomb would run off the board. |
| 3 (retry) | Chen ☢ | D4 💣 | E4 miss, E5 miss | E4 miss, E5 hit: battleship | — | The bomb covers D4, D5, E4, E5. D4 and D5 were already called, so only E4 and E5 resolve. Chen's board isn't a target. |

**End of the game:**
- Amani and Bo each have one unhit square left, both at G7. Amani calls G7. Bo goes nuclear, and Amani is the last fleet standing.
- If Amani's last square were also G7, both would go nuclear, and the game would end with no last fleet.

**`selfFire: false` (engine and simulation only):** on turn 1, Amani's own board isn't shot. A later single call at D4 is therefore still legal: it resolves on Amani's board and returns `alreadyShot` on the others.

Every example in this section becomes a unit test, verbatim (M1).

### 2.5 Design notes (so you can make good calls in the gaps)
- **Nobody gets knocked out of play.** Going nuclear changes how you play, not whether you play. That's the most important rule for fun at 6–8 players.
- **Bombs speed up the endgame.** Classic Battleship drags while everyone hunts the last ship. Here, the more players are nuclear, the more of the board each round covers.
- **Fleet choice is a real choice because of bombs.** A small fleet goes nuclear sooner and drops four squares at a time for most of the game. A big fleet survives longer. Neither is correct; they're two ways to play.
- **No ganging up.** Every call hits everyone, so nobody can single out one player. Soft targeting still exists: you aim where you think someone's ships are, and that's part of the fun.
- **Your calls give you away.** Afloat players avoid squares where their own ships are, so the squares they keep avoiding hint at where their fleet is. That's why each player needs a glanceable reference of their own fleet, and nothing more.
- **Named hits make the game faster and more open.** After a ship's second hit, its line is known. The roster shows how close each fleet is to sinking.
- **One shared grid is enough.** With self-hits, every afloat board has exactly the same set of shots. So the screen shows one grid marked with who was hit where. Nobody has to remember anything about anyone else's board.
- **Random placement first** *(confirmed)*. It gets the table playing in a minute, and rerolling keeps a little agency. Player placement comes back in M5.
- **No bonus shot on a hit** *(opinion)*. With N boards, most calls hit *someone*, so a bonus shot would let turns run away.

---

## 3. Tech stack (*opinion*)

- **Language and UI:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vite, Preact with @preact/signals. One language end to end; the simulation runs in Node via `tsx`.
- **Testing:** Vitest and fast-check for the engine. Playwright for a few end-to-end and screenshot tests, including mobile viewports.
- **Lint:** ESLint and Stylelint, with the guardrails in §8.
- **i18n:** Unicode MessageFormat 2 via the `messageformat` package (v4 is its MF2 implementation), and `Intl.*` for everything else.
- **QR generation:** one small, maintained library. Pick the current best option yourself. Scanning isn't needed until M5, because phones scan with their own camera app.
- **Deployment:** one static build containing both the shared app and the phone page, on any HTTPS static host. Phones load the phone page over any connection, including mobile data. For local development, `vite --host` serves it over the LAN.
- **Versions:** check current package versions yourself; don't trust anything pinned here.

---

## 4. Architecture

### 4.1 Layout
```
src/
  engine/     pure TS: no DOM, no i18n, no Math.random, no Date
  bots/       see only viewFor(...) + legalCalls
  share/      pure: fleet-image payload encode/decode (§4.3)
  i18n/       negotiation, direction/writing mode, labels, digits, MF2 catalogs, pseudolocales
  ui/
    display/  the TV (public projection only)
    control/  the laptop: lobby, fleet handout, call entry, undo, private peek
    phone/    the static fleet-image page, which reads everything from the URL fragment
    speech/   spoken callouts
scripts/simulate.ts
e2e/
```
The engine gets its own `tsconfig` with `lib: ["ES2022"]` (no DOM), so its purity is enforced at compile time. A `no-restricted-imports` rule keeps it from importing `ui/`, `i18n/`, `bots/` or `share/`.

### 4.2 Engine API (functional, immutable, JSON-serializable)
```ts
type PlayerId   = string & { readonly __brand: 'PlayerId' };
type ShipId     = string & { readonly __brand: 'ShipId' };      // one shipyard ship
type ShipKindId = string & { readonly __brand: 'ShipKindId' };  // carrier, cruiser, … (messages, pictograms)
type Coord = Readonly<{ row: number; col: number }>;            // logical, 0-based
type Axis  = 'alongRow' | 'alongCol';                           // never "horizontal"/"vertical": they swap in vertical writing modes

interface Rules {
  rows: number; cols: number;
  shipyard: readonly { id: ShipId; kind: ShipKindId; number: number; length: number }[];
  allowTouching: boolean;
  selfFire: boolean; announceShipOnHit: boolean; nuclear: boolean;   // all true in play; false only for simulation comparison
}
interface Seat { id: PlayerId; kind: 'human' | 'bot'; fleet: readonly ShipId[] }   // fleet: non-empty, public
interface PlacedShip { ship: ShipId; origin: Coord; axis: Axis }

type Phase = 'setup' | 'playing' | 'over';

type Action =
  | { kind: 'reroll'; player: PlayerId }        // setup only; places that fleet again with the seeded RNG
  | { kind: 'start' }                           // ends setup
  | { kind: 'call';   player: PlayerId; at: Coord };   // single if afloat, 2×2 bomb if nuclear

type GameEvent =
  | { kind: 'shotCalled';   turn: number; by: PlayerId; at: Coord; shape: 'single' | 'bomb'; cells: readonly Coord[] }
  | { kind: 'shotResolved'; turn: number; board: PlayerId; at: Coord; outcome: 'miss' | 'hit' | 'alreadyShot'; ship?: ShipId }
  | { kind: 'shipSunk';     turn: number; board: PlayerId; ship: ShipId; cells?: readonly Coord[] }   // cells whenever announceShipOnHit
  | { kind: 'wentNuclear';  turn: number; player: PlayerId }
  | { kind: 'gameOver';     turn: number;
      result: { kind: 'lastFleet'; player: PlayerId } | { kind: 'allNuclear'; lastToSink: readonly PlayerId[] } };

type RuleViolation =
  | 'wrongPhase' | 'notYourTurn' | 'outOfBounds' | 'noUnshotTarget' | 'bombOffBoard'
  | 'unknownPlayer' | 'emptyFleet' | 'duplicateShip' | 'shipNotInShipyard' | 'noLegalLayout';

declare function newGame(rules: Rules, seats: readonly Seat[], seed: number): Result<GameState, RuleViolation>;  // places every fleet at random
declare function reduce(s: GameState, a: Action):
  Result<{ state: GameState; events: readonly GameEvent[] }, RuleViolation>;
declare function legalCalls(s: GameState, p: PlayerId): readonly Coord[];
declare function viewFor(s: GameState, viewer: PlayerId | 'spectator'): PlayerView;
declare function fleetOf(s: GameState, p: PlayerId): readonly PlacedShip[];   // ONLY for the private handout/peek screens and the payload encoder
declare function gameStats(s: GameState): GameStats;                          // feeds the game-over awards
declare function replay(rules: Rules, seats: readonly Seat[], seed: number,
                        actions: readonly Action[]): Result<GameState, { index: number; violation: RuleViolation }>;
```
**Random placement**
- Placement must be **uniform over all legal layouts**, not just "place ships one by one and retry". The naive approach is biased toward edges and corners.
- Use rejection sampling of whole layouts (draw every ship, reject the whole layout on any conflict), with a bounded retry count. Return `noLegalLayout` if no layout is found, e.g. a tiny board with `allowTouching: false`.
- Add a test of the empirical cell-occupancy distribution against an exact count on a small board.

**Data rules**
- Events and violations are **data, never strings**. Player display names live outside the engine.
- Use plain objects and arrays only: no `Map`, `Set` or class instances.
- The seeded PRNG (sfc32 or similar) is part of the state. The same seed plus the same actions must give an identical state and event log.

### 4.3 Fleet-image payload (the QR code)
- **The QR holds a URL:** `https://<host>/fleet#<payload>`. The payload sits in the **URL fragment, which browsers never send to any server**, so the static host never sees a fleet.
- **Payload contents:** `base64url` of packed bytes containing:
  - format version
  - game code
  - a short **fleet check** that changes on every reroll
  - board rows and columns
  - label system id(s) (§7.4), direction, and writing mode
  - player name (UTF-8, NFC)
  - glyph and colour index
  - each ship's number, kind, length, origin and axis
- **Keep it short:** under about 400 characters, so the QR scans easily off a laptop screen at arm's length. Test the worst case: a 24-grapheme name in a long script or with emoji, the 10-ship Морской бой preset, and a 20×20 board.
- **`share/` is pure,** with a property test: decode(encode(x)) equals x for random valid inputs.
- **The phone page needs nothing else.** No network after it loads, no storage, no updates. The fragment *is* the state, so reopening the same URL shows the same image.

### 4.4 Hidden information
- The display and the control panel render only `viewFor(s, 'spectator')`. `fleetOf` is called only by the private handout and peek screens (§5.3, §5.4) and by the payload encoder.
- **Nothing shared may react to a hidden fleet.** No "this will hit your own ship" warning, no change in timing, no disabled cells beyond what's publicly known. A warning like that would announce to the whole table where the caller's ship is.
- The laptop's state contains every fleet, so someone with devtools could peek. That's fine for a game among friends; say so once in the README.
- Bots get `viewFor(s, theirId)`: their own fleet and nothing else private.

### 4.5 Undo
- Undo covers **only the most recent call, before the next call is made.** It's for typos.
- Undo replays the action log without the last call. Everyone saw the result, so this isn't a strategic tool, and the UI says so briefly.

---

## 5. The table

### 5.1 Display (the TV)
Design for a "10-foot UI": readable from across a room.

**Shared grid**
- One grid, labelled on all four sides.
- Each called square shows either a miss mark or the **glyphs of every player hit there**, plus a sunk marker.
- The most recent call is highlighted; for a bomb, all four squares, with already-called ones marked as no-ops.
- Which ship was hit stays out of the cells, because with 8 players they'd be too crowded. That detail lives in the roster and the last-call card.

**Last-call card**
- The coordinate, in huge type. A bomb shows as a 2×2 with the nuclear symbol *and* the word for "bomb" in the game language, never the symbol alone.
- **A dramatic beat** *(opinion)*: show the call, pause briefly (configurable, about 1.5 s; none under `prefers-reduced-motion`), then reveal every result at once. Results list each hit with its ship and square ("Bo: cruiser, E5"), or "No hits", plus sinkings and anyone who went nuclear.

**Roster**
- Each player's glyph and colour, name, and **chosen fleet** (public from the start).
- Each ship is a numbered pictogram with one segment per square; filled segments count hits, and a ship is crossed out once sunk.
- Nuclear players are **not** greyed out: they get a nuclear badge and a different row style.
- The current caller is highlighted ("{name} is calling" or "{name} is bombing").
- During setup, a tick appears next to each player who has their fleet image.

**Look and feel**
- Size type with `clamp()` against the viewport. Main text meets WCAG AAA contrast. Nothing depends on hover.
- **Player identity:** a colour plus an **SVG shape** from an 8-shape set, using the Okabe–Ito palette (exactly 8 colours). The shapes carry identity for colour-blind players and on the phone image. Use SVG, not font glyphs.
- **TV housekeeping:** a fullscreen toggle, and the Screen Wake Lock API (in try/catch) so the TV doesn't sleep.

**Game over:** a celebration, not a ranking.
- The last fleet standing (if any), and every fleet revealed.
- A handful of **awards** computed by `gameStats`, for example: most self-hits ("friendly fire"), biggest single-bomb haul, longest-surviving ship, first to go nuclear, most ships sunk by bombs. Each award is a plural-aware message key, and only awards someone actually earned are shown.
- Buttons: replay with the same seed, or start a new game.

### 5.2 Control panel (the laptop)
**Windows**
- **Two-window mode** (the default when a second display exists): a *Display* window on the TV and a *Control* window on the laptop, synced with `BroadcastChannel`. Control owns the state, and Display can request it again after a reload.
- **One-window mode:** the controls dock at the inline-end or block-end edge and can be collapsed.

**Lobby**
- **Language:** each language is shown by its own name for itself (`Intl.DisplayNames([tag], { type: 'language' })`). No flags.
- **Seats:** for each seat, a name in any script, human or bot, and a **fleet picker**: toggle ships from the shipyard, at least one, defaulting to the full fleet.
- **Settings:** rules, board size, shipyard preset, coordinate label system (§7.4), an optional second label system, and an optional seed.

**Fleet handout** (§5.3), then **Start**.

**Turn flow** (fully keyboard-driven)
1. The caller says a coordinate.
2. The operator types it (§7.5) or clicks the grid, then presses Enter.
3. The display shows the call, pauses for the beat, reveals the results and speaks them (§5.5).
4. Play moves to the next player.

**Other controls**
- Ctrl/Cmd+Z, bound to the physical `KeyZ` plus a modifier, undoes the most recent call (§4.5).
- **Show a fleet privately** (§5.4).

**Autosave:** after every action, save the seed, seats and action log to `localStorage` (in try/catch). On load, offer to resume.

### 5.3 Fleet handout and the phone image
**On the laptop, one human player at a time, in seat order:**
1. A privacy screen: "Pass to {name}". Everyone else looks away.
2. Tap to show that player's **QR code**, with a small preview of their board and its fleet check.
3. The player scans it with their phone's ordinary camera app, and the phone opens the fleet image.
4. Then **Got it** (which hides the screen and ticks them off on the TV roster), or **Reroll** (a new random layout, a new QR, and a new fleet check). Rerolling is allowed any number of times until they confirm.

**The QR code never appears on the TV.** Anyone in the room could scan it from there.

**The phone page** is static and runs only on the phone. It draws one image from the fragment:
- the player's name, glyph and colour
- their board, labelled on all four sides with the **game's** label system, direction and writing mode, so it matches the TV exactly
- their ships, outlined, with each ship's number inside its outline
- a legend of ship numbers and names in **the phone's own language**
- the game code and fleet check, which must match the laptop's preview

**Phone behaviour:**
- **Peeking:** hold to peek *(opinion)*. The image is hidden until you press and hold, so a neighbour can't read it over your shoulder. A setting keeps it always visible.
- **Save image:** exports a PNG to the camera roll (§7.7), for anyone who'd rather glance at a photo.
- **Nothing to do during play.** No buttons, no updates, no network.

### 5.4 Players without a phone, and lost images
- **Show a fleet privately:** in the control panel, pick a player, then a privacy screen, then hold to view their fleet on the laptop. This works anytime: for players without a phone, or for someone who closed their image.
- **Re-showing a QR:** the handout QR can also be shown again privately. It encodes the same fleet, so the same fleet check appears.

### 5.5 Spoken callouts
- Players glance down at their phones, so the app reads each call aloud, then the results after the reveal.
- **On by default** whenever the browser has a voice for the game language; it can be toggled off.
- Use `speechSynthesis`, choosing the voice by BCP 47 lookup against `getVoices()`. **Never read text with a voice for another language.** If no voice matches, stay silent and show a note once.
- **Spoken text has its own MF2 messages** (`*.spoken`), because a displayed label like ⁨هـ⁩ or 甲7 may not read naturally.
  - The spoken coordinate can spell letters out by name; English says "D four".
  - Bombs: "Bomb, D four".
  - Results avoid possessives: "Hit: Bo, cruiser. Sunk: Chen, destroyer. Chen goes nuclear."

### 5.6 Accessibility
- **Grid:** the control-panel grid follows the ARIA grid pattern with a roving tabindex. Every cell's accessible name comes from a message.
- **Announcements:** results go to `aria-live="polite"`. Going nuclear and game over use `assertive`.
- **Colour:** never rely on colour alone.
- **Phone page:** the image has a text alternative listing each ship and its squares, available only while peeking.

---

## 6. Bots and simulation

### 6.1 Bots
- Bots are players whose calls the app makes, after a configurable "{bot} is choosing…" delay. The call is shown and spoken like anyone else's.
- **Fleet choice:** each bot seat has a policy: full, a random non-empty subset, or a fixed list. Bot placement uses the same random placer as everyone else.
- **`RandomBot`:** uniform over legal calls. While afloat, it avoids its own unhit ship squares unless nothing else is legal.
- **`DensityBot`** (the default):
  1. For each target board, list every placement of each ship still afloat that fits the public information. A placement must cover **all of that ship's named hits**, and can't cover a miss or a square hit on a different ship.
  2. Normalise per board to get a probability per square.
  3. Score each legal call as **expected hits on others − expected hits on itself** (the self term is 1 on its own unhit ship square, 0 otherwise).
  4. Break ties with the seeded RNG.
  - **Nuclear:** score each on-board 2×2 by the expected hits over its new squares, with no self term.
  - **With `announceShipOnHit: false`** (simulation only): placements covering unattributed hits get a heavy weight instead.
- **`InferenceBot`** (stretch): also updates a posterior over each afloat opponent's fleet from the squares that opponent keeps avoiding.
- A test checks that `bots/` can't import engine internals.

### 6.2 Simulation
```
npm run sim -- --players 2..8 --games 5000 --bots density --fleets full,random --nuclear both --selfFire both --announce both --seed 1
```
Prints a table and writes JSON and CSV. The point is **pacing**, not balance. Report:
- mean, median and p95 game length, in turns and in calls per player
- how much of the game each player spends afloat and how much nuclear, by fleet size
- how long the endgame lasts, from when only two fleets are afloat until the end, with and without bombs
- how much named hits shorten the game compared with classic reporting
- the share of turns where the caller hit their own board
- the share of games that end with no last fleet standing
- last-fleet rate by seat and by fleet size, for curiosity only

Format all numbers with `Intl.NumberFormat`, even in the CLI.

---

## 7. Internationalization (the ground floor, not a retrofit)

**Rule:** never build an English-only screen and translate it later. From M2 on, every screen (TV, laptop and phone) is built and checked in `en`, `ar`, `zh-Hant` and both pseudolocales at the same time.

### 7.1 Locales and direction
- **Required:** `en`, `ar`, `zh-Hant`, plus two pseudolocales generated from `en` at build time:
  - `en-XA`: accented, about 35% longer
  - `ar-XB`: RTL layout with force-reversed text
- **Optional:** `he`, `fa`, `ru`, `ja`, `ko`, `mn-Mong`. Draft these catalogs and flag them "needs native review".
- **Which locale applies where:**
  - The **TV and laptop** use the game language chosen in the lobby.
  - The **phone page** uses **the phone's own language** (`navigator.languages`, with a picker), so every player reads their legend in their own language.
  - The **grid** on every surface follows the game's label system, direction and writing mode.
- **Locale negotiation:** canonicalise with `Intl.getCanonicalLocales`, and set `lang` and `dir` on `<html>`. Get the direction from `Intl.Locale.prototype.getTextInfo()` where available. Otherwise, check the maximised script (`new Intl.Locale(tag).maximize().script`) against the RTL scripts: Arab, Hebr, Syrc, Thaa, Nkoo, Adlm, Rohg, Mand, Samr, and so on.
- **Extensions:** respect `-u-nu-` and `-u-ca-`. Never hardcode a numbering system per language; let `Intl.NumberFormat` pick the locale default.

### 7.2 Messages
- **Catalogs:** MF2 sources, one catalog per locale, with a `MessageKey` type generated from `en`. Tests: every locale has every key, every message parses, and every message uses the same variables as `en`.
- **Bidi isolation:** turn on MF2's default bidi isolation for placeholders (check the library's option name). Player names are always isolated: `<bdi>` in markup, FSI…PDI in plain strings (`aria-live` text, `document.title`, speech, CLI).
- **Codes and fleet checks** are Latin by design. In RTL UIs, show them in an LTR isolate (`<bdi dir="ltr">`) so the groups don't reorder.
- **No concatenation, no possessives built in code.** Join lists of players with `Intl.ListFormat` (conjunction).
- **Plurals and ordinals:** MF2 `:number` selection, which follows the CLDR rules. A unit test has Arabic exercise all six categories (zero, one, two, few, many, other).
- **Ship names carry grammatical gender per locale,** exposed to messages as a selector:
  - Russian: Авианосец, Линкор, Крейсер and Эсминец are masculine; Подводная лодка is feminine. So «… потоплен» / «… потоплена», and the same for hits: «… подбит» / «… подбита».
  - Arabic: ⁨حَامِلَةُ طَائِرَاتٍ⁩, ⁨بَارِجَةٌ⁩, ⁨غَوَّاصَةٌ⁩ and ⁨مُدَمِّرَةٌ⁩ are feminine; ⁨طَرَّادٌ⁩ is masculine. Sunk is ⁨غَرِقَتْ⁩ / ⁨غَرِقَ⁩; hit is ⁨أُصِيبَتْ⁩ / ⁨أُصِيبَ⁩. The diacritics here are for clarity; the shipped catalog can follow normal unvocalised UI style.
  - Repeated kinds take their number as a variable (`{$kind} {$number}`).
  ```
  .input {$gender :string}
  .match $gender
  feminine {{{$ship} потоплена!}}
  *        {{{$ship} потоплен!}}
  ```

### 7.3 Layout, direction, keyboard
- **Logical CSS only** (`margin-inline-start`, `inset-inline-end`, `block-size`, …). `stylelint-use-logical` or an equivalent fails the build on physical properties.
- **The grid** is a CSS grid on logical axes everywhere, so RTL mirrors it automatically: column 1 sits at the inline-start (right) edge.
- **Arrow keys move visually** (the ARIA grid convention). One table in `ui/keyboard.ts` maps (key, `direction`, `writing-mode`) to a logical (Δrow, Δcol). Unit-test all six combinations (ltr/rtl × horizontal-tb/vertical-rl/vertical-lr).
- **Shortcuts bind to `KeyboardEvent.code`** (the physical key), so they work on Arabic, Hebrew, Russian and other layouts. Show the key's label via `navigator.keyboard.getLayoutMap()` where supported, otherwise a localised fallback.
- **Fonts:** the system UI stack, with Noto fallbacks for Arabic, Hebrew, Traditional Chinese and Mongolian. Only load what the active locales need. Wait for `document.fonts.ready` before drawing the phone image.

### 7.4 Coordinate labels
- **Rows** get an enumerative label system. **Columns** get locale digits (`Intl.NumberFormat`), starting at 1.
- Implement the CSS Counter Styles Level 3 **`alphabetic`** and **`fixed`** algorithms in pure TS, about 15 lines each. The strings are needed in JS for the TV, the phone, speech and parsing, so CSS `counter()` won't do.

| System | First ten | Algorithm, length | Default for |
|---|---|---|---|
| Latin | A B C D E F G H I J | alphabetic (…Z, AA, AB) | Latin-script locales, `ja` |
| Arabic abjad order | ‎أ ب ج د هـ و ز ح ط ي | fixed, 28 | `ar` |
| Arabic alphabetical order | ‎أ ب ت ث ج ح خ د ذ ر | fixed, 28 | option |
| Persian alphabetical order | ‎الف ب پ ت ث ج چ ح خ د | fixed, 32 | `fa` (also offer abjad order, ⁨الف ب ج د⁩) |
| Hebrew | ‎א ב ג ד ה ו ז ח ט י | fixed, 22 | `he` |
| Greek | Α Β Γ Δ Ε Ζ Η Θ Ι Κ | fixed, 24 | `el` |
| Морской бой | А Б В Г Д Е Ж З И К | fixed, 28 (skips Ё Й Ъ Ы Ь) | `ru` (option: the ten distinct letters of РЕСПУБЛИКА) |
| Heavenly Stems 天干 | 甲 乙 丙 丁 戊 己 庚 辛 壬 癸 | fixed, 10 | `zh-Hant` |
| Earthly Branches 地支 | 子 丑 寅 卯 辰 巳 午 未 申 酉 (戌 亥) | fixed, 12 | option |
| Hangul 가나다 order | 가 나 다 라 마 바 사 아 자 차 | fixed, 14 | `ko` |
| イロハ order | イ ロ ハ ニ ホ ヘ ト チ リ ヌ | fixed, 47 | option |

Jyutping: 天干 tin1 gon1 (甲 gaap3, 乙 jyut6, 丙 bing2, 丁 ding1, 戊 mou6, 己 gei2, 庚 gang1, 辛 san1, 壬 jam4, 癸 gwai3). 地支 dei6 zi1 (子 zi2, 丑 cau2, 寅 jan4, 卯 maau5, 辰 san4, 巳 zi6, 午 ng5, 未 mei6, 申 san1, 酉 jau5, 戌 seot1, 亥 hoi6).

- **Arabic heh:** the fifth abjad letter is written ⁨هـ⁩ (U+0647 U+0640, heh + tatweel). That's the usual way to write a standalone heh, and it keeps it from being read as the Arabic-Indic digit ⁨٥⁩. Apply the same rule wherever heh appears in a sequence.
- **Never mix systems within an axis.** If the board has more rows than a fixed system has letters, the lobby offers the next system that fits (天干 → 地支) or switches the whole row axis to numerals. When both axes are numeric, the callout uses a separator (message key `coord.bothNumeric`).
- **Second label system** (optional, for mixed-language tables): shown smaller beside the primary one on the TV and on every phone image. The parser accepts either.
- **The callout format is a catalog message** (`{$row}{$col}`), so translators control order and separators. Chinese gets 甲7 by default; Han digits are available via `-u-nu-hanidec`.

### 7.5 Typed calls (parsing)
- **Normalise:** NFKC (this folds full-width Ｂ７ to B7), trim, then case-fold Latin, Greek and Cyrillic.
- **Digits:** accept any `\p{Nd}`. The value is (code point − start of its maximal contiguous `\p{Nd}` run) mod 10. This works because Unicode only assigns decimal digits in contiguous ascending 0–9 ranges.
- **Row labels:** reverse-look-up in the active system(s).
  - Latin is always accepted as a fallback, *except* when the active system is Cyrillic or Greek. There, Latin letters are treated as homoglyphs of the native letters (B → В, H → Η, …), because accepting them as Latin labels would be ambiguous.
- **Order:** accept row-first or column-first when it's unambiguous.
- **Errors** are message keys, not strings.
- **Property test:** `parse(format(c)) === c` for every label system and every coordinate.

### 7.6 Names
- **Normalisation and length:** names can be in any script. Normalise to NFC on input, and limit them to 24 grapheme clusters, counted with `Intl.Segmenter`.
- **Direction:** `dir="auto"` on inputs, `<bdi>` on output.
- **Duplicates:** warn, but don't block, when two names are equal under `Intl.Collator(locale, { sensitivity: 'base' })`.
- **On the phone:** names travel in the QR payload as NFC UTF-8 and are rendered with the same isolation rules.
- **Fixtures:** ⁨יעל⁩, ⁨لينا⁩, 陳大文, Ngũgĩ, "👩🏽‍🚀 Ada" (the ZWJ sequence counts as one grapheme), and a name that starts with a digit, shown in an RTL UI.

### 7.7 The phone image
- **Two renderings:** the on-screen image is SVG/DOM, using the same components as the TV grid. **Save image** draws a PNG with Canvas 2D.
- **Text in the PNG:**
  - Set `ctx.direction` per text run, because Canvas doesn't run the bidi algorithm across mixed runs for you. Draw each isolated run separately.
  - Canvas has no vertical text. In vertical modes, draw each label upright in its own cell position. Labels are single tokens, so no line layout is needed.

### 7.8 Vertical writing modes (M4)
- **Which locales:**
  - `zh-Hant` and `ja`: an optional `vertical-rl` toggle. It isn't forced, because modern UIs are mostly horizontal.
  - `mn-Mong`: `vertical-lr`, on by default.
  - The toggle applies to the TV and every phone image together.
- **The vertical grid is just the transposed layout,** thanks to the logical grid axes:
  - In `vertical-rl`, cell (0,0) is top-right, columns run down, and rows go right to left.
  - In `vertical-lr`, cell (0,0) is top-left.
- **Column numbers** of up to two digits sit horizontally inside the vertical line, via a span with `text-combine-upright: all`. Avoid `digits 2`, which browsers barely support.
- **Scope:** the TV and the phone image must work fully vertically. The laptop controls may stay horizontal; note it in the README if they do.

### 7.9 i18n tests
- **Playwright screenshots of the TV** (setup, mid-game, game over) in `en`, `ar`, `ar-XB`, `en-XA`, `zh-Hant`, and vertical `zh-Hant`.
- **Playwright screenshots of the phone page** at mobile viewports:
  - the same locales as the TV
  - plus a **mixed** case: a phone in `ar` showing a game with Latin labels
- **Unit tests:**
  - label round-trips
  - plural categories
  - the key-map table
  - bidi isolation around every name in every displayed and spoken announcement
  - catalog parity
  - payload round-trips and worst-case payload size

---

## 8. Guardrails (lint/CI)
- **Engine:** no DOM types; no imports from `ui/`, `i18n/`, `bots/` or `share/`; no `Math.random`, no `Date`.
- **Hidden fleets:** only the handout screen, the private peek screen and `share/` may call `fleetOf`. Enforce it with a lint rule or an import boundary.
- **UI strings:** no literal user-facing strings in JSX (`eslint-plugin-i18next` `no-literal-string` or an equivalent).
- **CSS:** logical properties only.
- **User text:** never `.toUpperCase()` or `.length` on it. Use `toLocaleUpperCase(locale)` and grapheme counts. Lint where practical; otherwise add it to the review checklist in the README.

---

## 9. Milestones

- **M0 Scaffold**
  - Vite + strict TS + Preact, Vitest, the ESLint/Stylelint guardrails.
  - i18n plumbing: negotiation, `dir`/`lang`, MF2 loading, pseudolocale generation.
  - Hello-world TV and phone routes in every required locale.
- **M1 Engine**
  - Rules, per-player fleets, uniform random placement and rerolls, going nuclear, 2×2 bombs, `legalCalls`, `viewFor`, `fleetOf`, `gameStats`, `replay`, and undo.
  - Unit tests reproducing §2.4 verbatim.
  - Property tests:
    - The game always ends within the §2.2 bound.
    - With `selfFire` on, every afloat board has the same shot set after every turn.
    - A player goes nuclear exactly when their last ship sinks. From then on every call they make is a bomb, and no turn is ever skipped.
    - A bomb never leaves the board, and the order of a bomb's squares never changes the outcome.
    - A ship sinks exactly when its named hits equal its length, and a sunk ship's footprint is exactly its hit squares.
    - Random placement is always legal, and is uniform: the occupancy test from §4.2.
    - `viewFor(s, 'spectator')` never contains an unsunk ship square. Check this by searching the serialised view.
    - Determinism, and `replay` matches the live state.
    - `legalCalls` is never empty while the game is running, and `reduce` accepts exactly those calls.
- **M2 The table**
  - TV display, control panel (one-window and two-window), lobby, **fleet handout with QR codes**, the **phone fleet image** (with save image), private peek, spoken callouts, autosave/resume, accessibility.
  - All of it in every required locale at once.
  - **Exit test:** a 4-player game where each phone is used exactly once to scan, and nothing in the code changes along the way.
- **M3 Bots and simulation**
  - `RandomBot`, `DensityBot`, `npm run sim`.
  - Commit a pacing table to the README: 2–8 players, `nuclear` on/off, full fleets vs random fleets.
- **M4 Vertical modes:** §7.8, on the TV and the phone image.
- **M5 Players place their own ships** (designed now, built later)
  1. The TV shows one QR code that opens a phone **placement** page. Game parameters are in the URL fragment, the phone's UI is in the phone's language, and the grid uses the game's labels and orientation.
  2. On the phone: pick your name, place your ships (drag, tap-and-rotate, or random), and the page validates overlap and touching.
  3. The phone then shows a **fleet code** as a QR, plus as text: Crockford Base32 with its mod-37 check symbol, grouped 4-4-4-1, in an LTR isolate.
     - The code packs the seat, the game check, the fleet subset, and each ship's placement index in mixed radix. It is lightly obfuscated with a game-keyed keystream.
     - That's about 13 characters for the classic fleet.
  4. The player shows the QR to the laptop webcam (`BarcodeDetector` where available, otherwise a WASM decoder), or types the code in.
     - Decoding applies NFKC, is case-insensitive, maps I/L to 1 and O to 0, ignores hyphens, and maps any `\p{Nd}` digit to ASCII.
     - Codes from another game, or with a bad check symbol, are rejected with friendly, localised errors.
  5. The phone then shows the same static fleet image as now.
  6. Property tests: code round-trips; any single substitution or adjacent transposition is caught.
- **Stretch**
  - **Blind fleets:** a party mode where nobody sees any fleet, including their own.
  - `InferenceBot`.
  - Voice input for calls via Web Speech recognition in the game language, always with a confirm step.
  - Salvo for afloat players: as many calls per turn as surviving ships.
  - Live phones and remote play via a relay: this is the first feature that would need a server.

## 10. Definition of done
- **The game is playable at the table:** 3–8 people play a full game around one TV in `en`, `ar` or `zh-Hant`, with any mix of bots. Each phone is used once to scan, and only glanced at after that.
- **No leaks:** nothing on the TV or the laptop ever reveals a fleet, except behind a privacy screen.
- **Nuclear works:** a player whose fleet is sunk keeps playing as a bomber, and the game-over screen celebrates instead of ranking.
- **Tests:** all tests and lint pass, and the pacing table is in the README.
- **Right-to-left and Chinese work:**
  - An Arabic table sees a mirrored grid with abjad labels on both the TV and the phones.
  - A Chinese table sees 天干 rows on both, and can switch both to `vertical-rl`.
  - A player whose phone is set to a different language still sees the game's labels, with their legend in their own language.

## References
- W3C, *CSS Counter Styles Level 3* (the `alphabetic` and `fixed` algorithms; `cjk-heavenly-stem`, `cjk-earthly-branch`), and *Ready-made Counter Styles*.
- W3C, *CSS Writing Modes Level 4*.
- Unicode, *MessageFormat 2.0* specification, including its bidi isolation section.
- Unicode, UAX #9 (Bidirectional Algorithm), UAX #29 (Text Segmentation), UTS #35 (LDML).
- W3C WAI, *ARIA Authoring Practices Guide*: the Grid pattern.
- W3C, *Web Speech API*, *Screen Wake Lock API*.
- ISO/IEC 18004 (QR code); D. Crockford, *Base32* (for M5 fleet codes).
- Okabe & Ito, *Color Universal Design* (2002), for the 8-colour palette.
