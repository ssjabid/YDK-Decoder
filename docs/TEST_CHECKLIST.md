# YDK Decoder — Test Checklist

Work through this **section by section** and report results (e.g. "§3.2 broke").
Build to verify: **Settings → About → Build** should read
`2026-05-29-phase6L-backup-drill-cheatsheet` (or later) after a hard refresh.

**Setup:** `py -m http.server 8000` in the repo root → open
`http://localhost:8000/decoder/ydk_decoder.html` → **Ctrl+Shift+R** (hard refresh).
⚠ = needs the Chrome extension or live data I couldn't auto-test.

---

## §0 — First load
- [ ] 0.1 A loading screen (logo + spinner) shows briefly, then fades out.
- [ ] 0.2 Console (F12) shows the build marker line, **no red errors**.
- [ ] 0.3 If you have decks/combos/formats and haven't backed up in 7 days, an
  amber **"back up your data"** banner appears under the header.
- [ ] 0.4 The 3 tabs read **Decks · Format · Playtest** (+ ⚙ Settings).

## §1 — Card knowledge base (hover summaries)
- [ ] 1.1 Hover any DoomZ/Power-Patron card (in a combo, deck, or format) → an
  accent **"In short"** stripped summary shows *above* the full card text.
- [ ] 1.2 Hover a handtrap (Ash, Belle, Mulcharmy) → "In short" summary shows.
- [ ] 1.3 Hover the new cards (Zegredo, Vidrium, Vidria, Terminus, Graflario,
  ADRASTEIA) → real summary (no "VERIFY"/blank).
- [ ] 1.4 The summaries read correctly to you (flag any that are wrong).

## §2 — Decks tab
- [ ] 2.1 Deck list shows; clicking a tile opens its panel.
- [ ] 2.2 Methodology fields save (a "Saved" toast appears as you type).
- [ ] 2.3 **Key Ratios → ↺ Auto-fill from active build** → produces grouped
  sections (Engine — Monsters/Spells/Traps, Staples — …), not one blob.
- [ ] 2.4 Key cards bucket correctly; "+ Add card" opens the autocomplete picker.
- [ ] 2.5 Decklists: add / rename / switch / delete a build.
- [ ] 2.6 Delete a deck → combos linked to it become unassigned (no orphans),
  and any format using it as primary clears that pick.

## §3 — Combos (open from a deck → Combos ↗)
- [ ] 3.1 Combo tiles show; clicking one opens it (title matches the tile).
- [ ] 3.2 Mulligan combo: the opening hand shows the **real opener** (e.g.
  Amalthe) tagged "real opener after mulligan", and it buckets as **1-card**.
- [ ] 3.3 A green **"✓ Effect data for all N cards"** chip shows at the top
  (or amber "⚠ N need data" listing which).
- [ ] 3.4 **2d narration:** a card Elara sets from Deck reads **"Set … face-down"**,
  NOT "Equip"; ADRASTEIA from GY still reads "Equip".
- [ ] 3.5 **🎓 Drill** button → reveals the line one play at a time
  (Reveal / Hide last / Restart / Exit all work).
- [ ] 3.6 5 view modes render; drag-reorder + rename + per-combo notes work.

## §4 — Format tab
- [ ] 4.1 Create/rename/delete a format; set a primary deck.
- [ ] 4.2 Add a matchup (+ Import opponent .ydk / + Link existing).
- [ ] 4.3 Matchup card opens the drill — **7 collapsible sections**.
- [ ] 4.4 All drill sections save: chokepoints, playbook (drag-reorder steps),
  target end board, side-deck planner (drag chips), tech cards, linked combos,
  freeform notes.
- [ ] 4.5 **📄 Cheat sheet** button → opens a clean printable page in a new tab
  with the whole plan (allow pop-ups). Print looks tidy.

## §5 — Tournament journal (Format tab)
- [ ] 5.1 **+ Log a tournament** → type / venue / date → name "Type - Venue: Date".
- [ ] 5.2 **+ Add round** → guided **form** (opponent pre-picked from matchups,
  going first/second, Win/Loss/Draw, score, notes). Confirm disabled until
  opponent + result chosen.
- [ ] 5.3 The round shows in the list with its score; editing a round stays in
  the tournament view (no jump to the top of the grid).
- [ ] 5.4 The matchup card's **W-L badge** updates from logged rounds.

## §6 — Playtest tab
### Goldfish (your openers)
- [ ] 6.1 Shuffle & draw → hand shows; "possible lines" lists playable combos.
- [ ] 6.2 Consistency streak updates.
### Break boards (going 2nd) — NEW
- [ ] 6.3 Toggle to **Break boards**. Pick an opponent.
- [ ] 6.4 **+ Define their board** → add cards (autocomplete), tag each
  disruption (Negate/Removal/Floodgate/Body) + note. Make a "Full" and a
  "Half" board profile.
- [ ] 6.5 **Import from a combo's end board** populates pieces.
- [ ] 6.6 **🎲 Shuffle going 2nd** → 6-card hand; your **board breakers**
  (orange) and **handtraps** (blue) are highlighted.
- [ ] 6.7 Gauge shows "N breakers + M handtraps vs K disruptions".
- [ ] 6.8 If a matchup side plan exists, "Side plan applied" shows and the
  shuffle reflects it.
- [ ] 6.9 Self-assess **Broke it / Partial / Couldn't** → tally updates
  ("vs X: broke n/m"). Notes field works.

## §7 — Settings
- [ ] 7.1 Theme toggle (dark/light) — everything stays readable.
- [ ] 7.2 **Backup** downloads a JSON. **Restore** it back → decks, combos,
  **and formats** all come back (formats were the recent fix).
- [ ] 7.3 Danger zone: clear combos / reset cache are gated by a confirm modal.
- [ ] 7.4 About shows the build marker + storage stats.

## §8 — Global / polish
- [ ] 8.1 Tab switches feel smooth; modals fade/slide in.
- [ ] 8.2 Keyboard: Tab shows focus rings; Esc closes modals.
- [ ] 8.3 Navigate everything with the console open → **zero red errors**.

## ⚠ Needs the Chrome extension (I can't auto-test)
- [ ] E.1 Extract a replay → combo lands in the decoder, tagged to the active deck.
- [ ] E.2 Scan a DuelingBook deck page → produces a `.ydk`; importing it shows a
  proper "Main build" (not an empty Decklists section).
- [ ] E.3 Re-extract the 6 reference DoomZ combos and sanity-check narration.

---

### Known / by-design (not bugs)
- **Full vs Core views can look identical** when every step is "significant".
- **Board breaker doesn't auto-decide** if you broke the board — by design
  (it's a thinking trainer; you self-assess).
- **DuelingBook ↔ official card names differ** for new Power Patron cards —
  handled by an alias map so both resolve.
