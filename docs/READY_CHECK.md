# Ready-to-use check — the 5 things only you can verify

Everything else is already tested (deck import, card roles, opening odds,
combo add/edit/duplicate/delete, backup+restore, draw-a-hand, matchups, and
the whole UI — see the table in chat / `docs/UI_OVERHAUL_PLAN.md`). These 5
need **your machine, the Chrome extension, and your eyes on your own cards** —
things a sandbox can't do. ~10 minutes total.

---

### 1. Serve it the real way and open it  (~2 min)
In the repo root, in PowerShell:
```
cd app
npm run build:8000
cd ..
py -m http.server 8000
```
Open **http://localhost:8000/react/**
- [ ] The app loads, looks right, and your tabs are there.

> Why you: this is the one origin the Chrome extension shares storage with —
> my dev server isn't. Always use `localhost:8000/react/`, never `file://`.

---

### 2. Your deck has no blank cards  (~1 min)
Decks → import `abid_doomz_1.ydk` (if it isn't already there) → open it →
**Decklist — the cards**.
- [ ] Every card shows an image and a role tag. **Nothing blank or showing "?".**

> Why you: this catches any brand-new/niche card the API doesn't know yet (like
> the Power Patron name we already fixed). If one is blank, tell me its exact
> DuelingBook name and I'll add the alias.

---

### 3. The extension hands a combo off  (~3 min)  ← the big one
With the app served at `localhost:8000` (step 1): open a DuelingBook replay,
run the YDK Decoder extension, click **Extract**.
- [ ] The combo appears in the **Combos** tab.

> Why you: I can't drive Chrome + DuelingBook. This is the one integration
> that's never been tested on this build — it matters most.

---

### 4. That combo reads true  (~2 min)
Open the combo you just extracted.
- [ ] The **steps**, **opening hand**, and **end board** match what actually
  happened in the duel.

> Why you: only you know the line is correct. If a step or the board looks off,
> screenshot it and I'll fix the renderer.

---

### 5. Make one real backup  (~1 min)
Settings (gear, top-right) → **Download backup**.
- [ ] A `ydk-decoder-backup-*.json` file lands in your Downloads — **keep it.**

> Why you: it's your only copy. Your data lives in this browser; this file is
> the safety net. Do this whenever you've added combos you'd hate to lose.

---

### The payoff (not pass/fail — just go enjoy it)
Add your DoomZ combos, tag which handtraps each line plays through (Combos →
Edit), set your deck in Format, and practice in **Testing** (draw hands) or
**Combos → Drill**. If it helps you memorize the deck, it's done its job.
