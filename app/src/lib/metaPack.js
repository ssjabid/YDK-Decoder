// ───────────────────────────────────────────────────────────────────
// Meta-pack loader. Fetches the bundled pack (public/) and CLEAN-REPLACES the
// meta-managed data so new research always lands:
//   - deck_meta_* decks: replaced (keep the user's keyCards/notes if they
//     edited them),
//   - the "Meta - May 2026" format matchups: replaced with the fresh deep
//     versions (comboLine / weaknesses / deepened plans), keeping only the
//     user's own authored fields (freeformNotes, sideboard, priority steps,
//     linked combos) + the tournament journal + any non-meta matchups.
// Version-stamped so the app can auto-refresh to the latest on load.
// ───────────────────────────────────────────────────────────────────
import {
  loadDecks, saveDecks, loadFormats, saveFormats,
  getActiveFormatId, setActiveFormatId, readLs, writeLs,
} from "./storage.js";

const PACK_URL = (import.meta.env.BASE_URL || "/") + "meta-matchups-backup.json";
const VERSION_KEY = "ydk_meta_version";
const DEFAULT_DECK_NOTES =
  "Imported from a ygoprodeck tournament list (May 2026). Refine as the meta shifts.";

// Fields on a matchup the USER authors — preserved across a refresh.
const USER_FIELDS = ["freeformNotes", "sideboard", "priorityFirst", "prioritySecond", "relatedComboIds", "chokepointOurs", "tier", "targetEndboard", "counterCards"];
const nonEmpty = (v) => v != null && (Array.isArray(v) ? v.length : (typeof v === "object" ? Object.keys(v).length : String(v).length));

export async function fetchMetaPack() {
  const res = await fetch(PACK_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function packVersion(json) {
  return (json && (json.metaVersion || (json.data && json.data.metaVersion) || json.exportedAt)) || "";
}

// Returns { added, refreshed, version }.
export async function loadMetaPack(prefetched) {
  const json = prefetched || (await fetchMetaPack());
  const data = json && json.data;
  if (!data || !Array.isArray(data.decks)) throw new Error("malformed pack");

  // ── Decks: replace deck_meta_* with the fresh list (keep user keyCards/notes) ──
  const existing = loadDecks();
  const byId = new Map(existing.map((d) => [d.deckId, d]));
  let added = 0, refreshed = 0;
  for (const incoming of data.decks) {
    if (!incoming || !incoming.deckId) continue;
    const prev = byId.get(incoming.deckId);
    if (prev) {
      if (Array.isArray(prev.keyCards) && prev.keyCards.length) incoming.keyCards = prev.keyCards;
      if (prev.notes && prev.notes !== DEFAULT_DECK_NOTES) incoming.notes = prev.notes;
      refreshed++;
    } else {
      added++;
    }
    byId.set(incoming.deckId, incoming);
  }
  saveDecks([...byId.values()]);

  // ── Format: replace pack matchups wholesale, keep user edits + journal ──
  const packFmt = (data.formats || [])[0];
  if (packFmt) {
    const formats = loadFormats();
    const local = formats.find((f) => f && f.formatId === packFmt.formatId);
    if (!local) {
      formats.push(packFmt);
    } else {
      const localByOpp = new Map((local.matchups || []).map((m) => [m.opponentDeckId, m]));
      const packOppIds = new Set((packFmt.matchups || []).map((m) => m.opponentDeckId));
      const refreshedMatchups = (packFmt.matchups || []).map((pm) => {
        const lm = localByOpp.get(pm.opponentDeckId);
        if (!lm) return pm;
        const merged = { ...pm, matchupId: lm.matchupId || pm.matchupId };
        USER_FIELDS.forEach((f) => { if (nonEmpty(lm[f])) merged[f] = lm[f]; });
        return merged;
      });
      const nonPack = (local.matchups || []).filter((m) => !packOppIds.has(m.opponentDeckId));
      local.matchups = [...refreshedMatchups, ...nonPack];
      local.notes = packFmt.notes || local.notes;
      local.updatedAt = new Date().toISOString();
    }
    saveFormats(formats);
    if (!getActiveFormatId()) setActiveFormatId(packFmt.formatId);
  }

  const version = packVersion(json);
  writeLs(VERSION_KEY, version);
  return { added, refreshed, version };
}

// Auto-refresh: if the user has already loaded the meta pack and the bundled
// pack is a newer version, silently refresh to it. Returns { updated }.
export async function ensureMetaFresh() {
  try {
    const hasMeta = loadDecks().some((d) => typeof d.deckId === "string" && d.deckId.indexOf("deck_meta_") === 0);
    if (!hasMeta) return { updated: false };
    const json = await fetchMetaPack();
    const pv = packVersion(json);
    if (!pv || pv === (readLs(VERSION_KEY) || "")) return { updated: false };
    await loadMetaPack(json);
    return { updated: true, version: pv };
  } catch {
    return { updated: false };
  }
}
