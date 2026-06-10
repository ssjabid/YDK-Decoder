# YDK Decoder

Personal learning tool for memorizing Yu-Gi-Oh decks and prepping for tournaments
(currently tuned for **DoomZ / Power Patron**). Strip every card to its role +
essential function, learn combos as step-by-step lines, and plan every matchup.

## The three surfaces (they share one `localStorage`)

1. **React app — `app/`** ⭐ **the current, active build.** React 19 + Vite. Four
   tabs (Decks / Format / Combos / Testing) + Settings. This is where development
   happens now.
2. **Legacy decoder — `decoder/ydk_decoder.html`.** The original single-file
   vanilla-JS app. Still works and is preserved.
3. **Chrome extension — `extension/`.** Scrapes DuelingBook **replays** into clean
   combo JSON and **deck constructor** pages into `.ydk`, then hands off to the app.

All three read/write the same `ydk_*` keys, so decks, combos, formats, and backups
carry across them — **as long as they're served from the same origin** (browser
storage is per-origin). Serve everything from `localhost:8000`.

## Quick start — the React app
```bash
cd app
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build
```
Card images + the YGOPRODeck API need a served origin (not `file://`). To share
data with the extension + legacy decoder, build the app and serve it from
`localhost:8000`.

## Quick start — legacy decoder (Windows PowerShell)
```powershell
cd "H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder"
py -m http.server 8000
# open http://localhost:8000/decoder/ydk_decoder.html
```

## Chrome extension install
1. `chrome://extensions/` → enable Developer mode.
2. "Load unpacked" → select the `extension/` folder. Pin it.
3. On a DuelingBook replay: click the icon → Extract → it pushes the combo to the app.

## Docs (start here if you're an AI agent)
1. `docs/CLAUDE.md` — architecture, conventions, hard rules.
2. `HANDOFF.md` — current-state snapshot.
3. `docs/ROADMAP.md` / `docs/BUGS.md` — backlog + known issues.
4. `docs/FABLE5_REVIEW_PROMPT.md` — a self-contained prompt to review & level-up the React app.

## Status
- ✅ React app: Decks / Format / Combos / Testing all shipped — playbooks, key-card
  buckets, side planner, tournament journal, combo editor + Simulate/Drill,
  goldfish + board-breaker, handtrap-resistance tagging, backup/restore.
- ✅ Legacy decoder + Chrome extension: preserved and working.
- 🚧 Open: serving the React build at `localhost:8000` so extension-extracted
  combos land in it directly (per-origin storage); narrow/mobile layout.
