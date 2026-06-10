// ───────────────────────────────────────────────────────────────────
// Card search for @-mentions. Two sources, merged:
//   1) the local card cache (ydk_card_cache) — instant, has images+desc
//      for every card in the loaded decks,
//   2) the YGOPRODeck fuzzy-name API (fname=) for anything not seen yet,
//      so you can @-mention ANY Yu-Gi-Oh card. API hits are written back
//      to the cache so chips + hover previews work offline afterward.
// ───────────────────────────────────────────────────────────────────
import { loadCardCache, saveCardCache } from "./storage.js";
import { slimCard } from "./ydk.js";

let _index = null;
let _indexSize = -1;

// Deduped [{ lc, card }] sorted by name, rebuilt when the cache grows.
export function nameIndex() {
  const cache = loadCardCache();
  const size = Object.keys(cache).length;
  if (_index && _indexSize === size) return _index;
  const seen = new Set();
  const out = [];
  for (const k in cache) {
    const c = cache[k];
    if (!c || !c.name || seen.has(c.name)) continue;
    seen.add(c.name);
    out.push({ lc: c.name.toLowerCase(), card: c });
  }
  out.sort((a, b) => a.lc.localeCompare(b.lc));
  _index = out; _indexSize = size;
  return out;
}

export function lookupCardByName(name) {
  const lc = String(name || "").toLowerCase();
  if (!lc) return null;
  for (const e of nameIndex()) if (e.lc === lc) return e.card;
  return null;
}

// Local prefix-then-substring scan (mirrors the original's two-pass).
export function searchLocal(query, limit = 10) {
  const idx = nameIndex();
  const q = String(query || "").toLowerCase().trim();
  if (!q) return idx.slice(0, limit).map((e) => e.card);
  const prefix = [];
  const sub = [];
  for (const e of idx) {
    if (e.lc.startsWith(q)) { prefix.push(e.card); if (prefix.length >= limit) break; }
    else if (e.lc.includes(q) && sub.length < limit) sub.push(e.card);
  }
  return prefix.concat(sub).slice(0, limit);
}

// Live fuzzy-name search against YGOPRODeck. Caches results. Returns [].
export async function searchApi(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  try {
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&num=20&offset=0`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const j = await res.json();
    const cards = (j.data || []).slice(0, 20);
    if (cards.length) {
      const cache = loadCardCache();
      for (const c of cards) {
        const sc = slimCard(c); // cache the lean shape — see ydk.js slimCard
        cache[c.id] = sc;
        for (const im of c.card_images || []) if (!cache[im.id]) cache[im.id] = sc;
      }
      saveCardCache(cache);
      _index = null; // invalidate so nameIndex rebuilds with the new cards
    }
    return cards;
  } catch {
    return [];
  }
}
