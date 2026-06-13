# HANDOFF — YDK Decoder

Snapshot of the project state for whoever picks this up next (including future-me).
Last updated: **2026-06-13**.

---

## ⚡ Current build: the React app in `app/` (2026-06)

**Development moved to a React + Vite SPA in `app/`.** Everything below this banner
describes the **legacy single-file decoder** (`decoder/ydk_decoder.html`) and the
extension — both still exist and are preserved, and the Yu-Gi-Oh domain knowledge
+ data model below all still apply. But the app Abid uses now is the React build.

**Stack:** React 19 + Vite 8, plain JSX, plain CSS tokens. Deps: `react`/`react-dom`
only. Client-only; **same `ydk_*` localStorage keys + backup format** as the legacy
app (`app/src/lib/storage.js`), so data carries across. Run: `cd app && npm run dev`.

**Tabs (parity with + beyond the legacy app):**
- **Decks** — deck list, decklist viewer, methodology/matchup **playbook** editor,
  **key-card buckets** (Boss/Starter/Extender/Handtrap/Floodgate/Tech; Boss now
  includes the Extra deck) with a per-card **Category** control.
- **Format** — read-only matchup **dashboard** with "Edit in Decks →" deep links,
  format export/import, "+ Add from library", **side-deck planner** (named patterns,
  going first/second, copy-count dots, visual OUT/IN summary), **tournament journal**
  (event name · type · date, rounds, aggregated record).
- **Combos** — list + image **gallery**, detail with **Line / Simulate / Drill**, a
  full **combo editor** (multi-deck links via `deckIds[]`, opener-size control, edit
  opening hand / end board, full **step editor**: add/remove/reorder/retext + per-step
  cards, live simulated board, **"plays through" handtrap tags** `beatsTraps[]`),
  manual builder, paste/import JSON, extension ingestion.
- **Testing** — **Going first** (goldfish → role-tagged hand → playable lines matched
  from saved combos, handtrap badges, **"if they have <handtrap>" filter**) and
  **Going second** (board breaker with Game-1 / sided Game-2 hands).
- **Settings** (gear) — data overview, **backup/restore** (same JSON as legacy),
  theme, danger zone.

**2026-06 — UI overhaul P1–P6 complete + Fable 5 feature pass.** The whole-app
design system is enforced and measured: every boxed control is exactly
26/32/40px, every segmented toggle computes one identical spec, headers/tiles/
empty-states share one recipe each, plus one motion language, one Esc back-out
order, per-tab scroll memory, `/`-to-search, and a context-aware title bar
(`docs/UI_OVERHAUL_PLAN.md`, P1–P6 all ✅). Earlier in the pass: handtrap-
resistance loop (tag lines that "play through" Fuwa/Droll/Imperm → Format
breakdown intel → Testing preset), exact-hypergeometric opening odds, printable
matchup cheat sheet, drill mastery, DuelingBook↔official card-name aliases.
Functional machinery verified live on the real `abid_doomz_1.ydk` (import,
roles, odds, combo CRUD, backup/restore, draw-a-hand) — see `docs/READY_CHECK.md`.

**The only untested-by-machine items left** are the 5 in **`docs/READY_CHECK.md`**
— they need Abid's machine + the Chrome extension + his eyes on his own cards
(serve at `localhost:8000/react/`, the extension→Combos handoff, his deck's
cards all resolving, one real backup). That is the live to-do.

Docs: `app/README.md` (React app), `docs/READY_CHECK.md` (the live checklist),
`docs/UI_OVERHAUL_PLAN.md` (design system + P1–P6), `docs/FABLE5_REVIEW_PROMPT.md`.

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
| Decoder | `2026-05-30-phase6O-meta-loader` |
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

