# YDK Decoder — Test & Feedback Sheet

**How to use:** for each item, tick the box (`- [x]`) if it works, and type your
result on the `> Feedback:` line under it. Use the legend. Then paste a section
(or the whole thing) back to me and we'll fix/build from there.

**Legend — put one at the start of your feedback line:**
`✅ works` · `❌ broken` · `⚠ works-but-odd` · `💡 idea/change` · `⏭ skipped`

**Setup:** run `py -m http.server 8000` in the repo root → open
`http://localhost:8000/decoder/ydk_decoder.html` → **Ctrl+Shift+R**.
Confirm **Settings → About → Build** = `2026-05-29-phase6M-modal-refactor` (or later).
🌐 = needs the Chrome extension (only you can test these).

> Tip: there's also a clickable version at
> `localhost:8000/docs/test-checklist.html` (auto-saves, "Copy results" button) —
> use whichever you prefer; this file is the one to write notes in.

---

## §0 — First load & global
- [ ] **0.1** Loading screen (logo + spinner) shows briefly, then fades out.
  > Feedback:
- [ ] **0.2** F12 console: build marker logs, **no red errors** on load.
  > Feedback:
- [ ] **0.3** Tabs read **Decks · Format · Playtest** + ⚙.
  > Feedback:
- [ ] **0.4** Switching tabs feels smooth; modals fade/slide in.
  > Feedback:
- [ ] **0.5** Backup nudge: if you have data and haven't backed up in a while, an amber banner shows; "Remind me tomorrow" hides it for the day.
  > Feedback:

## §1 — Card hover summaries (knowledge base)
- [ ] **1.1** Hover a core DoomZ card (Amalthe/Elara/Drastea) → accent **"In short"** summary appears *above* the full text.
  > Feedback:
- [ ] **1.2** Hover a handtrap (Ash / Ghost Belle / Mulcharmy) → "In short" summary.
  > Feedback:
- [ ] **1.3** Hover the newer cards (Zegredo, Vidrium, Vidria, Terminus, Graflario, ADRASTEIA) → real summary, no "VERIFY"/blank.
  > Feedback:
- [ ] **1.4** Read 4–5 summaries — are they **accurate**? (flag any that are wrong)
  > Feedback:

## §2 — Decks tab
- [ ] **2.1** Deck list shows on the left; clicking a tile opens its panel.
  > Feedback:
- [ ] **2.2** Edit a Methodology field → a "Saved" toast appears (bottom-right).
  > Feedback:
- [ ] **2.3** Key Ratios → **↺ Auto-fill from active build** → output is **grouped** (Engine — Monsters/Spells/Traps, Staples — …), not one run-on blob.
  > Feedback:
- [ ] **2.4** Key cards bucket correctly; **+ Add card** opens the search-with-art picker.
  > Feedback:
- [ ] **2.5** Decklists: add a build, rename it, set active, delete it.
  > Feedback:
- [ ] **2.6** Delete a deck (confirm) → its combos become unassigned, and a format using it as primary clears that pick (no leftovers).
  > Feedback:
- [ ] **2.7** Rename a deck → the header switcher updates too.
  > Feedback:

## §3 — Combos (open a deck → Combos ↗)
- [ ] **3.1** Combo tiles show; clicking one opens it and the **title matches the tile**.
  > Feedback:
- [ ] **3.2** A mulligan combo shows the **real opener** (e.g. Amalthe) tagged "real opener after mulligan", and sits in the **1-card** bucket.
  > Feedback:
- [ ] **3.3** A green **"✓ Effect data for all N cards"** chip shows at the top (or amber "⚠ N need data" listing which).
  > Feedback:
- [ ] **3.4** A card Elara sets from Deck reads **"Set … face-down"**, NOT "Equip". ADRASTEIA from GY still reads "Equip".
  > Feedback:
- [ ] **3.5** **🎓 Drill** → opener shows, then "Reveal play 1 of N" reveals the line one step at a time. Hide-last / Restart / Exit all work.
  > Feedback:
- [ ] **3.6** The 5 view modes (Full/Core/Cluster/Compact/Diagram) all render.
  > Feedback:
- [ ] **3.7** Drag-reorder a tile across buckets; rename a combo title; per-combo notes save.
  > Feedback:
- [ ] **3.8** Search box filters combos by card/title/note.
  > Feedback:

## §4 — Format tab
- [ ] **4.1** Create / rename / delete a format; set a primary deck.
  > Feedback:
