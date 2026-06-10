// ───────────────────────────────────────────────────────────────────
// Deck model helpers — ported from the original decoder so the React
// Decks tab reaches full parity: primary-decklist resolution, persistence,
// multi-build management, role conversion, reference cleanup on delete,
// and key-card auto-extraction (6 buckets + archetype/engine detection).
// All pure logic — no React. Mirrors the same deck shape + ydk_* keys.
// ───────────────────────────────────────────────────────────────────
import { parseYdk, getImageUrls } from "./ydk.js";
import {
  loadDecks, saveDecks, getActiveDeckId, setActiveDeckId,
  loadSavedCombos, saveSavedCombos, loadFormats, saveFormats,
} from "./storage.js";
import { classify } from "./classify.js";
import { lookupKB } from "./cardKB.js";

export const KEY_CARD_BUCKETS = ["Boss", "Starter", "Extender", "Handtrap", "Floodgate", "Tech"];
export const STOP_PRIORITIES = ["none", "medium", "high"];

const nowIso = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 7);

// ── Decklist resolution ──────────────────────────────────────────────
export function getDeckPrimaryDecklist(deck) {
  if (!deck) return null;
  if (Array.isArray(deck.decklists) && deck.decklists.length) {
    const found = deck.decklists.find((d) => d && d.decklistId === deck.primaryDecklistId);
    return found || deck.decklists[0];
  }
  // Legacy / meta deck — synthesize from the top-level fields.
  return {
    decklistId: "legacy_" + (deck.deckId || ""),
    name: "Main build",
    ydkContent: deck.ydkContent || "",
    counts: deck.counts || { main: (deck.main || []).length, extra: (deck.extra || []).length, side: (deck.side || []).length },
    main: deck.main || [], extra: deck.extra || [], side: deck.side || [], notes: deck.notes || "",
  };
}

export function ensureDeckShape(deck) {
  if (!deck.methodology || typeof deck.methodology !== "object") {
    deck.methodology = { summary: "", endboard: "", howItWins: "", strengths: "", weaknesses: "", keyRatios: "", techCards: [] };
  }
  if (!Array.isArray(deck.methodology.techCards)) deck.methodology.techCards = [];
  if (!Array.isArray(deck.keyCards)) deck.keyCards = [];
  return deck;
}

// ── Persistence ──────────────────────────────────────────────────────
// Read fresh, replace by id, write back the whole array.
export function persistDeck(deck) {
  const all = loadDecks();
  const idx = all.findIndex((d) => d.deckId === deck.deckId);
  deck.updatedAt = nowIso();
  if (idx >= 0) all[idx] = deck;
  else all.push(deck);
  saveDecks(all);
  return deck;
}

// ── Multi-build management ───────────────────────────────────────────
function mirrorLegacyFields(deck, dl) {
  deck.ydkContent = dl.ydkContent; deck.counts = dl.counts;
  deck.main = dl.main; deck.extra = dl.extra; deck.side = dl.side;
}

export function setActiveBuild(deck, decklistId) {
  const dl = (deck.decklists || []).find((d) => d.decklistId === decklistId);
  if (!dl) return deck;
  deck.primaryDecklistId = decklistId;
  mirrorLegacyFields(deck, dl);
  return persistDeck(deck);
}

export function addDecklistFromYdkText(deck, text) {
  const sec = parseYdk(text || "");
  const total = sec.main.length + sec.extra.length + sec.side.length;
  if (!total) throw new Error("No card IDs found under #main / #extra / !side. Paste the full .ydk contents.");
  const decklistId = "dl_" + deck.deckId + "_" + rid();
  const dl = {
    decklistId,
    name: "Build " + ((deck.decklists || []).length + 1),
    ydkContent: text,
    counts: { main: sec.main.length, extra: sec.extra.length, side: sec.side.length, total },
    main: sec.main.map(String), extra: sec.extra.map(String), side: sec.side.map(String),
    notes: "", createdAt: nowIso(), updatedAt: nowIso(),
  };
  deck.decklists = deck.decklists || [];
  deck.decklists.push(dl);
  persistDeck(deck);
  return dl;
}

export function deleteDecklist(deck, decklistId) {
  if (!Array.isArray(deck.decklists) || deck.decklists.length <= 1) return deck;
  deck.decklists = deck.decklists.filter((d) => d.decklistId !== decklistId);
  if (deck.primaryDecklistId === decklistId) {
    const fallback = deck.decklists[0];
    deck.primaryDecklistId = fallback.decklistId;
    mirrorLegacyFields(deck, fallback);
  }
  return persistDeck(deck);
}

