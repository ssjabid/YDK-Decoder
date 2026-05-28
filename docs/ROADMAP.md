# ROADMAP

Status as of **2026-05-28**.
Read top to bottom. The "Shipped" section is what already works in the
current build. The "In progress / next" section is the active queue.
"Backlog" is everything that's been triaged but isn't being worked on yet.

> **2026-05-28 — Audit pass 1 done.** A full autonomous audit fixed five real
> bugs (the big one: restore was silently dropping the entire Format Planner)
> plus a data-loss-class cross-reference gap on deck delete. All verified live.
> See `docs/BUGS.md` → "Audit pass 1". No feature-queue changes.

Build markers (use these to verify a fresh load):
- Decoder: `YDK_BUILD = "2026-05-28-audit-pass-1"` (top of `decoder/ydk_decoder.html`, logged to console + shown in Settings → About)
- Service worker: `YDK_SW_BUILD = "sw-build-2026-04-26-combo-deckid-stamp"` (logged on SW startup)
- Extension manifest: `version: 1.5.0`

---

## ✅ Shipped (verified working end-to-end on Elara + Amalthe combos)

### Extension → Decoder handoff
- **P0.1** — Decoder auto-loads combos from `?combo=<base64>` URL param
- **P0.4** — Direct `chrome.scripting.executeScript` injection into the decoder tab's `localStorage` (no more 5KB URLs in the address bar). URL-param flow is preserved as a fallback for manual paste / sample data.
- Saved-combos persistence in `localStorage.ydk_saved_combos`, dedupe by `replayId`
- Combos tab auto-opens and selects the new combo on inject

