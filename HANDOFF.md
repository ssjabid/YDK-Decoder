# HANDOFF — YDK Decoder

Snapshot of the project state for whoever picks this up next (including future-me).
Last updated: **2026-05-17**.

---

## What this is

A **personal Yu-Gi-Oh deck-learning workbench** for Abid. Two pieces:

1. **Decoder** — single-file static HTML app at `decoder/ydk_decoder.html`. Drop in a `.ydk`, see your deck broken down by role (Starter / Extender / Engine / Floodgate / Board breaker / Handtrap), browse extracted combos with side-by-side master/detail layout, drill openers in Practice mode.
2. **Chrome extension** — `extension/`, MV3. Two jobs:
   - Extract DuelingBook **replays** → structured combo JSON → push to decoder
   - Scan DuelingBook **deck constructor** → `.ydk` → push to decoder

The extension and decoder communicate via `localStorage` injection (decoder owns the DB, extension is the data pipeline).

---

## Build markers (verify after Ctrl+Shift+R)

| Component | Current build |
|---|---|
| Decoder | `2026-05-18-phase6A-bugfix-round1` |
| Extension manifest | `1.5.0` |
| Service worker | `sw-build-2026-04-26-combo-deckid-stamp` |
| Deck extractor (content script) | `deck-extractor-2026-04-26-v6-content-script` |

Decoder build is visible in **Settings → About → Build** (selectable for copy/paste).
SW + deck-extractor builds are in their respective console logs.

---

## ✅ What's done

### Decoder app — core
- **Cards tab** with role-based filter pills (canonical 6: `Starter / Extender / Engine / Floodgate / Board breaker / Handtrap`)
- Compact card grid (DB-style) with Compact/Detailed toggle
- Hover preview with smooth fade-in/out (uses opacity + transform, not display)
- Sticky filter bar that survives scroll
- Section headers (Main/Extra/Side) with accent left-stripe + underline

### Decoder app — combos
- **Combos tab is now a master/detail workspace**: combo list in 320px sticky sidebar on left, selected combo on right. Collapses to stacked at < 1100px.
- Each combo tile uses a **cropped image of the first opening-hand card's art** as visual identity. Overlays: opener-size pill (top-right), `↗ Replay` link (bottom-right), 📝 notes badge (top-left, only when notes are non-empty).
- **Mini-grid of 3 stacked thumbnails** on each tile replaces the old comma-separated opener-text — visual scan instead of reading names. Overflow shown as `+N`.
- **Click-to-edit combo title**: click the title in the open combo's header → inline input. Enter saves, Escape discards, empty/equal-to-auto reverts. Persists to `combo.userTitle`. Sidebar tiles and tooltips use `getComboDisplayTitle()` so renames propagate everywhere.
- **Universal drag-to-reorder**: drag any tile to any position, including across buckets. Cross-bucket drop sets `combo.userOpenerSize` (re-buckets) and `combo.sortIndex` (re-positions). Drop indicators: 2px accent line above/below tiles, accent underline on empty bucket headers.
- **Manual opener-size override**: click the colored pill in the open combo's header to re-bucket between `1-card` / `2-card` / `Other`. Persists on `combo.userOpenerSize`. Auto-bucketing is by `openingHand.length` with anything 3+ folding into Other.
- Per-combo **collapsible notes** panel (`<details>` element, click outside to commit + close, `Cmd/Ctrl+Enter` saves, `Esc` discards)
- Five view modes: Full / Core / Cluster / Compact / Diagram (dropdown picker)

### Quadruple-check audit pass (May 17 2026, post-Phase-5)
After Phase 5 the user asked for a thorough audit. Real bugs found and fixed:

- ✅ **`deleteDeck` was a half-promise.** Modal said "combos linked become unassigned" but didn't actually null out `combo.deckId` / `combo.decklistId`, and didn't clear `format.primaryDeckId` on formats that pointed at the deleted deck. New `cleanupDeckReferences(deletedDeckId)` sweeps both.
- ✅ **Deleting a decklist orphaned combos.** Combos with `decklistId === deleted` would be hidden under all other decklists (filter mismatched). New `cleanupDecklistReferences(deckId, deletedId, fallbackId)` re-assigns those combos to the new primary decklist and clears stale `t.deckVariantId` on tournament rounds.
- ✅ **Deleting a combo left stale `relatedComboIds`** in every matchup that linked to it. New `cleanupComboReferences(removedKey)` sweeps every format's matchups. Bulk `clearAllSavedCombos` also wipes all relatedComboIds.
- ✅ **Sideboard click-to-add bypassed count-cap.** Spamming click could exceed the deck's copy count. Applied the same cap check as the drop handler.
- ✅ **Renaming a deck in Decks panel didn't refresh the header switcher.** Added `refreshDeckSwitcher()` call on commit.
- ✅ **Tournament name input didn't save on Enter** (was blur-only). Added Enter handler.
- ✅ **Methodology tech-card name input had no hover-preview.** Wired `showPreview` / `hidePreview` like the matchup tech-list does.

