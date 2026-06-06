// ───────────────────────────────────────────────────────────────────
// Combos — saved Yu-Gi-Oh combo lines (extracted from DuelingBook replays
// by the Chrome extension, or imported as JSON). Same ydk_saved_combos
// localStorage shape the extension + original decoder use, so combos carry
// over and the extension's live-inject keeps working untouched.
//
// Real combo shape (v1 → v3):
//   { comboName, userTitle?, deckId?, replayId, replayUrl, extractedAt,
//     openingHand:[name], playerCards:[name],
//     steps:[{ n, action, cards:[name]|null, detail, timestamp }],
//     endboard | endboardFromExtractor : [ name | {card,materials,isSet} ],
//     endboardGraveyard?:[name], endboardBanished?:[name],
//     userNotes?, userOpenerSize?, sortIndex? }
// ───────────────────────────────────────────────────────────────────
import { loadSavedCombos, saveSavedCombos } from "./storage.js";

export { loadSavedCombos, saveSavedCombos };

export const VIEW_MODES = [["full", "Full — every step"], ["core", "Core — key plays only"]];

// Actions that are just card-advantage churn (hidden in "Core" view).
const NOISE_ACTIONS = new Set(["Draw", "Return", "Mulligan", "Pass", ""]);
// Actions that mark the start of "doing something" (end of the opener block).
const PLAY_ACTIONS = new Set([
  "Normal Summon", "Special Summon", "Activate", "Set", "Tribute", "Flip Summon",
  "Pendulum Summon", "Link Summon", "Synchro Summon", "Xyz Summon", "Fusion Summon", "Overlay",
]);

export const comboKey = (c, i) => c.replayId || c.replayUrl || c.comboName || ("combo_" + i);
export const comboTitle = (c) => (c.userTitle && c.userTitle.trim()) || c.comboName || "Untitled combo";

// Card names a step touches — from cards[] or parsed out of the detail text.
export function stepCards(step) {
  if (Array.isArray(step.cards) && step.cards.length) return step.cards.filter(Boolean);
  const quoted = (step.detail || "").match(/"([^"]+)"/g);
  if (quoted) return quoted.map((s) => s.replace(/"/g, ""));
  return [];
}

// Opening hand for display: the recorded one, else derived from the leading
// draw/search block before the first real play.
export function comboOpeningHand(c) {
  if (Array.isArray(c.openingHand) && c.openingHand.length) return c.openingHand;
  const hand = [];
  for (const s of (c.steps || [])) {
    if (PLAY_ACTIONS.has(s.action)) break;
    if (/draw|search|add/i.test(s.action || "")) stepCards(s).forEach((n) => hand.push(n));
  }
  return [...new Set(hand)];
}

// Opener size for grouping (null = unknown).
export function comboOpenerSize(c) {
  if (c.userOpenerSize != null) return c.userOpenerSize;
  if (Array.isArray(c.openingHand) && c.openingHand.length) return c.openingHand.length;
  return null;
}
export function openerBucket(size) {
  if (size === 1) return "1-card openers";
  if (size === 2) return "2-card openers";
  if (size >= 3) return "3+ card openers";
  return "Other combos";
}
const BUCKET_ORDER = ["1-card openers", "2-card openers", "3+ card openers", "Other combos"];

// Final board → array of EndBoardView items ({name, zone?, materials?}).
export function comboEndboard(c) {
  const eb = (Array.isArray(c.endboard) && c.endboard.length) ? c.endboard
    : (Array.isArray(c.endboardFromExtractor) ? c.endboardFromExtractor : []);
  return eb.map((x) => (typeof x === "string"
    ? { name: x }
    : { name: x.card || x.name, zone: x.zone, materials: x.materials, isSet: x.isSet })).filter((x) => x.name);
}

// Every card a combo references — for search + coverage.
export function comboAllCards(c) {
  const set = new Set();
  (c.playerCards || []).forEach((n) => n && set.add(n));
  comboOpeningHand(c).forEach((n) => set.add(n));
  (c.steps || []).forEach((s) => stepCards(s).forEach((n) => set.add(n)));
  comboEndboard(c).forEach((s) => set.add(s.name));
  return [...set];
}

export function isCoreStep(step) {
  return !NOISE_ACTIONS.has(step.action || "");
}

export function comboSearchHaystack(c) {
  return [comboTitle(c), c.comboName, c.replayId, ...comboAllCards(c)]
    .filter(Boolean).join(" ").toLowerCase();
}

// Group combos for the master list: by opener-size bucket, then sortIndex/recency.
export function groupCombos(combos) {
  const groups = new Map();
  combos.forEach((c, i) => {
    const b = openerBucket(comboOpenerSize(c));
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push({ c, i });
  });
  for (const list of groups.values()) {
    list.sort((a, b) =>
      ((a.c.sortIndex ?? 1e9) - (b.c.sortIndex ?? 1e9)) ||
      String(b.c.extractedAt || "").localeCompare(String(a.c.extractedAt || "")));
  }
  return BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => ({ bucket: b, items: groups.get(b) }));
}

// ── Mutations (persist the whole array) ─────────────────────────────
function withCombos(mutate) {
  const all = loadSavedCombos();
  mutate(all);
  saveSavedCombos(all);
  return all;
}
export function renameCombo(idx, title) {
  withCombos((all) => { if (all[idx]) all[idx].userTitle = title; });
}
export function setComboDeck(idx, deckId) {
  withCombos((all) => { if (all[idx]) all[idx].deckId = deckId || ""; });
}
export function setComboNotes(idx, html) {
  withCombos((all) => { if (all[idx]) all[idx].userNotes = html; });
}
export function setComboOpenerSize(idx, size) {
  withCombos((all) => { if (all[idx]) all[idx].userOpenerSize = size; });
}
export function deleteCombo(idx) {
  withCombos((all) => { all.splice(idx, 1); });
}

// Import combos from pasted/loaded JSON (single object or array). Dedupes by
// replayId/replayUrl. Returns { added, skipped }.
export function importCombosJson(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  let added = 0, skipped = 0;
  withCombos((all) => {
    for (const c of arr) {
      if (!c || typeof c !== "object" || !(c.steps || c.endboard || c.endboardFromExtractor)) { skipped++; continue; }
      const k = c.replayId || c.replayUrl;
      if (k && all.some((x) => (x.replayId || x.replayUrl) === k)) { skipped++; continue; }
      all.push(c);
      added++;
    }
  });
  return { added, skipped };
}

// Create a combo by hand (no replay) — opener + end board you specify.
const rid = () => Math.random().toString(36).slice(2, 8);
export function addManualCombo({ title, deckId, openerSize, opener, endboard, notes }) {
  const t = (title || "").trim();
  const combo = {
    replayId: "manual_" + rid(),
    comboName: t || "New combo",
    userTitle: t,
    deckId: deckId || "",
    userOpenerSize: (openerSize != null && openerSize !== "") ? Number(openerSize) : (opener || []).length,
    openingHand: (opener || []).filter(Boolean),
    endboard: (endboard || []).filter(Boolean),
    steps: [],
    userNotes: notes || "",
    manual: true,
    extractedAt: null,
  };
  withCombos((all) => all.push(combo));
  return comboKey(combo, 0);
}

// Pull a base64 ?combo= payload (the decoder's URL hand-off) into storage.
// Returns the number added; clears the param afterwards.
export function ingestComboFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("combo");
    if (!raw) return 0;
    const json = decodeURIComponent(escape(atob(raw)));
    const { added } = importCombosJson(json);
    params.delete("combo");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    return added;
  } catch (_) {
    return 0;
  }
}
