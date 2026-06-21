# Known Bugs

Status as of **2026-05-30**. ✅ = fixed and verified. 🚧 = open / partial.
"Polish punch list" at the bottom is for small UI niggles to gather and
batch-fix during the next pass.

---

## ✅ Extension → React app handoff (verified live 2026-06-21)

- ✅ **Extension opened the legacy decoder, not the React app.** Both
  `extension/background/service-worker.js` and `extension/popup/popup.js`
  hardcoded `DECODER_URL = http://localhost:8000/decoder/ydk_decoder.html`.
  Since Abid now works in the React app, Extract → "Open in YDK Decoder" opened
  the old single-file decoder (and, when nothing was served at :8000, fell back
  to cramming the whole combo into a giant `?combo=` URL that failed to load —
  the "weird link"). **Fix:** both constants now point at
  `http://localhost:8000/react/`. The React app shares that origin, so the SW's
  `localStorage` injection + `ydk:combo-injected` event reach it (App.jsx
  already listens), and the `?combo=` fallback hits the React app's
  `ingestComboFromUrl`. *Verified: the real pasted v3 payload decodes + imports
  into the React app (added 1, renders steps).* **Requires** the React build
  served at :8000 (`npm run build:8000` → `py -m http.server 8000`) and an
  extension reload at `chrome://extensions/`.
- ✅ **Combo named after the wrong card.** `deriveComboName()` named every combo
  after its first Normal Summon, so every DoomZ line that funnels into Elara
  collided on "DoomZ VII Seven - Elara". Now it names after the **starter** —
  the first opening-hand card that's actually played (Activate/Normal/Special
  Summon), falling back to first-play-of-any-card, then the old behaviour.
  *Verified: the DoomZ Change line now names "DoomZ Change", not "…Elara".*
  (In `service-worker.js`, NOT the protected `combo-import-helper.js`.)

## ✅ Phase 6O fixes (verified live 2026-05-30)

- ✅ **Role-recovery banner false positive.** After importing the meta pack,
  every deck is `role:"matchup"`, which tripped
  `detectMatchupDecksThatShouldBePrimary()` → the scary "all your decks are
  marked as Matchup" banner. Now the detector ignores meta-import decks
  (`source === "meta-import"` or `deckId` prefix `deck_meta_`) and only flags a
  user's *own* flipped decks. *Verified: detector returns null with only meta
  decks loaded; banner absent.*

---

## ✅ Audit pass 1 — autonomous deep audit  (FIXED + verified live 2026-05-28)

A full-app audit (init/migration, cross-references, backup/restore, Format
tab, combos, practice, Chrome extension) surfaced five real issues, all
fixed and verified in a live localhost browser session. Build marker
`2026-05-28-audit-pass-1`.

- ✅ **Restore silently dropped the entire Format Planner.** `buildBackupBlob()`
  exported `ydk_formats` (matchups, side-deck plans, tournament journal),
  but `runRestoreFromFile()` had no formats branch — it restored decks,
  combos, card cache, prefs, practice streaks, and ignored formats. A
  restore onto a fresh machine lost all format/matchup/tournament work even
  though it sat in the backup. Added a conservative formats merge (dedupe by
  formatId, append only new ids, set activeFormatId if none). *Verified: a
  format with 1 matchup + 1 tournament survives a wipe→restore round-trip.*
- ✅ **Header deck-switcher delete didn't clean up references.** Its confirm
  modal promised "Combos linked to this deck will become unassigned," but
  the handler just filtered + saved — combos kept their stale `deckId` and
  formats kept a dangling `primaryDeckId`. The two Decks-tab delete paths
  already swept refs; the switcher path was missed. Now calls
  `cleanupDeckReferences(deckId)`. *Verified: cleanup nulls combo.deckId /
  decklistId and format.primaryDeckId.*
