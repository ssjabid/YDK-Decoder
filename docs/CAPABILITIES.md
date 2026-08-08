# CAPABILITIES — everything the app can do (verified 2026-08-08)

Every item below was exercised end-to-end on 2026-08-08 (live browser, real
`abid_doomz_1.ydk` + the 18-deck meta pack + the two sample combos), with zero
console errors, at desktop (1280×800) and phone (375×812) widths. This is the
inventory to play against — if something on this list doesn't work for you,
that's a bug report.

---

## Decks

- **Import your deck** from a `.ydk` file (or paste); parses main/extra/side.
- **My decks vs Matchup decks** — two roles, convertible either way; summary
  line (e.g. "19 decks · 1 mine · 18 matchup").
- **Deck cover card** — pick any card from main/extra as the deck's face;
  thumbnail shows on the sidebar tile (defaults to first main-deck card).
- **Decklist viewer** — card-image grid with hover/pin preview (full card text
  + "In short" summaries for known cards).
- **Opening odds** — exact hypergeometric: ≥1 starter / ≥2 starters /
  ≥1 handtrap / brick %, going first (5) and second (6).
- **Methodology editor** — summary, end board, how it wins, strengths,
  weaknesses, key ratios (auto-fillable, engine-vs-staples grouped), tech cards.
- **Key cards** — auto-extracted into Boss / Starter / Extender / Handtrap /
  Floodgate / Tech buckets (Extra deck feeds Boss); per-card stop-priority,
  stop-with, notes; manual edits survive re-extraction.
- **Multiple builds per deck** — add variants from `.ydk`, set active, rename,
  download, delete; combos link to specific builds.
- **Playbook per matchup deck** — how they win, their end boards (visual
  playmat), game plans first/second, mid-game if/then calls, good cards,
  side-deck plans, notes.
- **Deck notes**, rename, delete (with reference cleanup), download `.ydk`.

## Format

- **Formats** (e.g. "Meta - May 2026") — create / clone / rename / export /
  import / delete via the **⋯ menu**; format notes; primary-deck picker.
- **Matchup dashboard partitioned by Tier 1 / Tier 2 / Rogue** with per-tier
  counts; each cell previews how-they-win + your plan.
- **Add matchups** from a `.ydk` file **or from your existing decks** (the
  dropdown lists any deck not yet in the format).
- **Matchup drill** — full playbook: chokepoints, priority steps, target end
  board, tech/counter cards, related combos, side-deck planner (named
  patterns, going 1st/2nd, in/out balance check), printable **cheat sheet**,
  and **"Edit in Decks →"** deep link.
- **Tournament journal** — events with rounds (opponent, going, W/L/D, score,
  notes); per-matchup aggregated records shown as badges.
- **One-click meta pack** — 18 researched meta decks with pre-filled matchup
  intel (Settings → Meta decks; re-runnable, preserves your edits).

## Combos

- **Sources**: Chrome-extension extraction from DuelingBook replays (opens
  `/react/` directly, auto-names by starter), paste JSON, import `.json`
  file, or build manually.
- **List + gallery views**, live search (`/` to focus), filter by deck.
- **Combo detail** — opening hand, step-by-step line, simulated end board.
- **Three study modes**: Line (read it), Simulate (watch the board build),
  Drill (flashcard recall — reveal one play at a time).
- **Full editor** — rename, opener size, edit opening hand / end board /
  steps (add, remove, reorder, retext, per-step cards), notes (rich text),
  link one combo to multiple decks, duplicate, delete.
- **"Plays through" handtrap tags** — mark which handtraps a line beats;
  surfaced in Testing and matchup intel.

## Testing

- **Going first — goldfish**: shuffle 5, role-tagged hand (starter / extender
  / handtrap tally), verdict, and which saved combo lines are live from this
  hand; **"if they have <handtrap>" filter** (13 common handtraps, or preset
  from an opponent deck's actual handtraps); per-deck consistency streak.
- **Going second — board breaker**: pick opponent + their recorded end board,
  draw a Game-1 or sided Game-2 hand (side plans pulled from the matchup),
  breakers/handtraps-vs-disruptions gauge, self-assessed Broke it / Partial /
  Couldn't tally per opponent.
- **Log games — track results** *(new, 2026-08)*:
  - **Sessions per deck** — start in one tap; name it; a "Testing" line
    records the tech configuration under test ("3× Droll side, no Bystials").
  - **One-tap game logging** — opponent deck (your matchup decks + any name
    you've used + free-typed) and went-1st/2nd stay set between games; Win /
    Draw / Loss logs instantly.
  - **Per-game detail** — tap a game to fix a mistapped result or turn, add
    notes, tag **impactful** and **underperformed** cards (autocompletes from
    your decklist), or delete it.
  - **The tally** — games / W-L-D / win-rate stat tiles, W-D-L proportion
    bar, going-1st vs going-2nd split, **per-opponent frequency table** with
    records + win % + mini bars, and most-impactful / underperformer card
    counts.
  - **Sessions compared** — "All sessions" scope aggregates the deck's whole
    history and lists each session (with its tech line) side by side, so
    different tech configs answer "which build actually wins more?".
  - Sessions live in `ydk_test_sessions`, are included in backup/restore
    (merge and replace), and sync live across open tabs.

## Settings (gear)

- **Appearance** — dark / light theme.
- **Your data** — live counts + per-area storage usage.
- **Backup & restore** — one-JSON export of everything; restore as safe
  **Merge** (never overwrites) or **Replace** (with a one-shot Undo safety
  snapshot). Same format as the legacy decoder.
- **Meta decks** — load / refresh the researched meta pack.
- **Danger zone** — clear card cache / clear all data (confirm-gated).

## App-wide

- **PWA** — installable on a phone home screen, offline after first load
  (network-first HTML so new deploys always win), branded icon + launch
  splash animation.
- **Deploys automatically** to GitHub Pages on every push to `main`.
- **Mobile layout** — bottom-sheet card preview with ✕/backdrop close,
  list→detail navigation with back buttons, full-width toolbars, zero
  horizontal scroll.
- **Design system** — every control 26/32/40 px, one segmented-control spec,
  one motion language; Esc backs out of views in LIFO order; per-tab scroll
  memory; browser-tab title follows where you are.
- **Resilience** — per-tab error boundary (one bad render can't blank the
  app), storage-quota handling (card cache sacrificed first, loud warning if
  truly full), live cross-tab sync on any `ydk_*` write.
- **Card data** — YGOPRODeck API with local cache, image fallbacks,
  DuelingBook↔official name aliases.

---

## Explicitly out of scope right now

- **Account + login sync** — next up (M2, `docs/MOBILE_PLAN.md`): Supabase
  auth + per-user sync of decks/combos/formats/sessions. Until then,
  export/import is the cross-device path.
- **Automated DuelingBook game analysis** — de-emphasized by design
  (2026-08): the Log games tally replaces it with self-recorded real games.
  The replay→combo extraction pipeline remains supported.
