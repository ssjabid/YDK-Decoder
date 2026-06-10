# CLAUDE.md — AI Briefing

This file is for AI assistants (like Claude Code) working on this project. Read this entire file before making changes.

---

## ⚡ CURRENT BUILD (read this first — updated 2026-06)

**The active app is now a React + Vite SPA in `app/`** — not the legacy HTML
decoder. Most of this file below was written for the original single-file
`decoder/ydk_decoder.html` and is kept for history + domain rules; where it says
"vanilla JS, no build step", that describes the **legacy decoder**, which still
exists and is preserved. New work happens in `app/`.

- **`app/`** — React 19 + Vite 8, plain JSX (no TypeScript), plain CSS with design
  tokens (`src/styles/tokens.css` + `app.css`). Client-only. Run with `cd app &&
  npm run dev`; build with `npm run build`. Deps are only `react`/`react-dom`.
- **Tabs:** Decks / Format / Combos / Testing, plus a Settings gear. (Cards is a
  sub-view inside Decks.)
- **Shared storage:** the React app uses the **same `ydk_*` localStorage keys** and
  the **same backup JSON format** as the legacy decoder + extension (see
  `app/src/lib/storage.js`). Do NOT rename those keys. Storage is per-origin, so
  the React app only sees extension-extracted combos when served from the same
  origin the extension targets (`localhost:8000`).
- **Still true and still preserved:** `decoder/ydk_decoder.html` (legacy app) and
  the whole `extension/` (especially `combo-import-helper.js` — do not rewrite).
- The **Yu-Gi-Oh domain rules, role taxonomy, naming, and DON'Ts** in this file
  still apply to the React app.

➡ For the React app's own readme see `app/README.md`. For a full-feature
review/level-up prompt see `docs/FABLE5_REVIEW_PROMPT.md`.

---

## Project summary

**Goal:** Personal tool for Abid to memorize Yu-Gi-Oh decks (focus: DoomZ / Power Patron).
**Approach:** Strip every card to its essential role + function. Show meta combos step-by-step.

**Core insight:** Abid struggles to memorize 40+ cards of text. Role-based tagging (Starter, Extender, Searcher, etc.) + stripped effect summaries + combo flows are far easier to memorize than raw card text.

## Architecture

```
┌─────────────────────────────┐
│ Chrome Extension            │
│ (extension/)                │
│                             │
│ - Opens DuelingBook replay  │
│ - Clicks Fast Forward       │
│ - Extracts log via DOM      │
│ - Produces combo JSON       │
└──────────────┬──────────────┘
               │ URL param or clipboard
               ▼
┌─────────────────────────────┐
│ YDK Decoder (HTML/JS)       │
│ (decoder/ydk_decoder.html)  │
│                             │
│ - Parses .ydk files         │
│ - Fetches card data (API)   │
│ - Role tags + stripped fx   │
│ - Renders combo lines       │
└─────────────────────────────┘
```

**Why this split:**
- DuelingBook replays are JS-rendered — only accessible to code running IN a Chrome tab on duelingbook.com
- Decoder is static HTML — needs localhost (`py -m http.server 8000`) for API/image access
- Extension does the hard scraping, Decoder does the beautiful rendering

## Current state (refreshed 2026-05-19)

> **The decoder is now a full deck-+-format-+-matchup planning workbench**, not
> just a combo viewer. The "what's broken" list below is small and specific —
> the big architectural items that used to be here are all shipped. For the
> blow-by-blow of every feature, read `HANDOFF.md` (the canonical snapshot) and
> `docs/ROADMAP.md` (the queue).

