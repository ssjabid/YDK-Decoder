// ───────────────────────────────────────────────────────────────────
// localStorage layer — SAME ydk_* keys as the original app, so when this
// React build is served from the same origin (localhost:8000) it reads the
// user's existing decks / combos / formats / meta pack unchanged. The
// backup JSON format also stays identical (Settings → Backup/Restore works
// across both apps). DO NOT rename these keys.
// ───────────────────────────────────────────────────────────────────

export const KEYS = {
  decks:            "ydk_decks",
  savedCombos:      "ydk_saved_combos",
  cardCache:        "ydk_card_cache",
  activeDeckId:     "ydk_active_deck_id",
  currentDeck:      "ydk_current_deck",
  practiceStreak:   "ydk_practice_streak",
  practiceGoing:    "ydk_practice_going",
  cardsView:        "ydk_cards_view",
  comboViewMode:    "ydk_combo_view_mode",
  comboDeckFilter:  "ydk_combo_deck_filter",
  formats:          "ydk_formats",
  activeFormatId:   "ydk_active_format_id",
  decksSchemaVer:   "ydk_decks_schema_version",
  bbStreak:         "ydk_bb_streak",
  theme:            "ydk_theme",
  lastBackup:       "ydk_last_backup",
  backupNudgeSnooze:"ydk_backup_nudge_snooze",
};

// Mirror of the original readLs/writeLs: JSON-parse with string fallback.
export function readLs(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return null; }
}

export function writeLs(key, value) {
  try {
    if (value == null) { localStorage.removeItem(key); return; }
    const s = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, s);
  } catch (e) {
    console.warn("[YDK] writeLs failed for", key, e);
  }
}

// ── Typed accessors ──────────────────────────────────────────────────
export const loadDecks = () => readLs(KEYS.decks) || [];
export const saveDecks = (arr) => writeLs(KEYS.decks, arr || []);

export const loadFormats = () => readLs(KEYS.formats) || [];
export const saveFormats = (arr) => writeLs(KEYS.formats, arr || []);

export const loadSavedCombos = () => readLs(KEYS.savedCombos) || [];
export const saveSavedCombos = (arr) => writeLs(KEYS.savedCombos, arr || []);

export const loadCardCache = () => readLs(KEYS.cardCache) || {};
export const saveCardCache = (m) => writeLs(KEYS.cardCache, m || {});

export const getActiveDeckId = () => readLs(KEYS.activeDeckId) || null;
export const setActiveDeckId = (id) => writeLs(KEYS.activeDeckId, id);

export const getActiveFormatId = () => readLs(KEYS.activeFormatId) || null;
export const setActiveFormatId = (id) => writeLs(KEYS.activeFormatId, id);

export const getStoredTheme = () => readLs(KEYS.theme) || "dark";
export const setStoredTheme = (t) => writeLs(KEYS.theme, t);