### Format planner — Phase 5: tournament-prep upgrades (May 17 2026, latest)
After the user asked for deeper tournament-prep tooling, five new pillars landed inside the matchup drill view + a new Tournament journal section.

**A. Side-deck planner per matchup (drag-and-drop)**
- `matchup.sideboard.{goingFirst,goingSecond}.{in,out}: [cardNames]`
- Per direction: two rows — side-deck pool → "Bring in" zone, main-deck pool → "Take out" zone
- Drag chips from pool to zone (or click to add). Each zone chip has × to remove. Live counter (`In 3 / Out 3 ✓` green when balanced, amber when not).
- Validates: can't drag more copies of a card than the deck holds.
- Card chips have hover-preview wired.
- Requires a primary deck on the format (otherwise shows a hint).

**B+C. Chokepoints + priority playbook**
- `matchup.chokepointTheirs` + `matchup.chokepointOurs` — two 1–2 line fields at the top of every drill. Red border for theirs (what we stop), amber for ours (what they stop). The most critical call-outs in the matchup, visible at a glance.
- `matchup.priorityFirst` + `matchup.prioritySecond` — ordered arrays of `{ text }` action lines per direction. Each step has a circle-numbered drag handle for reorder + delete button. Replaces freeform prose for the user who wants a tournament-pressure checklist (the existing `gameplanFirst` / `gameplanSecond` textareas stay for freeform notes; user picks per-matchup which they prefer).

**D. Target end board per matchup**
- `matchup.targetEndboard: [cardNames]` — what we want on the field against THIS specific opponent. Different from `methodology.endboard` (your generic plan).
- Chip editor with hover-preview per chip; type a name + Enter to add.

**E. Tournament journal**
- `format.tournaments[]` with `{ tournamentId, name, date, location, deckVariantId, rounds[], notes }`.
- Each round: `{ opponentDeckId, going: "first"|"second", result: "W"|"L"|"D", notes }`.
- New collapsible section below the matchup grid. List shows date, name, record summary, ×. Click → drill view with editable name, date, deck-variant selector (when the deck has multiple builds), rounds editor (round number badge, opponent dropdown including "Unknown / rogue", going first/second, W/L/D toggle, notes), event-wide notes textarea.
- **Auto-aggregated per-matchup record** rendered as a badge on every matchup card (`4-2-0`, green if positive / red if negative / neutral if even). Computed by `aggregateMatchupRecord(format, matchup)` across all this format's tournaments.
- Cloning a format does NOT carry tournaments forward — events are tied to the format they happened in.

### Format planner — completion patch (May 17 2026, late)
After phases 1–4 landed, a triple-check pass + notes audit surfaced three bugs and three missing notes surfaces. All resolved in this patch.

**Bugs fixed:**
- ✅ **Matchup-deck creation no longer mutates user's primary decks.** `addMatchupFlow` was reusing `upsertDeckFromYdkText`, whose content-hash dedup could match a primary deck and flip its `role` to "matchup". New `createMatchupDeck()` always creates a fresh entity, bypasses dedup, omits `_contentHash`.
- ✅ **Matchup card no longer puts `<button>` inside `<button>`.** Switched the tile element to `<div role="button">` with keyboard support; the `× delete` nested button is now valid HTML.
- ✅ **`card.onkeydown` no longer breaks nested-button keyboard activation.** Guards against `e.target !== card` so Enter/Space on the × delete fires the delete, not the drill-in.
- ✅ **Deck-jumping from Format tab forces role filter to "all"** so jumping to an opponent deck doesn't leave it hidden behind a "Mine only" filter.

**Notes feature — completed:**
- ✅ **Deck-level free-form notes** — new "Notes" collapsible section in the Decks panel below methodology. For thoughts that don't fit a structured methodology slot.
- ✅ **Per-decklist (build) notes** — small textarea below each decklist row in the Decklists section. For build-specific reminders ("this version cuts Ash for Mulcharmy", "tournament build only").
- ✅ **Format-level notes** — `Format notes (banlist-wide context)` textarea between primary-deck section and matchup grid. For meta predictions, side-deck plans, format-wide observations.