### What works (the short version — see HANDOFF.md for the full list)
- ✅ **Extension → decoder handoff** — replay JSON flows via `?combo=<base64>` URL param AND direct `chrome.scripting.executeScript` injection into the decoder tab's `localStorage`. Combos auto-tag with the active `deckId`.
- ✅ **`combo-import-helper.js`** — proven replay extractor (unchanged from DuelMetrics v4.0). **Do not rewrite.**
- ✅ **`deck-extractor.js`** — content script that scrapes a DB deck-constructor page into a `.ydk`.
- ✅ **Field-state simulator** (`simulateCombo()`) — replaced the naive endboard; tracks Xyz materials underneath, equips, Pendulum scales, banish/GY moves. Hand-written combos are **deleted**.
- ✅ **Decoder rendering** — role tags, stripped effects, hover previews, 5 combo view modes, per-phase mini playmat, end-board playmat, disruption analysis.
- ✅ **Three top-level tabs: Decks / Format / Practice** (+ Settings gear). Cards & Combos are sub-views reached from the Decks panel (Phase 6A restructure).
- ✅ **Format Planner** (phases 1–6F) — methodology editor, key-card buckets, multi-decklist builds, matchups with side-deck planner / chokepoints / priority playbook / target end board / tech cards / linked combos, tournament journal with W-L aggregation.
- ✅ **Rich-text notes everywhere** (contenteditable + `@cardname` mentions with hover preview) — Phase 6B.
- ✅ **Schema v1→v2 migration** with one-time backup; localStorage is the source of truth; full Settings → Backup/Restore.
- ✅ Visual refresh (Phase 6E) + archetype/type grouping for Key Ratios + sideboard pools (Phase 6F).

### What's broken or incomplete (current, small)
- 🚧 **N1.5 end-to-end test not done.** The 6 reference DoomZ combos (`docs/DECK_CONTEXT.md`) haven't been re-extracted against the current build. Needs Abid physically driving the Chrome extension.
- 🚧 **Phase 6E + 6F verification pending.** Abid has a test checklist to run (visual refresh, matchup collapsibles, save toast, Key Ratios grouping, sideboard ordering). Fix whatever fails.
- 🚧 **Images / API need localhost.** `py -m http.server 8000` is mandatory; CORS blocks YGOPRODeck on `file://`. Inline cache still works offline.
- 🚧 **New BLZD cards use placeholder passcodes** (55555555, 77777777, …) because real API data didn't exist when the cache was written. On localhost the real API fills these at runtime — but cards too new for the API keep the placeholders (Bug 4 / ROADMAP B3.3).
- 🚧 **Trap-Equip variant** (DoomZ Destruction GY-trigger equips from deck) isn't always captured — DB sometimes omits the equip event (see BUGS.md Bug 8 notes).
- 🚧 **Mobile / narrow-viewport layout** breaks below ~800px (ROADMAP B3.1).

## Key decisions made

### 1. Strip existing extension, don't rebuild
The DuelMetrics Opus 4.6 extension had 9000 lines of code. We kept only `combo-import-helper.js` + `deck-extractor.js` (~700 lines working). Deleted: live match capture, records scraper, XLSX export, 5 other files. Rationale: the extraction was solid, the downstream UX was buggy. Rebuild the UX, keep the extraction.

### 2. Handoff via URL param, not localhost sync
Chrome extension → Decoder communication is via `?combo=<base64-json>` URL parameter. Rejected: localhost POST endpoint (needs running server on unknown port), file drop (extra clicks), clipboard auto-paste (requires user gesture anyway). Copy JSON is the fallback button when URL param route fails.

### 3. Localhost over file:// for the decoder
File:// triggers CORS restrictions that break the YGOPRODeck API and images. Instructed user to run `py -m http.server 8000`. No way around this — it's a browser security thing.

### 4. Combo library shipped (this decision is now historical)
Originally the extension stored only `latestCombo` and the decoder had no library. **That's no longer true.** The decoder now persists every combo to `localStorage.ydk_saved_combos` (dedupe by `replayId`), groups them by opener size, supports drag-reorder, rename, per-combo notes, search, and linking combos to the matchups they solve. Combos auto-tag with the active `deckId`. The extension still hands off one combo at a time; the decoder accumulates them.

## Conventions

### Code style
- **React app (`app/`, current):** React 19 + Vite, plain JSX (no TypeScript),
  plain CSS with design tokens. Dependencies stay minimal (`react`/`react-dom`
  only) — no UI framework, state library, or CSS-in-JS.
- **Legacy decoder (`decoder/`):** vanilla JS, single-file HTML (all CSS/JS
  inline), no build step. Preserved as-is.
- Dark mode by default — CSS custom properties / design tokens.
- Fixed-height filter pills, role-colored dots, uniform widths.
- Minimal, slick, professional — no emojis as UI, no gratuitous motion (honor
  `prefers-reduced-motion`).