### Phase 6O — meta pack + one-click loader + Board-Breaker tie-in (May 30 2026, LATEST)
- **17 meta matchup decks** (TCG, May 2026) extracted from ygoprodeck tournament
  lists → `meta-decks/*.ydk` (added **Clown Crew** this session). Built into
  `meta-decks/meta-matchups-backup.json` by `scripts/build_meta_backup.py`, whose
  `INTEL` dict now carries **researched + cited** strategy per deck (see
  `docs/META_2026-05.md`). Each matchup is **fully pre-filled**: `howTheyWin`,
  `targetEndboard` (named cards), `chokepointTheirs`, `gameplanFirst/Second`,
  `counterCards` (recommended handtraps), and a `tier`.
- **⚡ Load meta decks** button — **Settings → Meta decks**. `loadMetaMatchups()`
  fetches the bundled JSON over localhost and smart-merges: adds/refreshes the
  `deck_meta_*` decks (preserving user `keyCards`/`notes`) and refreshes the
  researched fields on each matchup in `fmt_meta_may2026` while **keeping** the
  user's tournament journal, freeform notes, side plans and priority steps.
  Re-runnable to pull the latest research. Falls back gracefully off-localhost
  (clear alert). Manual paths (Settings → Restore, Format → + Import .ydk) still work.
- **Role-recovery banner false-positive fixed** — `detectMatchupDecksThatShouldBePrimary()`
  now ignores `meta-import` decks (`source === "meta-import"` / `deckId` prefix
  `deck_meta_`), so loading the pack no longer triggers the "all your decks are
  Matchup" scare. Only genuinely-flipped *user* decks are flagged.
- **Board Breaker ⚡ "Use their typical board"** — Testing → Going second seeds an
  end-board profile straight from the matchup's `targetEndboard`
  (`bbSeedProfileFromMatchup`, disruption inferred from card roles). Also a
  **⚡ Pull from matchup plan** button inside the board editor. Ties the meta intel
  directly into going-second practice.
- New reusable script: `scripts/resolve_ydk.py` (passcodes → card names via API);
  `scripts/check_html_js.py` (extract inline scripts → `node --check`).
- All verified live on localhost (preview): loader merge (17 decks, pre-filled
  matchups render), banner suppressed, board-breaker seed builds pieces, 0 console
  errors, all 4 tabs render.

### Phase 6M — modal-shell refactor + tickable checklist (May 29 2026)
- **`runChoiceModal(opts)`** — one shared shell for "pick/fill in" modals
  (open / cleanup / Esc / backdrop / listener removal in one place).
  `pickTournamentType`, `addRoundFlow`, and `pickFromList` now all use it
  (~3 copies of boilerplate → 1). `opts`: `title/icon/confirmText/cancelText`,
  `render(msgEl, api)` (call `api.setValid(bool)`), `getResult()`,
  `cancelValue`, `enterConfirms`. All 3 verified live, no regressions.
- **`docs/test-checklist.html`** — standalone interactive checklist (open in
  browser): real checkboxes + per-item note fields, progress bar, auto-saves
  to localStorage, "Copy results" + "Reset". Mirrors `docs/TEST_CHECKLIST.md`.

### Phase 6L — Batch E: backup nudge + combo drill + matchup cheat-sheet (May 29 2026)
- **Auto-backup nudge** (`renderBackupNudge`, host `#backup-nudge`): amber banner
  when there's real data + no backup in 7 days (or ever). "Back up now" exports +
  stamps `ydk_last_backup`; "Remind me tomorrow" snoozes 24h
  (`ydk_backup_nudge_snooze`). `runBackupDownload` records the time + refreshes it.
- **Combo drill** (`buildComboDrill`): "🎓 Drill" button on the open combo →
  flashcard recall — shows the opener, reveals the line one play at a time
  (Reveal / Hide last / Restart / Exit). Uses core steps via describeStep.
- **Matchup cheat-sheet** (`openMatchupCheatSheet`): "📄 Cheat sheet" button in the
  matchup drill → clean printable page in a new window (how they win, chokepoints,
  their typical board, key targets, both playbooks, side plan, notes, record).

