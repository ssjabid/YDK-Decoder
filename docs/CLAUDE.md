# CLAUDE.md — AI Briefing

This file is for AI assistants (like Claude Code) working on this project. Read this entire file before making changes.

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
- Vanilla JS throughout (no framework, no build step)
- HTML files are single-file (all CSS/JS inline) where possible
- Dark mode by default — CSS custom properties in `:root` of every file
- Fixed 32px height filter pills, role-colored dots, uniform widths
- Minimal, slick, professional — no emojis in UI

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

## How to test a change to the decoder

1. Make your code change
2. Ensure server is running: `py -m http.server 8000` in the repo root
3. Open `http://localhost:8000/decoder/ydk_decoder.html`
4. Drop `.ydk` file from repo root
5. For combo rendering: append `?combo=<base64-of-sample-json>` — use one of the samples in `sample-data/`

## Critical DON'Ts

- ❌ **Don't rewrite `combo-import-helper.js`** — it solves dozens of DuelingBook DOM quirks that took many iterations to discover
- ❌ **Don't add external dependencies** — project is intentionally zero-build, zero-npm. Vanilla JS only.
- ❌ **Don't rely on file://** — always assume localhost
- ❌ **Don't invent card text** — if a card (especially BLZD set) isn't in YGOPRODeck's API yet, leave a VERIFY flag and let the user paste actual text
- ❌ **Don't add analytics / tracking** — this is a personal tool, no phoning home

## User context

- **User:** Abid (personal project, not a commercial product)
- **Environment:** Windows, uses VS Code + PowerShell, has Python installed
- **Skill level:** Can copy-paste commands, follow step-by-step, but not a developer
- **Goal:** memorize the DoomZ deck before playing locals/online events
- **Preferences** (see userPreferences in most turns): step-by-step iterative builds, test frequently, clean minimal aesthetics, dark mode by default, no corny animations, professional tone