- ✅ **Extension-pushed / restored decks were stuck in v1 shape.**
  `migrateDecksToV2()` only runs once (schema-flag gated), so a deck that
  enters `ydk_decks` afterward (extension `injectDeckIntoDecoderPage`, or an
  old-backup restore) had no `decklists`/`role`/`methodology`/`keyCards`.
  No crash (consumers guard), but the Decklists section showed empty and
  adding a build could orphan the legacy cards. Added idempotent
  `ensureDeckV2Shape()` + `normalizeAllDecksShape()` (deterministic
  `dl_<deckId>_main` id so combo linkage stays stable), wired into init and
  the `ydk:deck-injected` handler. *Verified: a simulated v1 deck gains a
  Main build whose id matches primaryDecklistId; idempotent on 2nd call.*
- ✅ **Init-time duplicate-deck dedup left formats dangling.** It repointed
  combos + the active-deck pointer to the surviving keeper but not
  `format.primaryDeckId` / `matchup.opponentDeckId` / tournament-round
  `opponentDeckId`. Now repoints all three via the same dup→keeper map.
- ✅ **Tournament drill yanked scroll to top on every round edit.** Unlike
  the matchup drill (which returns early to render standalone), the
  tournament drill rendered below the full matchup grid. `buildRoundRow`'s
  result/opponent handlers call `renderFormatTab()` to refresh aggregate
  badges, so each edit rebuilt the grid and scrolled the user away from the
  rounds they were entering. Added an early-return so the tournament drill
  renders standalone. *Verified: with a tournament drill active, the matchup
  grid is no longer in the DOM above it.*

Also removed a dead `wireBackupRestore()` IIFE that wired button ids
(`ydk-backup-btn` …) which never existed in the DOM (real wiring is in
`wireSettingsTab`).

