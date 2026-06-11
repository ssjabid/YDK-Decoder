// ───────────────────────────────────────────────────────────────────
// Matchup cheat sheet — one printable page per opponent: how they win,
// what to stop, your lines vs their traps, 1st/2nd plans, if/then calls,
// their board, siding. Built as a standalone monochrome page in a new
// window (print-friendly; the browser's print dialog opens automatically).
// ───────────────────────────────────────────────────────────────────
import { opponentHandtraps, linesVsTraps } from "./matchupIntel.js";
import { comboTitle, trapShort } from "./combos.js";
import { getSidePlans } from "./sidePlans.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rich-notes HTML → readable plain text (paragraph/line breaks kept).
function htmlToText(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d)>/gi, "\n");
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

const block = (title, inner) => (inner ? `<section><h2>${esc(title)}</h2>${inner}</section>` : "");
const textBlock = (title, html) => { const t = htmlToText(html); return t ? block(title, `<p>${esc(t).replace(/\n/g, "<br>")}</p>`) : ""; };
const listBlock = (title, items) => (items && items.length ? block(title, `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`) : "");

export function openCheatSheet({ oppName, tier, meth = {}, pb, m, opponentDeck, primaryDeck, record }) {
  const traps = opponentHandtraps(opponentDeck);
  const lines = primaryDeck ? linesVsTraps([primaryDeck.deckId], traps) : [];

  const linesHtml = lines.length ? block("Your lines vs them",
    `<ul class="lines">` + lines.map(({ c, through, folds }) => {
      const tagged = (c.beatsTraps || []).length > 0;
      const verdict = !tagged ? "" :
        (through.length ? ` <b>✓ ${through.map(trapShort).map(esc).join(" · ")}</b>` : "") +
        (folds.length ? ` <i>✗ ${folds.map(trapShort).map(esc).join(" · ")}</i>` : "");
      return `<li>${esc(comboTitle(c))}${verdict}</li>`;
    }).join("") + `</ul>`) : "";

  const ifThenHtml = (pb.ifThen || []).filter((r) => (r.when || r.then)).length ? block("Mid-game calls",
    `<ul class="calls">` + pb.ifThen.filter((r) => r.when || r.then).map((r) => {
      const g = r.going === "first" ? "1st" : r.going === "second" ? "2nd" : "—";
      return `<li><span class="g">${g}</span> If ${esc(r.when)} → <b>${esc(r.then)}</b></li>`;
    }).join("") + `</ul>`) : "";

  const boardsHtml = (pb.endboards || []).length ? block("Their board",
    pb.endboards.map((b) => {
      const names = (b.cards || []).map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
      return names.length ? `<p>${pb.endboards.length > 1 ? `<b>${esc(b.name || "Board")}:</b> ` : ""}${names.map(esc).join(" · ")}</p>` : "";
    }).join("")) : "";

  const plans = getSidePlans(m || {});
  const sideHtml = plans.length ? block("Siding",
    plans.map((p) => {
      const fmtArr = (a) => (a || []).map((x) => `${x.count}× ${esc(x.name)}`).join(", ");
      return `<p><b>${esc(p.name)}</b> (${p.going === "first" ? "1st" : "2nd"}) — out: ${fmtArr(p.out) || "—"} · in: ${fmtArr(p.in) || "—"}</p>`;
    }).join("")) : "";

  const goodHtml = (pb.goodCards || []).length ? block("Really good here",
    `<ul>` + pb.goodCards.map((c) => `<li><b>${esc(c.name)}</b>${c.notes ? " — " + esc(c.notes) : ""}</li>`).join("") + `</ul>`) : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>vs ${esc(oppName)} — cheat sheet</title>
<style>
  body { font: 13px/1.45 -apple-system, "Segoe UI", sans-serif; color: #111; max-width: 720px; margin: 24px auto; padding: 0 16px; }
  header { display: flex; align-items: baseline; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 14px; }
  h1 { font-size: 20px; margin: 0; } header span { color: #555; font-size: 12px; }
  section { margin-bottom: 12px; break-inside: avoid; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px; color: #444; }
  p, ul, ol { margin: 0 0 4px; } ul, ol { padding-left: 18px; }
  li { margin-bottom: 2px; }
  .calls .g { display: inline-block; min-width: 26px; font-weight: 700; color: #555; }
  b { font-weight: 700; } i { color: #666; font-style: normal; }
  footer { margin-top: 18px; color: #999; font-size: 10px; border-top: 1px solid #ccc; padding-top: 6px; }
  @media print { body { margin: 0 auto; } footer { display: none; } }
</style></head><body>
<header><h1>vs ${esc(oppName)}</h1><span>${esc(tier || "")}</span>${record ? `<span>record ${esc(record)}</span>` : ""}${primaryDeck ? `<span>with ${esc(primaryDeck.name)}</span>` : ""}</header>
${textBlock("How they win", meth.howItWins || meth.summary)}
${textBlock("Chokepoint — stop this", pb.chokepoint)}
${traps.length ? block("They play", `<p>${traps.map(trapShort).map(esc).join(" · ")}</p>`) : ""}
${linesHtml}
${textBlock("Going 1st", pb.planFirst)}
${listBlock("Priority — going 1st", pb.priorityFirst)}
${textBlock("Going 2nd", pb.planSecond)}
${listBlock("Priority — going 2nd", pb.prioritySecond)}
${ifThenHtml}
${boardsHtml}
${sideHtml}
${goodHtml}
<footer>YDK Decoder cheat sheet</footer>
<script>setTimeout(function(){ window.print(); }, 150);</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
