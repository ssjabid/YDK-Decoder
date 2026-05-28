# Next-session prompt — autonomous audit + fix + polish (for Opus 4.8)

> Paste everything in the fenced block below as your **first message** in a fresh
> Claude Code session (model: Opus 4.8) opened in the project root. It briefs the
> model cold and turns it loose on a full-app audit.
>
> Decisions baked in (Abid chose these on 2026-05-19):
> - **Git:** commit locally per batch with detailed messages; **do NOT push** — Abid pushes after review.
> - **Scope:** decoder + Chrome extension + keep all docs in sync.

---

```
You're taking over the YDK Decoder — a personal Yu-Gi-Oh deck-memorization and
tournament-prep workbench for me (Abid). I want you to go through the ENTIRE app
and codebase, find and fix every bug you can, and make the app work as well as it
possibly can. This is an autonomous deep-audit-and-polish run, not a feature build.

═══════════════════════════════════════════════════════════════════════
STEP 0 — ORIENT (do this before touching anything)
═══════════════════════════════════════════════════════════════════════
Read these in order, fully:
  1. docs/CLAUDE.md   — AI briefing: architecture, conventions, critical DON'Ts
  2. HANDOFF.md       — canonical project snapshot (read the whole thing)
  3. docs/ROADMAP.md  — shipped features + the prioritized queue
  4. docs/BUGS.md     — fixed + open bugs

Then confirm orientation in ~5 lines:
  - current decoder build marker (top of decoder/ydk_decoder.html)
  - the three top-level tabs + what Cards/Combos are now
  - one sentence on what the app does end-to-end
Don't ask me to confirm — just state it and continue.

═══════════════════════════════════════════════════════════════════════
GROUND TRUTH ABOUT THIS PROJECT (so you don't re-learn it the hard way)
═══════════════════════════════════════════════════════════════════════
- The main app is ONE FILE: decoder/ydk_decoder.html (~17k lines, vanilla JS,
  all CSS + JS inline). No npm, no framework, no build step. This is permanent
  and intentional — NEVER propose a toolchain, bundler, or dependency.
- There's also a Chrome extension in extension/ (MV3): a service worker, a popup,
  combo-import-helper.js (replay extractor), and deck-extractor.js (deck scraper).
- localStorage is the ONLY source of truth. All keys are ydk_*. Settings →
  Backup/Restore does a full JSON export/import. Schema is v2 (migrated from v1
  with a one-time backup).
- The app MUST run on localhost: `py -m http.server 8000` from the repo root,
  then open http://localhost:8000/decoder/ydk_decoder.html. NEVER file:// — CORS
  breaks the YGOPRODeck API + card images.
- I am NOT a developer. I can copy-paste commands and follow steps, but I cannot
  read code or catch your mistakes. YOU are the QA. Explain things plainly.

═══════════════════════════════════════════════════════════════════════
HARD RULES — do not break these
═══════════════════════════════════════════════════════════════════════
- ❌ DON'T rewrite extension/content/combo-import-helper.js. It solves dozens of
  DuelingBook DOM quirks discovered over many iterations. Surgical edits only,
  and only if you find a real bug.
- ❌ DON'T add any dependency, build step, or framework. Vanilla JS only.
- ❌ DON'T rely on file://. Always localhost.
- ❌ DON'T invent card text or card data. If a card (esp. new BLZD set) isn't in
  YGOPRODeck's API, leave it VERIFY-flagged.
- ❌ DON'T add analytics/telemetry. Personal tool, no phoning home.
- ❌ DON'T break working features while polishing. Preserve behavior. If a change
  is risky, make it surgical and call it out.
- ⚠️ BE CAREFUL with destructive localStorage operations. There's real planning
  data in there (decks, combos, formats, tournaments). Never write migration or
  cleanup code that can wipe data without a backup path.

═══════════════════════════════════════════════════════════════════════
YOUR MISSION — full audit, fix, and polish
═══════════════════════════════════════════════════════════════════════
Work methodically, AREA BY AREA. For each area: read the code, trace the logic by
hand, list the issues you find, fix them, then verify. Don't try to hold the whole
17k-line file in your head at once — go region by region.

Areas to cover (roughly in this order):
  1. App init + schema migration (v1→v2, backups, ensure*Fields backfills)
  2. Decks tab — deck list, selection state, methodology editor, key-card buckets,
     multi-decklist picker, deck/decklist notes, delete + cross-ref cleanup
  3. Cards & Combos sub-views (reached from the Decks panel)
  4. Combos — list, grouping by opener size, drag-reorder, rename, notes, search,
     the field-state simulator (simulateCombo), all 5 view modes, playmats
  5. Format tab — format CRUD, primary deck, matchup grid, matchup drill (the 7
     collapsible sections: quick ref, playbook, target endboard, side-deck planner,
     tech cards, linked combos, freeform notes)
  6. Tournament journal — rounds, W-L aggregation, opponent dropdown
  7. Practice tab
  8. Settings — backup/restore, danger zone, about
  9. Rich-text editor everywhere (contenteditable, toolbar, @card mentions, links)
 10. Modals (ydkConfirm/Alert/Prompt, pickCardByName, pickTournamentType)
 11. Cross-references: deleting a deck/decklist/combo must clean up every place it's
     referenced (combos, matchups relatedComboIds, format primaryDeckId, tournament
     rounds). Verify cleanupDeckReferences / cleanupComboReferences /
     cleanupDecklistReferences are complete and called everywhere they should be.
 12. The Chrome extension — service worker orchestration, popup flows, deck-extractor.
     (You can read + fix logic, but you CANNOT fully test extraction without me
     driving Chrome on a live DuelingBook page — see "what needs me" below.)

For each area, audit along these DIMENSIONS:
  - Correctness: logic errors, off-by-one, wrong variable, broken function refs,
    stale-closure bugs, async/user-activation issues, re-render not firing.
  - Data integrity: localStorage read/write correctness, migration safety, every
    delete path cleans up its cross-references, no orphaned IDs.
  - Edge cases: empty states, cold card cache (card.type/desc not yet hydrated),
    huge decks, duplicate card names, missing decklist, no primary deck, 0 matchups,
    unresolved card IDs, very long text.
  - UX consistency: button styles, spacing, modal patterns, edit-in-place behavior,
    consistent ordering of card lists (engine→staples, Monster→Spell→Trap).
  - Accessibility: keyboard nav, focus management, Esc/Enter in modals, focus rings.
  - Performance: unnecessary full re-renders, the mention-picker index, anything
    that rebuilds large DOM on every keystroke.
  - Dead/duplicate code: consolidate copy-pasted patterns; remove unreachable code.

═══════════════════════════════════════════════════════════════════════
VERIFICATION — you are the QA, so be rigorous
═══════════════════════════════════════════════════════════════════════
After EVERY batch of edits to the HTML file:
  1. Extract the inline <script> blocks and run `node --check` on them to catch
     syntax errors. (The prior assistant did this — see recent git log for the
     exact python-extract-then-node-check approach.)
  2. Confirm CSS braces + parens are balanced (count { } and ( ) in the <style>).
  3. Confirm every var(--token) used in CSS resolves to a defined custom property.
  4. Confirm any function/helper you reference is actually defined once (no dupes).

Then ACTUALLY RUN THE APP and click through it:
  - Start the server (py -m http.server 8000) and open the decoder on localhost.
  - If you have browser automation tools available (preview / agent-browser /
    Claude-in-Chrome), USE THEM: load the app, import a sample .ydk, open the
    Decks/Format/Practice tabs, open a matchup drill, type in notes, run an
    auto-fill, take screenshots, and check the console for errors. Don't just
    reason about the UI — observe it.
  - There are sample .ydk and combo files in the repo root / sample-data/ for
    testing. Use them.

═══════════════════════════════════════════════════════════════════════
WHAT NEEDS ME (Abid) — flag, don't guess
═══════════════════════════════════════════════════════════════════════
You can self-verify almost all of the decoder. You CANNOT fully verify:
  - Live Chrome-extension extraction from DuelingBook replays/deck pages (needs me
    driving Chrome with the extension loaded).
  - The N1.5 end-to-end sweep of the 6 reference DoomZ combos (docs/DECK_CONTEXT.md).
For anything in that category: read the code, fix obvious bugs, and leave me a
clearly-labelled "NEEDS ABID TO TEST" list at the end with exact steps.

═══════════════════════════════════════════════════════════════════════
GIT + DOCS — how to record your work
═══════════════════════════════════════════════════════════════════════
- Commit LOCALLY after each logical batch of fixes, with a detailed message
  (what was broken, why, how you fixed it, how you verified). Group related fixes.
- DO NOT PUSH. I'll review your local commits and push myself. (If you think a
  push is warranted, ask first.)
- Bump the YDK_BUILD constant (top of decoder/ydk_decoder.html) and the build-
  markers table in HANDOFF.md when you reach a shippable checkpoint. Suggested
  marker: 2026-05-2x-audit-pass.
- Keep docs in sync as you go: log every bug you find+fix in docs/BUGS.md, update
  docs/ROADMAP.md if scope/status changes, refresh HANDOFF.md's snapshot. These
  four docs are the source of truth for the next session — they must stay accurate.

═══════════════════════════════════════════════════════════════════════
HOW TO COMMUNICATE WITH ME
═══════════════════════════════════════════════════════════════════════
- Use a task list to track the audit areas; mark progress as you go.
- Prefer surgical fixes over big rewrites. If something tempts a large refactor,
  describe the tradeoff in plain English and let me decide before doing it.
- At the end, give me a clear report: a numbered list of every bug found + fixed,
  every polish change, anything you deliberately left alone (and why), and the
  "NEEDS ABID TO TEST" list with copy-paste steps.

Start with STEP 0 now, then begin the audit at area 1. Go.
```

---

## Why it's structured this way
- **Step 0 + ground truth + hard rules** front-load everything the model loses by starting cold — especially the no-build-step / don't-touch-the-extractor / localhost-only constraints.
- **Area-by-area method** stops a 17k-line file from overwhelming the model into shallow skimming.
- **Audit dimensions** give it a concrete lens per area instead of "look for bugs" (which produces generic output).
- **Verification section** encodes the exact self-QA loop used through Phases 6A–6F (node --check + CSS brace balance + actually running the app), because Abid can't catch mistakes.
- **"What needs Abid"** keeps the model from hallucinating that it tested the Chrome-extension extraction pipeline it can't reach.
- **Git: local commits only, no push** per your choice — gives you a review gate and a safety net without surprise changes to `main`.
