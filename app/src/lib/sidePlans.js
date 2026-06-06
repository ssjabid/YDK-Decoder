// ───────────────────────────────────────────────────────────────────
// Side-deck plans — MULTIPLE named siding patterns per matchup. YGO players
// constantly tweak their side, so a matchup keeps a list of patterns; each is
// { id, name, going:"first"|"second", out:[{name,count}], in:[{name,count}] }.
// Patterns are saved on the format matchup (m.sidePlans) and applied in the
// Testing tab to draw a sided hand. If your decklist later changes, the
// pattern is preserved and its now-missing cards are flagged (not dropped).
// Migrates the legacy single m.sideboard.{goingFirst,goingSecond} shape.
// ───────────────────────────────────────────────────────────────────
export const rid = () => "sp_" + Math.random().toString(36).slice(2, 8);
const normSide = (arr) => (arr || []).map((x) => (typeof x === "string" ? { name: x, count: 1 } : { name: x.name, count: x.count || 1 })).filter((x) => x.name);

export function getSidePlans(m) {
  if (!m) return [];
  if (Array.isArray(m.sidePlans)) return m.sidePlans;
  // Lazy migration from the legacy single sideboard object.
  const sb = m.sideboard || {};
  const out = [];
  const gf = sb.goingFirst || {}, gs = sb.goingSecond || {};
  if ((gf.in || []).length || (gf.out || []).length) out.push({ id: "sp_first", name: "Going first", going: "first", out: normSide(gf.out), in: normSide(gf.in) });
  if ((gs.in || []).length || (gs.out || []).length) out.push({ id: "sp_second", name: "Going second", going: "second", out: normSide(gs.out), in: normSide(gs.in) });
  return out;
}

export function newPlan(going = "second", n = 1) {
  return { id: rid(), name: going === "first" ? "Going first" : `Side plan ${n}`, going, out: [], in: [] };
}

export function planTotals(plan) {
  const o = (plan.out || []).reduce((s, x) => s + (x.count || 0), 0);
  const i = (plan.in || []).reduce((s, x) => s + (x.count || 0), 0);
  return { out: o, in: i, balanced: o === i && o > 0 };
}

// Apply a plan to a deck's main ids → sided main id list (main − OUT + IN, by
// copy count). nameOf(id) resolves a card name; sideIdByName maps a side-deck
// card name → one of its ids.
export function applyPlan(mainIds, plan, nameOf, sideIdByName) {
  if (!plan) return mainIds.slice();
  const ids = mainIds.slice();
  for (const o of (plan.out || [])) {
    let n = o.count || 0;
    for (let k = ids.length - 1; k >= 0 && n > 0; k--) { if (nameOf(ids[k]) === o.name) { ids.splice(k, 1); n--; } }
  }
  for (const inn of (plan.in || [])) {
    const id = sideIdByName[(inn.name || "").toLowerCase()];
    if (id) for (let k = 0; k < (inn.count || 0); k++) ids.push(id);
  }
  return ids;
}

// Cards a plan references that aren't in the current deck anymore.
export function planMissing(plan, mainNames, sideNames) {
  const mn = new Set((mainNames || []).map((s) => String(s).toLowerCase()));
  const sn = new Set((sideNames || []).map((s) => String(s).toLowerCase()));
  return {
    out: (plan.out || []).filter((x) => !mn.has(x.name.toLowerCase())).map((x) => x.name),
    in: (plan.in || []).filter((x) => !sn.has(x.name.toLowerCase())).map((x) => x.name),
  };
}

export const planSummary = (plan) => {
  const part = (arr, sign) => (arr || []).length ? arr.map((x) => `${sign}${x.count}× ${x.name}`).join(", ") : "";
  return [part(plan.out, "−"), part(plan.in, "+")].filter(Boolean).join("  ·  ") || "empty";
};
