// Generates the PWA icons — the YDK Decoder MARK: two stacked cards on a
// dark radial field; the front card carries a thin inner frame (reads
// "trading card") and the app's 4-point summon-burst star. No wordmark —
// Android's launch screen prints the app name itself.
// v2 (2026-08-08): filenames carry the -v2 suffix ON PURPOSE — Android/Chrome
// cache WebAPK icons by URL, so a redesign must ship under a NEW url or
// phones keep the old art forever. Bump the suffix on the next redesign.
// Pure Node: manual rasterizer (3x supersample) + minimal PNG encoder (zlib).
// Run:  node scripts/make_icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "public");

// ── palette — tokens.css accent family ───────────────────────────────
const BG_IN = [17, 16, 20];         // radial center #111014
const BG_OUT = [8, 8, 10];          // --bg #08080a
const BACK = [140, 56, 32];         // back card #8c3820
const FRONT_TOP = [239, 106, 73];   // #ef6a49 → gradient →
const FRONT_BOT = [214, 74, 43];    // #d64a2b   (centered on --accent #e55b3c)
const FRAME = [255, 233, 214, 0.42]; // cream inner frame (alpha-blended)
const STAR = [255, 236, 219];       // summon-burst star

const deg = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

function inRoundedRect(x, y, hw, hh, r) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax > hw || ay > hh) return false;
  const cx = hw - r, cy = hh - r;
  if (ax <= cx || ay <= cy) return true;
  const dx = ax - cx, dy = ay - cy;
  return dx * dx + dy * dy <= r * r;
}

// 4-point star (concave octagon), point-in-polygon by ray casting.
function starVerts(R) {
  const rIn = R * 0.34, v = [];
  for (let k = 0; k < 8; k++) {
    const ang = deg(90 - k * 45), rad = k % 2 === 0 ? R : rIn;
    v.push([Math.cos(ang) * rad, -Math.sin(ang) * rad]);
  }
  return v;
}
function inPoly(x, y, v) {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i], [xj, yj] = v[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function render(S) {
  const SS = 3;
  const px = new Uint8Array(S * S * 4);
  const h = 0.54 * S, w = (h * 5) / 7, r = 0.11 * w;
  const frameInset = 0.075 * w, frameW = Math.max(1.2, 0.028 * w);
  const star = starVerts(0.30 * w);
  const cards = [
    { cx: 0.452 * S, cy: 0.52 * S, rot: deg(-12), front: false },
    { cx: 0.556 * S, cy: 0.488 * S, rot: deg(6), front: true },
  ];
  const cx0 = S / 2, cy0 = S / 2, maxD = Math.SQRT1_2 * S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS;
          const dBg = Math.hypot(fx - cx0, fy - cy0) / maxD;
          let c = lerp(BG_IN, BG_OUT, Math.min(1, dBg * 1.25));
          for (const card of cards) {
            const dx = fx - card.cx, dy = fy - card.cy;
            const cos = Math.cos(-card.rot), sin = Math.sin(-card.rot);
            const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
            if (!inRoundedRect(lx, ly, w / 2, h / 2, r)) continue;
            if (!card.front) { c = BACK; continue; }
            const t = Math.min(1, Math.max(0, (ly + h / 2) / h));
            c = lerp(FRONT_TOP, FRONT_BOT, t);
            // thin inner frame — the "card border"
            const oI = inRoundedRect(lx, ly, w / 2 - frameInset, h / 2 - frameInset, r * 0.72);
            const iI = inRoundedRect(lx, ly, w / 2 - frameInset - frameW, h / 2 - frameInset - frameW, r * 0.6);
            if (oI && !iI) c = lerp(c, FRAME.slice(0, 3), FRAME[3]);
            // summon-burst star, slightly above center
            if (inPoly(lx, ly + 0.02 * h, star)) c = STAR;
          }
          R += c[0]; G += c[1]; B += c[2];
        }
      }
      const n = SS * SS, o = (y * S + x) * 4;
      px[o] = Math.round(R / n); px[o + 1] = Math.round(G / n); px[o + 2] = Math.round(B / n); px[o + 3] = 255;
    }
  }
  return px;
}

// ── minimal PNG encoder ──────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(S, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [S, name] of [[512, "icon-512-v2.png"], [192, "icon-192-v2.png"], [180, "apple-touch-icon-v2.png"]]) {
  writeFileSync(join(OUT, name), png(S, render(S)));
  console.log("wrote", name, S + "x" + S);
}
