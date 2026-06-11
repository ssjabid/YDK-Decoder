// ───────────────────────────────────────────────────────────────────
// Opening-hand odds — exact hypergeometric, no simulation. This is the
// math behind ratio calls ("is 9 starters enough at 40 cards?").
// ───────────────────────────────────────────────────────────────────
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

// P(at least m of the K tagged cards in a k-card hand from an N-card deck).
export function pAtLeast(N, K, k, m = 1) {
  if (N <= 0 || k <= 0 || K <= 0) return 0;
  k = Math.min(k, N); // can't draw more cards than the deck holds
  const total = comb(N, k);
  if (!total) return 0;
  let p = 0;
  for (let x = m; x <= Math.min(K, k); x++) p += (comb(K, x) * comb(N - K, k - x)) / total;
  return Math.min(1, p);
}

export const pct = (p) => (Math.round(p * 1000) / 10).toFixed(1).replace(/\.0$/, "") + "%";
