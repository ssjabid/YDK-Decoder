# YDK Decoder — React app (`app/`)

This is the **current, active build** of YDK Decoder: a React + Vite single-page
app that rebuilds (and exceeds) the original `decoder/ydk_decoder.html`. It's a
personal Yu-Gi-Oh deck-learning + tournament-prep workbench for Abid.

> For the full architecture, conventions, and hard rules read **`../docs/CLAUDE.md`**
> and **`../HANDOFF.md`**. To hand the app to another agent for a review/level-up,
> use **`../docs/FABLE5_REVIEW_PROMPT.md`**.

## Stack
- **React 19 + Vite 8**, plain JSX (no TypeScript), plain CSS with design tokens.
- Client-only. **`localStorage` is the source of truth** — same `ydk_*` keys as
  the legacy decoder + the Chrome extension, so data and backups are shared.
- Card data from the **YGOPRODeck API** (cached in `ydk_card_cache`).
- Dependencies: just `react` / `react-dom` (+ Vite/ESLint). No UI framework, no
  state library, no CSS-in-JS — keep it that way.

## Run it
```bash
npm install
npm run dev      # Vite dev server + HMR → open the printed localhost URL
npm run build    # production build (must stay clean)
npm run lint
```
**Card images + the API need a served origin** — `file://` breaks CORS. To share
storage with the Chrome extension + legacy decoder, serve the built app from the
**same origin** they target (`localhost:8000`).

## What's in it
Four tabs + a Settings gear:
- **Decks** — deck list, decklist viewer, methodology/matchup **playbook** editor, **key-card buckets** (Boss/Starter/Extender/Handtrap/Floodgate/Tech).
- **Format** — read-only matchup **dashboard**, **side-deck planner** (named patterns, OUT/IN summary), **tournament journal**.
- **Combos** — list + image **gallery**, detail with **Line / Simulate / Drill**, a full **combo editor** (multi-deck links, step add/remove/reorder/retext, "plays through" handtrap tags).
- **Testing** — **Going first** (goldfish → playable lines, "if they have <handtrap>" filter) and **Going second** (board breaker with sided hands).

## Layout
```
src/
  App.jsx            shell + tab routing + cross-tab "Edit in Decks" jump
  tabs/              DecksTab, FormatTab, CombosTab, TestingTab, SettingsTab
  components/        Dropdown, CardPicker, CardPreview, EndBoardView, RichNotes,
                     Matchup, Icon, ModalHost, PanelSection, CardsView
  lib/               storage, combos, comboSim, deckModel, classify, cardKB,
                     cardSearch, ydk, metaPack, sidePlans, practice, backup,
                     formatIO, modal, cardFx
  styles/            tokens.css (design tokens) + app.css
```

## Don'ts (project-wide)
- Don't rename `ydk_*` keys or break the backup JSON format (shared with the other surfaces).
- Don't rewrite `../extension/content/combo-import-helper.js`.
- Don't add analytics. Don't invent card text or rulings (respect the one-EMZ rule).
- Don't add heavy dependencies or a build-time UI kit.
