# HANDOFF — YDK Decoder

Snapshot of the project state for whoever picks this up next (including future-me).
Last updated: **2026-04-27**.

---

## What this is

A **personal Yu-Gi-Oh deck-learning workbench** for Abid. Two pieces:

1. **Decoder** — single-file static HTML app at `decoder/ydk_decoder.html`. Drop in a `.ydk`, see your deck broken down by role (Starter / Extender / Engine / Floodgate / Board breaker / Handtrap), browse extracted combos with side-by-side master/detail layout, drill openers in Practice mode.
2. **Chrome extension** — `extension/`, MV3. Two jobs:
   - Extract DuelingBook **replays** → structured combo JSON → push to decoder
   - Scan DuelingBook **deck constructor** → `.ydk` → push to decoder

The extension and decoder communicate via `localStorage` injection (decoder owns the DB, extension is the data pipeline).

---

## Build markers (verify after Ctrl+Shift+R)

| Component | Current build |
|---|---|
| Decoder | `2026-04-27-favicon+sidebar-combos+1-2-only` |
| Extension manifest | `1.5.0` |
| Service worker | `sw-build-2026-04-26-combo-deckid-stamp` |
| Deck extractor (content script) | `deck-extractor-2026-04-26-v6-content-script` |

Decoder build is visible in **Settings → About → Build** (selectable for copy/paste).
SW + deck-extractor builds are in their respective console logs.

---

## ✅ What's done

### Decoder app — core
- **Cards tab** with role-based filter pills (canonical 6: `Starter / Extender / Engine / Floodgate / Board breaker / Handtrap`)
- Compact card grid (DB-style) with Compact/Detailed toggle
- Hover preview with smooth fade-in/out (uses opacity + transform, not display)
- Sticky filter bar that survives scroll
- Section headers (Main/Extra/Side) with accent left-stripe + underline

### Decoder app — combos
- **Combos tab is now a master/detail workspace**: combo list in 320px sticky sidebar on left, selected combo on right. Collapses to stacked at < 1100px.
- Each combo tile uses a **cropped image of the first opening-hand card's art** as visual identity. Two overlay chips: opener-size pill (top-right), `↗ Replay` link (bottom-right).
- **Manual opener-size override**: click the colored pill in the open combo's header to re-bucket between `1-card` / `2-card` / `Other`. Persists on `combo.userOpenerSize`. Auto-bucketing is by `openingHand.length` with anything 3+ folding into Other.
- Per-combo **collapsible notes** panel (`<details>` element, click outside to commit + close, `Cmd/Ctrl+Enter` saves, `Esc` discards)
- Five view modes: Full / Core / Cluster / Compact / Diagram (dropdown picker)

### Decoder app — decks
- **Header deck-switcher** (fanned-cards SVG icon + active deck name + counts) → click to open popover
- Popover supports: switch deck, inline rename (✎), download .ydk (↓), delete (×), `+ Import .ydk`, `Manage all decks →`
- **Active deck is the global context** — Cards / Combos / Practice all operate on the active deck implicitly. There's no Decks tab anymore (its functionality moved to the popover + the legacy view is reachable via Manage).
- Content-hash dedup on import means re-importing the same `.ydk` doesn't create duplicates (across all three import paths). One-time cleanup runs on init for any pre-existing dupes.

### Decoder app — practice
- Shuffle 5 cards (going first) or 6 (going second). Going-first toggle persists.
- Match drawn hand against active deck's combos:
  - ✓ Playable (every required card in hand)
  - ⚠ Need 1 more (told which)
  - ✗ Need 2+ (faded)
- Per-deck consistency streak: `N openable / M hands · X%`
- "Walk through →" jumps to the open combo