### Combo extraction (extension)
- **Service worker** clean rewrite (`extension/background/service-worker.js`)
- **`detectAction`** recognizes: Drew, Returned, Normal Summoned, Special Summoned, Activated, Set, **Placed** (DB's "from Deck/GY to S-/M-x"), **Attached** (explicit AttachMaterial events including `Attached banished X to Y`), **Moved** (cross-zone repositions), Detached, Overlayed, Banished, Sent to GY, Tributed, Discarded, Searched (Added)
- **Combo output structure** versioned to `version: 3` with `isSolo`, `endboardGraveyard`, `endboardBanished` arrays so the decoder can reconstruct full state, not just the field

### Field-state simulator (decoder)
- **P0.3** — `simulateCombo()` replaces the naive endboard. Per-step state tracker producing `{hand, field, gy, banished, zones}` snapshots
- `extractZone()`, `applyStepToState()`, `cloneState()` — full state machine including Xyz material attachment, Pendulum scale activation, equip handling, Move detection, Set-from-GY, AttachMaterial-from-banish

### Decoder rendering
- **P0.2** — Hand-written `COMBOS` array deleted; full extracted-combo renderer with phases, opening hand, step-by-step + state line
- Card thumbnails everywhere via `INLINE_CACHE` + persistent `localStorage.ydk_card_cache` (Bug 6 fix)
- Hover preview shows full card image + stripped effect text on every named card pill in combos
- Per-step **state line** (Hand at end / Field) so the user can see what's resolved
- Logical **phase clustering** (`groupStepsIntoPhases`) — not "every 3 steps", but actual play boundaries (draws, opener line, climbs, finisher, end-of-turn sets)
- **Five view modes** via dropdown: Full / Core / Cluster / Compact / Diagram
- **Per-phase mini playmat** — 5x3 zone grid (Field Spell + EMZ + M1-5 + S1-5) at the end of each cluster
- **End Board playmat** — full grid identical layout, larger pills
- **Disruption analysis** — multi-tag (`negate / removal / lock / protection / finisher / engine`); cards appear in every applicable section with a `+N` badge
- **Combo grouping by hand size** — 1-card / 2-card / 3-card opener sections
- Pendulum-by-scale detection ("Activate as Pendulum scale" when Vidrium/Zegredo placed in S-1/S-5)
- Cause annotation — outcomes are stamped with their trigger ("via X's effect")
- Auto-save dropped `.ydk` to `localStorage.ydk_current_deck`; restored on reload
- View-mode persistence in `localStorage.ydk_combo_view_mode`
- Per-combo notes textarea (saved per `replayId`)
- **Unified card pill sizing** (2026-04-26) — every pill in every context now resolves to one of two sizes (md / sm), driven by CSS custom properties in `:root`. No more 6 different bespoke sizes across phase bullets, mini playmat, step rows, end board, etc.

### Bugs fixed (see BUGS.md for the per-bug detail)
- ✅ Bug 1 (endboard over-includes Xyz materials) — fixed by P0.3 simulator
- ✅ Bug 2 (Solo Mode opening hand empty) — handTracker post-mulligan snapshot
- ✅ Bug 3 (Draw `cards: null`) — regex backfill from detail text
- ✅ Bug 6 (missing thumbnails) — persistent card cache + ydk-driven cache merge
- ✅ Bug 8 (silent equip transitions) — equip-spell heuristic + AttachMaterial event detection
- ✅ Pendulum-by-scale, Set-from-GY, Move detection, cloneState zone copy
- ✅ Duplicate Set bullets dedupe, "Vidria suddenly in hand" mystery (mill/recovery were getting filtered out)
- ✅ Solo Mode mulligan polluted every view (2026-05-17) — `markMulliganSteps` + universal filter + banner
- ✅ ADRASTEIA placed-by-effect mis-narrated as "Set" (2026-05-17) — three-tier disambiguation in `describeStep`; structural fallback works even before card cache hydrates

### N2 — UI polish round  (DONE 2026-05-17)
- ✅ Browser tab title reflects active deck (`{deckName} · YDK Decoder`)
- ✅ 📝 notes badge on combo tiles when `userNotes` is non-empty (with tooltip preview)
- ✅ Combo-tile mini-grid of 3 stacked opener thumbnails (replaces comma-separated text), with `+N` overflow chip
- ✅ Click-to-edit combo title; persists as `combo.userTitle`, propagates via `getComboDisplayTitle()`
- ✅ Universal drag-to-reorder combos in sidebar; cross-bucket drops re-bucket the combo (`userOpenerSize`) and re-position (`sortIndex`), densified to `100, 200, 300 …` on each drop
- ✅ Per-step `?` info chip surfacing card's effect text on hover, in Cluster/Core/Compact/Full views; `(via X's effect)` annotation hoverable to show trigger card's text
- ✅ Sidebar search input — live-filter combos by title / opening hand / step cards / notes; visibility-toggle (not re-render) so input focus + thumbnails survive; persists across re-renders

### N3 — Format planner — ALL PHASES  (DONE 2026-05-17)
**The big one: deck-+-format-+-matchup planning workbench.** Shipped end-to-end across phases 1–4 in a single round. The user picks a banlist-bounded format, declares which of their decks they're playing, and tracks opponent decks with per-matchup gameplans. Combos in their deck can be linked to specific matchups they solve.

**Phase 1 — Decks foundation** (data model + UI shell)
- ✅ Schema migration v1 → v2: `migrateDecksToV2()` idempotent, snapshots to `ydk_decks_premigration_backup`.
- ✅ `migrateCombosToDecklists()` stamps `combo.decklistId` from owning deck.
- ✅ Top-level Decks tab with role filter (All / Mine / Matchup), deck tile list, + New deck.
- ✅ Methodology editor — autosaving fields (summary, endboard, howItWins, strengths, weaknesses, keyRatios) + repeating tech-cards list.
- ✅ Multi-decklist picker — switch / rename / download / delete per deck.
- ✅ Combos-for-active-build read-only summary.

**Phase 2 — Key cards** (extraction + manual curation)
- ✅ `extractKeyCardsFromDeck()` runs cards through `classify()` and maps to 6 buckets (Boss / Starter / Extender / Handtrap / Floodgate / Tech).
- ✅ Per-card annotations: `stopPriority`, `stopWith`, `notes`. User overrides flip `auto: false` and survive re-extract.
- ✅ Bucket grid with inline editor (priority buttons, stopWith select, category override, notes textarea, remove).
- ✅ Hover preview wired to every key-card row.

**Phase 3 — Format tab + matchups**
- ✅ New top-level Format tab. `ydk_formats[]` + `ydk_active_format_id` storage.
- ✅ Format CRUD: picker, rename, delete, "+ New format (clone matchups)" with auto-stamping `endDate` on the previous format.
- ✅ Primary deck section with picker + "Edit in Decks ↗" link.
- ✅ Matchup grid: tier-stripe cards, opponent name, preview snippets, key-target chips synced from opponent's keyCards.
- ✅ Add matchup flow: paste opponent .ydk to create role:"matchup" deck inline, OR pick existing.
- ✅ Matchup drill view: gameplan first/second, how-they-win, freeform notes, related combos checkbox list (links combos by `comboKey`), tier dropdown.

**Phase 4 — Cross-linking polish**
- ✅ "vs Opponent" badge on combo tiles when active format links the combo to a matchup.
- ✅ Tooltip lists all matchups a combo solves.
- ✅ Sidebar search includes vs-linkage so "branded" surfaces every combo linked to that matchup.
- ✅ Card chips throughout Format UI wired to hover-preview.

### N5 — Tournament-prep upgrades  (DONE 2026-05-17, latest)
After Phase 4 the app could plan matchups but couldn't actually side-board, prioritize, or track tournament outcomes. N5 closes that loop end-to-end.

- ✅ **Side-deck planner per matchup** (drag-and-drop). `matchup.sideboard.{goingFirst,goingSecond}.{in,out}` arrays. Pool subtraction (deck minus zone), live in/out counter, hover-preview on chips, click-or-drag to add, × to remove.
- ✅ **Chokepoints** — symmetric `chokepointTheirs` / `chokepointOurs` fields, top of every drill.
- ✅ **Priority playbook** — ordered `priorityFirst` / `prioritySecond` arrays with drag-reorder (circle-num handles), per-step `{ text }`, freeform gameplan textareas kept alongside for prose-style notes.
- ✅ **Target end board** per matchup — `matchup.targetEndboard` chip list with type-and-Enter input.
- ✅ **Tournament journal** — `format.tournaments[]` with rounds, opponent dropdown (incl. "Unknown / rogue" sentinel), going first/second, W/L/D, per-round + event-wide notes. Date-sortable. Most-recent-first list.
- ✅ **Per-matchup W-L badge** — `aggregateMatchupRecord()` computes across all tournaments in the format; renders bottom-right of each matchup card (green / red / neutral).
- ✅ All Phase 5 fields backfilled by `ensureMatchupPhase5Fields()` + `ensureFormatPhase5Fields()` so matchups/formats created earlier in the day don't blow up the UI.

### N6 — Phase 6 UX overhaul  (DONE 2026-05-19, latest)
After the Format Planner was feature-complete, the focus shifted to making it
usable and pleasant. Six sub-phases, all shipped:

**Phase 6A — Tab restructure + Decks panel sub-nav**
- ✅ Top-level tabs collapsed to **Decks / Format / Practice** (+ Settings gear). Cards and Combos are no longer top-level — they're sub-views reached from the Decks panel header ("Cards ↗" / "Combos ↗") with a back bar.
- ✅ Role filter simplified (dropped "All", default "Mine"); sideboard chips given uniform sizing; matchup deck creation via `.ydk` file picker (two direct-click grid tiles to preserve user-activation for the file dialog).
- ✅ Tile selection state reworked: role-tinted background + thick role stripe + right-edge dot (replaced the clashing orange border).
- ✅ 8 rounds of bug fixes (duplicate `const decks` parse error, Decks tab empty on load, 6 decks flipped to matchup role, Cards subview showing stale deck, file picker user-activation loss) — see BUGS.md.

**Phase 6B — Rich-text notes + `@cardname` mentions**
- ✅ `createRichTextEditor()` — contenteditable + toolbar (bold/italic/bullet/number/H3/H4/¶/link/@). Rolled out to **every** notes surface (deck, decklist, format, matchup ×4 freeform fields, combo, methodology ×6 fields).
- ✅ `@`-mention picker with cached sorted name index + debounced indexed search; inserts inline card chips with hover preview. Link insertion uses a styled in-app modal (no `window.prompt`).

**Phase 6C — Card-name autocomplete on inline inputs**
- ✅ Reusable `pickCardByName()` modal (search with art). Wired into "+ Add card" (key cards), tech/target/counter card inputs.

**Phase 6D — (folded into 6B/6C; no separate ship.)**

**Phase 6E — End-to-end visual refresh**
- ✅ Refreshed design tokens (shadow/radius/motion scales, deeper bg layers, accent-hover/soft). Radial-gradient body, Inter font stack. Refined tab bar.
- ✅ Polish layer: focus rings, dark scrollbars, modal fade+slide animations, tile elevations + hover lift, RTE focus elevation, sub-view back-bar gradient, unified `.btn` helper.
- ✅ **Matchup drill → 7 collapsible sections** (Quick reference / Playbook / Target end board open; Side-deck / Tech / Combos / Detailed notes collapsed, with count meta).
- ✅ **Save indicator toast** — `showSaveToast()` fires on every debounced RTE save + combo-checkbox toggle; coalesces within 600ms; capped to 3.

**Phase 6F — Archetype + type grouping**
- ✅ `detectArchetypeTokens()` / `isEngineCard()` / `classifyCardBroadType()` helpers.
- ✅ **Key Ratios autofill** now emits up to 8 labelled sections (Engine / Staples × Monster / Spell / Trap / Other), count-desc within each, instead of one wrap-crammed paragraph.
- ✅ **Side-deck planner pools** sorted Monster → Spell → Trap → Other, then by name.

### N4 — Late-patch completion  (DONE 2026-05-17)
Triple-check pass + notes audit + the Illusion-Gate-vs-Branded feature.

**Bugs fixed:**
- ✅ `createMatchupDeck()` — fresh entity creation that bypasses dedup, so an opponent .ydk paste can never flip a primary deck's role to "matchup".
- ✅ Matchup card switched from `<button>` (invalid: nested button) to `<div role="button">` with Enter/Space keyboard handling.
- ✅ Keyboard handler guards `e.target !== card` so it doesn't break nested-button activation.
- ✅ "Edit opponent's deck ↗" forces role filter to "all" so the destination is visible in the sidebar.

**Notes feature — completed across every entity:**
- ✅ Deck-level free-form notes (new collapsible section in Decks panel).
- ✅ Per-decklist (build) notes (textarea below each build row).
- ✅ Format-level notes (textarea between primary deck and matchup grid).

**Per-matchup Tech & Counter cards:**
- ✅ Schema field `matchup.counterCards: [{ name, side, notes }]`.
- ✅ Drill view section with side toggle (Good for us / Bad for us — green/red), name input with hover-preview, notes input, delete.
- ✅ Cloned formats deep-copy counterCards so each format is independent.

### N3-old — Format planner Phase 1  (DONE 2026-05-17 — superseded by full N3)
Foundation for the new top-level "Format" concept: a banlist-bounded plan that ties your deck to opponents' decks with matchup-specific strategy. Phase 1 ships the deck-side data model + UI; phases 2–4 layer on key-card buckets, format matchups, and cross-linking.
- ✅ Schema migration v1→v2: `migrateDecksToV2()` runs on init, idempotent, snapshots pre-migration to `ydk_decks_premigration_backup`. Every deck gains `decklists[]`, `primaryDecklistId`, `role`, `methodology`, `keyCards`. Legacy fields preserved & mirrored.
- ✅ Combos migration: `migrateCombosToDecklists()` stamps `combo.decklistId` from owning deck's `primaryDecklistId`.
- ✅ New Decks top-level tab between Combos and Practice. Master/detail layout: role-filtered deck list (All / Mine / Matchup) + selected-deck panel.
- ✅ Methodology editor — collapsible section with autosaving fields: summary, endboard, howItWins, strengths, weaknesses, keyRatios, plus repeating tech-cards `{ name, reason }` rows.
- ✅ Multi-decklist picker — switch / rename / download / delete builds per deck; setting active mirrors content to legacy deck-level fields so Cards/Combos/Practice keep working.
- ✅ Combos-for-active-build read-only summary, click → opens combo in Combos tab.

---

## 🔧 In progress / next

> **The build is feature-complete for now.** No half-finished features in the
> code. The "next" work is **verification + real-world testing**, then picking
> from the backlog. Concretely, in priority order:

### NEXT-1 — Verify Phase 6E + 6F  (active — needs Abid driving the app)
Run the test checklist (the assistant produced it; sections cover visual
refresh, matchup collapsibles, save toast, Key Ratios archetype grouping,
sideboard pool ordering, plus regression of everything previous). File any
failure as a numbered BUGS.md entry and fix before starting new features.

Specific things to watch on the new Phase 6F grouping:
- Engine vs Staples split correct for the DoomZ deck (DoomZ/Power Patron →
  Engine; Ash/Belle/Mulcharmy/Solemn → Staples). If a card lands in the
  wrong group, tune `_ARCHETYPE_STOP_WORDS` or the 2-card token threshold in
  `detectArchetypeTokens()`.
- Monster/Spell/Trap ordering correct (depends on `card.type` being hydrated —
  cold cache may bucket as "Other" until the Cards tab fetches data).

### NEXT-2 — N1.5 end-to-end extraction sweep  (needs Abid + Chrome extension)
Re-extract the 6 reference DoomZ combos (`docs/DECK_CONTEXT.md`) through the
popup → decoder pipeline against the current build and confirm:
1. All 40+ active-deck cards resolve thumbnails (no text-only pills)
2. Each combo extracts cleanly, tagged with the right `deckId`
3. Endboard sensible (no orphan materials, no missing equips)
4. Disruption section groups pieces correctly
5. Combos list groups under the active deck
Any UI niggle found here → BUGS.md Bug 7 punch list.

### N1 — Multi-deck system  (LARGELY SHIPPED — kept for history)

Variations were **dropped from scope** (Abid, 2026-04-27: each deck is
independent; no parent/child inheritance). The deck library, combos↔decks
mapping, and backup/restore all shipped. Remaining open item is N1.5 (above).

#### N1.1 — Deck extractor in the extension  (DONE 2026-04-26)
Manifest 1.4.0. The popup has a "Scan DuelingBook deck page" button that
injects `extension/content/deck-extractor.js` into the active tab, scans the
DOM for main/extra/side card images, and produces a `.ydk` string.
Multi-strategy DOM detection plus a global-image fallback, with a debug
dump returned alongside the result so failed scans are diagnosable.

Output offers Copy `.ydk` / Download / Save to YDK Decoder. The Save flow
goes through the service worker into `localStorage.ydk_decks` (new key),
upsert by `deckId`, dispatching `ydk:deck-injected` so the decoder can
re-render its deck library on the fly.

**Schema (deck object stored at `localStorage.ydk_decks`):**
```js
{
  deckId: 'deck_<timestamp>',
  name: 'DoomZ v2',           // user-editable, defaults to scan-derived name
  ydkContent: '#created by ...\n#main\n14558127\n...',
  counts: { main, extra, side, total },
  main: ['14558127', ...],
  extra: [...],
  side: [...],
  parentDeckId: null,         // or the deckId of the base deck if this is a variation
  isVariation: false,
  notes: '',
  source: 'extension' | 'manual-upload' | 'imported',
  sourceUrl: 'https://www.duelingbook.com/deck?id=...' | null,
  createdAt: ISO,
  updatedAt: ISO,
}
```

#### N1.2 — Decks tab in the decoder  (DONE — shipped as Format Planner + Phase 6A)
The Decks tab exists as a top-level destination (Phase 6A), with a deck-tile
list, selected-deck panel, methodology editor, key-card buckets, multi-decklist
picker, and Cards/Combos sub-views. The original spec below is preserved for
reference; the shipped version went well beyond it.

UI:
- **Sidebar** lists all decks; variations indent under their parent.
- **Main panel** for the selected deck: header (name + counts), full
  card list (`renderNamedCard` pills as a uniform grid, same look as the
  Diagram view), notes textarea, action bar (Make Variation / Rename /
  Delete / Set as Active).
- **"Active deck"** indicator persists across reloads (`localStorage.ydk_active_deck`).
  When a deck is active, the existing Cards tab pulls from THAT deck's
  contents instead of the legacy single-deck flow. Combos extracted from
  the popup auto-tag with the active `deckId`.
- **Make Variation**: deep-clones a deck, sets `parentDeckId` to the
  source, opens it in edit mode so the user can add/remove cards.

#### N1.3 — Combos belong to decks  (DONE)
Existing `localStorage.ydk_saved_combos` entries each get a `deckId` field.
- New combos extracted while a deck is active are tagged with that `deckId`.
- Old combos with no `deckId` show in an "Unassigned" group; user can
  drag/drop or use a dropdown to assign them.
- Combos tab gains a deck filter (default = active deck). Variations show
  their own combos AND inherit combos from `parentDeckId`. A filter pill
  toggles "show inherited" so the user can opt out.

#### N1.4 — Backup / restore everything
- "Export all data" button: dump `ydk_decks` + `ydk_saved_combos` +
  `ydk_card_cache` + `ydk_combo_view_mode` + per-combo notes into one
  JSON file. Filename `ydk-decoder-backup-YYYY-MM-DD.json`.
- "Import" button: read a backup JSON and merge it into the current
  state. Upsert by id everywhere; user gets a summary ("imported 3 decks,
  18 combos, 67 cached cards").
- Auto-export prompt every 30 days as a gentle nag if it hasn't been
  exported recently.

#### N1.5 — End-to-end test on the 6 reference combos
With the decklist now stored as a proper deck entity, run each of the 6
test replays through the popup → decoder pipeline and confirm:
1. All 40+ cards in the active deck resolve thumbnails (no text-only pills)
2. Each combo extracts cleanly, lands tagged with the right `deckId`
3. Endboard for each combo is sensible (no orphan materials, no missing equips)
4. Disruption section shows the right pieces in the right tag groups
5. Combos list correctly groups under the active deck (and variations roll up)

### N2 — Triage UI issues found during N1.5
Bug 7 in BUGS.md is a placeholder for "various polish issues, enumerate during the next pass." This is that pass. Each issue found during N1.5 gets a numbered entry in BUGS.md and is fixed before the deep features below.

---

## 📋 Backlog (triaged, not started)

### B1 — Combo library improvements
- **B1.1** — Combo tagging + filtering. Auto-tag by starting card category (Amalthe / Elara / Change / Raiders / Terminus). Filter bar like the Cards tab. Search by card name in steps.
- **B1.2** — Export / import all combos as a single JSON file (for backup or sharing).
- **B1.3** — Combo diff view — pick two combos, highlight where they diverge.

### B2 — Extension polish
- **B2.1** — Batch import: paste all 6 URLs, extract sequentially, queue UI in the popup.
- **B2.2** — Wire `extension/content/deck-extractor.js` into the popup as a second button ("Extract Deck from Current Tab" — runs on a DB deck constructor page, outputs `.ydk`). Currently the file exists but is unreachable.
- **B2.3** — Better "no replay loaded" diagnostics — popup should detect if it's not on a replay URL and show what to do instead of just spinning.

### B3 — Decoder polish
- **B3.1** — Mobile / narrow-viewport layout. Current CSS breaks below ~800px.
- **B3.2** — SVG-based arrow rendering for Diagram view (currently uses text arrows; SVG would let causes/materials/equips show as actual lines on the field grid).
- **B3.3** — Replace remaining BLZD placeholder passcodes (55555555, 77777777…) once they hit YGOPRODeck. See Bug 4.
- **B3.4** — Inline edit pencil per saved combo for manual endboard fixups (Bug 8 option 4 — last-resort).
- **B3.5** — Card-effect database extension. `DISRUPTION_PROFILES` covers the disruption tag system; a fuller stripped-effects DB would let other parts of the UI surface "what does this card do?" without the YGOPRODeck round-trip.

### B4 — Future learning features
- **B4.1** — Spaced repetition: random combo step shown with the card name hidden, user fills in what comes next; SM2 scheduling.
- **B4.2** — Multi-deck support: `userPreferences.decks = [{name, ydkPath, combos}, ...]`. Right now only DoomZ is the assumed deck; the decoder shouldn't hardcode any deck-specific naming.
- **B4.3** — Opponent-turn simulator: given an endboard, walk through what disruption you have vs common threats. "vs Feather Duster — chain Warning? Which?"

---

## 🚫 Explicitly out of scope

- **No build step.** Vanilla JS, no npm, no bundler. Single-file HTML where possible.
- **No file:// support.** `py -m http.server 8000` is mandatory; CORS breaks YGOPRODeck on file://.
- **No analytics, no telemetry.** Personal tool.
- **No rewrite of `combo-import-helper.js`.** It solves dozens of DB DOM quirks. Targeted edits only.
- **No external card-text invention.** New BLZD cards stay flagged `VERIFY` until real data lands.
