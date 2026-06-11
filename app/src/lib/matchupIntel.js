// ───────────────────────────────────────────────────────────────────
// Matchup intel — derived, zero-data-entry cross references.
// The app already knows (a) which handtraps an opponent deck runs (their
// decklist + key-card buckets) and (b) which handtraps each of your lines
// plays through (combo.beatsTraps). Crossing them answers the real
// question: "vs THIS deck, which of my lines still gets there?"
// ───────────────────────────────────────────────────────────────────
import { loadCardCache, loadSavedCombos } from "./storage.js";
import { comboDeckIds, comboBeatsTraps, COMMON_HANDTRAPS } from "./combos.js";
import { classify } from "./classify.js";

// Handtraps an opponent deck actually plays, limited to the canonical
// COMMON_HANDTRAPS list (the same names combo tagging + the Testing
// toggles use, so verdicts line up). Union of:
//   1) their key-card Handtrap bucket,
//   2) a role scan of their cached main+side cards.
export function opponentHandtraps(oppDeck) {
  if (!oppDeck) return [];
  const found = new Set();
  for (const kc of oppDeck.keyCards || []) {
    if (kc && kc.category === "Handtrap" && kc.name) found.add(kc.name);
  }
  const cache = loadCardCache();
  for (const id of [...(oppDeck.main || []), ...(oppDeck.side || [])]) {
    const card = cache[Number(id)];
    if (card && card.name && (classify(card).roles || []).includes("Handtrap")) found.add(card.name);
  }
  return COMMON_HANDTRAPS.filter((t) => found.has(t));
}

// Your saved lines (for any of myDeckIds) scored against a trap list.
// Returns [{ c, idx, through, folds, score }], best coverage first.
export function linesVsTraps(myDeckIds, traps) {
  const mine = new Set(myDeckIds || []);
  const out = [];
  loadSavedCombos().forEach((c, idx) => {
    if (!c || !comboDeckIds(c).some((id) => mine.has(id))) return;
    const beats = comboBeatsTraps(c);
    const through = (traps || []).filter((t) => beats.includes(t));
    const folds = (traps || []).filter((t) => !beats.includes(t));
    out.push({ c, idx, through, folds, score: through.length });
  });
  out.sort((a, b) => (b.score - a.score) || ((a.c.userOpenerSize ?? 9) - (b.c.userOpenerSize ?? 9)));
  return out;
}
