import { useMemo, useReducer, useRef, useState } from "react";
import { loadFormats, saveFormats, getActiveFormatId, loadDecks } from "../lib/storage.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import { persistDeck } from "../lib/deckModel.js";
import { lookupCardByName } from "../lib/cardSearch.js";
import { getImageUrls } from "../lib/ydk.js";
import CardPreview from "../components/CardPreview.jsx";
import PanelSection from "../components/PanelSection.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Icon from "../components/Icon.jsx";

const TIER_LABEL = { tier1: "Tier 1", tier2: "Tier 2", rogue: "Rogue" };
const TIER_OPTIONS = [["tier1", "Tier 1"], ["tier2", "Tier 2"], ["rogue", "Rogue"]];
const rid = () => Math.random().toString(36).slice(2, 8);

export default function FormatTab({ dataVersion = 0 }) {
  const [rev, bump] = useReducer((x) => x + 1, 0);
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // shared card preview {card, rect, pinned}

  const { format, deckNames } = useMemo(() => {
    const formats = loadFormats();
    const fmt = formats.find((f) => f.formatId === getActiveFormatId()) || formats[0] || null;
    const names = {};
    for (const d of loadDecks()) names[d.deckId] = d.name;
    return { format: fmt, deckNames: names };
  }, [dataVersion, rev]);

  const [openId, setOpenId] = useState(null);

  // Mutate the active format + persist + re-render.
  const update = (mutator) => {
    const formats = loadFormats();
    const f = formats.find((x) => x.formatId === (format && format.formatId));
    if (!f) return;
    mutator(f);
    f.updatedAt = new Date().toISOString();
    saveFormats(formats);
    bump();
  };

  const onHover = (card, rect) => { if (card) setPreview((p) => (p && p.pinned ? p : { card, rect, pinned: false })); };
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  const onAddMatchupFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { deck } = importDeckFromYdk(text, file.name);
      deck.role = "matchup";
      persistDeck(deck);
      update((f) => {
        f.matchups = f.matchups || [];
        if (!f.matchups.some((m) => m.opponentDeckId === deck.deckId)) {
          f.matchups.push(emptyMatchup(deck.deckId));
        }
      });
    } catch (err) {
      alert("Couldn't add that matchup .ydk: " + err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!format) {
    return (
      <div className="placeholder">
        No format yet. Go to <strong>Decks → Load meta decks</strong> to import the
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
    <div className="format-tab" onMouseLeave={clearHover}>
      <input ref={fileRef} type="file" accept=".ydk" hidden onChange={onAddMatchupFile} />
      <div className="format-head">
        <div>
          <h2 className="format-title">{format.name}</h2>
          <span className="format-sub">{matchups.length} matchups · pick your deck as primary, then refine each one</span>
        </div>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          <Icon name="swords" size={15} /> Add matchup (.ydk)
        </button>
      </div>

      <div className="matchup-list">
        {matchups.map((m) => {
          const name = deckNames[m.opponentDeckId] || "Unknown deck (re-link)";
          const open = openId === m.matchupId;
          return (
            <div key={m.matchupId} className={"matchup-card tier-" + (m.tier || "tier1")}>
              <button type="button" className="matchup-card-head" onClick={() => setOpenId(open ? null : m.matchupId)}>
                <span className={"matchup-tier tier-" + (m.tier || "tier1")}>{TIER_LABEL[m.tier] || "Tier 1"}</span>
                <span className="matchup-name">{name}</span>
                <span className="matchup-chevron">{open ? "▾" : "▸"}</span>
              </button>
              {m.howTheyWin && <div className="matchup-how">{m.howTheyWin}</div>}
              {open && (
                <MatchupDrill m={m} update={update} onHover={onHover} onPick={onPick} setOpenId={setOpenId} />
              )}
            </div>
          );
        })}
      </div>

      <PanelSection title="Tournament journal — log events + matchup record" defaultOpen={false}>
        <TournamentJournal format={format} deckNames={deckNames} update={update} />
      </PanelSection>

      {preview && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}

function emptyMatchup(opponentDeckId) {
  return {
    matchupId: "m_" + rid(), opponentDeckId, tier: "tier2",
    howTheyWin: "", comboLine: "", chokepointTheirs: "", gameplanFirst: "", gameplanSecond: "", weaknesses: "",
    counterCards: [], targetEndboard: [], priorityFirst: [], prioritySecond: [],
    sideboard: { goingFirst: { in: [], out: [] }, goingSecond: { in: [], out: [] } },
    freeformNotes: "", relatedComboIds: [], chokepointOurs: "",
  };
}

// Helper to mutate one matchup inside the active format.
function useMatchupUpdate(update, matchupId) {
  return (fn) => update((f) => {
    const m = (f.matchups || []).find((x) => x.matchupId === matchupId);
    if (m) fn(m);
  });
}

function MatchupDrill({ m, update, onHover, onPick, setOpenId }) {
  const upd = useMatchupUpdate(update, m.matchupId);
  return (
    <div className="matchup-drill">
      <div className="drill-row">
        <label className="drill-inline">
          <span className="drill-label">Tier — you decide</span>
          <select className="bb-select" value={m.tier || "tier1"} onChange={(e) => upd((x) => { x.tier = e.target.value; })}>
            {TIER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="deck-mini-btn is-danger" title="Remove this matchup"
          onClick={() => { if (confirm("Remove this matchup from the format? (The deck stays in your library.)")) { setOpenId(null); update((f) => { f.matchups = (f.matchups || []).filter((x) => x.matchupId !== m.matchupId); }); } }}>
          × Remove matchup
        </button>
      </div>

      <Field label="Main combo line (how their turn goes)" value={m.comboLine} />
      <Field label="Chokepoint — what to Ash / stop" value={m.chokepointTheirs} />
      <Field label="Going first vs them" value={m.gameplanFirst} />
      <Field label="Going second — break their board" value={m.gameplanSecond} />
      <Field label="How it loses / weaknesses" value={m.weaknesses} />

      <ChipEditor label="Their typical end board (feeds Testing → Going 2nd)" items={m.targetEndboard || []}
        onChange={(items) => upd((x) => { x.targetEndboard = items; })} onHover={onHover} onPick={onPick} placeholder="Add a board piece…" />

      <CounterEditor cards={m.counterCards || []} onChange={(c) => upd((x) => { x.counterCards = c; })} onHover={onHover} onPick={onPick} />

      <StepEditor label="Priority plays — going first" steps={m.priorityFirst || []} onChange={(s) => upd((x) => { x.priorityFirst = s; })} />
      <StepEditor label="Priority plays — going second" steps={m.prioritySecond || []} onChange={(s) => upd((x) => { x.prioritySecond = s; })} />

      <SideboardEditor sb={m.sideboard} onChange={(sb) => upd((x) => { x.sideboard = sb; })} onHover={onHover} onPick={onPick} />

      <div className="drill-field">
        <div className="drill-label">Your notes on this matchup</div>
        <RichNotes value={m.freeformNotes || ""} placeholder="Scouting notes, lines you've found, what to watch for. Type @ to mention a card."
          onSave={(v) => upd((x) => { x.freeformNotes = v; })} />
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

// Reusable card chip with hover/pin preview + optional remove.
function CardChip({ name, onHover, onPick, onRemove, tone }) {
  const c = lookupCardByName(name);
  const urls = c?.id ? getImageUrls(c.id) : [];
  return (
    <span className={"fmt-chip" + (tone ? " is-" + tone : "")}
      onMouseEnter={(e) => onHover && onHover(c, e.currentTarget.getBoundingClientRect())}
      onClick={(e) => onPick && onPick(c, e.currentTarget.getBoundingClientRect())}>
      {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : null}
      <span className="fmt-chip-name">{name}</span>
      {onRemove && <button type="button" className="fmt-chip-x" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>}
    </span>
  );
}

function CardAddInput({ onAdd, placeholder }) {
  const [adding, setAdding] = useState(false);
  if (!adding) return <button type="button" className="fmt-add-btn" onClick={() => setAdding(true)}>+ Add</button>;
  return (
    <input className="fmt-add-input" autoFocus placeholder={placeholder || "Card name, Enter"}
      onKeyDown={(e) => {
        if (e.key === "Enter") { const v = e.target.value.trim(); if (v) onAdd((lookupCardByName(v) || {}).name || v); setAdding(false); }
        else if (e.key === "Escape") setAdding(false);
        else e.stopPropagation();
      }}
      onBlur={(e) => { const v = e.target.value.trim(); if (v) onAdd((lookupCardByName(v) || {}).name || v); setAdding(false); }} />
  );
}

function ChipEditor({ label, items, onChange, onHover, onPick, placeholder }) {
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <div className="fmt-chip-row">
        {(items || []).map((name, i) => (
          <CardChip key={i} name={name} onHover={onHover} onPick={onPick}
            onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        ))}
        <CardAddInput placeholder={placeholder} onAdd={(name) => onChange([...(items || []), name])} />
      </div>
    </div>
  );
}

function CounterEditor({ cards, onChange, onHover, onPick }) {
  return (
    <div className="drill-field">
      <div className="drill-label">Cards that shine / cards that whiff</div>
      <div className="fmt-chip-row">
        {(cards || []).map((c, i) => (
          <CardChip key={i} name={c.name} tone={c.side === "bad" ? "bad" : "good"} onHover={onHover} onPick={onPick}
            onRemove={() => onChange(cards.filter((_, j) => j !== i))} />
        ))}
        <CardAddInput placeholder="Good counter…" onAdd={(name) => onChange([...(cards || []), { name, side: "good", notes: "" }])} />
      </div>
    </div>
  );
}

function StepEditor({ label, steps, onChange }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <ol className="fmt-steps">
        {(steps || []).map((s, i) => (
          <li key={i} className="fmt-step">
            <span className="fmt-step-text">{s}</span>
            <button type="button" className="fmt-chip-x" title="Remove" onClick={() => onChange(steps.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ol>
      {adding ? (
        <input className="fmt-add-input is-wide" autoFocus placeholder="A step, Enter to add"
          onKeyDown={(e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) onChange([...(steps || []), v]); setAdding(false); } else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) onChange([...(steps || []), v]); setAdding(false); }} />
      ) : (
        <button type="button" className="fmt-add-btn" onClick={() => setAdding(true)}>+ Add step</button>
      )}
    </div>
  );
}

function SideboardEditor({ sb, onChange, onHover, onPick }) {
  const plan = sb || { goingFirst: { in: [], out: [] }, goingSecond: { in: [], out: [] } };
  const setLeg = (leg, dir, items) => {
    const next = { goingFirst: { ...(plan.goingFirst || { in: [], out: [] }) }, goingSecond: { ...(plan.goingSecond || { in: [], out: [] }) } };
    next[leg][dir] = items;
    onChange(next);
  };
  const legUI = (leg, title) => {
    const l = plan[leg] || { in: [], out: [] };
    return (
      <div className="sb-leg">
        <div className="sb-leg-title">{title}</div>
        <div className="sb-dir"><span className="sb-dir-label is-in">+ In</span>
          <div className="fmt-chip-row">
            {(l.in || []).map((n, i) => <CardChip key={i} name={n} tone="good" onHover={onHover} onPick={onPick} onRemove={() => setLeg(leg, "in", l.in.filter((_, j) => j !== i))} />)}
            <CardAddInput placeholder="Side in…" onAdd={(n) => setLeg(leg, "in", [...(l.in || []), n])} />
          </div>
        </div>
        <div className="sb-dir"><span className="sb-dir-label is-out">− Out</span>
          <div className="fmt-chip-row">
            {(l.out || []).map((n, i) => <CardChip key={i} name={n} tone="bad" onHover={onHover} onPick={onPick} onRemove={() => setLeg(leg, "out", l.out.filter((_, j) => j !== i))} />)}
            <CardAddInput placeholder="Side out…" onAdd={(n) => setLeg(leg, "out", [...(l.out || []), n])} />
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="drill-field">
      <div className="drill-label">Side-deck plan</div>
      <div className="sb-grid">{legUI("goingFirst", "Going first")}{legUI("goingSecond", "Going second")}</div>
    </div>
  );
}

// ── Tournament journal ───────────────────────────────────────────────
function TournamentJournal({ format, deckNames, update }) {
  const tournaments = format.tournaments || [];
  const [openT, setOpenT] = useState(null);

  const addTournament = () => {
    const name = prompt("Event name (e.g. Locals 2026-06-01):", "");
    if (name == null) return;
    update((f) => { f.tournaments = f.tournaments || []; f.tournaments.push({ tournamentId: "t_" + rid(), name: name.trim() || "Event", date: "", rounds: [] }); });
  };

  // Aggregate W/L per opponent across all events.
  const record = {};
  for (const t of tournaments) for (const r of (t.rounds || [])) {
    const k = r.opponentDeckId || "_other";
    record[k] = record[k] || { w: 0, l: 0, d: 0 };
    if (r.result === "W") record[k].w++; else if (r.result === "L") record[k].l++; else record[k].d++;
  }

  return (
    <div className="journal">
      <div className="journal-bar">
        <button type="button" className="deck-inline-btn" onClick={addTournament}>+ New event</button>
      </div>

      {!!Object.keys(record).length && (
        <div className="journal-record">
          <div className="drill-label">Matchup record (all events)</div>
          <div className="fmt-chip-row">
            {Object.entries(record).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).map(([k, r]) => (
              <span key={k} className="record-chip">
                <strong>{deckNames[k] || "Other"}</strong> {r.w}-{r.l}{r.d ? "-" + r.d : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {!tournaments.length && <div className="deck-empty-hint">No events logged yet. Click + New event, then add each round's opponent + result.</div>}

      {tournaments.map((t) => {
        const open = openT === t.tournamentId;
        const w = (t.rounds || []).filter((r) => r.result === "W").length;
        const l = (t.rounds || []).filter((r) => r.result === "L").length;
        return (
          <div key={t.tournamentId} className="journal-event">
            <button type="button" className="journal-event-head" onClick={() => setOpenT(open ? null : t.tournamentId)}>
              <span className="journal-event-name">{t.name}</span>
              <span className="journal-event-rec">{w}-{l}</span>
              <span className="matchup-chevron">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <RoundEditor t={t} format={format} deckNames={deckNames} update={update} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoundEditor({ t, format, deckNames, update }) {
  const updT = (fn) => update((f) => { const tt = (f.tournaments || []).find((x) => x.tournamentId === t.tournamentId); if (tt) fn(tt); });
  const opponents = (format.matchups || []).map((m) => m.opponentDeckId);
  const addRound = () => updT((tt) => { tt.rounds = tt.rounds || []; tt.rounds.push({ roundId: "r_" + rid(), opponentDeckId: opponents[0] || "", result: "W", score: "", notes: "" }); });
  return (
    <div className="journal-rounds">
      {(t.rounds || []).map((r, i) => (
        <div key={r.roundId} className="journal-round">
          <span className="journal-round-n">R{i + 1}</span>
          <select className="bb-select" value={r.opponentDeckId || ""} onChange={(e) => updT((tt) => { tt.rounds[i].opponentDeckId = e.target.value; })}>
            <option value="">— opponent —</option>
            {opponents.map((id) => <option key={id} value={id}>{deckNames[id] || id}</option>)}
          </select>
          <div className="journal-wl">
            {["W", "L", "D"].map((res) => (
              <button key={res} type="button" className={"journal-wl-btn is-" + res.toLowerCase() + (r.result === res ? " active" : "")}
                onClick={() => updT((tt) => { tt.rounds[i].result = res; })}>{res}</button>
            ))}
          </div>
          <input className="fmt-add-input" defaultValue={r.score} placeholder="2-1" style={{ width: 56 }}
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updT((tt) => { tt.rounds[i].score = e.target.value; })} />
          <input className="fmt-add-input is-wide" defaultValue={r.notes} placeholder="notes"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updT((tt) => { tt.rounds[i].notes = e.target.value; })} />
          <button type="button" className="fmt-chip-x" title="Remove round" onClick={() => updT((tt) => { tt.rounds = tt.rounds.filter((_, j) => j !== i); })}>×</button>
        </div>
      ))}
      <button type="button" className="fmt-add-btn" onClick={addRound}>+ Add round</button>
    </div>
  );
}
