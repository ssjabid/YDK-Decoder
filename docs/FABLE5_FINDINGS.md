# FABLE5 FINDINGS — full-app audit (React build)

Audit date: 2026-06-10. Method: 5 parallel area audits (Decks, Format, components,
libs, styles) + a direct pass over the combo engine / Testing / Settings, with
**every blocker/major claim re-verified against the source** before inclusion.
Findings are ranked by impact on Abid's actual goal (enter his DoomZ combos +
matchup analysis safely, then drill them).

Severity: **B**locker · **M**ajor · **m**inor · **p**olish.
Each: what's wrong → proposed fix → risk of fixing.

---

## TIER 1 — data safety (fix before Abid enters hours of real data)

### F1 · B · Silent data loss when localStorage fills up
`storage.js:38-46` — `writeLs` catches **all** exceptions and only `console.warn`s.
A `QuotaExceededError` means the save **silently never happened**; the user keeps
working and loses everything on reload. And quota *will* eventually be hit:
`ydk_card_cache` grows unbounded — `fetchCards` (`ydk.js:55-62`) caches the **full
API object** for every card ever seen (including `card_sets`, `card_prices`, every
alt-art image entry), plus one cache entry **per alt-art id**, and `searchApi`
adds more. Hundreds of heavy card objects + 18 meta decks ≈ multi-MB; localStorage
is ~5MB.
**Fix:** (a) slim card objects before caching (keep id/name/type/race/desc/atk/def/
level/linkval/scale/frameType + first image id only); (b) in `writeLs`, detect
quota errors → auto-clear the card cache (it's re-fetchable) → retry once → if
still failing, surface a **visible modal**, never a silent warn; (c) one-time
migration to re-slim the existing cache. **Risk: low** (cache is derived data).

### F2 · M · A single render error blanks the whole app
`App.jsx` has no React error boundary. Any uncaught render exception (one bad
combo object is enough) = permanent white screen for a non-developer with no
recovery path.
**Fix:** add a small `ErrorBoundary` around the tab content with "Something broke
rendering this tab" + a "Back to Decks" reset button (and the error text to copy
to me). **Risk: low.**

### F3 · M · Restore-replace has no safety net
`backup.js:91-96` — `restoreReplace` wipes **every** key then writes the file's
contents. The Settings UI confirms first, but a corrupted/wrong backup file =
everything gone, unrecoverable.
**Fix:** before wiping, snapshot current data to `ydk_restore_safety` (a non-KEYS
key so the wipe loop can't touch it) + show "Restore undone-able for this session
→ Undo" after. **Risk: low.**

### F4 · M · Deck delete leaves ghost multi-deck links
`deckModel.js:126-132` — `deleteDeck` clears legacy `combo.deckId` but not the new
`combo.deckIds[]` (multi-deck links added this month). Ghost ids inflate the
"Deck +1" label and survive forever in saved data. (The *matchup* dangling-id
behaviour at `:123-125` is documented + rendered defensively — kept, but see F17.)
**Fix:** also filter `c.deckIds`. One line + verify. **Risk: low.**

### F5 · M · No backup nudge
The legacy app nudged after 7 days without a backup; the React app has
`lastBackupAt()` but never uses it. Abid is about to invest hours of analysis.
**Fix:** small amber banner (dismissable, snoozes 24h) when real data exists and
no backup in 7 days; one click = download + stamp. Same keys the legacy app used
(`ydk_last_backup`, `ydk_backup_nudge_snooze`). **Risk: low.**

---

## TIER 2 — the core loop (hand → line) works better

### F6 · M · "Playable lines" almost never fire for freshly-extracted combos
`practice.js:89-117` — `matchCombosToHand` requires **every** card of
`combo.openingHand` to be in the drawn 5. For extracted combos, `openingHand` is
the *entire 5-card drawn hand* from the replay → drawing those exact 5 again is
near-impossible → extracted lines sit at "✗ Need 4" forever. Hand-built/curated
combos (1-2 card openers) match fine — so the app silently rewards curation
without ever telling the user.
**Fix (two parts):** (a) in Testing, when a line's `openingHand.length` is much
larger than its `userOpenerSize`, show a one-line hint: "trim this combo's
opening hand in the editor for accurate matching"; (b) **flagged for Abid** —
optional heuristic: when `userOpenerSize=N` is set, treat a hand as *possible*
when it holds ≥N of the recorded opener cards. It's a guess about which cards
matter, so I won't ship it without your call. **Risk: (a) zero, (b) needs your
judgment.**

### F7 · m · Simulator drops cards in two step types
`comboSim.js` — (1) `Draw`/`Search` push only `cards[0]`; a step recording 2+
cards loses the rest from the simulated hand. (2) `Send to GY`/`Destroy`/
`Tribute`/`Discard` push to GY but only remove from hand/field when the detail
text says so — otherwise the card is duplicated (in hand *and* GY).
**Fix:** push all `cards` on draw/search; on GY-bound actions fall back to
removing the first copy found in hand→field→nothing. **Risk: low** (pure logic,
verify with the sample combos).

### F8 · m · Journal round edits address rounds by list index
`FormatTab.jsx:568/575/582` — mutations write `tt.rounds[i]` with the render-time
index. Narrow timing windows around a delete can write to the wrong round.
**Fix:** address by `r.roundId` (already exists on every round). **Risk: low.**

---

## TIER 3 — API hygiene + robustness

### F9 · m · Card search fires an API call on every keystroke
`CardPicker.jsx:41-43` and the `@`-mention search in `RichNotes.jsx:64-69` hit
`searchApi` for every keystroke ≥3 chars — typing a long name ≈ 15+ requests.
YGOPRODeck rate-limits; a 429 ban would "break search" mysteriously mid-session.
(The race-condition claim was false — effect cleanup already guards ordering.)
**Fix:** 300ms debounce in both. **Risk: low.**

### F10 · m · Playmat retries unknown card names forever
`EndBoardView.jsx:112-122` — the self-healing lookup has no memory of failures; a
misspelled board card re-queries the API on **every mount** of every playmat that
contains it.
**Fix:** module-level session `Set` of failed names; skip known failures.
**Risk: low.**

### F11 · m · `fetchCards` requests all ids in one URL; misses aren't cached
`ydk.js:51` — 200+ unique ids would exceed URL limits (not hit today, but one
"fetch everything" feature away); ids the API doesn't know are re-requested every
load.
**Fix:** chunk requests (~120 ids), remember not-found ids for the session.
**Risk: low.**

### F12 · m · Stacked modals orphan the first promise
`ModalHost.jsx:6-14` — a second modal request overwrites `req`; the first caller's
promise never resolves (its `await` hangs).
**Fix:** when overwriting, resolve the previous request with its cancel value.
**Risk: low.**

### F13 · m · Notes HTML is stored + re-injected unsanitized
`RichNotes.jsx:37` — `el.innerHTML = storedValue`. Fine for self-typed notes, but
a tampered **backup/combo JSON import** could carry `<img onerror=…>` etc.
Personal tool → low likelihood, cheap defense.
**Fix:** strip `<script>`, inline `on*=` handlers and `javascript:` URLs inside
`normalizeNotesHtml`. **Risk: low.**

### F14 · m · No cross-tab/live sync (also the extension's landing pad)
All mutations are load→mutate→save whole array; a second tab (or the extension
injecting a combo into another tab of the same origin) is invisible until reload,
and last-writer-wins can drop a change.
**Fix:** listen to the `storage` event → bump `dataVersion` (the app already
re-renders off it). Cheap, and makes extension-extracted combos appear live.
**Risk: low.**

---

## TIER 4 — UI/a11y/responsive polish (verified subset)

### F15 · m · Reduced-motion gaps + tiny faint text
`app.css` — several animations (`modal-pop`, `dd-pop`, `hand-deal`, `section-in`,
`preview-in`) ignore `prefers-reduced-motion`; a handful of real labels render at
8-10px in `--text-faint` (`.key-card-manual` 8px, `.combo-line-trap` 9.5px,
trap-chip green at 12% alpha).
**Fix:** one `@media (prefers-reduced-motion: reduce)` blanket for the animation
classes; bump sub-10px informational text to 10-11px / `--text-dim`. **Risk: low.**

### F16 · m · 768–1024px (laptop split-screen) layouts overflow
Sidebars + multi-column grids only collapse below ~800-1000px and some toolbars
overflow before that. Matters at a tournament with a split screen.
**Fix:** targeted media-query pass over the four tab layouts (decks grid, combos
layout, practice grid, format dash) — wrap toolbars, let sidebars shrink.
**Risk: low-med** (CSS only, verify each tab visually).

### F17 · p · Assorted
- Deck delete could *offer* to also remove that deck's matchup entries (today they
  linger as "Unknown deck" by design) — `deckModel.js:123`.