**Flagged for Abid (couldn't self-verify — need Chrome / real combos):**
- Practice hand-matcher matches the *entire* recorded `openingHand`. For a
  combo whose recorded opener is a full 5-card hand, "Playable" requires
  drawing all 5 — likely too strict. Logic is internally correct (multiset
  bag, handles needing 2 copies); whether `openingHand` is the right thing
  to match against is a data/design question to settle during N1.5 with
  real extracted combos. Not changed blind.
- The extension combo-injection lands on the standalone `tab-combos` view
  (`focusComboByKey` → `setActiveTab("combos")`). Since Phase 6A removed the
  Combos tab button, no top tab highlights (content still shows). Left as-is
  — it's the intended "show the freshly extracted combo" behavior.

---

## ✅ Phase 6 bug round  (FIXED 2026-05-18 → 05-19)

The Phase 6 UX overhaul (tab restructure, rich-text notes, visual refresh,
archetype grouping) surfaced and fixed a cluster of bugs. Grouped here.

- ✅ **Duplicate `const decks` SyntaxError** (Phase 6A) — re-declared `decks`
  inside `renderFormatTab` which already had it in an outer scope. The whole
  script failed to parse → blank app on hard refresh. Fixed by reusing the
  outer variable.
- ✅ **Decks tab empty on initial load** — after making Decks the default tab,
  its container kept `class="hidden"`. Removed the class; wrapped the init
  `renderDecksTab()` in try/catch.
- ✅ **Six decks all flipped to `role:"matchup"`** — the old add-matchup flow
  ran `upsertDeckFromYdkText()` + set `role="matchup"`, and content-hash dedup
  matched the user's own primary decks, mutating them. Fixed two ways: (1) new
  `createMatchupDeck()` always makes a fresh entity that bypasses dedup; (2) a
  per-deck role toggle + auto-detection banner offering one-click batch-restore.
- ✅ **Cards/Combos sub-view showed a stale deck** — `openDeckSubview` wasn't
  triggering a re-render. Fixed by calling `loadDeckFromText` (Cards) /
  `renderCombos` (Combos) on entry.
- ✅ **Matchup `.ydk` file picker silently failed** — user-activation was lost
  across `await ydkConfirm` + `await ydkPrompt`, so the browser blocked the
  file dialog. Split into two direct-click grid tiles → synchronous picker.
- ✅ **Mention chips looked like loud orange buttons** — restyled to subtle
  inline pills with an `@` prefix.
- ✅ **Tournament name format** — changed `Type · Venue · Date` to the
  requested `Type - Venue: Date`.
- ✅ **Key Ratios auto-fill was wrap-crammed + ungrouped** (Phase 6F) — the
  autofill dumped every card into one `<p>` joined by commas, mixing engine
  cards with handtraps in an unreadable soup. Rewrote to detect archetype
  tokens (`detectArchetypeTokens`), bucket into Engine vs Staples, then by
  broad type (Monster/Spell/Trap/Other), emitting up to 8 labelled sections.
  Side-deck planner pools got the same Monster→Spell→Trap→name ordering.

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

## ✅ Solo Mode mulligan polluted every view  (FIXED 2026-05-17)

**Severity:** High — every solo combo started with 10 noise steps (Drew 5 + Returned 5), making the combo unreadable.
**Location:** `decoder/ydk_decoder.html` → step filters + `groupStepsIntoPhases`
**Fixed by:** New `markMulliganSteps()` runs after `simulateCombo`, detects the leading `Draw × N → Return × N (hand → deck)` block and stamps `_mulligan: true` on those steps. `filterCoreSteps`, `filterPhaseBullets`, `groupStepsIntoPhases`, and the Full-view loop all skip mulligan-flagged steps. A single-line banner ("Solo Mode mulligan — drew N, returned N to deck") replaces the noise so the user knows what was hidden.

**Verification:** `abid_doomz_combo2.txt` (Amalthe combo, 10-step mulligan) now opens with the Search Amalthe as the first visible step. Banner shows `drew 5, returned 5`. Pattern-based — no `combo.isSolo` flag dependency.

---

## ✅ ADRASTEIA placed-by-effect mis-narrated as "Set"  (FIXED 2026-05-17)

**Severity:** High — directly confused the user during memorization. Step 18 of `abid_doomz_combo2.txt`: `"action": "Set", "detail": "Placed DoomZ Command \"A.D.R.A.S.T.E.I.A.\" from Deck to S-4"` was rendered as `"Set ADRASTEIA"` instead of `"Equip ADRASTEIA to Drastea from Deck (by effect)"`.
**Location:** `decoder/ydk_decoder.html` → `describeStep()` Set handler + `applyStepToState()` Set handler
**Root cause:** The extractor maps both `Set X in S-N` (manual face-down) and `Placed X from <source> to S-N` (effect-driven) to `action: "Set"`. The renderer's Set handler dropped both to `"Set X"`.
**Fixed by:** Three-tier disambiguation in `describeStep`:
1. **Tier A** (cached + Equip Spell, `Placed` + `from Deck/GY/banished`): `"Equip X to Y from <source> (by effect)"` with `inferEquipTarget()` picking the most recent monster on the field.
2. **Tier B** (cached + Continuous Spell/Trap, same shape): `"Place X face-up from <source> (by effect)"`.
3. **Tier C** (no card data — brand-new combo, cache cold, same shape): `"Place X face-up from <source> (by effect)"`. Structural — DuelingBook never uses `Placed` for manual face-down sets, so the tier-C fallback is provably correct. Late-hydration re-render from `enrichComboCards` upgrades to tier-A precision once YGOPRODeck data arrives.

Simulator's Set handler mirrors the same logic — writes `isSet: false` for effect placements so the playmat doesn't show face-downs where there should be face-up equips.

**Verification:** All 8 `Set` steps in `abid_doomz_combo2.txt` narrate correctly (3× ADRASTEIA equip, DOOMDURG equip, Zegredo Pendulum-scale, Graflario fallback "Set" with end-board `isSet: true` consistent, DoomZ Destruction manual face-down from hand).

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
