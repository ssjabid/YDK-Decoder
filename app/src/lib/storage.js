// ───────────────────────────────────────────────────────────────────
// localStorage layer — SAME ydk_* keys as the original app, so when this
// React build is served from the same origin (localhost:8000) it reads the
// user's existing decks / combos / formats / meta pack unchanged. The
// backup JSON format also stays identical (Settings → Backup/Restore works
// across both apps). DO NOT rename these keys.
// ───────────────────────────────────────────────────────────────────
import { alertModal } from "./modal.js"; // no import cycle: modal.js is standalone

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

const isQuotaErr = (e) => !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);
let _quotaNotified = false; // one modal per session, not one per keystroke

// Quota-aware write. localStorage filling up used to fail SILENTLY (the
// worst possible failure: the user keeps working, nothing persists). Now:
// the card cache — the only re-fetchable data — is sacrificed to make room,
// and if that still isn't enough the user gets a loud, actionable error.
export function writeLs(key, value) {
  let s;
  try {
    if (value == null) { localStorage.removeItem(key); return; }
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch (e) { console.warn("[YDK] writeLs failed for", key, e); return; }
  try {
    localStorage.setItem(key, s);
  } catch (e) {
    if (key === KEYS.cardCache) { console.warn("[YDK] card-cache write skipped (storage full)"); return; } // cache is best-effort
    if (isQuotaErr(e)) {
      try {
        localStorage.setItem(KEYS.cardCache, "{}");
        localStorage.setItem(key, s);
        if (!_quotaNotified) {
          _quotaNotified = true;
          alertModal({ title: "Storage was full", message: "Browser storage hit its limit, so the card image cache was cleared to make room — your data saved fine. Card art and text re-download as you browse." });
        }
        return;
      } catch (_) { /* fall through to the hard warning */ }
    }
    console.warn("[YDK] writeLs FAILED for", key, e);
    if (!_quotaNotified) {
      _quotaNotified = true;
      alertModal({ danger: true, title: "Save failed — storage is full", message: "Your last change could NOT be saved. Download a backup right now (Settings → Backup), then free space with Settings → Danger zone → Clear cache." });
    }
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