### Decoder app — settings
- **Settings tab** (gear icon at right of tab bar)
  - **Theme**: dark/light toggle (light mode is implemented via `body[data-theme="light"]` overriding color tokens — works automatically because everything else uses CSS variables)
  - **Backup / Restore**: full JSON export of `ydk_decks`, `ydk_saved_combos`, `ydk_card_cache`, `ydk_practice_streak`, prefs. Restore is conservative-merge (never destroys local data).
  - **Danger zone**: clear all combos / reset card cache (both gated by themed confirm modal)
  - **About**: version badge `v1.5`, friendly description, live storage usage stats (`N decks · M combos · K cards · Z KB`)

### Decoder app — UI primitives
- **Custom modal** (`ydkConfirm` / `ydkAlert`) replaces native `confirm()` everywhere. Themed, animated, keyboard-friendly (Esc cancels, Enter confirms), supports HTML in messages, danger variant for destructive actions.
- Tab transitions: fade + slide on each tab switch (~180ms cubic-bezier, honors `prefers-reduced-motion`)
- Setup banner auto-hides when `location.hostname` is `localhost` / `127.0.0.1`
- Custom favicon (inline SVG fanned cards in accent orange)
- Clean tab title (`YDK Decoder — DoomZ / Power Patron`)

### Chrome extension
- **Replay extractor** (`combo-import-helper.js`) — preserved from DuelMetrics v4.0; extracts log lines, opening hand, end-board state, structured steps. **Do not rewrite this** — it solves dozens of DB DOM quirks.
- **Deck extractor** (`content/deck-extractor.js`) — registered as `content_scripts` in manifest, auto-loads on every duelingbook.com page. Listens for `exportDeck` and `scanAllDecks` messages. Uses DuelMetrics' selectors:
  - Main: `#deck_constructor div.deck_cards .cardfront`
  - Side: `#deck_constructor div.side_cards .cardfront`
  - Extra: `#deck_constructor div.extra_cards .cardfront`
  - Card data: `.cardfront_content > .name_txt + .passcode_txt`
  - Deck name: `select#decklist_cb` selectedIndex
- **Service worker** orchestrates replay → combo → decoder injection (`saveDeckToDecoder`, `openInDecoder`). Stamps `combo.deckId` from `localStorage.ydk_active_deck_id` so combos auto-link to the active deck.
- **Popup** drives both flows + a `.ydk` file picker as the simplest path. Local deck library mirrored in `chrome.storage.local.savedDecks`.

---

## 🔧 In-progress / partially done

### N1.x — Multi-deck + variations system
Per `docs/ROADMAP.md`. **N1.1 (deck extractor) and N1.2/N1.3 (combos↔decks mapping) are done.** Still open:

- **N1.4** — Backup/restore. Done as the Settings → Backup/Restore feature.
- **N1.5** — End-to-end test on the 6 reference combos (`docs/DECK_CONTEXT.md`). Not yet done — Abid is testing the tool with their own `abid_doomz_2.ydk` deck.

### Variations
**Dropped from scope.** Per Abid (2026-04-27): "I think variations does not make sense tbh — what would happen is a user would create a variation of a deck → import that and map the combos etc to that new decklist." Each deck is independent.
- The schema fields `parentDeckId` / `isVariation` are still on legacy deck objects but are **not used** for any logic. New deck imports don't set them.

---

## 🚀 Next priorities (queued, not started)

These are flagged for after Abid finishes drilling combos with the current build. Order by likely impact:

1. **Active deck name in browser tab title** — currently static. Should be `{deckName} · YDK Decoder` so multiple tabs are distinguishable.
2. **Combo title editability** — the auto-detected combo names (e.g. `DoomZ VII Seven - Elara`) are often generic. Click-to-edit on the open combo title.
3. **Drag-to-reorder combos** within their bucket. Currently sorted by extraction date.
4. **Combo tile mini-grid** — replace comma-separated opener card text with 3 stacked thumbnails for faster visual scan.
5. **`📝` icon on tiles that have notes** — quick visual cue of which combos have annotations.
6. **Card-effect database for staples** — hand-curated overrides for ~30 meta cards (Super Poly, Lightning Storm, Forbidden Droplet, Kaijus, Solemns, Branded engine, Snake-Eye engine, etc.). Currently `KEYWORD_RULES` does best-effort but staples deserve overrides for accuracy. Abid said skip for now and flag mis-classifications as they appear.
7. **Quiz mode** — show opening hand, hide line, user names which combo it is. Deferred per Abid.

