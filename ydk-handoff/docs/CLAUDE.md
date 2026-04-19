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

## Current state

### What works
- ✅ `extension/content/combo-import-helper.js` — proven extractor (401 lines, unchanged from DuelMetrics v4.0 because it works)
- ✅ `extension/background/service-worker.js` — orchestrates extraction (clean rewrite, 290 lines)
- ✅ `extension/popup/popup.*` — URL input, progress display, Copy JSON, Open in Decoder
- ✅ Two real extractions confirmed working — see `sample-data/`
- ✅ `decoder/ydk_decoder.html` — parses .ydk, shows cards with role tags, has combo tab (currently with hand-written combos from before extractor worked)

### What's broken or incomplete
- 🚧 **Decoder doesn't yet consume the extension's output.** The extension builds `http://localhost:8000/ydk_decoder.html?combo=<base64>` but the decoder doesn't detect the URL param
- 🚧 **Endboard tracking wrong.** The extractor's `deriveEndboard()` lists every card ever summoned — doesn't track Xyz materials going underneath, doesn't handle destruction/banish. See `sample-data/elara-combo-summary.json` for the "actual" vs "naive" endboard.
- 🚧 **Images don't load without localhost.** Need server running for CORS on YGOPRODeck image CDN.
- 🚧 **Hand-written combos in decoder are inferred, not verified.** These should be deleted once real extracted combos render.
- 🚧 **New BLZD cards use placeholder passcodes** (55555555, 77777777, etc.) because real API data didn't exist when the cache was written. On localhost the real API fills these in at runtime — but for cards too new for the API, the placeholders stick.

## Key decisions made

### 1. Strip existing extension, don't rebuild
The DuelMetrics Opus 4.6 extension had 9000 lines of code. We kept only `combo-import-helper.js` + `deck-extractor.js` (~700 lines working). Deleted: live match capture, records scraper, XLSX export, 5 other files. Rationale: the extraction was solid, the downstream UX was buggy. Rebuild the UX, keep the extraction.

### 2. Handoff via URL param, not localhost sync
Chrome extension → Decoder communication is via `?combo=<base64-json>` URL parameter. Rejected: localhost POST endpoint (needs running server on unknown port), file drop (extra clicks), clipboard auto-paste (requires user gesture anyway). Copy JSON is the fallback button when URL param route fails.

### 3. Localhost over file:// for the decoder
File:// triggers CORS restrictions that break the YGOPRODeck API and images. Instructed user to run `py -m http.server 8000`. No way around this — it's a browser security thing.

### 4. One combo, one JSON. No combo library yet.
The current extension stores only the `latestCombo` in chrome.storage.local. When the user extracts another, it overwrites. Combo library (saving multiple combos, tagging, searching) is explicitly deferred — see ROADMAP.md.

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
