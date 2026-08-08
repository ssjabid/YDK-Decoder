// One-shot Firebase auth setup — does what the console kept refusing to:
//   1. adds ssjabid.github.io (+ the defaults) to Authorized domains
//   2. enables Email/Password sign-in (alongside Google)
// Talks to the Identity Toolkit admin API directly, authenticated with the
// Firebase CLI's own cached login (run `firebase login` first). The OAuth
// client id/secret below are firebase-tools' PUBLIC desktop-app constants
// (shipped in its source) — not secrets of ours.
// Run:  node scripts/firebase_admin_setup.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "ydk-decoder";
const WANT_DOMAINS = ["localhost", "ydk-decoder.firebaseapp.com", "ydk-decoder.web.app", "ssjabid.github.io"];
const CLI_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function readRefreshToken() {
  const p = join(homedir(), ".config", "configstore", "firebase-tools.json");
  const store = JSON.parse(readFileSync(p, "utf8"));
  const t = store.tokens && store.tokens.refresh_token;
  if (!t) throw new Error("No Firebase CLI login found — run `npx firebase-tools login` first.");
  return t;
}

async function accessToken(refresh) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: refresh,
      client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("Token exchange failed: " + JSON.stringify(j));
  return j.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch("https://identitytoolkit.googleapis.com/admin/v2/" + path, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(method + " " + path + " → " + res.status + ": " + JSON.stringify(j).slice(0, 400));
  return j;
}

const token = await accessToken(readRefreshToken());
const cfg = await api(token, "GET", `projects/${PROJECT}/config`);
console.log("current authorizedDomains:", cfg.authorizedDomains || []);
console.log("current email sign-in:", (cfg.signIn && cfg.signIn.email) || "(unset)");

const domains = [...new Set([...(cfg.authorizedDomains || []), ...WANT_DOMAINS])];
const updated = await api(token, "PATCH",
  `projects/${PROJECT}/config?updateMask=authorizedDomains,signIn.email`,
  { authorizedDomains: domains, signIn: { email: { enabled: true, passwordRequired: true } } });

console.log("\n✔ authorizedDomains now:", updated.authorizedDomains);
console.log("✔ email sign-in now:", updated.signIn && updated.signIn.email);
console.log("\nDone — Google + Email/Password login will work from ssjabid.github.io.");
