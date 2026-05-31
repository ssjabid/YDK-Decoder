import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadFormats, saveFormats, getActiveFormatId, setActiveFormatId, loadDecks } from "../lib/storage.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import { persistDeck, getDeckPrimaryDecklist, classifyCardBroadType } from "../lib/deckModel.js";
import { lookupCardByName } from "../lib/cardSearch.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import CardPreview from "../components/CardPreview.jsx";
import PanelSection from "../components/PanelSection.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Icon from "../components/Icon.jsx";

const TIER_LABEL = { tier1: "Tier 1", tier2: "Tier 2", rogue: "Rogue" };
const TIER_OPTIONS = [["tier1", "Tier 1"], ["tier2", "Tier 2"], ["rogue", "Rogue"]];
const rid = () => Math.random().toString(36).slice(2, 8);

export default function FormatTab({ dataVersion = 0 }) {
  const [rev, bump] = useReducer((x) => x + 1, 0);
  const [selectedMatchupId, setSelectedMatchupId] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const { formats, format, decks, deckNames, primaryDecks } = useMemo(() => {
    const fmts = loadFormats();
    const fmt = fmts.find((f) => f.formatId === getActiveFormatId()) || fmts[0] || null;
    const ds = loadDecks();
    const names = {};
    for (const d of ds) names[d.deckId] = d.name;
    return { formats: fmts, format: fmt, decks: ds, deckNames: names, primaryDecks: ds.filter((d) => (d.role || "primary") === "primary") };
  }, [dataVersion, rev]);

  const update = (mutator) => {
    const fmts = loadFormats();
    const f = fmts.find((x) => x.formatId === (format && format.formatId));
    if (!f) return;
    mutator(f);
    f.updatedAt = new Date().toISOString();
    saveFormats(fmts);
    bump();
  };

  const onHover = (card, rect) => { if (card) setPreview((p) => (p && p.pinned ? p : { card, rect, pinned: false })); };
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  // ── Format CRUD ──
  const newFormat = (clone) => {
    const name = prompt("New format name (e.g. \"Meta — July 2026\"):", "");
    if (name == null) return;
    const fmts = loadFormats();
    const id = "fmt_" + rid();
    const base = { formatId: id, name: name.trim() || "New format", primaryDeckId: null, matchups: [], tournaments: [], notes: "", createdAt: new Date().toISOString() };
    if (clone && format) base.matchups = (format.matchups || []).map((m) => ({ ...m, matchupId: "m_" + rid(), freeformNotes: "", priorityFirst: [], prioritySecond: [], sideboard: { goingFirst: { in: [], out: [] }, goingSecond: { in: [], out: [] } } }));
    fmts.push(base); saveFormats(fmts); setActiveFormatId(id); setSelectedMatchupId(null); bump();
  };
  const renameFormat = () => { const n = prompt("Rename format:", format.name); if (n == null) return; update((f) => { f.name = n.trim() || f.name; }); };
  const deleteFormat = () => {
    if (!confirm(`Delete format "${format.name}"? (Matchup decks stay in your library.)`)) return;
    const remaining = loadFormats().filter((f) => f.formatId !== format.formatId);
    saveFormats(remaining); setActiveFormatId(remaining[0] ? remaining[0].formatId : null); setSelectedMatchupId(null); bump();
  };

  const onAddMatchupFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { deck } = importDeckFromYdk(text, file.name);
      deck.role = "matchup"; persistDeck(deck);
      update((f) => { f.matchups = f.matchups || []; if (!f.matchups.some((m) => m.opponentDeckId === deck.deckId)) f.matchups.push(emptyMatchup(deck.deckId)); });
    } catch (err) { alert("Couldn't add that matchup .ydk: " + err.message); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  if (!formats.length || !format) {
    return (
      <div className="placeholder">
        No format yet. Go to <strong>Decks → Load meta decks</strong> to import the
        "Meta - May 2026" format, or <button type="button" className="link-btn" onClick={() => newFormat(false)}>create a format</button>.
      </div>
    );
  }

  const primaryDeck = decks.find((d) => d.deckId === format.primaryDeckId) || null;
  const matchups = (format.matchups || []).slice().sort((a, b) => {
    const t = { tier1: 0, tier2: 1, rogue: 2 };
    return (t[a.tier] ?? 1) - (t[b.tier] ?? 1) || (deckNames[a.opponentDeckId] || "").localeCompare(deckNames[b.opponentDeckId] || "");
  });
  const selected = selectedMatchupId ? (format.matchups || []).find((m) => m.matchupId === selectedMatchupId) : null;

  return (
    <div className="format-tab" onMouseLeave={clearHover}>
      <input ref={fileRef} type="file" accept=".ydk" hidden onChange={onAddMatchupFile} />

      {/* ── Format header: pick/manage format + your deck ── */}
      <div className="format-bar">
        <div className="format-bar-left">
          <select className="format-picker" value={format.formatId} onChange={(e) => { setActiveFormatId(e.target.value); setSelectedMatchupId(null); bump(); }}>
            {formats.map((f) => <option key={f.formatId} value={f.formatId}>{f.name}</option>)}
          </select>
          <button type="button" className="format-act" title="New format" onClick={() => newFormat(false)}>+ New</button>
          {format.matchups?.length ? <button type="button" className="format-act" title="New format cloning these matchups" onClick={() => newFormat(true)}>Clone</button> : null}
          <button type="button" className="format-act" title="Rename" onClick={renameFormat}>✎</button>
          {formats.length > 1 && <button type="button" className="format-act is-danger" title="Delete format" onClick={deleteFormat}>×</button>}
        </div>
        <label className="format-primary">
          <span>Your deck</span>
          <select className="format-picker" value={format.primaryDeckId || ""} onChange={(e) => update((f) => { f.primaryDeckId = e.target.value || null; })}>
            <option value="">— pick your deck —</option>
            {primaryDecks.map((d) => <option key={d.deckId} value={d.deckId}>{d.name}</option>)}
          </select>
        </label>
      </div>

      {selected ? (
        <MatchupBreakdown
          key={selected.matchupId}
          m={selected} format={format} primaryDeck={primaryDeck} deckNames={deckNames}
          update={update} onHover={onHover} onPick={onPick}
          onBack={() => setSelectedMatchupId(null)}
          onRemove={() => { setSelectedMatchupId(null); update((f) => { f.matchups = (f.matchups || []).filter((x) => x.matchupId !== selected.matchupId); }); }}
        />
      ) : (
        <>
          <div className="format-listhead">
            <h2 className="format-title">{format.name}</h2>
            <span className="format-sub">{matchups.length} matchup decks{primaryDeck ? ` · testing ${primaryDeck.name}` : " · pick your deck above"}</span>
            <button type="button" className="btn-secondary format-addbtn" onClick={() => fileRef.current?.click()}><Icon name="swords" size={15} /> Add matchup (.ydk)</button>
          </div>

          {!matchups.length ? (
            <div className="placeholder">No matchup decks yet. <strong>Add matchup (.ydk)</strong> or load the meta pack from the Decks tab.</div>
          ) : (
            <div className="matchup-grid">
              {matchups.map((m) => {
                const name = deckNames[m.opponentDeckId] || "Unknown deck";
                return (
                  <button key={m.matchupId} type="button" className={"matchup-cell tier-" + (m.tier || "tier1")} onClick={() => setSelectedMatchupId(m.matchupId)}>
                    <span className={"matchup-tier tier-" + (m.tier || "tier1")}>{TIER_LABEL[m.tier] || "Tier 1"}</span>
                    <span className="matchup-cell-name">{name}</span>
                    {m.howTheyWin && <span className="matchup-cell-how">{m.howTheyWin}</span>}
                    <span className="matchup-cell-open">Open breakdown →</span>
                  </button>
                );
              })}
            </div>
          )}

          <PanelSection title="Tournament journal — log events + matchup record" defaultOpen={false}>
            <TournamentJournal format={format} deckNames={deckNames} update={update} />
          </PanelSection>
        </>
      )}

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

function useMatchupUpdate(update, matchupId) {
  return (fn) => update((f) => { const m = (f.matchups || []).find((x) => x.matchupId === matchupId); if (m) fn(m); });
}

// ── Full-screen matchup breakdown ──
function MatchupBreakdown({ m, format, primaryDeck, deckNames, update, onHover, onPick, onBack, onRemove }) {
  const upd = useMatchupUpdate(update, m.matchupId);
  const name = deckNames[m.opponentDeckId] || "Unknown deck";
  return (
    <div className="matchup-full">
      <div className="matchup-full-bar">
        <button type="button" className="back-btn" onClick={onBack}>← All matchups</button>
        <span className={"matchup-tier tier-" + (m.tier || "tier1")}>{TIER_LABEL[m.tier] || "Tier 1"}</span>
        <h2 className="matchup-full-title">{name}</h2>
        <select className="bb-select" value={m.tier || "tier1"} onChange={(e) => upd((x) => { x.tier = e.target.value; })}>
          {TIER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className="deck-mini-btn is-danger" onClick={() => { if (confirm("Remove this matchup? (The deck stays in your library.)")) onRemove(); }}>× Remove</button>
      </div>

      <div className="matchup-full-grid">
        <div className="matchup-col">
          <PanelSection title="How they win + their line" defaultOpen={true}>
            <Field label="How they win" value={m.howTheyWin} />
            <Field label="Main combo line" value={m.comboLine} />
            <Field label="Chokepoint — what to Ash / stop" value={m.chokepointTheirs} />
            <Field label="How it loses / weaknesses" value={m.weaknesses} />
          </PanelSection>

          <PanelSection title="Their typical end board" defaultOpen={true}>
            <ChipEditor items={m.targetEndboard || []} onChange={(items) => upd((x) => { x.targetEndboard = items; })} onHover={onHover} onPick={onPick} placeholder="Add a board piece…" />
            <div className="drill-hint">Feeds <strong>Testing → Going second</strong> — practise breaking this board.</div>
          </PanelSection>

          <PanelSection title="Game plan" defaultOpen={true}>
            <Field label="Going first vs them" value={m.gameplanFirst} />
            <Field label="Going second — break their board" value={m.gameplanSecond} />
            <StepEditor label="Priority plays — going first" steps={m.priorityFirst || []} onChange={(s) => upd((x) => { x.priorityFirst = s; })} />
            <StepEditor label="Priority plays — going second" steps={m.prioritySecond || []} onChange={(s) => upd((x) => { x.prioritySecond = s; })} />
          </PanelSection>
        </div>

        <div className="matchup-col">
          <PanelSection title="Cards that shine / whiff" defaultOpen={true}>
            <CounterEditor cards={m.counterCards || []} onChange={(c) => upd((x) => { x.counterCards = c; })} onHover={onHover} onPick={onPick} />
          </PanelSection>

          <PanelSection title="Side-deck plan (auto-pulled from your deck)" defaultOpen={true}>
            <SideboardPlanner sb={m.sideboard} primaryDeck={primaryDeck} onChange={(sb) => upd((x) => { x.sideboard = sb; })} onHover={onHover} />
          </PanelSection>

          <PanelSection title="Your notes on this matchup" defaultOpen={true}>
            <RichNotes value={m.freeformNotes || ""} placeholder="Scouting notes, lines you've found, what to watch for. Type @ to mention a card."
              onSave={(v) => upd((x) => { x.freeformNotes = v; })} />
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return <div className="drill-field"><div className="drill-label">{label}</div><div className="drill-text">{value}</div></div>;
}

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
      onKeyDown={(e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) onAdd((lookupCardByName(v) || {}).name || v); setAdding(false); } else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
      onBlur={(e) => { const v = e.target.value.trim(); if (v) onAdd((lookupCardByName(v) || {}).name || v); setAdding(false); }} />
  );
}

function ChipEditor({ items, onChange, onHover, onPick, placeholder }) {
  return (
    <div className="fmt-chip-row">
      {(items || []).map((name, i) => <CardChip key={i} name={name} onHover={onHover} onPick={onPick} onRemove={() => onChange(items.filter((_, j) => j !== i))} />)}
      <CardAddInput placeholder={placeholder} onAdd={(name) => onChange([...(items || []), name])} />
    </div>
  );
}

function CounterEditor({ cards, onChange, onHover, onPick }) {
  return (
    <div className="fmt-chip-row">
      {(cards || []).map((c, i) => <CardChip key={i} name={c.name} tone={c.side === "bad" ? "bad" : "good"} onHover={onHover} onPick={onPick} onRemove={() => onChange(cards.filter((_, j) => j !== i))} />)}
      <CardAddInput placeholder="Good counter…" onAdd={(name) => onChange([...(cards || []), { name, side: "good", notes: "" }])} />
    </div>
  );
}

function StepEditor({ label, steps, onChange }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <ol className="fmt-steps">
        {(steps || []).map((s, i) => <li key={i} className="fmt-step"><span className="fmt-step-text">{s}</span><button type="button" className="fmt-chip-x" onClick={() => onChange(steps.filter((_, j) => j !== i))}>×</button></li>)}
      </ol>
      {adding ? (
        <input className="fmt-add-input is-wide" autoFocus placeholder="A step, Enter to add"
          onKeyDown={(e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) onChange([...(steps || []), v]); setAdding(false); } else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) onChange([...(steps || []), v]); setAdding(false); }} />
      ) : <button type="button" className="fmt-add-btn" onClick={() => setAdding(true)}>+ Add step</button>}
    </div>
  );
}

