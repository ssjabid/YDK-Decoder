import { useEffect, useState } from "react";
import { lookupCardByName, searchApi } from "../lib/cardSearch.js";
import { getImageUrls } from "../lib/ydk.js";

// ════════════════════════════════════════════════════════════════════
// EndBoardView — the visual "playmat" port of the original decoder's
// DoomZ end-board view. A 5-column field grid:
//     row 1:  Field Spell · Extra Monster L · — · Extra Monster R · —
//     row 2:  M-1 … M-5      (main monster zones,  blue)
//     row 3:  S-1 … S-5      (spell / trap zones,  red)
// Cards are placed into zones automatically by type (monster→M, extra-
// deck→EMZ, spell/trap→S, field spell→Field), unless a card carries an
// explicit `zone`. Read-only: hover/click a piece to preview the card.
//   cards: [ "Name" | { name, zone?, materials?, note? } ]
// ════════════════════════════════════════════════════════════════════
const MAIN_ZONES = ["M-1", "M-2", "M-3", "M-4", "M-5"];
const ST_ZONES = ["S-1", "S-2", "S-3", "S-4", "S-5"];

export const ZONE_OPTIONS = [
  ["auto", "Auto-place"],
  ["Field", "Field Spell"],
  ["EMZ-L", "Extra Monster L"],
  ["EMZ-R", "Extra Monster R"],
  ["M-1", "Monster 1"], ["M-2", "Monster 2"], ["M-3", "Monster 3"], ["M-4", "Monster 4"], ["M-5", "Monster 5"],
  ["S-1", "Spell/Trap 1"], ["S-2", "Spell/Trap 2"], ["S-3", "Spell/Trap 3"], ["S-4", "Spell/Trap 4"], ["S-5", "Spell/Trap 5"],
];

// Which pool a card belongs to (for auto-placement).
function kindOf(card) {
  if (!card) return "monster"; // unknown board pieces are almost always monsters
  const t = (card.type || "").toLowerCase();
  const race = (card.race || "").toLowerCase();
  if (t.includes("spell")) return race === "field" ? "field" : "spell";
  if (t.includes("trap")) return "spell";
  if (/link|xyz|synchro|fusion/.test(t)) return "extra";
  return "monster";
}

const CELL_DEFS = [
  { zone: "Field", cls: "zone-field", label: "Field Spell" },
  { zone: "EMZ-L", cls: "zone-emz", label: "Extra Monster" },
  { zone: "EMZ-R", cls: "zone-emz", label: "Extra Monster" },
  { zone: "M-1", cls: "zone-m", label: "M-1" }, { zone: "M-2", cls: "zone-m", label: "M-2" },
  { zone: "M-3", cls: "zone-m", label: "M-3" }, { zone: "M-4", cls: "zone-m", label: "M-4" },
  { zone: "M-5", cls: "zone-m", label: "M-5" },
  { zone: "S-1", cls: "zone-s", label: "S-1" }, { zone: "S-2", cls: "zone-s", label: "S-2" },
  { zone: "S-3", cls: "zone-s", label: "S-3" }, { zone: "S-4", cls: "zone-s", label: "S-4" },
  { zone: "S-5", cls: "zone-s", label: "S-5" },
];

// Resolve a card list into { slots: {zone: slot}, orphans: [slot] }.
export function placeBoard(cards) {
  const items = (cards || [])
    .map((c) => (typeof c === "string" ? { name: c } : { ...c }))
    .filter((c) => c && c.name)
    .map((c) => ({ ...c, card: lookupCardByName(c.name) }));

  const pools = { monster: [...MAIN_ZONES], spell: [...ST_ZONES], extra: ["EMZ-L", "EMZ-R"], field: ["Field"] };
  const take = (z) => { for (const k in pools) { const i = pools[k].indexOf(z); if (i >= 0) pools[k].splice(i, 1); } };
  const slots = {};
  const orphans = [];

  // 1) Honour explicit zones first.
  const implicit = [];
  for (const it of items) {
    if (it.zone && it.zone !== "auto") {
      if (!slots[it.zone]) { slots[it.zone] = it; take(it.zone); }
      else orphans.push(it);
    } else implicit.push(it);
  }
  // 2) Auto-place the rest, with sensible overflow.
  for (const it of implicit) {
    const kind = kindOf(it.card);
    let z = pools[kind] && pools[kind].shift();
    if (!z && kind === "extra") z = pools.monster.shift();
    if (!z && kind === "monster") z = pools.extra.shift();
    if (z) { slots[z] = { ...it, zone: z }; } else orphans.push(it);
  }
  return { slots, orphans };
}

function Pill({ slot, onHover, onPick }) {
  const card = slot.card || lookupCardByName(slot.name);
  const urls = card?.id ? getImageUrls(card.id) : [];
  return (
    <span
      className="eb-pill"
      title={slot.name}
      onMouseEnter={(e) => onHover && card && onHover(card, e.currentTarget.getBoundingClientRect())}
      onClick={(e) => { e.stopPropagation(); onPick && card && onPick(card, e.currentTarget.getBoundingClientRect()); }}
    >
      <span className="eb-pill-thumb">
        {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : <span className="eb-pill-ph">{slot.name[0]}</span>}
      </span>
      <span className="eb-pill-name">{slot.name}</span>
    </span>
  );
}

export default function EndBoardView({ cards, onHover, onPick, compact = false }) {
  const [, setRev] = useState(0);
  const nameKey = (cards || []).map((c) => (typeof c === "string" ? c : (c && c.name) || "")).join("|");

  // Resolve any board card not yet cached (by fuzzy name) so it lands in the
  // correct zone — makes the playmat self-healing wherever it's rendered.
  useEffect(() => {
    let alive = true;
    const missing = nameKey.split("|").filter((n) => n && !lookupCardByName(n));
    if (!missing.length) return;
    (async () => {
      let got = false;
      for (const n of [...new Set(missing)]) { try { const r = await searchApi(n); if (r && r.length) got = true; } catch (_) { /* noop */ } }
      if (alive && got) setRev((x) => x + 1);
    })();
    return () => { alive = false; };
  }, [nameKey]);

  const { slots, orphans } = placeBoard(cards);
  const filled = Object.keys(slots).length;
  if (!filled && !orphans.length) {
    return <div className="eb-empty">No cards on this board yet.</div>;
  }
  return (
    <div className={"eb" + (compact ? " is-compact" : "")}>
      <div className="eb-grid">
        {CELL_DEFS.map((def) => {
          const slot = slots[def.zone];
          return (
            <div key={def.zone} className={"eb-cell " + def.cls + (slot ? "" : " is-empty")} data-zone={def.zone}>
              <span className="eb-zone-label">{def.label}</span>
              {slot && <Pill slot={slot} onHover={onHover} onPick={onPick} />}
              {slot && slot.note ? <span className="eb-pill-note">{slot.note}</span> : null}
            </div>
          );
        })}
      </div>
      {orphans.length > 0 && (
        <div className="eb-orphans">
          <span className="eb-orphans-label">Also on board / overflow</span>
          <div className="eb-orphans-row">
            {orphans.map((slot, i) => <Pill key={i} slot={slot} onHover={onHover} onPick={onPick} />)}
          </div>
        </div>
      )}
    </div>
  );
}