### Two large new sections Abid sketched out (do AFTER they've used the tool)

a. **Deck methodology section** — per-deck panel explaining the deck's strategy / end goal / key ratios / role density. Lives on the active deck context. Not yet built.

b. **Combos through handtraps** — branches on the main combo line. "If Ash hits Elara, do X; if Imperm on Drastea, do Y." UI shape TBD — could be a separate tab, OR linked combos under each main combo (parent-child). Deliberately deferred until we have real combos and real handtrap-played-around scenarios.

---

## 🪤 Gotchas / non-obvious decisions

### Architecture
- **Active deck is global context, not a destination.** There's no "Decks tab" — switching the active deck (via header switcher) reloads Cards/Combos/Practice. This was a deliberate refactor; do not revert.
- **localStorage is the source of truth.** No backend. Every piece of state has a `ydk_*` key. Backup/restore reads/writes a known set documented in `BACKUP_KEYS` in the decoder.
- **Cross-component sync uses CustomEvents** — `ydk:combo-injected` and `ydk:deck-injected` fire on `window` after the SW injects into localStorage. The decoder listens and re-renders.
- **Service-worker → page injection** is via `chrome.scripting.executeScript({ func: ... })` with the function serialized. Those `injectComboIntoDecoderPage` and `injectDeckIntoDecoderPage` functions in `service-worker.js` MUST be self-contained — no closures, no external refs except web globals.

### Role taxonomy
- **6 canonical roles** (collapsed from a legacy 14): `Starter`, `Extender`, `Engine`, `Floodgate`, `Board breaker`, `Handtrap`.
- Legacy `Searcher / Combo piece / Boss / Equip / Pendulum / Finisher` collapse to `Engine`. `Stopper` collapses to `Floodgate`. `Tech` is dropped (was a meaningless catch-all).
- The collapse happens in `normalizeRoles()` at `classify()` output time, so `CARD_OVERRIDES` entries can stay in the legacy 14-role format and they get normalized automatically. **Don't bulk-rewrite the overrides** — the collapse map handles it.

### Opener size
- Three buckets: `1-card`, `2-card`, `Other / mulligan`. Anything 3+ auto-folds to Other.
- `getComboOpenerSize(combo)` checks `combo.userOpenerSize` (manual override) first, falls back to `openingHand.length`. Always use this helper, never read `openingHand.length` directly for bucketing.

