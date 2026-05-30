# Tournament Prep — guided run-through + test plan

This is **two things at once**:
1. A **prep routine** — follow it before locals and you'll know every meta matchup.
2. A **test plan** — each step exercises a real feature. Tick it and note anything that
   feels off, and we fix it next session.

**How to mark:** put your verdict in the `→` line after each step.
`✅ works` · `❌ broken (what happened)` · `⚠ works but weird` · `💡 idea`

> **Setup (do once):**
> 1. In a terminal in the project root: `py -m http.server 8000`
> 2. Open **http://localhost:8000/decoder/ydk_decoder.html** (NOT a `file://` path)
> 3. Build marker should read **2026-05-30-phase6O-meta-loader** (Settings → it's on `window.YDK_BUILD`).

---

## Part 1 — Load the meta pack (the new automation)

**1.1** Open **Settings (⚙) → Meta decks → ⚡ Load meta decks**. Confirm the dialog.
- Expect a toast like `Meta pack: +17 new, 0 refreshed · added "Meta - May 2026"`.
- → ______________________________________________

**1.2** Go to the **Decks** tab. You should see **17 matchup decks** (Branded / Despia, Dracotail, Mitsurugi, Maliss, Yummy, … Clown Crew). No scary "decks marked as Matchup" banner.
- → ______________________________________________

**1.3** Click any meta deck (e.g. **Branded / Despia**). The card list should fill with images + effects (hydrated from the API — needs localhost). Hover a card → preview.
- → ______________________________________________

**1.4** Click **⚡ Load meta decks again**. It should say *Refresh meta pack* and the toast should read `… 17 refreshed …` (not 17 new). Your data isn't duplicated.
- → ______________________________________________

---

## Part 2 — Set up YOUR deck

**2.1** Load your own deck (DoomZ / Kewl Tune): **Decks → + New deck** (or drop a `.ydk`), or use the deck switcher in the header. Make sure it's role **"My deck"**, not Matchup.
- → ______________________________________________

**2.2** Go to **Format** tab → the **Meta - May 2026** format → set your deck as the **primary deck** for the format.
- → ______________________________________________

---

## Part 3 — Learn each matchup (Format tab)

For each opponent you expect at locals, open its matchup card and read the pre-filled plan.
Start with the **tier-1** decks: Branded, Dracotail, Mitsurugi, Maliss, Yummy, White Forest,
Sky Striker, Fairy Tail Magistus, Radiant Typhoon.

**3.1** Open **Branded / Despia**. You should see, pre-filled:
- *How they win* + *chokepoint* ("Ash the **real** Branded Fusion…")
- *Going first* / *Going second* plans
- *Target end board* chips (Mirrorjade, Masquerade, Branded in Red, Dramaturge)
- *Counter cards* (Ash, Droll, Nibiru, Super Poly, Bystial) tagged "Good for us"
- → ______________________________________________

**3.2** Read the **chokepoint** for 3 more decks (e.g. Mitsurugi = "Droll", Maliss = "White Rabbit", Sky Striker = "Engage / Droll"). Does each make sense to you as the "what do I Ash?" answer?
- → ______________________________________________

**3.3** Add your **own note** to a matchup (freeform notes box) — type a sentence, click away, refresh the page. It should persist.
- → ______________________________________________

**3.4** Open a matchup's **📄 Cheat sheet** (button in the drill). Readable one-glance summary?
- → ______________________________________________

---

## Part 4 — Drill breaking boards (Testing → Going second)

**4.1** Go to **Testing**. Make sure your deck is the active deck (header switcher).
Click the **Going second** mode.
- → ______________________________________________

**4.2** Pick an opponent (e.g. **Mitsurugi**). Since no board is defined yet, click
**⚡ Use their typical board**. It should instantly build their end board from the matchup plan
(Murakumo, Futsu no Mitama, Great Purification…), each tagged with a disruption type.
- → ______________________________________________

**4.3** Click **🎲 Shuffle going 2nd (6)** to draw a 6-card going-second hand. Self-assess:
can your hand break that board? Use the gauge / notes. (This is practice, not an auto-solver.)
- → ______________________________________________

**4.4** Open **Edit boards** → **⚡ Pull from matchup plan** on an existing board (adds any missing
pieces). Fix any disruption tag that's wrong (e.g. set Mirrorjade to "Removal").
- → ______________________________________________

**4.5** Do this for your 3 toughest matchups. The point: rehearse the *specific* boards you'll face.
- → ______________________________________________

---

## Part 5 — Practice your own openers (Testing → Going first)

**5.1** Testing → **Going first**. Shuffle a 5-card hand from your deck.
- → ______________________________________________

**5.2** Under **Possible lines**, your saved combos should show ✓ Playable / Need 1 more / Need N.
The "Starter(s)" listed should be the real openers — **end-board pieces should NOT show as "needed"**
(this was the DoomZ Destruction bug — confirm it's gone).
- → ______________________________________________

**5.3** Check the **consistency %** at the bottom updates as you shuffle, and the **reset** button works.
- → ______________________________________________

---

## Part 6 — Log a practice event (Tournament journal)

**6.1** Format → create a **tournament** (date + type + venue → auto-named).
- → ______________________________________________

**6.2** Add a **round**: pick the opponent deck, W/L, score, a note. Save.
- → ______________________________________________

**6.3** Confirm the **per-matchup record** aggregates (e.g. "vs Branded: 1-0"). Refresh — it persists.
- → ______________________________________________

---

## Part 7 — Safety net

**7.1** Settings → **↑ Backup**. A JSON downloads. (Do this before any big experiment.)
- → ______________________________________________

**7.2** The "never backed up" nudge should stop pestering once you've backed up.
- → ______________________________________________

---

## Overall
- Biggest win this build: ______________________________________________
- Most annoying thing still: ______________________________________________
- Next things to build: ______________________________________________

> When you've filled this in, paste it back to me and I'll fix the ❌/⚠ items and build the 💡 ideas.
> The feature-by-feature checklist (`docs/TEST_CHECKLIST.md` / `docs/test-checklist.html`) is still
> there if you want the exhaustive version.