**Per-matchup Tech & Counter cards:**
- ✅ New schema field `matchup.counterCards: [{ name, side, notes }]`.
- ✅ Drill view section "Tech & counter cards — what works for us, what hurts us". Repeating rows: side toggle (Good for us / Bad for us — green vs red), name input, notes input, delete. Two `+ Add` buttons that pre-set the side.
- ✅ Card-name input wires hover-preview when name resolves in `NAME_INDEX` (rewires on blur if name changed).
- ✅ Cloned formats deep-copy `counterCards` so editing one format doesn't bleed into another.

### Format planner — ALL FOUR PHASES (May 17 2026)
**Banlist-bounded competitive plan: your primary deck + opponents' decks + per-matchup gameplans + combos that solve each matchup.** Shipped as a single end-to-end build.

**Phase 1 — Decks foundation:** see "phase 1" section below.

**Phase 2 — Key cards (Decks tab):**
- New collapsible "Key cards" section per deck. Six buckets: **Boss / Starter / Extender / Handtrap / Floodgate / Tech**. Extracted by `extractKeyCardsFromDeck()` which parses the primary decklist, runs each card through `classify()`, and maps to the canonical 6.
- Per-card annotations: `stopPriority: "high" | "medium" | "none"`, `stopWith: "handtrap" | "removal" | "negate" | "outboard" | "ignore"`, free-form `notes`. Visual: high-stop cards get a red left-stripe + dot; medium gets amber. High-priority cards sort to the top of their bucket.
- Inline editor expands below a clicked card row — priority button group, stopWith select, category override select, notes textarea, remove button. Setting any field flips `auto: false` so re-extraction preserves your edits.
- Hover any key-card row → existing preview pane shows full card text (reuses `attachPreviewHover`).
- "↻ Re-extract from active build" button refreshes auto entries; manual overrides + auto-annotations are carried across.