### DuelingBook integration
- DB is **canvas-rendered for the deck builder** — `<img>` scraping doesn't work. We failed at this for several iterations before extracting DuelMetrics' working selectors (which target `.cardfront` real DOM elements that DO exist on the deck constructor page specifically — the rest of DB's UI is canvas).
- The deck extractor is registered as a **content script** (auto-loads), not injected on demand via `chrome.scripting.executeScript`. This was the breakthrough — `.executeScript({ files: [...] })` doesn't reliably hit DB's same-origin same-scope DOM, but a manifest-registered content script does.
- **Don't rewrite `combo-import-helper.js`** (CLAUDE.md rule). Targeted edits only.

### CSS / theme
- All colors are CSS variables in `:root`. Light theme overrides them under `body[data-theme="light"]`.
- The HTML `hidden` attribute interacts badly with `display: flex` on the same element. Modal backdrop and similar need `[hidden] { display: none !important }` to respect `hidden`. (We hit this exact bug with the modal — see the fix at `.ydk-modal-backdrop[hidden]` rule.)
- **Pill widths are fixed sizes via CSS variables**: `--pill-thumb-w-md/sm`, etc. Two sizes (md = 28×40 thumb, sm = 20×28). Every context override uses these — do not introduce bespoke pixel values.

### Browser extension lifecycle
- MV3 service workers go to sleep. The decoder injects use `chrome.scripting.executeScript` from the SW directly, but anything that requires the SW to wait for a response should explicitly handle the suspension (existing code does).
- Chrome aggressively caches MV3 SWs. After SW edits: `chrome://extensions` → **remove + re-add** the extension, not just reload. Verify via `YDK_SW_BUILD` console log.

### Storage shapes (truncated reference)

```js
// localStorage.ydk_decks
[
  {
    deckId: "deck_<timestamp>_<random>",
    name: "abid_doomz_2",
    ydkContent: "#created by ...\n#main\n14558127\n...",
    counts: { main, extra, side, total },
    main: ["14558127", ...], extra: [...], side: [...],
    source: "manual-upload" | "extension",
    notes: "",
    createdAt: ISO, updatedAt: ISO,
    _contentHash: "<length>:<first 200 chars>",  // dedup key
  }
]

// localStorage.ydk_saved_combos
[
  {
    replayId, replayUrl, comboName,
    version: 3,
    deckId: "deck_xxx",          // ← stamped on save with active deck
    userOpenerSize: 1 | 2 | "other" | undefined,  // override
    userNotes: "...",            // per-combo notes
    openingHand: [...names],
    steps: [...],
    endboard, endboardGraveyard, endboardBanished,
    isSolo, ...
  }
]

// localStorage.ydk_active_deck_id  → string deckId
// localStorage.ydk_practice_streak → { [deckId]: { hands, hits } }
// localStorage.ydk_theme           → "dark" | "light"
// localStorage.ydk_cards_view      → "compact" | "detailed"
// localStorage.ydk_combo_view_mode → "full" | "core" | "cluster" | "compact" | "diagram"
```

---

## 📁 Repo layout

```
.
├── README.md
├── HANDOFF.md                          ← this file
├── abid_doomz_1.ydk                    ← reference decks
├── abid_doomz_2.ydk
├── decoder/
│   └── ydk_decoder.html                ← single-file app, ~9000 lines
├── docs/
│   ├── CLAUDE.md                       ← AI briefing (rules, conventions)
│   ├── ROADMAP.md                      ← phased roadmap
│   ├── BUGS.md                         ← bug tracker
│   ├── DECK_CONTEXT.md                 ← DoomZ deck strategy + 6 test replay URLs
│   └── GIT_SETUP.md
├── extension/                          ← MV3 Chrome extension
│   ├── manifest.json                   ← v1.5.0
│   ├── background/service-worker.js
│   ├── content/
│   │   ├── combo-import-helper.js      ← DO NOT REWRITE
│   │   └── deck-extractor.js           ← content_script, auto-loads on DB
│   └── popup/                          ← popup.html, popup.js
├── sample-data/                        ← extracted combo JSON for testing
└── workshop/                           ← scratch space (gitignored zips)
```

---

## How to dev

1. `py -m http.server 8000` (or `python3 -m`) in repo root.
2. Open `http://localhost:8000/decoder/ydk_decoder.html`.
3. For extension changes: `chrome://extensions/` → reload (or remove+re-add for SW changes).
4. To test extension flow: open a DB replay → click extension icon → Extract → Open in Decoder. Combo lands in decoder Combos tab tagged with active deck.
5. Settings → About shows live storage stats + version. Settings → Backup downloads a single JSON of everything.

## Hard rules

- **Vanilla JS only.** No npm, no build step, no framework. Single-file HTML where possible.
- **Don't rely on file://.** YGOPRODeck API + images need a real origin (CORS).
- **Don't rewrite `combo-import-helper.js`.**
- **Don't add analytics or telemetry.** Personal tool.
- **Don't invent card text.** New BLZD cards stay flagged `VERIFY` until real data lands.
