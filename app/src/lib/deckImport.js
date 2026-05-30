// ───────────────────────────────────────────────────────────────────
// Import the user's OWN deck from a .ydk file → a role:"primary" deck
// stored under the same ydk_decks key (v2 shape) the original app uses.
// Dedupes by content hash so re-importing the same file doesn't duplicate.
// ───────────────────────────────────────────────────────────────────
import { parseYdk } from "./ydk.js";
import { loadDecks, saveDecks, setActiveDeckId } from "./storage.js";

const contentHash = (text) => String(text || "").length + ":" + String(text || "").slice(0, 200);

const newId = (prefix) =>
  prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Returns { deck, isNew }.
export function importDeckFromYdk(text, rawName) {
  const sec = parseYdk(text);
  const counts = {
    main: sec.main.length, extra: sec.extra.length, side: sec.side.length,
    total: sec.main.length + sec.extra.length + sec.side.length,
  };
  const decks = loadDecks();
  const hash = contentHash(text);
  const existing = decks.find((d) => d._contentHash === hash);
  if (existing) { setActiveDeckId(existing.deckId); return { deck: existing, isNew: false }; }

  const name = (rawName || "Imported deck").replace(/\.ydk$/i, "").trim() || "Imported deck";
  const now = new Date().toISOString();
  const id = newId("deck");
  const dlId = newId("dl") + "_main";
  const deck = {
    deckId: id, name, role: "primary",
    ydkContent: text, counts,
    main: sec.main, extra: sec.extra, side: sec.side,
    decklists: [{
      decklistId: dlId, name: "Main build", ydkContent: text, counts,
      main: sec.main, extra: sec.extra, side: sec.side, notes: "",
      createdAt: now, updatedAt: now,
    }],
    primaryDecklistId: dlId,
    methodology: { summary: "", endboard: "", howItWins: "", strengths: "", weaknesses: "", keyRatios: "", techCards: [] },
    keyCards: [], source: "import", notes: "",
    _contentHash: hash, createdAt: now, updatedAt: now,
  };
  decks.push(deck);
  saveDecks(decks);
  setActiveDeckId(id);
  return { deck, isNew: true };
}
