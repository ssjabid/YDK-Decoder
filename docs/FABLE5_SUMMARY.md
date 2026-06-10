# FABLE5 SUMMARY — what changed, what's better, what's left

Run date: 2026-06-10. Companion to `FABLE5_FINDINGS.md` (the ranked audit).
Four themed commits, every fix verified live in a browser before committing:

| Commit | Batch |
|---|---|
| `475d0c5` | A — data safety (F1–F5) |
| `964ae0f` | B — core-loop accuracy (F6a, F7, F8) |
| `47e2214` | C — API hygiene + robustness (F9–F14) |
| `f26c1e4` | D — polish/a11y + O4 same-origin bridge |

## What's better (user-visible)

**Your data is now hard to lose.**
- Storage filling up can no longer silently eat your work: the card cache is
  auto-sacrificed (it re-downloads), and if that's not enough you get a loud
  modal telling you exactly what to do. The cache itself is ~5–10× smaller per
  card now, so the limit is far away to begin with.
- "Replace from file" is **undoable once** (safety snapshot + an Undo row in
  Settings) — a wrong backup file is no longer fatal.
- A backup **nudge** appears when you have real data and haven't backed up in
  a week.
- A display error can't blank the app any more — it's contained to the tab
  with a "Back to Decks" escape hatch.
- Deleting a deck cleans **all** combo links (including multi-deck links,
  which keep the surviving variant as primary).

**The practice loop is more honest.**
- The simulator no longer drops cards on multi-card draws, duplicates cards
  into the GY when the log lacks a source, or ignores banish-from-hand.
- Testing now *tells you* when an extracted combo can't match because its
  recorded opener is the whole 5-card hand ("✂ trim the opening hand…").
- Tournament-round edits can't hit the wrong round after a delete.

**The app is a better citizen.**
- Card search fires **one** API request per pause, not one per keystroke; a
  misspelled board card costs one lookup per session instead of one per
  render, forever; big fetches are chunked.
- A second tab — or **the Chrome extension injecting a combo** — shows up
  live, no manual reload.
- Reduced-motion is honoured everywhere; the tiniest labels are legible;
  laptop split-screen widths (1000–1200px) keep a usable two-pane layout;
  collapsible panels work from the keyboard.

**The extension question is closed (O4).**
`cd app && npm run build:8000` builds the React app into `react/` at the repo
root. Your existing `py -m http.server 8000` then serves it at
**`http://localhost:8000/react/`** — the same origin as the legacy decoder and
the extension's target, so all three share one localStorage. Bookmark that URL
as *the* app. Re-run `build:8000` after pulling changes.

## Intentionally left alone
- The legacy decoder + the entire extension (per the hard constraints).
- The `ydk_*` keys and backup JSON format (byte-compatible, both directions —
  the safety snapshot lives under a new, non-conflicting key).
- The dependency list (still just react/react-dom).
- Format-clone semantics (playbooks live on decks and are shared across
  formats **by design**; the audit's "clone loses sidePlans" claim was false).
- Full mobile (<800px) layout — the split-screen band was the practical win;
  true mobile is a bigger pass, queued.

## Flagged for Abid (your Yu-Gi-Oh judgment needed)
1. **F6b — matching heuristic:** should a hand count as "playable" when it
   holds ≥N of a line's recorded opener cards (N = your opener-size setting)?
   It can false-positive when the *specific* starter is missing. Today's rule
   (all recorded opener cards) is strict-but-honest, and the new trim hint
   makes curation easy. Say the word and I'll add the heuristic as an option.
2. **O1 printable matchup cheat-sheet**, **O2 drill mastery tracking,**
   **O3 combo↔matchup links** — approved-in-principle opportunities, not yet
   built. Pick any and I'll start there next session.

## For the next agent
Read `FABLE5_FINDINGS.md` for what was checked and what was deliberately not
"fixed". The false-positive list at the bottom is there so the same scary
claims don't get re-reported. Verify in a live browser; a green build is not
proof.
