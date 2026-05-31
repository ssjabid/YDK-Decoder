// ───────────────────────────────────────────────────────────────────
// Card role classification + grouping — ported verbatim from the original
// decoder (canonical 6-role system + keyword rules + frame grouping).
// CARD_OVERRIDES (per-id hand curation) is omitted for now; classify()
// falls back to the keyword rules, which is accurate for the meta decks.
// ───────────────────────────────────────────────────────────────────

import { CARD_KB } from "./cardKB.js";

export const CANONICAL_ROLES = [
  "Starter", "Extender", "Engine", "Board breaker", "Floodgate", "Handtrap",
];

const ROLE_COLLAPSE_MAP = {
  "Starter": "Starter", "Extender": "Extender", "Handtrap": "Handtrap",
  "Board breaker": "Board breaker", "Floodgate": "Floodgate", "Engine": "Engine",
  "Searcher": "Engine", "Combo piece": "Engine", "Boss": "Engine",
  "Equip": "Engine", "Pendulum": "Engine", "Finisher": "Engine",
  "Stopper": "Floodgate", "Tech": null,
};

export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return ["Engine"];
  const out = []; const seen = new Set();
  for (const r of roles) {
    const collapsed = ROLE_COLLAPSE_MAP[r];
    if (!collapsed) continue;
    if (seen.has(collapsed)) continue;
    seen.add(collapsed); out.push(collapsed);
  }
  if (!out.length) out.push("Engine");
  return out;
}

const KEYWORD_RULES = [
  { match: /\bduring (?:either|your opponent's) turn.*Quick Effect/i, role: "Handtrap" },
  { match: /you can (?:discard|send) this card.*hand.*to.*GY/i, role: "Handtrap" },
  { match: /from either field|from both players' fields?/i, role: "Board breaker" },
  { match: /\b(?:destroy|banish|return|send).*(?:your opponent's|monsters? your opponent controls|cards? your opponent controls|all .* opponent)/i, role: "Board breaker" },
  { match: /destroy all (?:cards|monsters|spells|traps)/i, role: "Board breaker" },
  { match: /tribute .* monster.*your opponent controls/i, role: "Board breaker" },
  { match: /target .* card.*your opponent controls.*(?:destroy|banish|return)/i, role: "Board breaker" },
  { match: /negate (?:the |its )?(?:activation|effect|effects)/i, role: "Floodgate" },
  { match: /your opponent (?:cannot|can't) (?:special summon|activate|add)/i, role: "Floodgate" },
  { match: /skip (?:the|your opponent's).*phase/i, role: "Floodgate" },
  { match: /effects? (?:are|is) negated/i, role: "Floodgate" },
  { match: /special summon.*from your (?:deck|graveyard|GY|hand)/i, role: "Extender" },
  { match: /\bspecial summon.*from.*GY\b/i, role: "Extender" },
  { match: /add (?:1|one) .* (?:card|monster) from your deck to your hand/i, role: "Engine" },
  { match: /\bsearch\b|reveal.*deck/i, role: "Engine" },
];

export const ROLE_COLORS = {
  "Starter": "var(--role-starter)",
  "Extender": "var(--role-extender)",
  "Engine": "var(--role-engine)",
  "Board breaker": "var(--role-boardbreaker)",
  "Floodgate": "var(--role-floodgate)",
  "Handtrap": "var(--role-handtrap)",
};

const ROLE_PRIORITY = [
  "Starter", "Extender", "Handtrap", "Floodgate", "Board breaker", "Engine",
];

export function pickPrimaryRole(roles) {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return roles[0] || "Engine";
}

export function classify(card) {
  if (!card) return { roles: ["Engine"], stripped: ["(no data)"] };
  // Curated knowledge base wins over the keyword heuristics for known cards.
  const kb = card.name ? CARD_KB[card.name.toLowerCase()] : null;
  if (kb && kb.roles) return { roles: normalizeRoles(kb.roles), stripped: [stripDesc(card.desc || "")] };
  const roles = new Set();
  const text = (card.desc || "") + " " + (card.name || "");
  for (const rule of KEYWORD_RULES) if (rule.match.test(text)) roles.add(rule.role);
  const t = card.type || "";
  if (t.includes("Xyz") || t.includes("Link") || t.includes("Synchro") || t.includes("Fusion")) roles.add("Engine");
  if ((card.frameType === "spell" || card.frameType === "trap") && roles.size === 0) roles.add("Engine");
  if (roles.size === 0) roles.add("Engine");
  return { roles: normalizeRoles([...roles]), stripped: [stripDesc(card.desc || "")] };
}

export function stripDesc(desc) {
  if (!desc) return "(no effect text)";
  return desc
    .replace(/\([^)]*once per turn[^)]*\)/gi, "")
    .replace(/\(this is treated as[^)]*\)/gi, "")
    .replace(/\s+/g, " ").trim()
    .slice(0, 220) + (desc.length > 220 ? "…" : "");
}

const sortGroup = (arr) =>
  arr.sort((a, b) => b.qty - a.qty || a.card.name.localeCompare(b.card.name));

export function groupByFrame(counts, cardData) {
  const groups = { Monsters: [], Spells: [], Traps: [] };
  for (const id of Object.keys(counts)) {
    const c = cardData[id]; if (!c) continue;
    let g = "Monsters";
    if (c.frameType === "spell") g = "Spells";
    else if (c.frameType === "trap") g = "Traps";
    groups[g].push({ id: parseInt(id, 10), card: c, qty: counts[id] });
  }
  for (const k of Object.keys(groups)) sortGroup(groups[k]);
  return groups;
}

export function groupExtraByType(counts, cardData) {
  const groups = { Fusion: [], Synchro: [], Xyz: [], Link: [] };
  for (const id of Object.keys(counts)) {
    const c = cardData[id]; if (!c) continue;
    const t = c.type || "";
    if (t.includes("Fusion") || c.frameType === "fusion") groups.Fusion.push({ id: +id, card: c, qty: counts[id] });
    else if (t.includes("Synchro") || c.frameType === "synchro") groups.Synchro.push({ id: +id, card: c, qty: counts[id] });
    else if (t.includes("Link") || c.frameType === "link") groups.Link.push({ id: +id, card: c, qty: counts[id] });
    else groups.Xyz.push({ id: +id, card: c, qty: counts[id] });
  }
  for (const k of Object.keys(groups)) sortGroup(groups[k]);
  return groups;
}