### Phase 6K — Board Breaker (going-second practice) (May 29 2026)
The Practice tab is renamed **Playtest** with two modes:
- **Goldfish — your openers** (the existing going-first hand/combo matcher).
- **Break boards — going 2nd** (new): pick an opponent + one of their saved
  end-board profiles, shuffle a going-second hand, and work out whether you
  can break it.

Design choice (guided, not a solver): the app sets up the PUZZLE and tracks
results; it does NOT auto-decide if you break the board (that needs full
interaction-rule simulation and would rob the practice). It:
- lists the opponent's board pieces with a **disruption tag** (Negate /
  Removal / Floodgate / Just a body) + note, KB hover;
- highlights your drawn **board breakers** (accent) and **handtraps** (blue)
  via the KB roles;
- shows a **rough gauge** ("N breakers + M handtraps vs K disruptions") as a
  hint, explicitly "not a verdict";
- lets you self-assess **Broke it / Partial / Couldn't** + a line note, logged
  as a per-(deck,opponent) tally in `ydk_bb_streak`.

Data: opponent **end-board profiles** stored on the opponent deck
(`deck.endboards = [{ endboardId, name, pieces:[{card, disruption, note}] }]`),
reusable across formats. Build them in the inline **board editor**
(`renderBbEditor`): add cards via the autocomplete picker, tag each
disruption, or **import a combo's end board**. Multiple profiles per
opponent cover Full vs Half boards. If the active format has a matchup vs
that opponent, its going-second **side plan is auto-applied** to the shuffle.

Key functions: `renderBoardBreaker`, `renderBbEditor`, `bbShuffle`,
`bbGaugeAndAssess`, `bbOpponentDecks`, `bbSidePlan`, `ensureDeckEndboards`,
`pickFromList`. Mode toggle: `wirePlaytestModes` + `_playtestMode`.

### Phase 6J — KB via API + name aliases + validation + loading screen (May 29 2026)
Three things in one pass.

- **Authored the combo's splash cards from the YGOPRODeck API** (not invented —
  pulled the real text by passcode). KB now 38 cards: added Springans
  Merrymaker, Gigantic "Champion" Sargas, Therion "King" Regulus, Terminus,
  Vidrium, Vidria, Varudras, Forbidden Crown, Dimension Shifter, Dark Ruler No
  More, Lightning Storm; flipped the 4 `verify` cards (ADRASTEIA, Graflario,
  Zegredo, Change) to confirmed.
- **DuelingBook ↔ official name aliases.** Discovered DuelingBook uses
  unofficial early names for the new "Power Patron" cards (combo's "Zegredo" =
  official "Jupredo the Shademachine Power Patron", same passcode 43871165).
  `CARD_FX_ALIASES` maps official → DB key so `getCardFx` resolves either name
  (combo logs use DB names, Cards tab / API use official). Likely the root of
  past "missing data / VERIFY" for these cards.
- **Validation/coverage chip.** `buildComboCoverageChip` shows, at the top of
  each open combo, "✓ Effect data for all N cards" or "⚠ N need data: …" —
  surfaces gaps instead of silently rendering context-less cards. (Real combo:
  "all 12 cards".)
- **First-paint loading overlay.** `#ydk-loading-overlay` (logo + spinner)
  fades out once init finishes (`window.__ydkHideLoading()`), with a window-load
  + 3s fallback. Respects prefers-reduced-motion.

### Phase 6I — card knowledge base (May 29 2026)
The structured per-card effect DB that the smarter combo engine runs on.

- **`CARD_FX`** (top of script, after NAME_OVERRIDES) — 27 cards so far: the 15
  DoomZ / Power Patron core (Abid-confirmed) + 12 handtraps/staples (from
  INLINE_CACHE). Each entry: `archetype`, `roles`, a stripped memorizable
  `summary`, a `mechanics` block of structured flags (`setsFromDeck`,
  `equipsFromDeck`, `searchesFromDeck`, `isEquipSpell`, …), and `verify` (true
  for the 4 placeholder-passcode cards). Accessor: `getCardFx(name)`.