// ── Side-deck planner — auto-pulls your side deck (→ bring in) + main deck (→ take out) ──
function SideboardPlanner({ sb, primaryDeck, onChange, onHover }) {
  const [cardMap, setCardMap] = useState({});
  const dl = primaryDeck ? getDeckPrimaryDecklist(primaryDeck) : null;
  const sideIds = useMemo(() => (dl && dl.side) || [], [dl]);
  const mainIds = useMemo(() => (dl && dl.main) || [], [dl]);

  useEffect(() => {
    let alive = true;
    if (!primaryDeck) return;
    fetchCards([...mainIds, ...sideIds]).then(({ map }) => { if (alive) setCardMap(map); });
    return () => { alive = false; };
  }, [primaryDeck, mainIds, sideIds]);

  if (!primaryDeck) return <div className="deck-empty-hint">Pick <strong>your deck</strong> at the top of the Format tab to auto-load your side + main deck here.</div>;

  const nameOf = (id) => (cardMap[Number(id)] && cardMap[Number(id)].name) || ("#" + id);
  const TYPE_ORDER = { Monster: 0, Spell: 1, Trap: 2, Other: 3 };
  const uniqSorted = (ids) => {
    const seen = new Set(); const out = [];
    for (const id of ids) { const n = nameOf(id); if (!seen.has(n)) { seen.add(n); out.push(n); } }
    return out.sort((a, b) => {
      const ca = cardMap[Number((ids.find((i) => nameOf(i) === a)))]; const cb = cardMap[Number((ids.find((i) => nameOf(i) === b)))];
      return (TYPE_ORDER[classifyCardBroadType(ca)] - TYPE_ORDER[classifyCardBroadType(cb)]) || a.localeCompare(b);
    });
  };
  const sidePool = uniqSorted(sideIds);
  const mainPool = uniqSorted(mainIds);
  const plan = sb || { goingFirst: { in: [], out: [] }, goingSecond: { in: [], out: [] } };

  const setPlan = (leg, dir, items) => {
    const next = { goingFirst: { ...(plan.goingFirst || { in: [], out: [] }) }, goingSecond: { ...(plan.goingSecond || { in: [], out: [] }) } };
    next[leg][dir] = items;
    onChange(next);
  };
  const toggle = (leg, dir, name) => {
    const cur = (plan[leg] && plan[leg][dir]) || [];
    setPlan(leg, dir, cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]);
  };

  const legUI = (leg, title) => {
    const l = plan[leg] || { in: [], out: [] };
    const zone = (dir, label, pool, tone) => (
      <div className="sbp-zone">
        <div className="sbp-zone-label">{label} <span className="sbp-count">{(l[dir] || []).length}</span></div>
        <div className="sbp-pool">
          {pool.map((n) => {
            const on = (l[dir] || []).includes(n);
            const c = lookupCardByName(n);
            const urls = c?.id ? getImageUrls(c.id) : [];
            return (
              <button key={n} type="button" className={"sbp-chip is-" + tone + (on ? " is-on" : "")}
                title={n}
                onMouseEnter={(e) => onHover && onHover(c, e.currentTarget.getBoundingClientRect())}
                onClick={() => toggle(leg, dir, n)}>
                {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : null}
                <span className="sbp-chip-name">{n}</span>
                <span className="sbp-chip-mark">{on ? "✓" : (tone === "in" ? "+" : "−")}</span>
              </button>
            );
          })}
          {!pool.length && <span className="deck-empty-hint">No {tone === "in" ? "side-deck" : "main-deck"} cards loaded.</span>}
        </div>
      </div>
    );
    const inN = (l.in || []).length, outN = (l.out || []).length;
    return (
      <div className="sbp-leg">
        <div className="sbp-leg-head">
          <span className="sbp-leg-title">{title}</span>
          <span className={"sbp-balance" + (inN === outN && inN > 0 ? " ok" : inN !== outN ? " warn" : "")}>In {inN} / Out {outN} {inN === outN ? (inN ? "✓" : "") : "⚠"}</span>
        </div>
        {zone("in", "Bring IN (from your side deck)", sidePool, "in")}
        {zone("out", "Take OUT (from your main deck)", mainPool, "out")}
      </div>
    );
  };

  return <div className="sbp-grid">{legUI("goingFirst", "Going first")}{legUI("goingSecond", "Going second")}</div>;
}