export function downloadDecklist(deck, dl) {
  const blob = new Blob([dl.ydkContent || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (s) => String(s || "").replace(/[^a-z0-9_\-]+/gi, "_");
  a.download = `${safe(deck.name) || "deck"}_${safe(dl.name) || "build"}.ydk`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Role conversion + delete ─────────────────────────────────────────
export function convertDeckRole(deck) {
  deck.role = deck.role === "matchup" ? "primary" : "matchup";
  return persistDeck(deck);
}

// Sweep references when a deck is deleted: unassign its combos, clear it
// as a format's primary deck. Matchups keep the (now-dangling) id — the
// Format tab renders "Unknown deck" defensively.
export function deleteDeck(deckId) {
  const combos = loadSavedCombos();
  let comboChanged = false;
  for (const c of combos) {
    if (!c) continue;
    const hadLegacy = c.deckId === deckId;
    const hadMulti = Array.isArray(c.deckIds) && c.deckIds.includes(deckId);
    if (!hadLegacy && !hadMulti) continue;
    if (Array.isArray(c.deckIds)) c.deckIds = c.deckIds.filter((id) => id !== deckId);
    if (hadLegacy) {
      // Fall back to the next multi-link (a combo on two DoomZ variants keeps
      // the surviving one as its primary), else unassign.
      c.deckId = (c.deckIds && c.deckIds[0]) || null;
      if (!c.deckId) c.decklistId = null;
    }
    comboChanged = true;
  }
  if (comboChanged) saveSavedCombos(combos);

  const formats = loadFormats();
  let fmtChanged = false;
  for (const f of formats) {
    if (f && f.primaryDeckId === deckId) { f.primaryDeckId = null; fmtChanged = true; }
  }
  if (fmtChanged) saveFormats(formats);

  saveDecks(loadDecks().filter((d) => d.deckId !== deckId));
  if (getActiveDeckId() === deckId) setActiveDeckId(null);
}

// ════════════════════════════════════════════════════════════════════
// KEY CARDS — auto-extraction into 6 buckets, preserving manual edits.
// cardMap is { [numericId]: cardObject } (from fetchCards).
// ════════════════════════════════════════════════════════════════════
export function classifyCardBroadType(card) {
  if (!card || !card.type) return "Other";
  if (/Spell/i.test(card.type)) return "Spell";
  if (/Trap/i.test(card.type)) return "Trap";
  if (/Monster/i.test(card.type)) return "Monster";
  return "Other";
}

export function classifyKeyCardCategory(card) {
  if (!card) return "Tech";
  // Curated KB first (accurate handtraps / floodgates / board breakers / bosses).
  const kb = card.name ? lookupKB(card.name) : null;
  if (kb && kb.cat) return kb.cat;
  if (/xyz|link|synchro|fusion/i.test(card.type || "")) return "Boss";
  const roles = (classify(card).roles) || [];
  if (roles.includes("Handtrap")) return "Handtrap";
  if (roles.includes("Floodgate")) return "Floodgate";
  // Starter: searches a card from the Deck to hand, or Special Summons from
  // the Deck — i.e. the cards that START a combo (what you'd hand-trap).
  // The keyword classifier never emits "Starter" on its own, so detect it
  // from the text here (this is why the Starter bucket was always empty).
  const desc = card.desc || "";
  if (/add 1[^.]*from your deck to your hand/i.test(desc) ||
      /add[^.]*from your deck to (?:the|your) hand/i.test(desc) ||
      /special summon[^.]*from your deck/i.test(desc)) return "Starter";
  if (roles.includes("Extender")) return "Extender";
  if (roles.includes("Starter")) return "Starter";
  return "Tech";
}

export function extractKeyCards(deck, cardMap) {
  const dl = getDeckPrimaryDecklist(deck);
  if (!dl) return [];
  // Main deck (starters/extenders/handtraps to stop) PLUS the Extra deck so the
  // Boss bucket fills with the deck's actual end-board threats (Mirrorjade,
  // Lunalight Leo Dancer, …) — exactly what you want to know you're up against.
  const ids = [...(dl.main || []), ...(dl.extra || [])].map(String);
  const uniqueIds = Array.from(new Set(ids));
  const existing = Array.isArray(deck.keyCards) ? deck.keyCards : [];
  const manualByName = new Map(existing.filter((kc) => kc && kc.auto === false).map((kc) => [kc.name, kc]));
  const autoAnnByName = new Map(
    existing.filter((kc) => kc && kc.auto !== false)
      .map((kc) => [kc.name, { stopPriority: kc.stopPriority || "none", stopWith: kc.stopWith || "", notes: kc.notes || "" }])
  );

  const seen = new Set();
  const out = [];
  let priority = 0;
  for (const id of uniqueIds) {
    const card = cardMap[Number(id)];
    if (!card || !card.name) continue;
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    if (manualByName.has(card.name)) { out.push(manualByName.get(card.name)); continue; }
    const ann = autoAnnByName.get(card.name) || { stopPriority: "none", stopWith: "", notes: "" };
    out.push({
      name: card.name, cardId: id, category: classifyKeyCardCategory(card),
      stopPriority: ann.stopPriority, stopWith: ann.stopWith, notes: ann.notes,
      priority: priority++, auto: true,
    });
  }
  for (const [name, kc] of manualByName) {
    if (!seen.has(name)) out.push({ ...kc, priority: priority++ });
  }
  return out;
}

export function countMissingCardData(deck, cardMap) {
  const dl = getDeckPrimaryDecklist(deck);
  if (!dl) return 0;
  const ids = (dl.main || []).map(String);
  const uniqueIds = Array.from(new Set(ids));
  let missing = 0;
  for (const id of uniqueIds) if (!cardMap[Number(id)]) missing++;
  return missing;
}

// ── Key-ratios auto-fill (engine vs staples × type) → grouped text ────
const ARCHETYPE_STOP_WORDS = new Set([
  "the","of","and","a","an","to","in","for","by","with","from","on","at","or","as","is","it","this","that","be","not","no","you","your",
  "i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii",
  "one","two","three","four","five","six","seven","eight","nine","zero",
  "king","queen","lord","lady","sir","duke","baron",
  "dark","light","fire","water","wind","earth","divine","chaos","new","old","great","grand","ancient",
]);

function detectArchetypeTokens(uniqueNames) {
  const tokensByName = new Map();
  for (const name of uniqueNames) {
    const tokens = String(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter((t) => t.length >= 3 && !ARCHETYPE_STOP_WORDS.has(t));
    tokensByName.set(name, new Set(tokens));
  }
  const counts = new Map();
  for (const tokens of tokensByName.values()) for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const archetypeTokens = new Set();
  for (const [t, n] of counts) if (n >= 2) archetypeTokens.add(t);
  return { archetypeTokens, tokensByName };
}

// Shared bucketing for key-ratio output — returns [{ label, entries }] where
// each entry is { name, count, card }. Empty buckets are dropped.
function keyRatioSections(deck, cardMap) {
  const dl = getDeckPrimaryDecklist(deck);
  const main = (dl && dl.main) || [];
  if (!main.length) return null;
  const counts = new Map();
  const cardByName = new Map();
  for (const id of main) {
    const card = cardMap[Number(id)];
    const name = (card && card.name) || ("#" + id);
    counts.set(name, (counts.get(name) || 0) + 1);
    if (card && !cardByName.has(name)) cardByName.set(name, card);
  }
  const uniqueNames = Array.from(counts.keys());
  const { archetypeTokens, tokensByName } = detectArchetypeTokens(uniqueNames);
  const isEng = (name) => {
    const toks = tokensByName.get(name);
    if (!toks) return false;
    for (const t of toks) if (archetypeTokens.has(t)) return true;
    return false;
  };
  const buckets = { engine: { Monster: [], Spell: [], Trap: [], Other: [] }, staples: { Monster: [], Spell: [], Trap: [], Other: [] } };
  for (const name of uniqueNames) {
    const card = cardByName.get(name);
    buckets[isEng(name) ? "engine" : "staples"][classifyCardBroadType(card)].push({ name, count: counts.get(name), card });
  }
  const sortLeaf = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
  ["engine", "staples"].forEach((g) => ["Monster", "Spell", "Trap", "Other"].forEach((t) => buckets[g][t].sort(sortLeaf)));
  const defs = [
    ["engine", "Monster", "Engine — Monsters"], ["engine", "Spell", "Engine — Spells"], ["engine", "Trap", "Engine — Traps"], ["engine", "Other", "Engine — Other"],
    ["staples", "Monster", "Staples — Monsters (handtraps + tech)"], ["staples", "Spell", "Staples — Spells"], ["staples", "Trap", "Staples — Traps"], ["staples", "Other", "Staples — Other"],
  ];
  const out = [];
  for (const [g, t, label] of defs) {
    const entries = buckets[g][t];
    if (entries.length) out.push({ label, entries });
  }
  return out;
}

export function buildKeyRatiosText(deck, cardMap) {
  const sections = keyRatioSections(deck, cardMap);
  if (!sections) return null;
  const lines = [];
  for (const s of sections) {
    lines.push(s.label + ":");
    lines.push("  " + s.entries.map((e) => `${e.count}× ${e.name}`).join(", "));
  }
  return lines.join("\n");
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Same data, but as RTE HTML so each card becomes a hoverable @-chip.
export function buildKeyRatiosHtml(deck, cardMap) {
  const sections = keyRatioSections(deck, cardMap);
  if (!sections) return null;
  const chip = ({ name, count, card }) => {
    const urls = card && card.id ? getImageUrls(card.id) : [];
    const inner = urls.length
      ? `<img src="${esc(urls[0])}" alt="${esc(name)}" loading="lazy">`
      : `<span class="rt-card-mention-fallback">?</span>`;
    return `<span class="rt-ratio-count">${count}×</span> <span class="rt-card-mention" data-card="${esc(name)}" contenteditable="false" title="${esc(name)}">${inner}${esc(name)}</span>`;
  };
  // One card per line (indented list) with its image — readable, not a
  // comma-jammed paragraph.
  return sections
    .map((s) => `<h4>${esc(s.label)}</h4><ul>${s.entries.map((e) => `<li>${chip(e)}</li>`).join("")}</ul>`)
    .join("");
}
