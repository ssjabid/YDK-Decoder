// ───────────────────────────────────────────────────────────────────
// One-click meta-pack loader (React port of the vanilla loadMetaMatchups).
// Fetches the bundled meta pack (served from public/) and merges it into
// localStorage: refresh deck_meta_* decks (keep user keyCards/notes) + the
// "Meta - May 2026" format's researched fields (keep tournaments + notes).
// ───────────────────────────────────────────────────────────────────
import {
  loadDecks, saveDecks, loadFormats, saveFormats,
  getActiveFormatId, setActiveFormatId,
} from "./storage.js";

const PACK_URL = (import.meta.env.BASE_URL || "/") + "meta-matchups-backup.json";
const DEFAULT_DECK_NOTES =
  "Imported from a ygoprodeck tournament list (May 2026). Refine as the meta shifts.";

export async function fetchMetaPack() {
  const res = await fetch(PACK_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Returns { added, refreshed } or throws.
export async function loadMetaPack() {
  const json = await fetchMetaPack();
  const data = json && json.data;
  if (!data || !Array.isArray(data.decks)) throw new Error("malformed pack");

  // Decks
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

  // Format (refresh researched fields, keep journal + user-authored bits)
  const packFmt = (data.formats || [])[0];
  if (packFmt) {
    const formats = loadFormats();
    const local = formats.find((f) => f && f.formatId === packFmt.formatId);
    if (!local) {
      formats.push(packFmt);
    } else {
      const REFRESH = ["howTheyWin", "gameplanFirst", "gameplanSecond",
        "chokepointTheirs", "targetEndboard", "counterCards", "tier"];
      const byOpp = new Map((local.matchups || []).map((m) => [m.opponentDeckId, m]));
      for (const pm of packFmt.matchups || []) {
        const lm = byOpp.get(pm.opponentDeckId);
        if (lm) REFRESH.forEach((k) => { lm[k] = pm[k]; });
        else (local.matchups = local.matchups || []).push(pm);
      }
    }
    saveFormats(formats);
    if (!getActiveFormatId()) setActiveFormatId(packFmt.formatId);
  }
  return { added, refreshed };
}