// ── Tournament journal ──
function TournamentJournal({ format, deckNames, update }) {
  const tournaments = format.tournaments || [];
  const [openT, setOpenT] = useState(null);
  const addTournament = () => { const name = prompt("Event name (e.g. Locals 2026-06-01):", ""); if (name == null) return; update((f) => { f.tournaments = f.tournaments || []; f.tournaments.push({ tournamentId: "t_" + rid(), name: name.trim() || "Event", date: "", rounds: [] }); }); };
  const record = {};
  for (const t of tournaments) for (const r of (t.rounds || [])) { const k = r.opponentDeckId || "_other"; record[k] = record[k] || { w: 0, l: 0, d: 0 }; if (r.result === "W") record[k].w++; else if (r.result === "L") record[k].l++; else record[k].d++; }
  return (
    <div className="journal">
      <div className="journal-bar"><button type="button" className="deck-inline-btn" onClick={addTournament}>+ New event</button></div>
      {!!Object.keys(record).length && (
        <div className="journal-record">
          <div className="drill-label">Matchup record (all events)</div>
          <div className="fmt-chip-row">
            {Object.entries(record).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).map(([k, r]) => (
              <span key={k} className="record-chip"><strong>{deckNames[k] || "Other"}</strong> {r.w}-{r.l}{r.d ? "-" + r.d : ""}</span>
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
              <span className="journal-event-name">{t.name}</span><span className="journal-event-rec">{w}-{l}</span><span className="matchup-chevron">{open ? "▾" : "▸"}</span>
            </button>
            {open && <RoundEditor t={t} format={format} deckNames={deckNames} update={update} />}
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
            {["W", "L", "D"].map((res) => <button key={res} type="button" className={"journal-wl-btn is-" + res.toLowerCase() + (r.result === res ? " active" : "")} onClick={() => updT((tt) => { tt.rounds[i].result = res; })}>{res}</button>)}
          </div>
          <input className="fmt-add-input" defaultValue={r.score} placeholder="2-1" style={{ width: 56 }} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updT((tt) => { tt.rounds[i].score = e.target.value; })} />
          <input className="fmt-add-input is-wide" defaultValue={r.notes} placeholder="notes" onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updT((tt) => { tt.rounds[i].notes = e.target.value; })} />
          <button type="button" className="fmt-chip-x" onClick={() => updT((tt) => { tt.rounds = tt.rounds.filter((_, j) => j !== i); })}>×</button>
        </div>
      ))}
      <button type="button" className="fmt-add-btn" onClick={addRound}>+ Add round</button>
    </div>
  );
}
