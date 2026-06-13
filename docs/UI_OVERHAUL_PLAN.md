# UI Overhaul — diagnosis, design system, and roadmap

Goal (Abid's words): clean, easy, simple, elegant, fun — "everyone knows where
everything is, no one gets lost, melodic." Dark, minimal, orange accent stays.

## Diagnosis — why it feels off

The app grew feature-by-feature, and each feature hand-rolled its controls.
There is no enforced **scale**, so adjacent elements disagree slightly — which
the eye reads as "messy" even when each piece looks fine alone:

1. **Four control heights in one toolbar** (Combos): dropdown ~31px, search
   ~36px, segmented toggle ~30px, primary button ~38px.
2. **Two button families stacked**: `btn-primary/btn-secondary` (38-40px, used
   in toolbars) vs `back-btn` (32px, used in detail bars) — visible together on
   the Combos screen.
3. **Two segmented-control styles**: `combo-viewtoggle` (List|Gallery) vs
   `combo-mode-switch` (Line|Simulate|Drill) vs `testing-modebar` vs
   `bb-leg-switch` vs `theme-toggle` vs `decks-role-filter` — six
   implementations of the same concept.
4. **Radius anarchy**: rounded-full chips next to rounded-rect dropdowns next
   to dashed pills, all in one row (the combo Decks row).
5. **Orphaned layout**: meta rows split content far-left/far-right with dead
   space between (combo meta row), instead of one grouped info cluster.
6. **Icon policy is random**: some buttons in a cluster have icons, siblings
   don't (Import .json ✓, Paste JSON ✗).
7. **Spacing rhythm drifts**: toolbar gaps 10px here, 12 there, 16 elsewhere;
   section spacing uneven between tabs.
8. **Six ad-hoc empty-state styles**, ad-hoc focus states, ad-hoc hover
   timings.

## The design system (small on purpose — 6 primitives)

**S1 · Control height scale — exactly three sizes.**
- `sm` 26px — inline row actions (×, dots, mini ↑↓+, tag-chips with actions)
- `md` 32px — THE default: every dropdown, input, segmented control,
  secondary/detail-bar button, chip-with-control
- `lg` 40px — page-level primary actions only, max ONE cluster per screen
  (+ New combo, Import deck, Shuffle & draw)
Tokens: `--ctl-sm/md/lg`; every control class maps to one.

**S2 · One button family.** `btn` base + `primary | secondary | ghost |
danger` variants × `md | lg` sizes. `back-btn`, `deck-inline-btn`,
`fmt-add-btn`, `combo-sim-btn` etc. become aliases of these metrics (CSS-level
first — no JSX churn), then gradually swap class names.

**S3 · One segmented control.** `.seg` container + `.seg-btn` (md height,
1px border container, accent-dim active pill). Replaces all six variants:
List|Gallery, Line|Simulate|Drill, Going 1st|2nd, My|Matchup decks,
Game1|Game2, Dark|Light.

**S4 · Radius discipline.**
- Interactive controls (buttons, inputs, dropdowns, segmented): `radius-md`
- Passive tags/status pills (roles, traps, tiers, mastery): `999`
- Cards/panels: `radius-lg`
Nothing else. (Kills the chip-vs-dropdown clash in the Decks row.)

**S5 · Spacing + type rhythm.**
- Spacing: 4 / 8 / 12 / 16 / 24 only. Toolbar gap 8, control-cluster gap 8,
  section gap 16, panel padding 16, page block gap 24.
- Type: 10 uppercase labels · 12.5 controls · 13 body · 15 panel titles ·
  19 page/detail titles. Strays (11, 11.5, 12, 14) get snapped to the scale.

**S6 · States, one way.** A single `:focus-visible` ring token; one hover
timing (140ms ease); one press transform (translateY(1px)) on ALL buttons;
one disabled treatment. One EmptyState component (one line + one action).

## The coherent change list

**A. Foundation (pure CSS, zero behavior risk)**
- A1 Add the tokens (S1, S4, S5) to tokens.css.
- A2 Map every existing control class onto the 3-height scale (the big one:
  btn-primary/secondary → lg, back-btn/dropdowns/inputs/segmented → md,
  minis → sm).
- A3 Radius sweep per S4 (deck chips → radius-md when interactive; tag pills
  stay 999).
- A4 Focus ring + hover/press unification (S6).

**B. Components**
- B1 `.seg` segmented control, applied to all six call sites.
- B2 Button-family aliasing (S2), then JSX class rename sweep.
- B3 EmptyState component, replacing the six ad-hoc styles.
- B4 Icon policy: within one button cluster, all-or-none; icons only on lg
  primaries and destructive actions (×).

**C. Layout & wayfinding**
- C1 One toolbar pattern for all four tabs: [filter · search] left,
  [primary action cluster] right, everything md except ≤1 lg primary.
- C2 Combo meta row regroup: Decks · Opener size · steps/extracted as ONE
  left-aligned cluster with labels above (kills the dead-middle).
- C3 Consistent detail-header pattern (title + inline context + actions
  right) for Combos detail, Format breakdown, Deck panel — same bar, same
  metrics everywhere.
- C4 Section order discipline inside panels (most-used first; Playbook
  groups, combo blocks).
- C5 Sidebar tiles (decks/combos) on one tile spec: stripe, title, meta line,
  badges — same paddings + hover.

**D. Feel ("melodic", but never corny)**
- D1 One motion language: 140ms ease on hover, 180ms section-in, stagger
  ≤40ms; honor reduced-motion (already blanket-guarded).
- D2 Hover lift (1px + border accent) for tiles, consistent.
- D3 Subtle scroll-position memory per tab (don't lose your place).
- D4 Keyboard: `/` focuses search on the current tab; Esc consistently backs
  out (modal → preview → detail). Maybe later: g+d/f/c/t tab hops.
- D5 Title-bar reflects context ("DoomZ - Elara · Combos") like the legacy app.

**E. Verification**
- E1 Screenshot audit of all five screens at 1280 and 1000 px after each
  phase; measure control heights programmatically (one eval that asserts
  every visible button/input/dropdown ∈ {26, 32, 40}).
- E2 No data/markup behavior changes anywhere in this overhaul — CSS +
  classNames + small JSX regroups only.

## Roadmap (each phase shippable, verified, committed)

| Phase | Contents | Risk | Visible win |
|---|---|---|---|
| **P1** ✅ 2026-06-11 | A1–A4 foundation — shipped as a cascade-final "control scale" layer at the end of app.css (+ --ctl-sm/md/lg tokens). Programmatic audit: 73 controls across all 7 views, 0 off-scale. | none | every row reads as one family |
| **P2** ✅ 2026-06-11 | B1–B2 shipped as a cascade-final identity layer: `.seg`/`.seg-btn` canonical spec + the six legacy segmented sets pinned to it (audited: all visible containers compute byte-identical bg/border/radius/active); md-secondary buttons (back/sim/replay/gcard-open) one identity; ghost-add dashed family one identity. Semantic modifiers (W/L/D colors, my/matchup tint, is-danger) survive by specificity, by design. | low | the six toggles become one control |
| **P3** ✅ 2026-06-12 | C1–C3 shipped: one detail-header recipe (combo bar / matchup bar / deck panel header all compute pb 12 · title 19/600 · 1px rule; mini/act buttons joined the md family); Decks toolbar = summary left, actions right; combo meta row is one left cluster (measured gaps exactly 24px — dead middle gone); list-head titles snapped to the 15px panel size. | low | screens stop feeling "assembled" |
| **P4** ✅ 2026-06-12 | B3 shipped as a cascade-final recipe, not a component (same visual outcome, zero churn): all ten quiet-empty classes compute 12.5px · italic · text-faint; `.placeholder` stays the one BIG empty. B4 icon policy: decorative glyphs dropped from secondaries (✎ ⧉ ↻ ↺ ⎙ + summon/swords SVGs); format-act cluster became words (+ New · Clone · Rename · Export · Import); KEPT by design — lg-primary icons, tab/modebar icons (all-or-none), semantic glyphs (← ↗ × ✓ ✗ ⚠ ≈ ◀ ▶ ✂ ★). C4 verified most-used-first everywhere; playbook editor titles now mirror the breakdown 1:1. C5 one sidebar-tile spec: deck + combo tiles ghost at rest, accent border + tint when active (same "you are here" as .seg), 13px name · 10.5px meta · 3px gap — measured byte-equal. Bonus: `.app-gear` straggler (34px) pinned to md. Height audit: 0 off-scale on all 4 tabs. | low | polish everywhere you look |
| **P5** ✅ 2026-06-13 | D1/D2 — sidebar tiles join the one hover language (1px lift, transform in the transition; cards/cells already lift more); reduced-motion still flattens via the blanket guard. D3 — per-tab scroll memory: `<main key={tab}>` no longer dumps you at the top; a `useLayoutEffect` saves the outgoing tab's `scrollY` and restores the incoming one's (verified Format↔Combos: 400 ↔ 0). D4 — one Esc back-out order via a tiny LIFO `lib/escStack.js`: a pinned preview peels off before the matchup breakdown backs out; modals still own Esc (stack bails while `.modal-overlay` exists) and a focused field always keeps its own Esc. `/` focuses the combo search (only tab with one; placeholder shows the hint). D5 — browser-tab title reflects the tab ("Combos · YDK Decoder"). Verified live: Esc closes pinned preview, Esc backs out breakdown, `/` focuses + doesn't hijack typing, 0 off-scale, console clean. | low | the "melodic" feel |
| **P6** | E1 full audit + straggler fixes | none | proof |

Recommended cadence: P1+P2 together (they're the 80% of perceived quality),
then P3; P4–P6 as a second pass after Abid has lived with it.
