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

// Decks a combo is linked to. Supports multi-link (deckIds[]) while staying
// backward-compatible with the legacy single deckId the extension writes.
export function comboDeckIds(c) {
  if (Array.isArray(c.deckIds)) return c.deckIds.filter(Boolean);
  return c.deckId ? [c.deckId] : [];
}

// ── Handtrap resistance ──────────────────────────────────────────────
// A line can be tagged with the handtraps it still resolves through, so
// Testing can answer "what do I do if I get Drolled / Impermed / Fuwa'd?".
// Names are exact (matched against drawn/known cards by name).
export const COMMON_HANDTRAPS = [
  "Ash Blossom & Joyous Spring",
  "Maxx \"C\"",
  "Mulcharmy Fuwalos",
  "Mulcharmy Purulia",
  "Droll & Lock Bird",
  "Infinite Impermanence",
  "Effect Veiler",
  "Ghost Ogre & Snow Rabbit",
  "Ghost Belle & Haunted Mansion",
  "Nibiru, the Primal Being",
  "D.D. Crow",
  "Skull Meister",
  "Dimension Shifter",
];
const TRAP_SHORT = {
  "Ash Blossom & Joyous Spring": "Ash",
  "Maxx \"C\"": "Maxx C",
  "Mulcharmy Fuwalos": "Fuwalos",
  "Mulcharmy Purulia": "Purulia",
  "Droll & Lock Bird": "Droll",
  "Infinite Impermanence": "Imperm",
  "Effect Veiler": "Veiler",
  "Ghost Ogre & Snow Rabbit": "Ghost Ogre",
  "Ghost Belle & Haunted Mansion": "Belle",
  "Nibiru, the Primal Being": "Nibiru",
  "D.D. Crow": "D.D. Crow",
  "Skull Meister": "Meister",
  "Dimension Shifter": "Shifter",
};
// Short label for chips/badges (e.g. "Droll", "Imperm", "Fuwalos").
export const trapShort = (name) => TRAP_SHORT[name] || name;

// Handtraps a combo's line is tagged as playing through.
export function comboBeatsTraps(c) {
  return Array.isArray(c.beatsTraps) ? c.beatsTraps.filter(Boolean) : [];
}

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

// Cards for the tile/gallery art — the user-chosen cover first, then the
// rest of the opener ("this combo IS the Elara combo" → Elara leads).
export function comboCoverNames(c, n = 3) {
  const hand = comboOpeningHand(c);
  if (c.coverCard) return [c.coverCard, ...hand.filter((x) => x !== c.coverCard)].slice(0, n);
  return hand.slice(0, n);
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
// Link a combo to any number of decks (e.g. two DoomZ variants share a line).
// Keeps the legacy deckId pointing at the first link for back-compat.
export function setComboDecks(idx, deckIds) {
  withCombos((all) => {
    if (!all[idx]) return;
    const ids = [...new Set((deckIds || []).filter(Boolean))];
    all[idx].deckIds = ids;
    all[idx].deckId = ids[0] || "";
  });
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

// Deep-copy a combo as a new manual one — the fast path for variant lines
// ("same opener, but through Droll"): duplicate, tweak steps, retag.
export function duplicateCombo(idx) {
  let key = null;
  withCombos((all) => {
    const src = all[idx];
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.replayId = "manual_" + rid();
    delete copy.replayUrl;
    copy.userTitle = comboTitle(src) + " (variant)";
    copy.comboName = copy.userTitle;
    copy.manual = true;
    copy.extractedAt = null;
    delete copy.sortIndex;
    all.push(copy);
    key = comboKey(copy, all.length - 1);
  });
  return key;
}

// Apply an edit form to a combo in one write — name, deck links, opener size,
// opening hand, steps, end board, and notes. Only patches the keys present.
// Steps drive Simulate + Drill, so editing them re-flows both immediately.
export function updateCombo(idx, patch) {
  withCombos((all) => {
    const c = all[idx];
    if (!c) return;
    if ("title" in patch) c.userTitle = (patch.title || "").trim();
    if ("deckIds" in patch) {
      const ids = [...new Set((patch.deckIds || []).filter(Boolean))];
      c.deckIds = ids;
      c.deckId = ids[0] || "";
    }
    if ("openerSize" in patch) {
      const s = patch.openerSize;
      c.userOpenerSize = (s === "" || s == null) ? null : Number(s);
    }
    if ("openingHand" in patch) c.openingHand = (patch.openingHand || []).filter(Boolean);
    if ("coverCard" in patch) c.coverCard = patch.coverCard || "";
    if ("steps" in patch) c.steps = (patch.steps || []).map(normalizeStep);
    if ("endboard" in patch) c.endboard = (patch.endboard || []).filter(Boolean);
    if ("beatsTraps" in patch) c.beatsTraps = [...new Set((patch.beatsTraps || []).filter(Boolean))];
    if ("notes" in patch) c.userNotes = patch.notes || "";
  });
}

// Tidy a step coming out of the editor: trim text, drop empty card slots,
// renumber. Keeps the shape the simulator + line view expect.
function normalizeStep(s, i) {
  return {
    n: i + 1,
    action: (s.action || "").trim(),
    detail: (s.detail || "").trim(),
    cards: Array.isArray(s.cards) ? s.cards.filter(Boolean) : [],
    timestamp: s.timestamp || "",
  };
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
export function addManualCombo({ title, deckId, deckIds, openerSize, opener, endboard, notes, beatsTraps }) {
  const t = (title || "").trim();
  const ids = [...new Set((deckIds || (deckId ? [deckId] : [])).filter(Boolean))];
  const openerCards = (opener || []).filter(Boolean);
  const combo = {
    replayId: "manual_" + rid(),
    comboName: t || "New combo",
    userTitle: t,
    deckId: ids[0] || "",
    deckIds: ids,
    userOpenerSize: (openerSize != null && openerSize !== "") ? Number(openerSize) : openerCards.length,
    openingHand: openerCards,
    endboard: (endboard || []).filter(Boolean),
    beatsTraps: [...new Set((beatsTraps || []).filter(Boolean))],
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
