// Generates the PWA icons — GLYPH ONLY (two stacked cards in the app accent),
// no wordmark. Android's launch screen shows the icon + app name itself, so a
// wordmark baked into the icon read as a weird "square box saying YDK Decoder"
// before the in-app splash animation took over (Abid, 2026-08-08).
// Pure Node: manual rasterizer (3x supersample) + minimal PNG encoder (zlib).
// Run:  node scripts/make_icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "public");

// ── palette — matches tokens.css / the splash animation exactly ──────
const BG = [8, 8, 10];              // --bg #08080a
const BACK = [156, 62, 38];         // back card #9c3e26
const FRONT_TOP = [239, 106, 73];   // #ef6a49 → gradient →
const FRONT_BOT = [217, 78, 46];    // #d94e2e   (centered on --accent #e55b3c)

const deg = (d) => (d * Math.PI) / 180;

// Rounded-rect hit test in the card's local frame.
function inRoundedRect(x, y, hw, hh, r) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax > hw || ay > hh) return false;
  const cx = hw - r, cy = hh - r;
  if (ax <= cx || ay <= cy) return true;
  const dx = ax - cx, dy = ay - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(S) {
  const SS = 3; // supersample
  const px = new Uint8Array(S * S * 4);
  const h = 0.55 * S, w = (h * 5) / 7, r = 0.11 * w;
  const cards = [
    { cx: 0.455 * S, cy: 0.515 * S, rot: deg(-13), grad: null },          // back
    { cx: 0.555 * S, cy: 0.49 * S, rot: deg(8), grad: [FRONT_TOP, FRONT_BOT] }, // front
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS;
          let c = BG;
          for (const card of cards) { // later cards draw on top
            const dx = fx - card.cx, dy = fy - card.cy;
            const cos = Math.cos(-card.rot), sin = Math.sin(-card.rot);
            const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
            if (inRoundedRect(lx, ly, w / 2, h / 2, r)) {
              if (!card.grad) c = BACK;
              else {
                const t = Math.min(1, Math.max(0, (ly + h / 2) / h));
                c = [0, 1, 2].map((i) => Math.round(card.grad[0][i] + (card.grad[1][i] - card.grad[0][i]) * t));
              }
            }
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
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [S, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(join(OUT, name), png(S, render(S)));
  console.log("wrote", name, S + "x" + S);
}
