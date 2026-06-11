// ───────────────────────────────────────────────────────────────────
// DuelingBook ⇄ official name aliases. DuelingBook shipped several BLZD
// cards under early unofficial names; combos extracted from replays carry
// those, while the API/cache uses the official ones — so by-name lookups
// (thumbnails, board placement, hand matching) miss without this bridge.
// Pairs ported from the legacy decoder's CARD_FX_ALIASES.
// ───────────────────────────────────────────────────────────────────
const PAIRS = [
  ["Jupredo the Shademachine Power Patron", "Power Patron Shadow Machine Zegredo"],
  ["DoomZ XIII Over - Graflareio", "DoomZ XIII Over - Graflario"],
  ["Vidolium the Unstable Power Patron of Unity", "Vidrium the Power Patron of Chaos Extermination"],
  ["Plundered Power Patron Plane - Vidolia", "Null Power Patron Realm - Vidria"],
  ["Prohibited Power Patron Portal - Terminus", "Unleashed Power Patron Portal - Terminus"],
];

// lowercased name → lowercased counterpart (both directions)
const ALIAS = new Map();
for (const [official, db] of PAIRS) {
  ALIAS.set(official.toLowerCase(), db.toLowerCase());
  ALIAS.set(db.toLowerCase(), official.toLowerCase());
}

export function aliasOf(lcName) {
  return ALIAS.get(lcName) || null;
}
