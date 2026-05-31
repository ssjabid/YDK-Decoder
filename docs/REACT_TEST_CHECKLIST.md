# YDK Decoder (React build) — Step-by-step test checklist

How to run the app: from the project root, start a local server and open the
Vite dev server (the React app lives in `app/`). Use **localhost**, never
`file://` (the YGOPRODeck API + card images break on file://).

```
cd app
npm install      # first time only
npm run dev      # opens http://localhost:5173 (or similar)
```

Tick each box. "Expected" tells you what a pass looks like. If something fails,
note the step number.

---

## 0. Setup (do this first)

- [ ] **0.1** App loads with the header "YDK Decoder" and 5 tabs: **Decks · Format · Combos · Testing · ⚙ (Settings)**.
- [ ] **0.2** Decks tab → **My decks** filter is empty (you have 18 matchup decks, no primary deck yet). This is expected.
- [ ] **0.3** Click **Import your deck (.ydk)** and load your **DoomZ** list. Expected: it appears under **My decks**, shows m/e/s counts.
- [ ] **0.4** Go to **Format** → top-right **"Your deck"** dropdown → pick your DoomZ deck. (Powers the side-deck planner + Testing.)

---

## 1. Reusable dropdowns + previews (cross-cutting)

- [ ] **1.1** Every dropdown (format picker, "Your deck", tier, opponent, opener size, deck link, etc.) is the **dark custom dropdown**, not a grey OS one. Opening one shows a dark rounded popover with a checkmark on the selected row.
- [ ] **1.2** Open a dropdown, then click elsewhere → it closes. Press Esc with it open → it closes.
- [ ] **1.3** Anywhere you see a card: **hover** shows the big preview; **click** pins it; **click outside** the preview closes it.
- [ ] **1.4** Scrollbars (e.g. the side-deck list) are slim + dark, not the grey OS bar.

---

## 2. Decks tab

- [ ] **2.1** Sidebar has **My decks / Matchup decks**. Switching filters the list. Active deck has a clear highlight.
- [ ] **2.2** Open a deck → sections: **Decklist · Methodology · (Playbook, matchup decks only) · Key cards · Builds · Notes · Combos**.
- [ ] **2.3** Decklist shows cards grouped (Monsters/Spells/Traps + Extra/Side) with role stripes; hover a card → preview.
- [ ] **2.4** Methodology fields (Summary / How it wins / Weaknesses / etc.) save as you type; reload → text persists.
- [ ] **2.5** Key cards → **Extract** buckets the build; each card shows a mini coloured card; the **Stop priority** picker is the custom dropdown.
- [ ] **2.6** Click the deck title → rename works. **↻ → My deck / → Matchup** reclassifies. **× Delete** asks to confirm (styled modal).

### 2b. Matchup-deck Playbook (this is what Format reads)

- [ ] **2.7** Open a **matchup** deck (e.g. Branded / Despia) → **Playbook — how to beat this deck** section is present.
- [ ] **2.8** It has **Game plan** (chokepoint / going first / going second + priority steps), **Their end boards** (with a visual playmat), **Cards that are really good here**, **Your notes / scouting**.
- [ ] **2.9** In **Their end boards**, add a card → it lands on the **playmat** in a sensible zone. Change its zone with the per-card dropdown → it moves. Only **one** monster sits in an Extra Monster Zone unless you put a second there manually.
- [ ] **2.10** Edit the chokepoint / a good card / a note → reload → it persists.

---

## 3. Format tab

- [ ] **3.1** Format bar: format picker + **New / Clone / ✎ / ×** + **Your deck** picker.
- [ ] **3.2** Matchup grid shows tiles (max 3 per row), tier-coloured, sorted by tier.
- [ ] **3.3** Click a matchup → full-screen **read-only dashboard** opens. Back button "← All matchups" returns.
- [ ] **3.4** Panels: **How they win + their line**, **Game plan**, **Their end boards** (playmat), **Cards that are really good here**, **Side-deck plan**, **Your notes** — each analysis panel shows a **"✎ Edit in Decks → \<deck\>"** hint and is **read-only** here.
- [ ] **3.5** Confirm the content matches what you typed in that deck's Playbook (step 2.8–2.10). Editing here is NOT possible — only in Decks.
- [ ] **3.6** Long text → click **⤢** on a field → it expands to a large readable overlay; click out to close.
- [ ] **3.7** **Side-deck plan** (the one interactive panel): it lists your main deck (left, "take OUT") + side deck (right, "bring IN") pulled from your chosen deck. Click the dots to side N copies (e.g. 1 of 3). Reason text on "good" side cards shows a ★. Out/in totals + balance indicator update.
- [ ] **3.8** Change the **tier** dropdown in a matchup → the tile re-colours/re-sorts when you go back.
- [ ] **3.9** **Remove matchup** asks to confirm; the deck stays in your library.

### 3b. Tournament journal

- [ ] **3.10** Below the grid → **Tournament journal** → **+ Log a new event**.
- [ ] **3.11** Pick a **type** (Locals / OTS / Regionals / OPEN / Nationals / YCS), a **date**, and **your deck** → **Create event**. Event appears with a type badge.
- [ ] **3.12** Open it → **+ Add round** → answer **"What did you play against?"** (opponent dropdown), **"Did you win?"** (Win/Loss/Draw), **"Any notes?"**. Add Round 2, 3… they number up.
- [ ] **3.13** The **Matchup record (all events)** chips update with your W-L per opponent. **× Delete event** removes it (confirm).

---

## 4. Combos tab

> If empty: **Paste JSON** a combo from `sample-data/` (e.g. `amalthe-combo.json`), or extract one with the Chrome extension on a DuelingBook replay.

- [ ] **4.1** Master list groups combos by opener size; **search** filters by combo name + card names; **deck filter** narrows to one deck.
- [ ] **4.2** Click a combo → detail shows **Line / Simulate / Drill** mode buttons.
- [ ] **4.3** **Line**: opening hand thumbnails, the step list (toggle **Full ↔ Core** — Core hides draws), the **end board on the playmat**, and **Graveyard / Banished** piles (click to expand).
- [ ] **4.4** **Simulate**: use **◀ Prev / Next ▶** or the slider. The playmat **rebuilds at each step** (cards appear as they're played, in the right zones), with narration + Hand / GY / Banished piles updating.
- [ ] **4.5** **Drill**: "You open with…", then **Reveal play N →** one at a time; finishing shows "✓ full line" + Restart.
- [ ] **4.6** **Rename** (click title), set **Deck** + **Opener size** (dropdowns), **↗ replay** opens DuelingBook, **× Delete** (confirm), and notes save.
- [ ] **4.7** Linking a combo to your deck (step 4.6) makes it show up in Testing → Going first (step 5.3).

---

## 5. Testing tab

### 5a. Going first (your openers)

- [ ] **5.1** Pick **Going first**. **Shuffle & draw 5** → a 5-card opener appears, each card **role-tagged** (Starter / Extender / Engine / Handtrap…).
- [ ] **5.2** **Hand readout**: a verdict ("a saved line opens" / "one card away" / "no saved line") + a starter/extender/handtrap tally.
- [ ] **5.3** If a saved combo matches, it appears under **Playable lines**; click **Walk the line ▸** → its core plays expand inline.
- [ ] **5.4** Shuffle several hands → the **consistency %** updates (openable / hands). **reset** clears it.

### 5b. Going second (break boards)

- [ ] **5.5** Pick **Going second**. Choose an **Opponent** (dropdown). Their end board renders on the **playmat** with a **disruption read** below (Negate / Removal / Floodgate chips).
- [ ] **5.6** If that opponent has **more than one** recorded end board, a **"Their board"** picker appears — switching changes the playmat.
- [ ] **5.7** **Shuffle 6** → your going-second hand; breakers + handtraps are tagged; the **gauge** shows breakers/handtraps vs disruptions.
- [ ] **5.8** **Game 1 / Game 2 (sided)** toggle: Game 2 is **disabled** until you set a *going-second* side plan for that matchup (Format → that matchup → Side-deck plan → Going second). Once set, switch to **Game 2** → "Shuffle 6" draws from your **post-side deck** (the OUT cards gone, IN cards possible), and a "Sided for game 2" summary shows.
- [ ] **5.9** Record **✓ Broke it / ~ Partial / ✗ Couldn't** → the per-matchup tally + break-% update.

---

## 6. Settings + data safety

- [ ] **6.1** **Your data** shows live counts (my/matchup decks, combos, formats, cached cards, storage size).
- [ ] **6.2** **Download backup** → a `ydk-decoder-backup-YYYY-MM-DD.json` saves; the status shows counts; "Last backup" updates to now.
- [ ] **6.3** **Restore (merge)** → pick that file → status reports what was added; nothing you already had is duplicated or lost.
- [ ] **6.4** **Theme** Dark/Light toggles instantly and persists on reload.
- [ ] **6.5** **Load meta decks** refreshes the opponent pack (keeps your Playbook edits + notes).
- [ ] **6.6** Danger zone: **Clear cache** (confirm) empties cached cards — they re-load as you browse. **Delete all data** requires confirm **and** typing DELETE. *(Back up first — only test this if you mean it.)*

---

## 7. Regression sweep (quick)

- [ ] **7.1** Reload the app on every tab → no blank screens, no errors (open DevTools console: should be clean).
- [ ] **7.2** No grey/native `<select>` dropdowns anywhere.
- [ ] **7.3** Card previews close when you click away (no "stuck" pinned card).
- [ ] **7.4** Edits made in Decks → Playbook appear (read-only) in Format for the same matchup.
- [ ] **7.5** A combo linked to your deck shows in Testing → Going first when its openers are in hand.
