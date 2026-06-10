// ───────────────────────────────────────────────────────────────────
// Backup / restore — IDENTICAL JSON shape to the original decoder so a
// backup made in either app restores in the other:
//   { version:1, exportedAt, appBuild, counts:{decks,combos,cachedCards},
//     data:{ <field>: value } }   // fields = KEYS field names
// ───────────────────────────────────────────────────────────────────
import {
  KEYS, readLs, writeLs,
  loadDecks, saveDecks, loadSavedCombos, saveSavedCombos,
  loadFormats, saveFormats, loadCardCache, saveCardCache,
} from "./storage.js";

export const APP_BUILD = "react-preview";
const comboKey = (c) => (c && (c.replayId || c.replayUrl || c.comboName)) || null;

export function buildBackup() {
  const data = {};
  for (const [field, key] of Object.entries(KEYS)) {
    const v = readLs(key);
    if (v != null) data[field] = v;
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appBuild: APP_BUILD,
    counts: {
      decks: Array.isArray(data.decks) ? data.decks.length : 0,
      combos: Array.isArray(data.savedCombos) ? data.savedCombos.length : 0,
      cachedCards: data.cardCache ? Object.keys(data.cardCache).length : 0,
    },
    data,
  };
}

export function downloadBackup() {
  const payload = buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dt = new Date();
  const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url; a.download = `ydk-decoder-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try { writeLs(KEYS.lastBackup, new Date().toISOString()); } catch (_) { /* noop */ }
  return payload.counts;
}

function parseBackup(json) {
  if (!json || !json.data || typeof json.data !== "object") {
    throw new Error("That doesn't look like a YDK Decoder backup (missing .data).");
  }
  return json.data;
}

// MERGE — safe: append decks/combos/formats we don't already have (by id),
// merge in any missing cached cards, and fill scalar prefs only if unset.
// Never overwrites existing data. Returns { decks, combos, formats, cards }.
export function restoreMerge(json) {
  const inc = parseBackup(json);
  const added = { decks: 0, combos: 0, formats: 0, cards: 0 };

  if (Array.isArray(inc.decks)) {
    const local = loadDecks(); const ids = new Set(local.map((d) => d.deckId));
    for (const d of inc.decks) { if (!d || !d.deckId || ids.has(d.deckId)) continue; local.push(d); ids.add(d.deckId); added.decks++; }
    saveDecks(local);
  }
  if (Array.isArray(inc.savedCombos)) {
    const local = loadSavedCombos(); const keys = new Set(local.map(comboKey));
    for (const c of inc.savedCombos) { if (!c) continue; const k = comboKey(c); if (k && keys.has(k)) continue; local.push(c); if (k) keys.add(k); added.combos++; }
    saveSavedCombos(local);
  }
  if (Array.isArray(inc.formats)) {
    const local = loadFormats(); const ids = new Set(local.map((f) => f.formatId));
    for (const f of inc.formats) { if (!f || !f.formatId || ids.has(f.formatId)) continue; local.push(f); ids.add(f.formatId); added.formats++; }
    saveFormats(local);
  }
  if (inc.cardCache && typeof inc.cardCache === "object") {
    const cache = loadCardCache(); let n = 0;
    for (const k in inc.cardCache) { if (!cache[k]) { cache[k] = inc.cardCache[k]; n++; } }
    saveCardCache(cache); added.cards = n;
  }
  for (const field of ["activeDeckId", "activeFormatId", "theme", "cardsView", "comboViewMode", "comboDeckFilter", "practiceStreak", "practiceGoing", "bbStreak", "decksSchemaVer"]) {
    if (inc[field] != null && readLs(KEYS[field]) == null) writeLs(KEYS[field], inc[field]);
  }
  return added;
}

// REPLACE — destructive: wipe every known key, then write the backup verbatim.
// A safety snapshot of the data being replaced is kept under a key that is
// deliberately NOT in KEYS, so the wipe loop can't touch it — one bad backup
// file is no longer fatal (Settings shows an "Undo replace" while it exists).
const SAFETY_KEY = "ydk_restore_safety";

function applyReplace(inc) {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  for (const [field, key] of Object.entries(KEYS)) { if (inc[field] != null) writeLs(key, inc[field]); }
  return { decks: (inc.decks || []).length, combos: (inc.savedCombos || []).length };
}

export function restoreReplace(json) {
  const inc = parseBackup(json);
  try { localStorage.setItem(SAFETY_KEY, JSON.stringify(buildBackup())); } catch (_) { /* storage full — proceed without */ }
  const counts = applyReplace(inc);
  return json.counts || counts;
}

export function hasSafetySnapshot() {
  try { return !!localStorage.getItem(SAFETY_KEY); } catch { return false; }
}

export function undoReplace() {
  const raw = localStorage.getItem(SAFETY_KEY);
  if (!raw) throw new Error("No safety snapshot to restore.");
  const counts = applyReplace(parseBackup(JSON.parse(raw)));
  localStorage.removeItem(SAFETY_KEY);
  return counts;
}

// Approximate per-area localStorage usage (chars ≈ bytes).
export function storageStats() {
  let total = 0; const per = {};
  for (const [field, key] of Object.entries(KEYS)) {
    const raw = localStorage.getItem(key);
    if (raw != null) { per[field] = raw.length; total += raw.length; }
  }
  return { total, per };
}

export function clearCardCache() { writeLs(KEYS.cardCache, {}); }

export function clearAllData() {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key);
}

export const lastBackupAt = () => readLs(KEYS.lastBackup) || null;
