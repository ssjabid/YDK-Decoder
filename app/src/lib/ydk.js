// ───────────────────────────────────────────────────────────────────
// .ydk parsing + card fetch/image helpers — ported from the original.
// parseYdk / getImageUrls are verbatim. fetchCards currently hits the
// YGOPRODeck API only; the offline INLINE_CACHE + BLZD placeholder
// handling will be ported into lib/cardData.js in a later pass.
// ───────────────────────────────────────────────────────────────────
import { loadCardCache, saveCardCache } from "./storage.js";

export function parseYdk(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = { main: [], extra: [], side: [] };
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("#main")) { cur = "main"; continue; }
    if (t.startsWith("#extra")) { cur = "extra"; continue; }
    if (t.startsWith("!side")) { cur = "side"; continue; }
    if (!t || t.startsWith("#")) continue;
    if (/^\d+$/.test(t) && cur) sections[cur].push(parseInt(t, 10));
  }
  return sections;
}

// Image URL fallback chain (verbatim). Returns [] for placeholder ids.
export function getImageUrls(id) {
  if (id >= 99999999 || id < 99999) return [];
  return [
    `https://images.ygoprodeck.com/images/cards/${id}.jpg`,
    `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`,
    `https://storage.googleapis.com/ygoprodeck.com/pics/${id}.jpg`,
  ];
}

// Resolve card data for a set of passcodes. Uses the persistent card cache
// (same ydk_card_cache key), then fills gaps from the API and writes them
// back so thumbnails/text survive reloads. Returns { map, apiError }.
export async function fetchCards(ids) {
  // ids may be strings (meta-pack decks store passcodes as strings) — coerce.
  const unique = [...new Set(ids.map((x) => Number(x)))].filter((x) => Number.isFinite(x));
  const cache = loadCardCache();
  const map = {};
  const missing = [];
  for (const id of unique) {
    if (cache[id]) map[id] = cache[id];
    else missing.push(id);
  }
  const realIds = missing.filter((id) => id < 99999999 && id > 99999);
  let apiError = null;
  if (realIds.length) {
    try {
      const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${realIds.join(",")}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const j = await resp.json();
        for (const c of j.data || []) {
          map[c.id] = c;
          cache[c.id] = c;
          // alt-art ids resolve to the same card
          for (const im of c.card_images || []) {
            if (!cache[im.id]) cache[im.id] = c;
          }
        }
        saveCardCache(cache);
      } else {
        apiError = `HTTP ${resp.status}`;
      }
    } catch (e) {
      apiError = e.message;
    }
  }
  return { map, apiError };
}

export function countCopies(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return counts;
}
