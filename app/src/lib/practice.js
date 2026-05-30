// ───────────────────────────────────────────────────────────────────
// Testing-tab helpers — Goldfish (going first) + Board Breaker (going
// second). Pure logic + localStorage tallies, kept out of the component
// so it mirrors the original decoder's practice/board-breaker behaviour.
// Same ydk_* keys as the original, so streaks carry over same-origin.
// ───────────────────────────────────────────────────────────────────
import { readLs, writeLs, loadSavedCombos } from "./storage.js";
import { classify } from "./classify.js";

const PRACTICE_STREAK_KEY = "ydk_practice_streak"; // { [deckId]: {hands, hits} }
const BB_STREAK_KEY = "ydk_bb_streak";             // { "myId:oppId": {tries, breaks, partials} }

// Fisher–Yates. (Browser Math.random is fine here — this is app runtime,
// not a workflow script.)
export function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Goldfish consistency streak ──────────────────────────────────────
export function loadPracticeStreaks() { return readLs(PRACTICE_STREAK_KEY) || {}; }
export function savePracticeStreaks(m) { writeLs(PRACTICE_STREAK_KEY, m || {}); }
export function bumpStreak(deckId, hadHit) {
  const map = loadPracticeStreaks();
  const cur = map[deckId] || { hands: 0, hits: 0 };
  cur.hands += 1;
  if (hadHit) cur.hits += 1;
  map[deckId] = cur;
  savePracticeStreaks(map);
  return cur;
}
export function resetPracticeStreak(deckId) {
  const m = loadPracticeStreaks();
  delete m[deckId];
  savePracticeStreaks(m);
}

// ── Board-breaker tally ──────────────────────────────────────────────
export function loadBbStreaks() { return readLs(BB_STREAK_KEY) || {}; }
export function saveBbStreaks(m) { writeLs(BB_STREAK_KEY, m || {}); }
export function bumpBb(key, verdict) {
  const m = loadBbStreaks();
  const rec = m[key] || { tries: 0, breaks: 0, partials: 0 };
  rec.tries += 1;
  if (verdict === "break") rec.breaks += 1;
  else if (verdict === "partial") rec.partials += 1;
  m[key] = rec;
  saveBbStreaks(m);
  return rec;
}

// ── Role helpers (operate on a fetched card object) ──────────────────
export function cardRoles(card) {
  if (!card) return [];
  return classify(card).roles || [];
}
export function isBreaker(card) {
  const r = cardRoles(card);
  return r.includes("Board breaker");
}
export function isHandtrap(card) {
  return cardRoles(card).includes("Handtrap");
}

// Best-effort disruption tag for an opponent board piece, from its roles.
export const BB_DISRUPTIONS = [
  { value: "negate",    label: "Negate",      cls: "is-negate" },
  { value: "removal",   label: "Removal",     cls: "is-removal" },
  { value: "floodgate", label: "Floodgate",   cls: "is-floodgate" },
  { value: "body",      label: "Just a body", cls: "is-body" },
];
export function inferDisruption(card) {
  const roles = cardRoles(card);
  if (roles.includes("Floodgate")) return "floodgate";
  if (roles.includes("Board breaker")) return "removal";
  return "negate"; // most end-board bosses negate; a sane default
}

// ── Combo matching for the goldfish hand ─────────────────────────────
// Match every saved combo for this deck against the drawn hand by name.
// Uses the combo's recorded openingHand as the requirement set (the
// effective-opener refinement is a later port). Returns
// { combos: [{combo, status, missing, idx}], anyPossible }.
export function matchCombosToHand(handNames, deckId) {
  const all = loadSavedCombos();
  const out = [];
  let anyPossible = false;

  all.forEach((combo, idx) => {
    if (combo.deckId !== deckId) return;
    const need = (combo.openingHand || []).filter(Boolean);
    if (!need.length) return; // no opener recorded — can't match
    const bag = (handNames || []).filter(Boolean).slice();
    const missing = [];
    for (const card of need) {
      const i = bag.indexOf(card);
      if (i >= 0) bag.splice(i, 1);
      else missing.push(card);
    }
    let status;
    if (missing.length === 0) { status = "possible"; anyPossible = true; }
    else if (missing.length === 1) status = "partial";
    else status = "no";
    out.push({ combo, status, missing, idx, need });
  });

  const order = { possible: 0, partial: 1, no: 2 };
  out.sort((a, b) =>
    (order[a.status] - order[b.status]) ||
    ((b.combo.steps || []).length - (a.combo.steps || []).length));
  return { combos: out, anyPossible };
}
