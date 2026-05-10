# Known Bugs

Status as of **2026-04-26**. ✅ = fixed and verified. 🚧 = open / partial.
"Polish punch list" at the bottom is for small UI niggles to gather and
batch-fix during the next pass.

---

## ✅ Bug 1 — Endboard over-includes Xyz materials  (FIXED)

**Severity (was):** High
**Location:** `extension/background/service-worker.js` → `deriveEndboard()` + decoder `simulateCombo()`
**Fixed in:** P0.3 — full field-state simulator in the decoder; service worker now ships a `version: 3` payload with the raw step list, and the decoder computes the endboard locally rather than trusting a flat list of every-card-summoned.

**Verification:** Elara extraction now resolves to: Varudras (with 2× Zegredo material), Sargas (with Merrymaker + Amalthe + Elara material chain), Therion "King" Regulus, Drastrius (with Drastea material), Vidria Field Spell. Materials no longer appear as their own field pieces.

---

## ✅ Bug 2 — Opening hand empty when Solo Mode mulligan used  (FIXED)

**Severity (was):** Medium
**Location:** `extension/content/combo-import-helper.js` → `buildFinalResult()`
**Fixed in:** Targeted edit to `combo-import-helper.js`. After the Return sequence finishes, hand state is snapshotted via a `handTracker` that drops cards confirmed returned and keeps cards still present. `isSolo` flag is also set on the combo so the decoder can show a "Solo Mode" badge.

**Verification:** Amalthe extraction now reports `openingHand: [...]` with the post-mulligan 5 cards rather than `[]`.

---

## ✅ Bug 3 — Draw actions inconsistent — `cards: null`  (FIXED)

**Severity (was):** Low
**Location:** `extension/content/combo-import-helper.js`
**Fixed in:** Post-process pass — for any step with `cards: null` and `detail` matching `/^Drew [\"]?(.+?)[\"]?$/`, regex-extract the card name and populate `cards`.

**Verification:** Amalthe extraction's first 5 draws now have populated `cards` arrays.

---

## ✅ Bug 6 — Many step cards render without thumbnails  (FIXED)

**Severity (was):** Low
**Location:** `decoder/ydk_decoder.html`
**Fixed in:** Two-part:
1. Persistent card cache in `localStorage.ydk_card_cache` — every card fetched via `fetchCards()` is merged in and survives reloads, so combos extracted before the deck was uploaded still get thumbnails after the first deck load.
2. When loading a combo, the decoder kicks off a prefetch for every name appearing in `playerCards` and re-renders once data arrives.

**Verification:** All 6 combos in `sample-data/` render full thumbnails for Springans Merrymaker, Sargas, Therion Regulus, Zegredo, Varudras, Vidrium, Vidria, Terminus, Diactorus, Drastrius, Graflario after one full session.

---

## ✅ Bug 8 — Endboard misses cards in S/T zones with silent equip transitions  (FIXED, partial — see notes)

**Severity (was):** Medium
**Location:** `extension/background/service-worker.js` + decoder simulator
**Fixed in:** Three layers:
1. **Equip-spell heuristic** — when an Equip Spell name is activated from GY/banished and there's a face-up monster on field, the simulator equips it to the most recent boss and stamps `inferred: true`. The decoder shows a `(inferred)` badge on those slots.
2. **AttachMaterial event detection** — the SW now matches DB's explicit `Attached banished X to Y` lines, so the manual "attach equipped DoomZ from banish" play resolves correctly without the heuristic.
3. **Pendulum scale tracking** — `Activated X to S-1/S-5` for any card with a `scale` property is treated as a Pendulum activation; the cell is tagged `zone-p` on the playmat.

