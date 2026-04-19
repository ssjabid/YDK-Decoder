# ROADMAP

Prioritized. Work top to bottom. Each item has acceptance criteria.

---

## P0 — Make the extension-to-decoder handoff actually work

### P0.1 — Decoder auto-loads combo from URL param

**Problem:** Extension builds `http://localhost:8000/decoder/ydk_decoder.html?combo=<base64>` but decoder doesn't detect or render it.

**Fix:**
1. On decoder page load, check `window.location.search` for `?combo=...`
2. If present: base64-decode → JSON.parse → render in Combos tab
3. Switch active tab to Combos automatically
4. Save combo to `localStorage` under key `ydk_saved_combos` (array of combo objects)
5. Show toast/banner: "Combo loaded: {comboName}"

**Acceptance:** Paste this into the URL bar with server running:
```
http://localhost:8000/decoder/ydk_decoder.html?combo=<base64_of_sample-data/amalthe-combo.json>
```
→ Combos tab opens with the Amalthe combo rendered.

### P0.2 — Render real extracted combos beautifully

**Problem:** Decoder's Combos tab has hand-written fake combos. Real data from extractor has different structure (81 steps with timestamps, exact card names, Xyz material stacking).

**Fix:**
1. Delete the hand-written `COMBOS` array in decoder
2. Build new combo renderer that takes the extension's output format and renders:
   - Combo header with name, replay URL link, timestamp, step count
   - Opening hand with card images (if `openingHand` non-empty)
   - Steps grouped by "phase" — detect phase breaks by timestamp gaps > 10 seconds OR by major actions (summon, Xyz Summon)
   - Each step: step number, timestamp, action type chip, card(s) involved with tiny images, cleaned detail text
   - Endboard section (but see P0.3 — fix endboard first)
3. Each card reference should hover-preview the full card image + effect text (already works for .ydk cards, extend to combo steps)

**Acceptance:** Loading the Amalthe sample shows all 81 steps readable, grouped logically, with card images.

### P0.3 — Fix endboard tracking

**Problem:** Current `deriveEndboard()` in `service-worker.js` lists every summoned card. Doesn't track:
- Cards going underneath as Xyz material (should NOT be on endboard)
- Xyz evolution (Drastrius → Graflario = Drastrius goes to material stack, Graflario is visible)
- Materials detached (go to GY, remove from field)
- Destruction/banish (remove from field)

**Fix:** Replace `deriveEndboard()` with proper field-state tracker:
```js
// Pseudo-code
let field = []; // { card, position, materials: [], isXyz: bool }
for (step of steps) {
  switch (step.action) {
    case 'Normal Summon':
    case 'Special Summon':
      if (step.detail.includes('onto')) {
        // Xyz Summon: find target, push old card into materials
        const target = findFieldCardByName(step.cards[1]);
        const newCard = { name: step.cards[0], materials: [target, ...target.materials] };
        field = field.filter(c => c !== target);
        field.push(newCard);
      } else {
        field.push({ name: step.cards[0], materials: [] });
      }
      break;
    case 'Overlay':
      // Xyz materials attached
      ...
    case 'Destroy':
    case 'Send to GY':
    case 'Banish':
    case 'Tribute':
      field = field.filter(c => c.name !== step.cards[0]);
      break;
    case 'Detach':
      // Remove material from top card
      const topCard = field.find(c => c.name === step.cards[1]);
      if (topCard) topCard.materials = topCard.materials.filter(m => m.name !== step.cards[0]);
      break;
    case 'Set':
      field.push({ name: step.cards[0], isSet: true });
      break;
    case 'Return':
      if (step.detail.includes('to Extra Deck') || step.detail.includes('to hand')) {
        field = field.filter(c => c.name !== step.cards[0]);
      }
      break;
  }
}
return field;
```

**Acceptance:** Elara sample endboard returns: Varudras (with 2 Zegredo materials), Sargas (with Merrymaker+Amalthe materials), Therion Regulus, Drastrius (with Drastea material), Vidria Field Spell. NOT: Amalthe, Merrymaker, Drastea (which are all materials now).

---

## P1 — Build the combo library

### P1.1 — Multiple combos saved, picker UI

**Problem:** Currently extension overwrites `latestCombo` each extraction. No way to save multiple combos and compare.

**Fix:**
1. In decoder, `localStorage.ydk_saved_combos` is array of combo objects (already designed in P0.1)
2. Combos tab has sidebar listing saved combos (name, replay ID, timestamp)
3. Click a combo → main panel renders it
4. Delete button per combo
5. Export/Import all combos as JSON file

**Acceptance:** User extracts all 6 combos from `DECK_CONTEXT.md`, sees all 6 in sidebar, can click between them.

### P1.2 — Combo tagging + filtering

**Problem:** 6+ combos quickly becomes unwieldy.

**Fix:**
- Auto-tag combos by category (Amalthe, Elara, Change, Raiders, Terminus) based on starting card
- Filter bar like the Cards tab
- Search box (filter by card name in steps)

---

## P2 — Decoder polish

### P2.1 — Remove hand-written combos
Delete `COMBOS` array. All combos come from extension now.

### P2.2 — Clean up BLZD placeholder passcodes
Card IDs like 55555555, 77777777 were placeholders. When user pastes verified YGOPRODeck URLs or real card data for these, replace in `INLINE_CACHE`.

### P2.3 — Hand-tune card labels based on real combo data
Looking at the two extractions, update `CARD_OVERRIDES`:
- Sargas plays a huge role (Rank 4 evolution from Merrymaker, searches Therion) — needs proper role tagging
- Therion Regulus — hand SS + Beast-focused tech
- Dimension Shifter (seen in Elara opening hand) — Handtrap role
- Varudras — add to Extra deck listing with Finisher role

### P2.4 — Image fallback on file://
Current fallback only shows card name text. Could use base64-encoded tiny placeholder images so file:// mode still looks decent.

---

## P3 — Extension improvements

### P3.1 — Handle Solo Mode mulligan properly
Amalthe replay had 5 cards drawn then returned (Solo Mode "shuffle hand" feature). Extractor's opening hand detector got confused and returned empty array.

**Fix:** After detecting a sequence of N draws followed by N returns (same cards), snapshot the hand state AFTER returns complete.

### P3.2 — Draw action should populate cards array
Amalthe extraction had `"Drew \"DoomZ Destruction\""` but `cards: null`. Elara extraction had this fixed (`cards: ["DoomZ Destruction"]`). Investigate why one worked and not the other — probably font.card_hover present in one replay but not other due to replay speed.

### P3.3 — Batch import
Instead of one URL at a time, paste all 6 URLs → extension extracts sequentially.

### P3.4 — Deck extractor
`extension/content/deck-extractor.js` is included but not wired into the popup. Add a second button: "Extract Deck from Current Tab" — runs on a DuelingBook deck constructor page, outputs `.ydk`.

---

## P4 — Nice-to-have

### P4.1 — Spaced repetition
Show a random combo's steps in order with card name hidden, user fills in what comes next. Track right/wrong. SM2 algorithm for scheduling.

### P4.2 — Multi-deck support
Not just DoomZ — let user swap between decks they own. `userPreferences.decks = [{name, ydkPath, combos}, ...]`.

### P4.3 — Opponent-turn simulator
Given an endboard, walk through what disruption tools you have vs common threats. "vs Feather Duster — chain Warning? Which?" Educational/defensive training.

### P4.4 — Mobile-friendly
Current CSS breaks below ~800px. Add responsive breakpoints or build mobile-specific view.
