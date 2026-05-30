import { useMemo, useReducer, useState } from "react";
import { loadFormats, saveFormats, getActiveFormatId, loadDecks } from "../lib/storage.js";

const TIER_LABEL = { tier1: "Tier 1", tier2: "Tier 2", rogue: "Rogue" };
const TIER_OPTIONS = [["tier1", "Tier 1"], ["tier2", "Tier 2"], ["rogue", "Rogue"]];

export default function FormatTab({ dataVersion = 0 }) {
  const [rev, bump] = useReducer((x) => x + 1, 0);
  const { format, deckNames } = useMemo(() => {
    const formats = loadFormats();
    const id = getActiveFormatId();
    const fmt = formats.find((f) => f.formatId === id) || formats[0] || null;
    const names = {};
    for (const d of loadDecks()) names[d.deckId] = d.name;
    return { format: fmt, deckNames: names };
  }, [dataVersion, rev]);

  const [openId, setOpenId] = useState(null);

  // Let the user dictate each matchup's tier (persisted; survives meta refresh).
  const setTier = (matchupId, tier) => {
    const formats = loadFormats();
    const f = formats.find((x) => x.formatId === (format && format.formatId));
    const m = f && (f.matchups || []).find((x) => x.matchupId === matchupId);
    if (!m) return;
    m.tier = tier;
    saveFormats(formats);
    bump();
  };

  if (!format) {
    return (
      <div className="placeholder">
        No format yet. Go to <strong>⚙ Settings → Load meta decks</strong> to import the
        "Meta - May 2026" format with all the matchups pre-filled.
      </div>
    );
  }

  const matchups = (format.matchups || []).slice().sort((a, b) => {
    const t = { tier1: 0, tier2: 1, rogue: 2 };
    return (t[a.tier] ?? 1) - (t[b.tier] ?? 1) ||
      (deckNames[a.opponentDeckId] || "").localeCompare(deckNames[b.opponentDeckId] || "");
  });

  return (
    <div className="format-tab">
      <div className="format-head">
        <h2 className="format-title">{format.name}</h2>
        <span className="format-sub">{matchups.length} matchups · pick your deck as primary, then refine</span>
      </div>

      <div className="matchup-list">
        {matchups.map((m) => {
          const name = deckNames[m.opponentDeckId] || "Unknown deck";
          const open = openId === m.matchupId;
          return (
            <div key={m.matchupId} className={"matchup-card tier-" + (m.tier || "tier1")}>
              <button
                type="button"
                className="matchup-card-head"
                onClick={() => setOpenId(open ? null : m.matchupId)}
              >
                <span className={"matchup-tier tier-" + (m.tier || "tier1")}>{TIER_LABEL[m.tier] || "Tier 1"}</span>
                <span className="matchup-name">{name}</span>
                <span className="matchup-chevron">{open ? "▾" : "▸"}</span>
              </button>
              {m.howTheyWin && <div className="matchup-how">{m.howTheyWin}</div>}

              {open && (
                <div className="matchup-drill">
                  <div className="drill-field">
                    <div className="drill-label">Tier — you decide</div>
                    <select className="bb-select" value={m.tier || "tier1"} onChange={(e) => setTier(m.matchupId, e.target.value)}>
                      {TIER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <Field label="Main combo line (how their turn goes)" value={m.comboLine} />
                  <Field label="Chokepoint — what to Ash / stop" value={m.chokepointTheirs} />
                  <Field label="Going first vs them" value={m.gameplanFirst} />
                  <Field label="Going second — break their board" value={m.gameplanSecond} />
                  {!!(m.targetEndboard || []).length && (
                    <div className="drill-field">
                      <div className="drill-label">Their typical end board</div>
                      <div className="chip-row">
                        {m.targetEndboard.map((c, i) => <span key={i} className="card-chip">{c}</span>)}
                      </div>
                    </div>
                  )}
                  {!!(m.counterCards || []).length && (
                    <div className="drill-field">
                      <div className="drill-label">Cards that shine</div>
                      <div className="chip-row">
                        {m.counterCards.map((c, i) => (
                          <span key={i} className={"card-chip " + (c.side === "bad" ? "is-bad" : "is-good")} title={c.notes || ""}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Field label="How it loses / weaknesses" value={m.weaknesses} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <div className="drill-text">{value}</div>
    </div>
  );
}