- `PanelSection` header isn't keyboard-toggleable; Dropdown lacks Home/End;
  heading rows could use `role="presentation"`.
- `Icon` silently renders nothing for unknown names.
- Journal aggregate counts rounds vs deleted decks under their raw id.
- Hardcoded dark gradients in `.eb`/`.hand-card-tag` break light theme (dark is
  the default + Abid's preference — low priority).
- Light-theme role-color rgba tints are near-invisible.

---

## Opportunities flagged (not bugs — need your go/no-go)

- **O1 · Printable matchup cheat-sheet.** The legacy app had one (how they win,
  chokepoints, board, side plan, record on one printable page). High tournament
  value, medium effort.
- **O2 · Mastery tracking / spaced repetition on Drill.** Track per-combo drill
  results ("got it / fumbled") → surface the lines you fumble most. Medium effort.
- **O3 · Combo ↔ matchup links.** Legacy `relatedComboIds` ("combos that solve
  this matchup") isn't surfaced in the React Format dashboard. Medium effort.
- **O4 · Serve the built app at `localhost:8000`** so extension-extracted combos
  land in the React app directly (same-origin storage). Small effort: build +
  copy into the repo root the python server already serves, or a tiny script.
- **O5 · Effective-opener matching heuristic** (see F6b) — needs your call.

## Claims from the area audits that did NOT survive verification
(recorded so they don't resurface): format clone losing `sidePlans` (the spread
preserves them); CardPicker out-of-order API race (effect cleanup guards it);
Dropdown menu lacking max-height (`.dd-menu` has `max-height:300px`); playbook
multi-field save race (each save re-loads from storage; fields are isolated);
SideboardPlanner mutating stored plans (writes are immutable).

---

## Proposed implementation order

1. **Batch A — data safety:** F1, F2, F3, F4, F5 (all low-risk, highest stakes).
2. **Batch B — core loop:** F6a (hint), F7, F8.
3. **Batch C — API/robustness:** F9, F10, F11, F12, F13, F14.
4. **Batch D — polish:** F15, F16, selected F17.
5. **Separately, on approval:** O1–O5.

Each batch: implement → verify live in the browser → themed commit.
