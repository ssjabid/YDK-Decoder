// ───────────────────────────────────────────────────────────────────
// Firebase bootstrap — LAZY on purpose. The SDK (~200 KB gz) is loaded via
// dynamic import only when sync is actually used (signed in before, or the
// user taps "Continue with Google"), so people who never sign in pay zero.
// These config values are PUBLIC by design (they ship in the bundle);
// per-user Firestore security rules are what protect the data.
// NO analytics — this app has a hard no-telemetry rule (HANDOFF.md).
// ───────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAB33RXvQOW5Q31E55927RYW-CpPPIS87I",
  authDomain: "ydk-decoder.firebaseapp.com",
  projectId: "ydk-decoder",
  storageBucket: "ydk-decoder.firebasestorage.app",
  messagingSenderId: "498382710627",
  appId: "1:498382710627:web:8c238fef65436d79de9556",
};

let _mods = null;

// Loads app/auth/firestore modules once and returns
// { auth, db, authMod, fsMod } — callers use fsMod.doc / fsMod.setDoc / …
export async function fb() {
  if (_mods) return _mods;
  const [appMod, authMod, fsMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  const app = appMod.getApps && appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  _mods = { app, auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod };
  return _mods;
}