**Remaining gap:** Trap-Equip variant (DoomZ Destruction's GY-trigger fires → equips a DoomZ from deck onto an Xyz) is NOT yet handled — the field tracker sees the activation but has no event telling it which deck card got equipped. Will only show up correctly if the DB log explicitly emits the equip event, which it sometimes does and sometimes doesn't.

**Workaround for now:** option 4 from the original bug entry (manual edit pencil per combo) is queued in ROADMAP.md as B3.4.

---

## ✅ cloneState dropped the `zone` property  (FIXED — diagnostic story worth keeping)

**Severity:** High at the time — caused every snapshot in every view mode to render with `zone: undefined`, dumping every card into the orphans pile.
**Location:** `decoder/ydk_decoder.html` → `cloneState()`
**Fixed by:** Adding `zone: slot.zone` to the field-slot copy. The simulator was setting zones in `applyStepToState`, but the per-step state snapshot only copied 5 of the 6 properties.
**How it was found:** runtime inspection via `_lastSim.stateAfter.field` showed every entry's zone as undefined.

---

## ✅ Move detection missing  (FIXED)

**Symptom:** Sargas + Therion both ended up at M-1 because the SW didn't recognize `Moved X from M-1 to M-2`. Fix: added Move detection to `detectAction` and a Move handler to the simulator.

---

## ✅ Set-from-GY left card stuck in GY  (FIXED)

**Symptom:** Graflario showed in both `field` and `gy` after `Placed Graflario from GY to S-2`. The Set handler only popped from hand. Fix: also drains from gy/banished when sourced from there.

---

## ✅ Phase boundaries / "Vidria suddenly in hand" mystery  (FIXED)

**Symptom:** Mid-combo, Vidria appeared in hand with no draw step. Cause: Core filter was hiding `Send-from-Deck-to-GY` (mill) and `Return-from-GY-to-hand` (recovery) lines, so the state line jumped without explanation. Fix: relaxed the core filter to include those, and added a "Hand at end" pile per phase so the user sees the state, not just the action.

---

## ✅ Duplicate Set bullets  (FIXED)

**Symptom:** v3 extraction emits both `Placed X from Deck to S-3` AND `Set X in S-3` for the same card. Fix: `filterPhaseBullets` dedupes consecutive same-action+same-card events.

---

## ✅ Cause annotation never fired  (FIXED)

**Symptom:** `via X's effect` annotation was supposed to stamp outcomes with their trigger. It was missing because `filterPhaseBullets` removed `Declared effect of X` lines BEFORE `renderPhaseBullets` could see them. Fix: do the annotation INSIDE `filterPhaseBullets` and stamp each outcome with `_viaTrigger`.

---

## ✅ Card pill sizing inconsistent across the UI  (FIXED 2026-04-26)

**Severity:** Medium-High — visually jarring across phase bullets, mini playmat, end board, step rows, etc.
**Location:** `decoder/ydk_decoder.html` (CSS only)
**Fixed by:** Unified pill-size system in `:root`. Two CSS variable groups (`--pill-*-md` and `--pill-*-sm`) drive every card pill. Every context override (`.field-grid-cell .step-card`, `.field-grid-mini .step-card`, `.phase-bullet-pills .step-card`, `.phase-bullet-compact .step-card`, `.step-state-row .step-card`) now resolves to one of those two sizes — no bespoke pixel values left. The mini playmat is tagged `.is-sm-pills` in JS so its pills inherit the small variant via parent selector.

**Verification:** Every `mini-thumb` width/height in the stylesheet now references `var(--pill-thumb-w-*)` / `var(--pill-thumb-h-*)`. `grep mini-thumb` returns only the unified rules.

---

## 🚧 Bug 4 — Decoder shows "VERIFY" flags for placeholder-passcode cards  (PARTIAL)

**Severity:** Low — aesthetic
**Location:** `decoder/ydk_decoder.html`
**Status:** Persistent cache (Bug 6 fix) means once YGOPRODeck has the real ID, fetched data overrides. But cards too new for the API still have placeholder IDs (55555555 etc.) and stay flagged. Tracked as ROADMAP B3.3.

**Cards still on placeholder IDs:** Graflario, DoomZ Change, A.D.R.A.S.T.E.I.A., Zegredo, Vidrium, Vidria, Terminus, The Fallen & The Virtuous, Varudras. Re-check YGOPRODeck periodically.

---

## 🚧 Bug 5 — Terminal 404s on favicon and devtools  (HARMLESS, deferred)

```
::1 - - "GET /favicon.ico HTTP/1.1" 404 -
::1 - - "GET /.well-known/appspecific/com.chrome.devtools.json HTTP/1.1" 404 -
```
**Fix when bored:** add `<link rel="icon" href="data:,">` to suppress favicon. DevTools self-registration 404 is harmless.

---

## 🚧 Bug 7 — Polish punch list (gather during N1 testing)

This is the bucket for small UI niggles found during Abid's end-to-end pass with the real `.ydk` and the 6 reference combos. Each item gets enumerated here as found and crossed off as fixed.

**Already known candidates:**
- Hover preview position when a combo card is near the right edge (preview can clip off-screen)
- Action chip color uniformity — currently all accent orange, could color-code by action class (Summon vs Activate vs Set)
- Step number alignment when n > 99
- Phase grouping edge cases when DB log has unusually long pauses inside a single play

**Found during N1:** _(empty — fill as testing reveals issues)_

---

## Edge cases noticed, not yet bugs

### Pendulum activation sequence
Vidrium "Activated to S-1" then "Returned S-1 to Extra Deck" — captured correctly by the simulator and tagged with `zone-p`.

### Duplicate card names in Overlay step
Step 74 of Elara: Overlay Zegredo onto Zegredo. The `cards` array has the same name twice. Renderer must NOT dedupe by name for Overlay steps. Currently handled.

### Xyz Summon "onto" notation
DB writes `Special Summoned Varudras... from Extra Deck onto Power Patron Shadow Machine Zegredo`. The "onto X" substring indicates an Xyz Summon where X becomes material. Renderer detects this and styles as Xyz Summon even though the action is "Special Summon".

### Trap-Equip variant
DoomZ Destruction's GY trigger sometimes resolves silently (no equip event in the log). Currently ends up as an `inferred` slot; full fix requires either a trap-specific heuristic or manual annotation. Tracked under remaining Bug 8 notes.
