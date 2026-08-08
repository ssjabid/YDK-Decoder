// ───────────────────────────────────────────────────────────────────
// ACCOUNT SYNC (M2) — offline-first. localStorage stays the source of
// truth; Firestore is the courier between devices.
//
// Model: one Firestore doc per ITEM (deck / combo / format / session)
// under users/{uid}/<area>/<docId>, plus one users/{uid}/meta/prefs doc
// for the small scalars. Per-item docs dodge Firestore's 1 MB doc cap
// (a whole combo library as one blob would blow through it) and make
// syncs incremental.
//
// Merge: 3-way against a SHADOW (ydk_sync_shadow) = what the server knew
// at last sync. Per item:
//   • changed here only            → push
//   • changed there only           → apply
//   • changed BOTH                 → the local copy wins (never lose the
//     work in front of the user); it pushes over the remote one.
//   • deleted here (in shadow, not local)  → push a tombstone
//   • deleted there (tombstone doc)        → delete locally (unless local
//     changed since last sync — then local survives and re-pushes)
// First sync has an empty shadow → clean union of both devices.
//
// Triggers: app open (signed in), any synced-key write (debounced 2.5 s),
// tab going hidden (flush), and the Settings "Sync now" button.
// ───────────────────────────────────────────────────────────────────
import { KEYS, SYNCED_KEYS, readLs, writeLs, syncGuard } from "./storage.js";
import { fb } from "./firebase.js";

const AREAS = {
  decks:    { key: () => KEYS.decks,        id: (x) => x && x.deckId },
  combos:   { key: () => KEYS.savedCombos,  id: comboSyncId },
  formats:  { key: () => KEYS.formats,      id: (x) => x && x.formatId },
  sessions: { key: () => KEYS.testSessions, id: (x) => x && x.sessionId },
};
const PREF_FIELDS = ["activeDeckId", "activeFormatId", "theme", "cardsView", "comboViewMode", "comboDeckFilter", "practiceStreak", "practiceGoing", "bbStreak", "drillMastery"];

// Combos have no single id field — derive one from the same key backup dedup
// uses; stamp a generated one onto keyless (hand-built) combos.
function comboSyncId(c) {
  if (!c) return null;
  if (c._syncId) return c._syncId;
  const k = c.replayId || c.replayUrl || c.comboName;
  if (k) return "k_" + hash(String(k));
  c._syncId = "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return c._syncId;
}

// djb2 — tiny content hash for change detection + stable doc ids.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36) + "_" + s.length.toString(36);
}
const itemHash = (x) => hash(JSON.stringify(x));

const loadShadow = () => readLs(KEYS.syncShadow) || { v: 1, areas: {}, prefs: null };
const saveShadow = (s) => { syncGuard.applying = true; try { writeLs(KEYS.syncShadow, s); } finally { syncGuard.applying = false; } };

// ── Public state for the Settings UI ─────────────────────────────────
const state = { status: readLs(KEYS.syncOn) ? "connecting" : "off", user: null, lastSyncAt: readLs(KEYS.lastSync) || null, error: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn({ ...state }); } catch (_) { /* noop */ } });
export const getSyncState = () => ({ ...state });
export function onSyncState(fn) { listeners.add(fn); fn({ ...state }); return () => listeners.delete(fn); }

let _wired = false, _debounce = null, _running = false, _queued = false;

// Called once from App. Only touches the network if this device signed in
// before (ydk_sync_on) — otherwise sync stays fully dormant.
export function initSync() {
  if (!readLs(KEYS.syncOn)) return;
  connect().catch((e) => { state.status = "error"; state.error = String(e && e.message || e); emit(); });
}

async function connect() {
  const { auth, authMod } = await fb();
  wireTriggers();
  authMod.onAuthStateChanged(auth, (user) => {
    state.user = user ? { email: user.email, name: user.displayName, uid: user.uid } : null;
    if (user) { state.status = "idle"; emit(); scheduleSync(0); }
    else { state.status = readLs(KEYS.syncOn) ? "signedout" : "off"; emit(); }
  });
}

export async function signInGoogle() {
  const { auth, authMod } = await fb();
  state.status = "connecting"; state.error = null; emit();
  try {
    const provider = new authMod.GoogleAuthProvider();
    await authMod.signInWithPopup(auth, provider);
    writeLs(KEYS.syncOn, "1");
    wireTriggers();
    // onAuthStateChanged (from connect) may not be wired on a first-ever
    // sign-in — sync directly.
    state.user = auth.currentUser ? { email: auth.currentUser.email, name: auth.currentUser.displayName, uid: auth.currentUser.uid } : null;
    state.status = "idle"; emit();
    await syncNow();
  } catch (e) {
    state.status = readLs(KEYS.syncOn) ? "error" : "off";
    state.error = friendlyAuthError(e); emit();
    throw new Error(state.error);
  }
}

export async function signOutSync() {
  const { auth, authMod } = await fb();
  await authMod.signOut(auth);
  writeLs(KEYS.syncOn, null);
  writeLs(KEYS.syncShadow, null); // next sign-in starts with a clean union-merge
  state.user = null; state.status = "off"; emit();
}

function friendlyAuthError(e) {
  const code = (e && e.code) || "";
  if (code.includes("unauthorized-domain")) return "This website isn't on the Firebase authorized-domains list yet — add ssjabid.github.io in Firebase → Authentication → Settings.";
  if (code.includes("popup-blocked")) return "The sign-in popup was blocked — allow popups for this site and try again.";
  if (code.includes("popup-closed")) return "Sign-in window was closed before finishing.";
  if (code.includes("network")) return "No connection — try again when you're online.";
  return String((e && e.message) || e);
}

