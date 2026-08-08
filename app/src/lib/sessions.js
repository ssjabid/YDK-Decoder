// ───────────────────────────────────────────────────────────────────
// Test sessions — self-logged real games, replacing the old idea of
// automated DuelingBook replay analysis. A session groups the games you
// play with one deck (one sitting / one tech configuration): each game
// records the opponent's deck, W/L/D, who went first, notes, and which
// cards over- or under-performed. Pure logic — no React.
// Stored under ydk_test_sessions (in KEYS, so backup/restore/stats and
// the storage quota handling all pick it up automatically).
// ───────────────────────────────────────────────────────────────────
import { KEYS, readLs, writeLs } from "./storage.js";

const rid = () => Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();

export const loadSessions = () => readLs(KEYS.testSessions) || [];
export const saveSessions = (arr) => writeLs(KEYS.testSessions, arr || []);

export const sessionsForDeck = (deckId) => loadSessions().filter((s) => s && s.deckId === deckId);

const defaultName = () => {
  const d = new Date();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " session";
};

export function newSession(deckId, name = "") {
  const s = {
    sessionId: "ts_" + Date.now().toString(36) + rid(),
    deckId,
    name: (name || "").trim() || defaultName(),
    tech: "", // what this session is testing — "3× Droll side, no Bystials"
    games: [],
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  const all = loadSessions();
  all.unshift(s);
  saveSessions(all);
  return s;
}

export function persistSession(session) {
  const all = loadSessions();
  const idx = all.findIndex((s) => s && s.sessionId === session.sessionId);
  session.updatedAt = nowIso();
  if (idx >= 0) all[idx] = session; else all.unshift(session);
  saveSessions(all);
  return session;
}

export function deleteSession(sessionId) {
  saveSessions(loadSessions().filter((s) => s && s.sessionId !== sessionId));
}

// One tap = one game. Opponent + turn are passed in from the sticky picker.
export function logGame(session, { opp = "", result, first = null }) {
  const g = {
    gameId: "g_" + Date.now().toString(36) + rid(),
    at: nowIso(),
    opp: (opp || "").trim(),
    result: result === "W" || result === "L" || result === "D" ? result : "D",
    first, // true = went first, false = second, null = not recorded
    notes: "", mvp: "", dud: "", // mvp/dud: comma-separated card names
  };
  session.games = [g, ...(session.games || [])];
  persistSession(session);
  return g;
}

export function updateGame(session, gameId, patch) {
  session.games = (session.games || []).map((g) => (g && g.gameId === gameId ? { ...g, ...patch } : g));
  return persistSession(session);
}

export function removeGame(session, gameId) {
  session.games = (session.games || []).filter((g) => g && g.gameId !== gameId);
  return persistSession(session);
}

// ── Tally / aggregation ──────────────────────────────────────────────
export function recordOf(games) {
  const r = { w: 0, l: 0, d: 0, n: 0, pct: 0 };
  for (const g of games || []) {
    if (!g) continue;
    r.n++;
    if (g.result === "W") r.w++;
    else if (g.result === "L") r.l++;
    else r.d++;
  }
  r.pct = r.n ? Math.round((100 * r.w) / r.n) : 0;
  return r;
}

const countTokens = (map, raw) => {
  String(raw || "").split(",").map((t) => t.trim()).filter(Boolean)
    .forEach((t) => map.set(t, (map.get(t) || 0) + 1));
};

// Everything the stats panel needs, from any set of games (one session or
// every session of a deck): overall record, going-1st/2nd split, the
// per-opponent frequency table, and over/under-performer card tallies.
export function aggregate(games) {
  const byOpp = new Map();
  const first = [], second = [];
  const mvp = new Map(), dud = new Map();
  for (const g of games || []) {
    if (!g) continue;
    const key = (g.opp || "").trim() || "Unknown deck";
    if (!byOpp.has(key)) byOpp.set(key, []);
    byOpp.get(key).push(g);
    if (g.first === true) first.push(g);
    else if (g.first === false) second.push(g);
    countTokens(mvp, g.mvp);
    countTokens(dud, g.dud);
  }
  const opps = [...byOpp.entries()]
    .map(([opp, gs]) => ({ opp, ...recordOf(gs) }))
    .sort((a, b) => b.n - a.n || a.opp.localeCompare(b.opp));
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  return { record: recordOf(games), opps, first: recordOf(first), second: recordOf(second), mvps: top(mvp), duds: top(dud) };
}

// Opponent-name suggestions: your matchup decks first (the meta), then any
// name you've already logged against (so a custom name is one-time typing).
export function knownOpponents(oppDecks) {
  const seen = new Set();
  const out = [];
  const add = (n) => { const t = (n || "").trim(); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); } };
  (oppDecks || []).forEach((d) => add(d && d.name));
  loadSessions().forEach((s) => (s && s.games || []).forEach((g) => add(g && g.opp)));
  return out;
}