- [ ] **4.2** Add a matchup via **+ Import opponent .ydk** and via **+ Link existing**.
  > Feedback:
- [ ] **4.3** Click a matchup card → drill opens with **7 collapsible sections**.
  > Feedback:
- [ ] **4.4** Chokepoints + freeform notes save.
  > Feedback:
- [ ] **4.5** Playbook: add steps, drag to reorder, delete.
  > Feedback:
- [ ] **4.6** Target end board: add/remove card chips.
  > Feedback:
- [ ] **4.7** Side-deck planner: drag chips in/out (or +); counter balances; can't exceed copies.
  > Feedback:
- [ ] **4.8** Tech & counter cards: add good/bad cards with notes.
  > Feedback:
- [ ] **4.9** Linked combos: tick combos that solve this matchup.
  > Feedback:
- [ ] **4.10** **📄 Cheat sheet** opens a clean printable page in a new tab (allow pop-ups); content is complete and prints tidily.
  > Feedback:

## §5 — Tournament journal (Format tab)
- [ ] **5.1** **+ Log a tournament** → pick type → venue → date → name reads "Type - Venue: Date".
  > Feedback:
- [ ] **5.2** **+ Add round** → guided form: opponent pre-picked from matchups, going first/second, Win/Loss/Draw, score, notes. "Add round" stays disabled until opponent + result chosen.
  > Feedback:
- [ ] **5.3** Saved round shows in the list with its score; editing a round keeps you in the tournament view (no jump to the top of the grid).
  > Feedback:
- [ ] **5.4** The matchup card's **W-L badge** reflects logged rounds.
  > Feedback:

## §6 — Playtest tab
### Goldfish (your openers)
- [ ] **6.1** Shuffle & draw → hand shows; "possible lines" lists playable combos.
  > Feedback:
- [ ] **6.2** Consistency streak updates over several shuffles.
  > Feedback:
### Break boards (going 2nd) — NEW
- [ ] **6.3** Toggle to **Break boards**; pick an opponent.
  > Feedback:
- [ ] **6.4** **+ Define their board** → add cards (search picker), tag each disruption (Negate/Removal/Floodgate/Body) + note. Make a **Full** and a **Half** profile.
  > Feedback:
- [ ] **6.5** **Import from a combo's end board** populates pieces.
  > Feedback:
- [ ] **6.6** **🎲 Shuffle going 2nd** → 6-card hand; **board breakers** (orange) and **handtraps** (blue) are highlighted.
  > Feedback:
- [ ] **6.7** Gauge shows "N breakers + M handtraps vs K disruptions".
  > Feedback:
- [ ] **6.8** If a matchup side plan exists, "Side plan applied" shows and the shuffle reflects it.
  > Feedback:
- [ ] **6.9** Self-assess **Broke it / Partial / Couldn't** → tally updates ("vs X: broke n/m"); notes field works.
  > Feedback:
- [ ] **6.10** Overall: is this useful for practice? Anything you'd change?
  > Feedback:

## §7 — Settings
- [ ] **7.1** Theme toggle (dark/light) — everything stays readable.
  > Feedback:
- [ ] **7.2** **Backup** downloads a JSON.
  > Feedback:
- [ ] **7.3** **Restore** that file (after clearing, or on another browser) → decks, combos, **and formats** all return.
  > Feedback:
- [ ] **7.4** Danger zone (clear combos / reset cache) gated by a confirm modal.
  > Feedback:
- [ ] **7.5** About shows the build marker + storage stats.
  > Feedback:

## §8 — Edge cases / polish
- [ ] **8.1** Keyboard: Tab shows focus rings; Esc closes modals; Enter confirms where sensible.
  > Feedback:
- [ ] **8.2** Resize the window narrower — note where layout breaks (mobile is known-weak).
  > Feedback:
- [ ] **8.3** Navigate the whole app with console open → **zero red errors**.
  > Feedback:
- [ ] **8.4** Anything that feels slow / janky with your real data volume.
  > Feedback:

## §9 — 🌐 Chrome extension (only you can test)
- [ ] **9.1** Extract a DuelingBook replay → combo lands in the decoder, tagged to the active deck.
  > Feedback:
- [ ] **9.2** Scan a DuelingBook deck page → `.ydk`; importing it shows a proper "Main build" (not an empty Decklists section).
  > Feedback:
- [ ] **9.3** Re-extract the 6 reference DoomZ combos — narration/board sensible?
  > Feedback:

---

## Anything else (open feedback)
Bugs, ideas, "wouldn't it be nice if…", things to build next:

-
-
-