**Phase 3 — Format tab + matchups:**
- New top-level **Format** tab (between Decks and Practice). `localStorage.ydk_formats[]` + `localStorage.ydk_active_format_id`.
- **Format CRUD**: format picker dropdown, "✎ Rename", "× Delete" (when >1 format), "+ New format (clone matchups)" — cloning carries forward every matchup with its opponent-deck refs, tier, gameplan text, key targets, related combos, and freeform notes. Stamps the previous format's `endDate` so history is preserved.
- **Primary deck section**: pick which of your `role: "primary"` decks is your deck for this format. Quick "Edit in Decks ↗" link jumps to that deck's Decks-tab panel.
- **Matchup grid**: tier-stripe cards (Tier 1 red / Tier 2 amber / Rogue grey), opponent name, preview snippets of "They win by" + "Our plan", "Key targets" chips (auto-pulled from opponent's `keyCards` with high/medium stopPriority).
- **Add matchup flow**: prompts for deck name + (optional) opponent .ydk paste. Creates a new `role: "matchup"` Deck with full decklists/methodology/keyCards (or notes-only if .ydk is blank). Or picks an existing matchup deck. Linked decks survive matchup removal (matchup deletion only removes this format's gameplan).
- **Matchup drill view** (click a card): full editors for "How they win", "Our plan going first", "Our plan going second", "Other notes". Tier dropdown. Key targets shown as hover-previewable chips (read-only — edit the opponent's keyCards to change). Related combos: checkbox list of your combos that solve this matchup.

**Phase 4 — Cross-linking polish:**
- **"vs Opponent" badge** on combo tiles in the sidebar (bottom-left of art crop, red). Appears when the active format links the combo to one or more matchups. Tooltip lists all matchups it solves.
- **Sidebar search includes vs-linkage**: typing "branded" finds every combo linked to the Branded matchup.
- **Card chips throughout Format/Decks UI** wired to the hover-preview pane via `attachPreviewHover`.
- Image-load-failure handler now preserves the vs badge alongside opener tag + notes badge.

### Format planner — phase 1 (May 17 2026)
**Foundation layer for "Format" — a banlist-bounded plan that ties your deck to opponents' decks.** Phase 1 ships the Decks tab and the multi-decklist data model so phases 2–4 (key-card extraction, Format tab, matchup planning, cross-linking) can build on top.

- **Schema migration v1 → v2**. `migrateDecksToV2()` runs idempotently on `DOMContentLoaded`. Every existing deck gets one `decklists: [...]` array with a single "Main build" inside (mirrored from legacy `ydkContent` / `main` / `extra` / `side`), plus empty `methodology` object, `keyCards: []`, and `role: "primary"`. Pre-migration snapshot saved to `localStorage.ydk_decks_premigration_backup` (one-time, never overwritten). Combos get `decklistId` stamped via `migrateCombosToDecklists()`.
- **New top-level Decks tab** (between Combos and Practice). Master/detail layout matching the Combos workspace conventions. Sidebar: role-filtered deck list ("All / Mine / Matchup") with `+ New deck` button. Right panel: selected deck.
- **Methodology editor** — collapsible section with autosaving textareas for `summary`, `endboard`, `howItWins`, `strengths`, `weaknesses`, `keyRatios`, plus a repeating tech-cards list (`{ name, reason }` rows with add/remove). Blurring an input persists to `deck.methodology`.
- **Multi-decklist picker** — every deck can hold multiple builds (variants of the same archetype). Each row: editable name, counts, set-active radio, download (`↓`), delete (`×`). "+ Add a new build" expands an inline `.ydk` paste box. Setting a build active mirrors its content back to the deck-level legacy fields so Cards/Combos/Practice keep reading the latest active build with no other changes.
- **Combos-for-active-build section** — read-only list filtered by `combo.decklistId === deck.primaryDecklistId` (falls back to `deckId` match for legacy combos). Click → jumps to Combos tab focused on that combo.
- **Inline rename** — deck name and decklist name use the same Enter/Escape/blur pattern as the combo title rename.

Next phases (in HANDOFF Next priorities): **Phase 2** key-card auto-extraction + manual curation (Boss/Starter/Extender/Handtrap/Floodgate/Tech buckets with per-card `stopPriority` flag); **Phase 3** Format tab with matchup planning; **Phase 4** cross-linking (related combos per matchup, "Used against" indicators on combo tiles).

### Decoder app — sidebar search (May 17 2026 patch)
- **Live search input** above the combo picker, sticky at the top of the sidebar. Filters tiles by title (`userTitle` / `comboName`), opening-hand card names, every step's card names, user notes, and replay ID.
- **Visibility-toggle filter** (not re-render): each tile gets `data-search-haystack` stamped during render; the input handler toggles `style.display` on matching/non-matching tiles. Preserves input focus, doesn't reload thumbnails, doesn't tear down drag wiring.
- **Bucket headers hide** when their bucket has no visible matches. Empty-state message ("No combos match — try a card name, combo title, or part of a note.") shows when the filter has zero hits.
- **Filter state persists across re-renders** via module-level `_comboFilterText` — survives drag-reorder, rename, late hydration, deck switch. `applyComboFilter()` re-fires at the end of `renderCombos()`. Esc clears the filter; `×` button clears + refocuses.

### Decoder app — per-step card-text context (May 17 2026 patch)
- **`?` info chip on every step** in Cluster, Core, Compact, and Full views — hovering surfaces the primary card's full effect text in the existing hover-preview pane. The user can verify "what does this card actually do?" without leaving the combo.
- **`(via X's effect)` annotation is now hoverable** — the trigger card's effect text shows on hover. Subtle dotted underline + cursor: help signals the interactivity.
- `getStepPrimaryCard(step)` picks the most informative card per step (handles Detach / Overlay / AttachMaterial where `cards[1]` is the actor, not `cards[0]`). `attachPreviewHover(el, card)` wires any element to the existing `showPreview`/`hidePreview`/`pinPreview` infra — single source of truth for hover behavior.

### Decoder app — combo narration accuracy (May 2026 patch)
- **Solo Mode mulligan filter**: `markMulliganSteps()` detects the leading `Draw × N → Return × N (hand → deck)` block and tags steps `_mulligan: true`. Hidden universally in cluster/core/compact/diagram/full views. A one-line banner ("Solo Mode mulligan — drew N, returned N to deck") replaces the noise so the user knows nothing was lost.
- **Equip-Spell placement detection**: when DuelingBook logs `Placed X from Deck/GY/banished to S-N` (vs the manual `Set X in S-N`), the renderer now narrates as `"Equip X to <target> from <source> (by effect)"` with monster inference via `inferEquipTarget()`. Fixes ADRASTEIA being misread as "Set" when Drastea places it as an equip.
- **Three-tier fallback** so this works on cards the cache hasn't seen yet: (A) cached + Equip Spell → `"Equip X to Y …"` with target; (B) cached + Continuous Spell/Trap → `"Place X face-up …"`; (C) no card data → still `"Place X face-up …"` (never the old wrong `"Set X"`). Late-hydration re-render from `enrichComboCards` then upgrades to tier-A precision once YGOPRODeck data arrives.
- **Simulator side**: `applyStepToState` Set handler matches the same logic and writes `isSet: false` for effect placements, so the end-board / phase mini-playmats don't show face-downs that should be face-up equips.
- **Better narration**: `Special Summon … onto X` now uses card type (`xyz`/`link`/`synchro`/`fusion`) for the verb; `Send to GY` from an S-zone of an equip → `"Equip X sent to GY (target left the field)"`.

### Decoder app — decks
- **Header deck-switcher** (fanned-cards SVG icon + active deck name + counts) → click to open popover
- Popover supports: switch deck, inline rename (✎), download .ydk (↓), delete (×), `+ Import .ydk`, `Manage all decks →`
- **Active deck is the global context** — Cards / Combos / Practice all operate on the active deck implicitly. There's no Decks tab anymore (its functionality moved to the popover + the legacy view is reachable via Manage).
- Content-hash dedup on import means re-importing the same `.ydk` doesn't create duplicates (across all three import paths). One-time cleanup runs on init for any pre-existing dupes.

### Decoder app — practice
- Shuffle 5 cards (going first) or 6 (going second). Going-first toggle persists.
- Match drawn hand against active deck's combos:
  - ✓ Playable (every required card in hand)
  - ⚠ Need 1 more (told which)
  - ✗ Need 2+ (faded)
- Per-deck consistency streak: `N openable / M hands · X%`
- "Walk through →" jumps to the open combo

### Decoder app — settings
- **Settings tab** (gear icon at right of tab bar)
  - **Theme**: dark/light toggle (light mode is implemented via `body[data-theme="light"]` overriding color tokens — works automatically because everything else uses CSS variables)
  - **Backup / Restore**: full JSON export of `ydk_decks`, `ydk_saved_combos`, `ydk_card_cache`, `ydk_practice_streak`, prefs. Restore is conservative-merge (never destroys local data).
  - **Danger zone**: clear all combos / reset card cache (both gated by themed confirm modal)
  - **About**: version badge `v1.5`, friendly description, live storage usage stats (`N decks · M combos · K cards · Z KB`)

### Decoder app — UI primitives
- **Custom modal** (`ydkConfirm` / `ydkAlert`) replaces native `confirm()` everywhere. Themed, animated, keyboard-friendly (Esc cancels, Enter confirms), supports HTML in messages, danger variant for destructive actions.
- Tab transitions: fade + slide on each tab switch (~180ms cubic-bezier, honors `prefers-reduced-motion`)
- Setup banner auto-hides when `location.hostname` is `localhost` / `127.0.0.1`
- Custom favicon (inline SVG fanned cards in accent orange)
- **Browser tab title reflects active deck** — `{deckName} · YDK Decoder` so multiple open tabs are distinguishable. Updated automatically on deck switch, rename, and DOM ready via `updateTabTitle()`.

### Chrome extension
- **Replay extractor** (`combo-import-helper.js`) — preserved from DuelMetrics v4.0; extracts log lines, opening hand, end-board state, structured steps. **Do not rewrite this** — it solves dozens of DB DOM quirks.
- **Deck extractor** (`content/deck-extractor.js`) — registered as `content_scripts` in manifest, auto-loads on every duelingbook.com page. Listens for `exportDeck` and `scanAllDecks` messages. Uses DuelMetrics' selectors:
  - Main: `#deck_constructor div.deck_cards .cardfront`
  - Side: `#deck_constructor div.side_cards .cardfront`
  - Extra: `#deck_constructor div.extra_cards .cardfront`
  - Card data: `.cardfront_content > .name_txt + .passcode_txt`
  - Deck name: `select#decklist_cb` selectedIndex
- **Service worker** orchestrates replay → combo → decoder injection (`saveDeckToDecoder`, `openInDecoder`). Stamps `combo.deckId` from `localStorage.ydk_active_deck_id` so combos auto-link to the active deck.
- **Popup** drives both flows + a `.ydk` file picker as the simplest path. Local deck library mirrored in `chrome.storage.local.savedDecks`.

---

## 🔧 In-progress / partially done

### N1.x — Multi-deck + variations system
Per `docs/ROADMAP.md`. **N1.1 (deck extractor) and N1.2/N1.3 (combos↔decks mapping) are done.** Still open:

- **N1.4** — Backup/restore. Done as the Settings → Backup/Restore feature.
- **N1.5** — End-to-end test on the 6 reference combos (`docs/DECK_CONTEXT.md`). Not yet done — Abid is testing the tool with their own `abid_doomz_2.ydk` deck.

### Variations
**Dropped from scope.** Per Abid (2026-04-27): "I think variations does not make sense tbh — what would happen is a user would create a variation of a deck → import that and map the combos etc to that new decklist." Each deck is independent.
- The schema fields `parentDeckId` / `isVariation` are still on legacy deck objects but are **not used** for any logic. New deck imports don't set them.

---

## 🚀 Next priorities (queued, not started)

The May 2026 round shipped the **complete Format Planner** (phases 1–4), plus the original 1–5 UI queue, the combo-narration bugs, per-step card-text chips, and sidebar search. Net result: the tool is now a deck-+-format-+-matchup planning workbench, not just a combo viewer.

### Next priorities (mostly real-world testing now)

### Other queued items (smaller, parallelizable with Format-planner phases)

4. **N1.5 end-to-end test sweep** — re-extract the 6 reference DoomZ combos against the current build and verify each renders cleanly in all 5 view modes. *Needs Abid physically driving the extension.*
5. **"Played as" indicator** — when Practice mode resolves a hand to a combo, stamp `combo.lastPlayedAt`. Tile shows a tiny clock icon if played in the last N days.

### Deferred per Abid's guidance

- ~~**Deck methodology section**~~ — **shipped as part of Format-planner Phase 1** (Decks tab → methodology editor).
- **Card-effect database for staples** — skip until misclassifications appear.
- **Quiz mode** — declined (2026-05-17).
- **Combos through handtraps** — Phase-3 matchup notes likely subsume the need; revisit only if real handtrap-played-around scenarios surface and notes can't capture them.

---

## 🪤 Gotchas / non-obvious decisions

### Architecture
- **Active deck is global context, not a destination.** There's no "Decks tab" — switching the active deck (via header switcher) reloads Cards/Combos/Practice. This was a deliberate refactor; do not revert.
- **localStorage is the source of truth.** No backend. Every piece of state has a `ydk_*` key. Backup/restore reads/writes a known set documented in `BACKUP_KEYS` in the decoder.
- **Cross-component sync uses CustomEvents** — `ydk:combo-injected` and `ydk:deck-injected` fire on `window` after the SW injects into localStorage. The decoder listens and re-renders.
- **Service-worker → page injection** is via `chrome.scripting.executeScript({ func: ... })` with the function serialized. Those `injectComboIntoDecoderPage` and `injectDeckIntoDecoderPage` functions in `service-worker.js` MUST be self-contained — no closures, no external refs except web globals.

### Role taxonomy
- **6 canonical roles** (collapsed from a legacy 14): `Starter`, `Extender`, `Engine`, `Floodgate`, `Board breaker`, `Handtrap`.
- Legacy `Searcher / Combo piece / Boss / Equip / Pendulum / Finisher` collapse to `Engine`. `Stopper` collapses to `Floodgate`. `Tech` is dropped (was a meaningless catch-all).
- The collapse happens in `normalizeRoles()` at `classify()` output time, so `CARD_OVERRIDES` entries can stay in the legacy 14-role format and they get normalized automatically. **Don't bulk-rewrite the overrides** — the collapse map handles it.

### Opener size
- Three buckets: `1-card`, `2-card`, `Other / mulligan`. Anything 3+ auto-folds to Other.
- `getComboOpenerSize(combo)` checks `combo.userOpenerSize` (manual override) first, falls back to `openingHand.length`. Always use this helper, never read `openingHand.length` directly for bucketing.
- **The opener-size pill AND drag-drop both write `userOpenerSize`.** Don't add a third path that bypasses it — coherency depends on one source of truth.

### Sort order (drag-reorder)
- `combo.sortIndex` is the user's chosen position; `getComboSortKey()` falls back to `Date.parse(extractedAt)` for combos that have never been touched.
- `persistComboOrder(orderedList)` densifies every visible combo's sortIndex to `100, 200, 300, …` after each drop. Numbers stay readable; future inserts have headroom; no floating-point midpoints to drift.
- Combos for non-active decks are NEVER reordered by a drag — `persistComboOrder` only rewrites keys present in the visible list.

### Combo step narration (`describeStep`)
- DuelingBook log convention: `Set X in S-N` = manual face-down set; `Placed X from <source> to S-N` = effect-driven placement (equip, continuous spell, etc.). The extractor maps both to `action: "Set"`, but the renderer disambiguates on the `detail` prefix.
- **Never describe `Placed X from Deck/GY/banished` as "Set X".** Use the three-tier fallback in `describeStep`. This is structural — true even when card data isn't yet hydrated.
- `inferEquipTarget()` looks at `stateAfter.field`, excludes the equip itself, sets/field-spells, and known spell/trap `frameType`. With one monster it's confident; with multiple it hedges with "likely" + candidates list.

### DuelingBook integration
- DB is **canvas-rendered for the deck builder** — `<img>` scraping doesn't work. We failed at this for several iterations before extracting DuelMetrics' working selectors (which target `.cardfront` real DOM elements that DO exist on the deck constructor page specifically — the rest of DB's UI is canvas).
- The deck extractor is registered as a **content script** (auto-loads), not injected on demand via `chrome.scripting.executeScript`. This was the breakthrough — `.executeScript({ files: [...] })` doesn't reliably hit DB's same-origin same-scope DOM, but a manifest-registered content script does.
- **Don't rewrite `combo-import-helper.js`** (CLAUDE.md rule). Targeted edits only.

### CSS / theme
- All colors are CSS variables in `:root`. Light theme overrides them under `body[data-theme="light"]`.
- The HTML `hidden` attribute interacts badly with `display: flex` on the same element. Modal backdrop and similar need `[hidden] { display: none !important }` to respect `hidden`. (We hit this exact bug with the modal — see the fix at `.ydk-modal-backdrop[hidden]` rule.)
- **Pill widths are fixed sizes via CSS variables**: `--pill-thumb-w-md/sm`, etc. Two sizes (md = 28×40 thumb, sm = 20×28). Every context override uses these — do not introduce bespoke pixel values.

### Browser extension lifecycle
- MV3 service workers go to sleep. The decoder injects use `chrome.scripting.executeScript` from the SW directly, but anything that requires the SW to wait for a response should explicitly handle the suspension (existing code does).
- Chrome aggressively caches MV3 SWs. After SW edits: `chrome://extensions` → **remove + re-add** the extension, not just reload. Verify via `YDK_SW_BUILD` console log.

### Storage shapes (truncated reference)

```js
// localStorage.ydk_decks  (schema v2 — May 2026)
[
  {
    deckId: "deck_<timestamp>_<random>",
    name: "abid_doomz_2",
    role: "primary" | "matchup",       // yours vs. opposing meta deck
    // ── Legacy fields (still kept, mirror the primary decklist) ──
    ydkContent: "#created by ...\n#main\n14558127\n...",
    counts: { main, extra, side, total },
    main: ["14558127", ...], extra: [...], side: [...],
    // ── v2 multi-decklist shape ──
    decklists: [
      {
        decklistId: "dl_<deckId>_<random>",
        name: "Main build" | "Snake-Eye splash" | …,
        ydkContent, counts, main, extra, side,
        notes,
        createdAt, updatedAt
      }
    ],
    primaryDecklistId: "dl_…",          // which decklist is currently "active"
    methodology: {                       // deck strategy notes (May 2026)
      summary, endboard, howItWins,
      strengths, weaknesses, keyRatios,
      techCards: [{ name, reason }, ...]
    },
    keyCards: [                          // phase 2 — auto-extracted from primary decklist
      {
        name: "Aluber the Jester of Despia",
        cardId: "70908596",
        category: "Boss" | "Starter" | "Extender" | "Handtrap" | "Floodgate" | "Tech",
        stopPriority: "high" | "medium" | "none",
        stopWith: "handtrap" | "removal" | "negate" | "outboard" | "ignore" | "",
        notes: "Their main starter — Ash this every time.",
        priority: 0,                     // sort order within category
        auto: true | false               // false = user edited, preserved on re-extract
      }
    ],
    source: "manual-upload" | "extension",
    notes: "",
    createdAt: ISO, updatedAt: ISO,
    _contentHash: "<length>:<first 200 chars>",  // dedup key
  }
]
// localStorage.ydk_decks_premigration_backup  → snapshot of v1 shape, one-time
// localStorage.ydk_decks_schema_version        → "2"

// localStorage.ydk_saved_combos
[
  {
    replayId, replayUrl, comboName,
    version: 3,
    deckId: "deck_xxx",          // ← stamped on save with active deck
    decklistId: "dl_…",          // which specific build (May 2026 phase 1)
    userOpenerSize: 1 | 2 | "other" | undefined,  // bucket override
    userTitle: "Elara opener (line A)" | undefined,  // rename override (May 2026)
    userNotes: "...",            // per-combo notes
    sortIndex: 100 | 200 | ...,  // densified on drag (May 2026)
    openingHand: [...names],
    steps: [...],                // each step may get a transient _mulligan flag
                                 //   at render time — not persisted
    endboard, endboardGraveyard, endboardBanished,
    isSolo, ...
  }
]

// localStorage.ydk_formats  (NEW — phase 3 format planner)
[
  {
    formatId: "fmt_<timestamp>_<random>",
    name: "May 2026",
    startDate: "2026-05-01",
    endDate: null,                      // null = current; auto-stamped when cloning to next format
    primaryDeckId: "deck_xxx",          // → ydk_decks (role:"primary")
    matchups: [
      {
        matchupId,
        opponentDeckId,                 // → ydk_decks (role:"matchup")
        tier: "tier1" | "tier2" | "rogue",
        howTheyWin, gameplanFirst, gameplanSecond,
        keyTargets: [card names],       // synced from opponent's keyCards on render
        techCardsThatShine: [...],      // legacy, kept for back-compat
        counterCards: [                 // per-matchup tech/counters (May 2026 late patch)
          { name, side: "good"|"bad", notes }
        ],
        relatedComboIds: [comboKey, …], // your combos that solve this matchup
        freeformNotes,
        // ── Phase 5 (May 2026 latest) ──
        chokepointTheirs: "",          // what they MUST NOT do
        chokepointOurs:   "",          // what they MUST stop us doing
        priorityFirst:    [{ text }],  // ordered playbook going first
        prioritySecond:   [{ text }],  // ordered playbook going second
        targetEndboard:   [cardNames], // what we want on field vs THIS deck
        sideboard: {
          goingFirst:  { in: [cardNames], out: [cardNames] },
          goingSecond: { in: [cardNames], out: [cardNames] }
        }
      }
    ],
    tournaments: [                      // Phase 5 tournament journal
      {
        tournamentId, name, date, location,
        deckVariantId,                  // which decklistId was played
        rounds: [
          {
            roundId, opponentDeckId,     // matches a matchup; "__unknown__" for rogue
            going: "first"|"second",
            result: "W"|"L"|"D",
            notes
          }
        ],
        notes, createdAt, updatedAt
      }
    ],
    notes, createdAt, updatedAt
  }
]
// localStorage.ydk_active_format_id  → string formatId
// localStorage.ydk_active_deck_id  → string deckId
// localStorage.ydk_practice_streak → { [deckId]: { hands, hits } }
// localStorage.ydk_theme           → "dark" | "light"
// localStorage.ydk_cards_view      → "compact" | "detailed"
// localStorage.ydk_combo_view_mode → "full" | "core" | "cluster" | "compact" | "diagram"
```

---

## 📁 Repo layout

```
.
├── README.md
├── HANDOFF.md                          ← this file
├── abid_doomz_1.ydk                    ← reference decks
├── abid_doomz_2.ydk
├── decoder/
│   └── ydk_decoder.html                ← single-file app, ~9000 lines
├── docs/
│   ├── CLAUDE.md                       ← AI briefing (rules, conventions)
│   ├── ROADMAP.md                      ← phased roadmap
│   ├── BUGS.md                         ← bug tracker
│   ├── DECK_CONTEXT.md                 ← DoomZ deck strategy + 6 test replay URLs
│   └── GIT_SETUP.md
├── extension/                          ← MV3 Chrome extension
│   ├── manifest.json                   ← v1.5.0
│   ├── background/service-worker.js
│   ├── content/
│   │   ├── combo-import-helper.js      ← DO NOT REWRITE
│   │   └── deck-extractor.js           ← content_script, auto-loads on DB
│   └── popup/                          ← popup.html, popup.js
├── sample-data/                        ← extracted combo JSON for testing
└── workshop/                           ← scratch space (gitignored zips)
```

---

## How to dev

1. `py -m http.server 8000` (or `python3 -m`) in repo root.
2. Open `http://localhost:8000/decoder/ydk_decoder.html`.
3. For extension changes: `chrome://extensions/` → reload (or remove+re-add for SW changes).
4. To test extension flow: open a DB replay → click extension icon → Extract → Open in Decoder. Combo lands in decoder Combos tab tagged with active deck.
5. Settings → About shows live storage stats + version. Settings → Backup downloads a single JSON of everything.

## Hard rules

- **Vanilla JS only.** No npm, no build step, no framework. Single-file HTML where possible.
- **Don't rely on file://.** YGOPRODeck API + images need a real origin (CORS).
- **Don't rewrite `combo-import-helper.js`.**
- **Don't add analytics or telemetry.** Personal tool.
- **Don't invent card text.** New BLZD cards stay flagged `VERIFY` until real data lands.
