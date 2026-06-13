> **⚠️ Superseded 2026-06-13 → use [`READY_CHECK.md`](READY_CHECK.md).** That's the
> current 5-item list (UI overhaul P1–P6 done; functional machinery re-verified
> live on the real DoomZ deck). This file is kept for history.

# Go-live checklist — trimmed to what matters before you bulk-enter data

Goal of this pass: get you confident enough to **add all your DoomZ combos** and
**do your format/matchup analysis** without fear of losing work or hitting a wall.

I already ran the full A–I + combos checklists live (in a sandbox) and fixed the
2 bugs I found. So this list **skips the mechanics I proved** and keeps only the
things that depend on **your** real decks + **your** browser, plus the two
workflows you're about to live in.

---

## ✅ Already verified — you don't need to re-test these
Custom dropdowns + scroll-stays-open, grouped deck pickers, Settings gear +
centering, deck-scoped vs global card pickers, hover/pin previews, Format
export/import + "Add from library" + Edit-in-Decks jump + visual side summary +
named side plans + tournament journal display, combos List/Gallery/Line/Sim/
Drill, the opener-size control, multi-deck linking, the step editor, handtrap
tagging, and the Testing "if they have…" filter. All pass.

---

## 0. Do this FIRST — data safety (2 min)
You're about to invest real hours, so prove persistence before you start.
- [ ] **0a** Open the app the **same way you always will** (same URL/port every time — bookmark it). Card **images load** (if not, you're on `file://` or the wrong origin — must be a served localhost).
- [ ] **0b** Settings (gear) → **Download backup**. Keep the file.
- [ ] **0c** Make one tiny edit (rename a deck or add a combo), **reload**, confirm it's still there. If yes, persistence works — proceed.

---

## 1. Adding DoomZ combos (your main task)
- [ ] **1a** Combos → **+ New combo**: name it, **link your DoomZ deck(s)**, add the opener + end-board cards, set **Opener size** to the real number → Create. It lands in the right opener-size group with the name you gave it.
- [ ] **1b** Open it → **✎ Edit**: delete any junk steps, retext a step, set **Plays through** (Droll / Imperm / Fuwalos / …) → **Save**. Then check **Simulate** and **Drill** reflect your edits.
- [ ] **1c** Testing → **Going first → Test with your DoomZ deck → Shuffle** until the opener turns up → the combo shows under **Playable lines** with its trap badges. Click **"If they have → Droll"** → it floats up / shows "Plays through Droll".
- [ ] **1d** **DuelingBook extraction:** the same-origin bridge is now built. One-time setup: in PowerShell run `cd app` then `npm run build:8000`; keep your usual `py -m http.server 8000` running; open **`http://localhost:8000/react/`** (bookmark THIS as your app from now on). Now run the Chrome extension on a replay as you always have → the combo should appear in this React app's **Combos** tab (live, without a reload, if the decoder tab received it while both were open on :8000). If it doesn't, tell me exactly what you clicked + the URLs.

## 2. Format / matchup analysis (your other task)
- [ ] **2a** Decks → a **matchup deck** → Playbook: edit **Game plan**, add **Their end boards** (from that deck's cards), add **Cards that are really good here**, write **notes** → **reload** → all still there.
- [ ] **2b** Key cards → **↻ Re-extract** → the **Boss** bucket now fills with that deck's real bosses *(this was the bug I just fixed — re-extract once per deck to refill it)*. If anything's mis-bucketed, open the card → **Category** dropdown → move it.
- [ ] **2c** Format → **pick your deck** (top bar) → open a matchup **breakdown** → **Side-deck plan → + New plan** → set the dots → the **OUT/IN summary** shows. Then Testing → **Going second** → that opponent → the plan appears in the picker and draws a **sided** hand.
- [ ] **2d** Format → **tournament journal** → log an event (name · type · date) and add a round or two → reload → it's still recorded.

---

## If anything fails
Note the number (e.g. "1d" or "2b") and what you saw — I'll fix it. Otherwise,
you're clear to start entering your DoomZ combos and matchup analysis for real.