- **First wiring — "In short" in the hover preview.** `_renderPreviewBody` now
  shows the KB stripped summary in an accent block ABOVE the full Konami text,
  on every card hover everywhere (combos / decks / format). Non-KB cards fall
  back to plain text. This is the memorization payoff — learn the function, not
  40 lines. (Verified live: Elara/Ash show "In short", random card doesn't.)

**Still TODO on the KB (next):**
- Author the combo's splash cards — need Abid's real text (don't invent):
  Springans Merrymaker, Gigantic "Champion" Sargas, Therion "King" Regulus,
  Unleashed Power Patron Portal - Terminus, Vidrium …, Null Power Patron Realm -
  Vidria, The Fallen & The Virtuous.
- Validation pass: flag combo steps referencing cards with no KB/cache data.
- (Optional) KB-driven equip targets where the card text fixes the target
  (e.g. Drastea equips to itself).

### Phase 6H — mulligan opener + face-down-set narration (May 29 2026)
Two extraction-accuracy fixes, verified against Abid's real Amalthe combo JSON.

- **Effective opener for Solo Mode mulligan combos.** `computeEffectiveOpener(combo)`
  detects the leading draw→return-all block and returns the REAL opener = cards
  searched/added to hand before the first board play. A 1-card Amalthe line whose
  recorded `openingHand` was the 5 discarded mulligan cards now buckets as
  **1-card** (not "Other/mulligan"), and the open combo + tile show Amalthe as the
  opening hand (with a "real opener after mulligan" tag). Used by
  `getComboOpenerSize`, the opening-hand render, and the combo tile art/thumbs.
- **Face-down set vs equip.** `markFaceDownSets(steps)` flags a "Placed X from
  Deck/GY to S-N" step that has a companion explicit "Set X in S-N" line — a
  reliable DuelingBook signal that the card went FACE-DOWN (e.g. Elara setting a
  DoomZ S/T from Deck). `describeStep` now narrates "Set X face-down (by effect)"
  for those, instead of mis-narrating an Equip Spell as "Equip … to <monster>".
  ADRASTEIA equipped from GY (no companion Set line) still reads as "Equip".

Both are decoder-side only — combo-import-helper.js untouched. These are
targeted correctness fixes; the general solution is the planned card-knowledge
base (see ROADMAP "smarter combo engine"), which will drive narration from each
card's actual effect text rather than log-pattern signals.

### Phase 6G — guided tournament round form (May 29 2026)
Logging a round used to append a blank inline row of selects the user had to
decode. Replaced with a guided modal (`addRoundFlow(format, t)`):
- **Opponent** — pre-selected buttons built from the format's matchups, plus
  an "Unknown / rogue" option. (The user's requested "pre-selected list from
  format analysis".)
- **Going first / second**, **Win / Loss / Draw** (colour-tinted), an optional
  **score** field (e.g. "2-1"), and an optional **notes** box.
- Confirm is disabled until opponent + result are chosen.
- New `round.score` field added to the schema + shown in the inline round row.
- "+ Add round" now opens this form; on confirm it re-renders the Format tab
  (refreshing the matchup aggregate W-L badges).
Verified live: form renders all options, persists a round with every field,
and the matchup aggregate badge updates (0-1 after logging a loss).

### Audit pass 1 — autonomous deep audit (May 28 2026)
Full-app audit (init/migration, cross-references, backup/restore, Format tab,
combos, practice, Chrome extension). Five real issues found + fixed, all
verified in a live localhost browser session. Full detail in `docs/BUGS.md`.

- ✅ **Restore silently dropped the Format Planner** — backup exported
  `ydk_formats` but `runRestoreFromFile()` had no formats branch. Added a
  conservative formats merge (dedupe by formatId).
- ✅ **Header deck-switcher delete skipped reference cleanup** — now calls
  `cleanupDeckReferences()` like the other two delete paths.
- ✅ **Extension-pushed / restored decks stuck in v1 shape** — new idempotent
  `ensureDeckV2Shape()` + `normalizeAllDecksShape()` backfill decklists/role/
  methodology/keyCards (deterministic `dl_<deckId>_main` id), wired into init
  + the `ydk:deck-injected` handler.
- ✅ **Init dedup left formats dangling** — now repoints `primaryDeckId`,
  `matchup.opponentDeckId`, and tournament-round `opponentDeckId` to the
  surviving keeper.
- ✅ **Tournament drill scroll-jump on round edit** — now renders standalone
  (early-return) like the matchup drill, so refreshing aggregate badges
  doesn't yank the user to the top of the matchup grid.
- 🧹 Removed dead `wireBackupRestore()` IIFE (wired non-existent button ids).

Two items flagged for Abid (need Chrome / real combos): practice
hand-matcher strictness, and the extension combo-landing tab highlight.
See `docs/BUGS.md` → "Audit pass 1".

### Phase 6F — Archetype + type grouping (May 19 2026)
Bulk card lists are now ordered by what matters, not by .ydk position.

**Helpers (new, top of utilities)**
- `detectArchetypeTokens(uniqueNames)` — finds words that appear in 2+ distinct card names. Those are the deck's archetype tokens (for a DoomZ deck: `doomz`, `power`, `patron`, `command`). Skips a stop-word list (`the`, `of`, `king`, roman numerals, etc.).
- `isEngineCard(name, archetypeTokens, tokensByName)` — true iff the card has at least one archetype token in its name. Splash 1-ofs with no shared word (e.g. Therion King Regulus) fall into Staples.
- `classifyCardBroadType(card)` — `"Monster"` / `"Spell"` / `"Trap"` / `"Other"` from `card.type`.

**Key Ratios autofill (the user-visible fix)**
- Instead of one wrap-crammed `<p>`, output up to 8 sections, each with an `<h4>` header and a `<p>` of chips:
  - Engine — Monsters / Spells / Traps / Other
  - Staples — Monsters (handtraps + tech) / Spells / Traps / Other
- Empty sections are skipped.
- Within every leaf bucket: count desc → name asc.
- Status bar reports which archetype tokens were detected.
- Triggers `showSaveToast("Auto-filled")` so the user sees the save.

**Side-deck planner pool order**
- Both side pool and main pool are now sorted by broad type (Monster → Spell → Trap → Other), then by name. Raw .ydk export order is meaningless for sideboarding; this makes the drag-out workflow scannable.
- Duplicates remain as separate chips so 3× copies are still 3 draggable instances.

### Phase 6E — Visual refresh (May 19 2026)
End-to-end UI polish. Functionality unchanged; everything is visual + interaction-layer.

- **Design tokens refresh.** Deeper bg layers (`--bg`, `--bg-elevated`, `--bg-card`, `--bg-card-hover`), softer borders (`--border-subtle`), brighter accent hover (`--accent-hover`), accent soft tint (`--accent-soft`). Added elevation tokens (`--shadow-sm/md/lg/glow`), radii (`--radius-sm/md/lg`), motion tokens (`--motion-fast/base/slow` with cubic-bezier easing). All legacy names preserved.
- **Body + header.** Subtle radial gradient backgrounds (warm at 12% top-left, cool at 92% bottom-right), Inter / SF font stack with antialiasing, refined h1 weight + letter-spacing.
- **Tab bar.** Subtler border, smoother color transition, no more loud underline — just an accent-bottom-border on active.
- **Polish layer (CSS block at end of style).** Focus rings, dark scrollbars, modal entrance animations (`ydk-modal-fade-in` + `ydk-modal-slide-up`), elevated deck/combo/matchup tiles with hover lift, panel section shadows, RTE focus elevation + toolbar gradient, sub-view back-bar gradient.
- **Unified `.btn` helper.** New `.btn` base + `.is-primary` / `.is-secondary` / `.is-ghost` / `.is-danger` variants. Drop-in for future components; existing buttons unchanged.
- **Matchup drill → collapsible sections.** The 10-section vertical scroll is now grouped into 7 collapsible blocks with the most-needed sections open by default:
  1. Quick reference (open) — chokepoints + key targets
  2. Playbook (open) — priority playbook (going first + second)
  3. Target end board (open)
  4. Side-deck plan (collapsed)
  5. Tech & counter cards (collapsed, header shows count)
  6. Combos that solve this matchup (collapsed, header shows linked count)
  7. Detailed notes / freeform (collapsed) — the 4 freeform RTE fields
- **Save indicator toast.** `showSaveToast("Saved")` fires on every 200ms-debounced RTE save + on Combos-checkbox toggle. Coalesces duplicate labels within 600ms; capped to 3 visible toasts; fades in/out from bottom-right.
- **Smoother tile selection.** Selected role-stripe expansion uses `--motion-base` (was a hard 0.12s).

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

As of 2026-05-19 the app is **feature-complete** through Phase 6F: a full
deck-+-format-+-matchup planning workbench with rich-text notes, visual
refresh, and archetype-grouped Key Ratios. There are **no half-finished
features in the code.** The queue is now verification first, then backlog.

**In priority order:**

1. **Verify Phase 6E + 6F** *(active — needs Abid driving the app).* Run the
   test checklist the assistant produced (visual refresh, matchup collapsible
   sections, save toast, Key Ratios archetype grouping, sideboard pool
   ordering, plus regression of all prior features). File any failure as a
   numbered BUGS.md entry and fix before new features.
   - Watch the 6F grouping specifically: Engine vs Staples split correct for
     DoomZ? If a card lands wrong, tune `_ARCHETYPE_STOP_WORDS` or the 2-card
     threshold in `detectArchetypeTokens()`. Type ordering depends on
     `card.type` being hydrated (cold cache buckets as "Other").
2. **N1.5 end-to-end extraction sweep** *(needs Abid + Chrome extension).*
   Re-extract the 6 reference DoomZ combos (`docs/DECK_CONTEXT.md`) and verify
   thumbnails resolve, each tags the right `deckId`, endboards are sensible,
   disruption groups correctly, and combos roll up under the active deck.
3. **"Played as" indicator** — when Practice resolves a hand to a combo, stamp
   `combo.lastPlayedAt`; tile shows a clock icon if played recently.
4. **Backlog** (see `docs/ROADMAP.md` § Backlog): mobile/narrow layout (B3.1),
   SVG diagram arrows (B3.2), replace BLZD placeholder passcodes (B3.3),
   combo tagging/filtering (B1.1), spaced-repetition practice (B4.1).

### Deferred per Abid's guidance

- ~~**Deck methodology section**~~ — **shipped as part of Format-planner Phase 1** (Decks tab → methodology editor).
- **Card-effect database for staples** — skip until misclassifications appear.
- **Quiz mode** — declined (2026-05-17).
- **Combos through handtraps** — Phase-3 matchup notes likely subsume the need; revisit only if real handtrap-played-around scenarios surface and notes can't capture them.

---

## 🪤 Gotchas / non-obvious decisions

### Architecture
- **Two ways to reach a deck, and they coexist (don't "simplify" this away):**
  1. **Decks is a top-level tab** (re-introduced in Phase 6A). It's a master/detail workbench — deck-tile list + selected-deck panel (methodology, key cards, decklists, notes) + "Cards ↗" / "Combos ↗" sub-views.
  2. **The header deck-switcher** sets the *active deck* — the global context that the Cards / Combos sub-views and Practice operate on.
  - Earlier (2026-04-26) there was a refactor that *removed* the Decks tab and made active-deck-via-switcher the only model. Phase 6A reversed that for the Format Planner. **Both now exist on purpose**: the tab is where you *manage* decks; the switcher is what picks the *active* one. Cards & Combos are NOT top-level tabs — only Decks / Format / Practice (+ Settings gear) are.
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