function wireTriggers() {
  if (_wired) return;
  _wired = true;
  window.addEventListener("ydk:local-write", () => scheduleSync(2500));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && _debounce) { clearTimeout(_debounce); _debounce = null; syncNow().catch(() => {}); }
  });
}

function scheduleSync(delay) {
  clearTimeout(_debounce);
  _debounce = setTimeout(() => { _debounce = null; syncNow().catch(() => {}); }, delay);
}

// ── The sync itself ──────────────────────────────────────────────────
export async function syncNow() {
  if (_running) { _queued = true; return; } // coalesce — run once more after
  const { auth, db, fsMod } = await fb();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  _running = true;
  state.status = "syncing"; state.error = null; emit();
  try {
    const shadow = loadShadow();
    let changedLocally = false;

    for (const [area, cfg] of Object.entries(AREAS)) {
      const sh = (shadow.areas[area] = shadow.areas[area] || {});
      const localArr = readLs(cfg.key()) || [];
      const local = new Map();
      for (const item of localArr) { const id = cfg.id(item); if (id) local.set(id, item); }

      // Pull the whole area (personal-scale data; reads are cheap).
      const snap = await fsMod.getDocs(fsMod.collection(db, "users", user.uid, area));
      const remote = new Map();
      snap.forEach((d) => remote.set(d.id, d.data()));

      const writes = []; // { id, data } | { id, tombstone }
      let applied = false;

      for (const [id, rdoc] of remote) {
        const s = sh[id];
        const litem = local.get(id);
        const localChanged = litem ? (!s || itemHash(litem) !== s.h) : false;
        if (rdoc.deleted) {
          if (litem && !localChanged) { local.delete(id); applied = true; sh[id] = { h: null, t: rdoc.updatedAt || 0, gone: true }; }
          // local changed → survives; push below overwrites the tombstone
          continue;
        }
        const remoteChanged = !s || (rdoc.updatedAt || 0) > (s.t || 0);
        if (!litem) {
          if (s && !s.gone) { /* deleted here since last sync → tombstone below */ }
          else if (remoteChanged) { local.set(id, rdoc.data); applied = true; sh[id] = { h: itemHash(rdoc.data), t: rdoc.updatedAt || 0 }; }
        } else if (remoteChanged && !localChanged) {
          local.set(id, rdoc.data); applied = true;
          sh[id] = { h: itemHash(rdoc.data), t: rdoc.updatedAt || 0 };
        }
        // both changed → local wins → push below
      }

      // Push: anything new/changed locally; tombstones for local deletions.
      const now = Date.now();
      for (const [id, item] of local) {
        const s = sh[id];
        const h = itemHash(item);
        if (!s || s.h !== h) { writes.push({ id, data: { data: item, updatedAt: now } }); sh[id] = { h, t: now }; }
      }
      for (const [id, s] of Object.entries(sh)) {
        if (!local.has(id) && !s.gone) {
          const r = remote.get(id);
          if (r && !r.deleted) { writes.push({ id, data: { deleted: true, updatedAt: now } }); }
          sh[id] = { h: null, t: now, gone: true };
        }
      }

      // Commit pushes in batches (Firestore caps a batch at 500 ops).
      for (let i = 0; i < writes.length; i += 400) {
        const batch = fsMod.writeBatch(db);
        for (const w of writes.slice(i, i + 400)) batch.set(fsMod.doc(db, "users", user.uid, area, w.id), w.data);
        await batch.commit();
      }

      if (applied) {
        syncGuard.applying = true;
        try { writeLs(cfg.key(), [...local.values()]); } finally { syncGuard.applying = false; }
        changedLocally = true;
      }
    }

    // ── prefs (one doc, latest-wins whole-doc) ───────────────────────
    const prefsLocal = {};
    for (const f of PREF_FIELDS) { const v = readLs(KEYS[f]); if (v != null) prefsLocal[f] = v; }
    const prefsH = itemHash(prefsLocal);
    const prefsRef = fsMod.doc(db, "users", user.uid, "meta", "prefs");
    const prefsSnap = await fsMod.getDoc(prefsRef);
    const rp = prefsSnap.exists() ? prefsSnap.data() : null;
    const shp = shadow.prefs;
    const localPrefsChanged = !shp || shp.h !== prefsH;
    const remotePrefsChanged = rp && (!shp || (rp.updatedAt || 0) > (shp.t || 0));
    if (remotePrefsChanged && !localPrefsChanged) {
      syncGuard.applying = true;
      try { for (const f of PREF_FIELDS) if (rp.data && rp.data[f] != null) writeLs(KEYS[f], rp.data[f]); } finally { syncGuard.applying = false; }
      shadow.prefs = { h: itemHash(rp.data || {}), t: rp.updatedAt || 0 };
      changedLocally = true;
    } else if (localPrefsChanged) {
      const now = Date.now();
      await fsMod.setDoc(prefsRef, { data: prefsLocal, updatedAt: now });
      shadow.prefs = { h: prefsH, t: now };
    }

    saveShadow(shadow);
    writeLs(KEYS.lastSync, new Date().toISOString());
    state.lastSyncAt = readLs(KEYS.lastSync);
    state.status = "idle"; emit();
    if (changedLocally) window.dispatchEvent(new Event("ydk:sync-applied"));
  } catch (e) {
    state.status = "error"; state.error = String((e && e.message) || e); emit();
    throw e;
  } finally {
    _running = false;
    if (_queued) { _queued = false; scheduleSync(500); }
  }
}