### Naming
- DoomZ card names use exact DuelingBook strings including quotes: `DoomZ Command "A.D.R.A.S.T.E.I.A."` with the literal quote marks and periods
- File names: kebab-case (`ydk-decoder.html`, `combo-import-helper.js`)
- JS functions: camelCase

### Card role taxonomy (used for tagging)
```
Starter       — 1-card combo starter (e.g., Medius, Amalthe Normal)
Extender      — adds bodies to field (e.g., Drastea, Amalthe's 2nd effect)
Searcher      — adds from deck to hand (e.g., Amalthe, Terminus, Sargas)
Handtrap      — Quick Effect on opp's turn from hand (e.g., Ash, Belle, Droll)
Combo piece   — part of the combo but not standalone (e.g., Power Patron, Drastea)
Boss          — end-board negate/removal threat (e.g., Drastrius, Diactorus)
Board breaker — destroys opp cards (e.g., Graflario, Feather Duster)
Floodgate     — stops opp from doing things (e.g., Destruction)
Tech          — flex slot / specific matchups (e.g., CBTG, TTT)
Equip         — Equip Spell (e.g., DOOMDURG, ADRASTEIA)
Engine        — multi-card package (e.g., Branded via Fallen & Virtuous)
Stopper       — hard negate (e.g., Solemn Judgment, Warning)
Pendulum      — Pendulum mechanic (e.g., Zegredo scale 1, Vidrium R12 scale)
Finisher      — closes the game (e.g., Jupiter, Varudras)
```

A card can have multiple roles. Amalthe is Starter + Searcher + Extender.

## How to test a change to the extension

1. Make your code change
2. Go to `chrome://extensions/`
3. Click the refresh icon on the YDK Decoder card
4. Click the extension icon in toolbar
5. Paste a DuelingBook replay URL (see DECK_CONTEXT.md for the 6 test URLs)
6. Click Extract
7. Watch console (right-click icon → Inspect popup)
8. Check `sample-data/` — extractions should still produce consistent structured output

## How to test a change to the React app (`app/`, current)

1. Make your code change.
2. `cd app && npm run dev` — Vite serves with HMR; open the printed localhost URL.
3. `npm run build` must stay clean; `npm run lint` for hygiene.
4. **Verify in the browser, not just the build** — drive the actual UI (Decks →
   "Load meta decks", add/edit a combo, draw a hand in Testing), watch the
   console for errors, and confirm changes persist across a reload.
5. To share data with the extension + legacy decoder, serve the built app from
   the **same origin** (`localhost:8000`) — storage is per-origin.

## How to test a change to the decoder (legacy)

1. Make your code change
2. Ensure server is running: `py -m http.server 8000` in the repo root
3. Open `http://localhost:8000/decoder/ydk_decoder.html`
4. Drop `.ydk` file from repo root
5. For combo rendering: append `?combo=<base64-of-sample-json>` — use one of the samples in `sample-data/`

## Critical DON'Ts

- ❌ **Don't rewrite `combo-import-helper.js`** — it solves dozens of DuelingBook DOM quirks that took many iterations to discover
- ❌ **Don't rename `ydk_*` localStorage keys or break the backup JSON format** — they're shared across the React app, the legacy decoder, and the extension
- ❌ **Don't add heavy dependencies to the React app** — keep it `react`/`react-dom` only; no UI framework, state library, or CSS-in-JS. (The *legacy decoder* stays zero-build vanilla JS.)
- ❌ **Don't rely on file://** — always assume a served localhost (API + images need a real origin)
- ❌ **Don't invent card text or rulings** — if a card isn't in YGOPRODeck's API yet, leave it flagged; respect real rules (e.g. the one-Extra-Monster-Zone rule unless Extra Linked)
- ❌ **Don't add analytics / tracking** — this is a personal tool, no phoning home
- ❌ **Don't break or delete the legacy decoder / extension** — they're preserved on purpose

## User context

- **User:** Abid (personal project, not a commercial product)
- **Environment:** Windows, uses VS Code + PowerShell, has Python installed
- **Skill level:** Can copy-paste commands, follow step-by-step, but not a developer
- **Goal:** memorize the DoomZ deck before playing locals/online events
- **Preferences** (see userPreferences in most turns): step-by-step iterative builds, test frequently, clean minimal aesthetics, dark mode by default, no corny animations, professional tone
