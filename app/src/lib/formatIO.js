// ───────────────────────────────────────────────────────────────────
// Format export / import — save a whole format's breakdown (matchups,
// tiers, side patterns, tournament journal, notes) PLUS the decks it
// references (so the playbook + decklists travel with it), and re-add it
// later or in another browser.
//   { kind:"ydk-format", version:1, exportedAt, format, decks:[...] }
// ───────────────────────────────────────────────────────────────────
import { loadFormats, saveFormats, loadDecks, saveDecks } from "./storage.js";

const rid = () => Math.random().toString(36).slice(2, 8);

export function buildFormatExport(formatId) {
  const f = loadFormats().find((x) => x.formatId === formatId);
  if (!f) return null;
  const ids = new Set([f.primaryDeckId, ...(f.matchups || []).map((m) => m.opponentDeckId)].filter(Boolean));
  const decks = loadDecks().filter((d) => ids.has(d.deckId));
  return { kind: "ydk-format", version: 1, exportedAt: new Date().toISOString(), format: f, decks };
}

export function downloadFormat(formatId) {
  const payload = buildFormatExport(formatId);
  if (!payload) return null;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safe = (payload.format.name || "format").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url; a.download = `ydk-format-${safe}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name: payload.format.name, matchups: (payload.format.matchups || []).length, decks: payload.decks.length };
}

// Import a format export. Merges referenced decks (by id, never overwriting an
// existing one), then adds the format under a fresh id + name so it never
// clobbers a current format. Returns { name, addedDecks }.
export function importFormat(json) {
  if (!json || json.kind !== "ydk-format" || !json.format) throw new Error("Not a YDK format export.");
  let addedDecks = 0;
  if (Array.isArray(json.decks) && json.decks.length) {
    const local = loadDecks();
    const ids = new Set(local.map((d) => d.deckId));
    for (const d of json.decks) { if (!d || !d.deckId || ids.has(d.deckId)) continue; local.push(d); ids.add(d.deckId); addedDecks++; }
    saveDecks(local);
  }
  const formats = loadFormats();
  const src = json.format;
  const taken = new Set(formats.map((f) => f.formatId));
  const newId = taken.has(src.formatId) ? "fmt_" + rid() : src.formatId;
  const exists = formats.some((f) => f.name === src.name);
  const f = { ...src, formatId: newId, name: exists ? src.name + " (imported)" : src.name, createdAt: new Date().toISOString() };
  formats.push(f);
  saveFormats(formats);
  return { name: f.name, formatId: newId, addedDecks };
}
