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
  drillMastery:     "ydk_drill_mastery",
  cardsView:        "ydk_cards_view",
  comboViewMode:    "ydk_combo_view_mode",
  comboDeckFilter:  "ydk_combo_deck_filter",
  formats:          "ydk_formats",
  activeFormatId:   "ydk_active_format_id",
  decksSchemaVer:   "ydk_decks_schema_version",
  bbStreak:         "ydk_bb_streak",
  testSessions:     "ydk_test_sessions",
  lastTab:          "ydk_last_tab",
  splashAt:         "ydk_splash_at",
  theme:            "ydk_theme",
  lastBackup:       "ydk_last_backup",
  backupNudgeSnooze:"ydk_backup_nudge_snooze",
  // ── Account sync (M2, Firebase) — device-local bookkeeping, never backed up
  syncOn:           "ydk_sync_on",     // "1" once signed in → sync auto-starts on launch
  syncShadow:       "ydk_sync_shadow", // what the server knew at last sync (3-way merge base)
  lastSync:         "ydk_last_sync",   // ISO of last successful sync (UI only)
};

// Keys whose changes should wake the sync engine (everything a second device
// cares about — NOT the card cache, not device-local bookkeeping).
export const SYNCED_KEYS = new Set([
  KEYS.decks, KEYS.savedCombos, KEYS.formats, KEYS.testSessions,
  KEYS.activeDeckId, KEYS.activeFormatId, KEYS.theme, KEYS.cardsView,
  KEYS.comboViewMode, KEYS.comboDeckFilter, KEYS.practiceStreak,
  KEYS.practiceGoing, KEYS.bbStreak, KEYS.drillMastery,
]);

// While the sync engine is APPLYING remote data it writes through writeLs too;
// this guard stops those writes from re-waking the engine (an infinite loop).
export const syncGuard = { applying: false };

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
    // Wake the sync engine on meaningful writes (no-op when sync is off —
    // nothing listens). Guarded so applying REMOTE data can't loop.
    if (!syncGuard.applying && SYNCED_KEYS.has(key)) {
      try { window.dispatchEvent(new CustomEvent("ydk:local-write", { detail: key })); } catch (_) { /* non-browser */ }
    }
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
