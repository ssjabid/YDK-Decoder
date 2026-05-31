import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadFormats, saveFormats, getActiveFormatId, setActiveFormatId, loadDecks } from "../lib/storage.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import { persistDeck, ensureDeckShape, getDeckPrimaryDecklist, classifyCardBroadType } from "../lib/deckModel.js";
import { lookupCardByName } from "../lib/cardSearch.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { confirmModal, promptModal, alertModal } from "../lib/modal.js";
import CardPreview from "../components/CardPreview.jsx";
import PanelSection from "../components/PanelSection.jsx";
import RichNotes, { normalizeNotesHtml } from "../components/RichNotes.jsx";
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

  // Edit the OPPONENT DECK directly (single source of truth) so "how they win",
  // combo line + weaknesses stay consistent between the Format breakdown and the
  // Decks tab methodology.
  const deckUpdate = (deckId, mutator) => {
    const ds = loadDecks();
    const d = ds.find((x) => x.deckId === deckId);
    if (!d) return;
    ensureDeckShape(d);
    mutator(d);
    persistDeck(d);
    bump();
  };

  const onHover = (card, rect) => { if (card) setPreview((p) => (p && p.pinned ? p : { card, rect, pinned: false })); };
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  // ── Format CRUD ──
  const newFormat = async (clone) => {
    const name = await promptModal({ title: "New format", message: "Name this format (e.g. \"Meta — July 2026\").", placeholder: "Meta — July 2026", confirmText: "Create" });
    if (name == null) return;
    const fmts = loadFormats();
    const id = "fmt_" + rid();
    const base = { formatId: id, name: name.trim() || "New format", primaryDeckId: null, matchups: [], tournaments: [], notes: "", createdAt: new Date().toISOString() };
    if (clone && format) base.matchups = (format.matchups || []).map((m) => ({ ...m, matchupId: "m_" + rid(), freeformNotes: "", priorityFirst: [], prioritySecond: [], sideboard: { goingFirst: { in: [], out: [] }, goingSecond: { in: [], out: [] } } }));
    fmts.push(base); saveFormats(fmts); setActiveFormatId(id); setSelectedMatchupId(null); bump();
  };
  const renameFormat = async () => { const n = await promptModal({ title: "Rename format", value: format.name, confirmText: "Save" }); if (n == null) return; update((f) => { f.name = n.trim() || f.name; }); };
  const deleteFormat = async () => {
    const ok = await confirmModal({ title: `Delete format "${format.name}"?`, message: "Matchup decks stay in your library — only this format's plan + matchup notes are removed.", confirmText: "Delete format", danger: true });
    if (!ok) return;
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
    } catch (err) { alertModal({ title: "Couldn't add that .ydk", message: err.message }); }
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
          opponentDeck={decks.find((d) => d.deckId === selected.opponentDeckId) || null}
          update={update} deckUpdate={deckUpdate} onHover={onHover} onPick={onPick}
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
function MatchupBreakdown({ m, format, primaryDeck, deckNames, opponentDeck, update, deckUpdate, onHover, onPick, onBack, onRemove }) {
  const upd = useMatchupUpdate(update, m.matchupId);
  const name = (opponentDeck && opponentDeck.name) || deckNames[m.opponentDeckId] || "Unknown deck";
  const meth = (opponentDeck && opponentDeck.methodology) || {};
  // Deck-owned research fields write to the opponent deck's methodology → one
  // source of truth shared with the Decks tab.
  const editDeck = (key) => (v) => { if (opponentDeck) deckUpdate(opponentDeck.deckId, (d) => { d.methodology[key] = v; }); };
  const remove = async () => {
    const ok = await confirmModal({ title: "Remove this matchup?", message: "The deck stays in your library — only this matchup's plan is removed.", confirmText: "Remove", danger: true });
    if (ok) onRemove();
  };
  return (
    <div className="matchup-full">
      <div className="matchup-full-bar">
        <button type="button" className="back-btn" onClick={onBack}>← All matchups</button>
        <span className={"matchup-tier tier-" + (m.tier || "tier1")}>{TIER_LABEL[m.tier] || "Tier 1"}</span>
        <h2 className="matchup-full-title">{name}</h2>
        <select className="bb-select" value={m.tier || "tier1"} onChange={(e) => upd((x) => { x.tier = e.target.value; })}>
          {TIER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className="back-btn is-danger" onClick={remove}>× Remove matchup</button>
      </div>

      <div className="matchup-dash">
        <PanelSection title="How they win + their line" defaultOpen={true}
          right={<span className="panel-edit-hint">Edit in Decks → {name}</span>}>
          <div className="dash-2up">
            <ReadField label="How they win" value={meth.howItWins} />
            <ReadField label="Their combo line" value={meth.summary} />
            <ReadField label="How it loses / weaknesses" value={meth.weaknesses} />
          </div>
        </PanelSection>

        <PanelSection title="Game plan (your plan vs them)" defaultOpen={true}>
          <div className="dash-2up">
            <EditField label="Chokepoint — what to Ash / stop" value={m.chokepointTheirs} onSave={(v) => upd((x) => { x.chokepointTheirs = v; })} />
            <EditField label="Going first vs them" value={m.gameplanFirst} onSave={(v) => upd((x) => { x.gameplanFirst = v; })} />
            <EditField label="Going second — break their board" value={m.gameplanSecond} onSave={(v) => upd((x) => { x.gameplanSecond = v; })} />
            <div className="dash-spacer" />
            <StepEditor label="Priority plays — going first" steps={m.priorityFirst || []} onChange={(s) => upd((x) => { x.priorityFirst = s; })} />
            <StepEditor label="Priority plays — going second" steps={m.prioritySecond || []} onChange={(s) => upd((x) => { x.prioritySecond = s; })} />
          </div>
        </PanelSection>

        <PanelSection title="Their end boards" defaultOpen={true}>
          <EndBoardsEditor m={m} upd={upd} onHover={onHover} onPick={onPick} />
          <div className="drill-hint">Feeds <strong>Testing → Going second</strong> — practise breaking these.</div>
        </PanelSection>

        <PanelSection title="Cards that are really good here" defaultOpen={true}>
          <ReallyGoodEditor cards={m.counterCards || []} onChange={(c) => upd((x) => { x.counterCards = c; })} onHover={onHover} onPick={onPick} />
        </PanelSection>

        <PanelSection title="Side-deck plan (auto-pulled from your deck)" defaultOpen={true}>
          <SideboardPlanner sb={m.sideboard} primaryDeck={primaryDeck} onChange={(sb) => upd((x) => { x.sideboard = sb; })}
            goodCards={(m.counterCards || []).filter((c) => c && c.side !== "bad").map((c) => c.name)} />
        </PanelSection>

        <PanelSection title="Your notes on this matchup" defaultOpen={true}>
          <RichNotes value={m.freeformNotes || ""} placeholder="Scouting notes, lines you've found, what to watch for. Type @ to mention a card."
            onSave={(v) => upd((x) => { x.freeformNotes = v; })} />
        </PanelSection>
      </div>
    </div>
  );
}

// A labelled editable rich-text field (used for the plan fields).
function EditField({ label, value, onSave }) {
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <RichNotes value={value || ""} placeholder="Type to add notes · @ to mention a card" onSave={onSave} />
    </div>
  );
}

// Read-only display of a methodology field (edited in the Decks tab). Click to
// expand and read the whole thing comfortably.
function ReadField({ label, value }) {
  const [open, setOpen] = useState(false);
  const has = value && String(value).trim();
  return (
    <div className="drill-field">
      <div className="drill-label">{label}{has ? <button type="button" className="read-expand" title="Expand" onClick={() => setOpen(true)}>⤢</button> : null}</div>
      {has
        ? <div className="read-field" dangerouslySetInnerHTML={{ __html: normalizeNotesHtml(value) }} />
        : <div className="read-field is-empty">— not set yet (add it in the Decks tab)</div>}
      {open && (
        <div className="rt-backdrop" onClick={() => setOpen(false)}>
          <div className="read-modal" onClick={(e) => e.stopPropagation()}>
            <div className="read-modal-head"><span>{label}</span><button type="button" className="fmt-chip-x" onClick={() => setOpen(false)}>×</button></div>
            <div className="read-field" dangerouslySetInnerHTML={{ __html: normalizeNotesHtml(value) }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Multiple named end boards per matchup. Keeps targetEndboard (union) in sync
// so the Testing → Board Breaker still gets fed.
function EndBoardsEditor({ m, upd, onHover, onPick }) {
  const boards = (m.endboards && m.endboards.length) ? m.endboards
    : ((m.targetEndboard || []).length ? [{ id: "eb_seed", name: "Typical board", cards: (m.targetEndboard || []).slice() }] : []);
  const commit = (next) => upd((x) => {
    x.endboards = next;
    const seen = new Set(); const union = [];
    next.forEach((b) => (b.cards || []).forEach((c) => { if (!seen.has(c)) { seen.add(c); union.push(c); } }));
    x.targetEndboard = union;
  });
  return (
    <div className="endboards">
      {boards.map((b, bi) => (
        <div className="endboard" key={b.id || bi}>
          <div className="endboard-head">
            <input className="endboard-name" defaultValue={b.name} onKeyDown={(e) => e.stopPropagation()}
              onBlur={(e) => commit(boards.map((x, i) => (i === bi ? { ...x, name: e.target.value.trim() || x.name } : x)))} />
            {boards.length > 1 && <button type="button" className="fmt-chip-x" title="Remove board" onClick={() => commit(boards.filter((_, i) => i !== bi))}>×</button>}
          </div>
          <ChipEditor items={b.cards || []} onHover={onHover} onPick={onPick} placeholder="Add a board piece…"
            onChange={(items) => commit(boards.map((x, i) => (i === bi ? { ...x, cards: items } : x)))} />
        </div>
      ))}
      <button type="button" className="fmt-add-btn" onClick={() => commit([...boards, { id: "eb_" + rid(), name: "Board " + (boards.length + 1), cards: [] }])}>+ Add another end board</button>
    </div>
  );
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

function ReallyGoodEditor({ cards, onChange, onHover, onPick }) {
  const good = (cards || []).filter((c) => c && c.side !== "bad");
  const setReason = (card, reason) => onChange((cards || []).map((c) => (c === card ? { ...c, notes: reason } : c)));
  const remove = (card) => onChange((cards || []).filter((c) => c !== card));
  return (
    <div className="rg-list">
      {good.map((c, i) => (
        <div className="rg-row" key={i}>
          <CardChip name={c.name} tone="good" onHover={onHover} onPick={onPick} onRemove={() => remove(c)} />
          <input className="rg-reason" defaultValue={c.notes || c.reason || ""} placeholder="why it's good here…"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => setReason(c, e.target.value)} />
        </div>
      ))}
      <CardAddInput placeholder="Add a card that's good here…" onAdd={(name) => onChange([...(cards || []), { name, side: "good", notes: "" }])} />
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

// ── Side-deck planner — auto-pulls your side deck (→ bring IN) + main deck
//    (→ take OUT). Going first / second is a toggle (one leg at a time), and
//    each pool is a clean uniform list. Memoised + stable fetch deps for speed. ──
function SideboardPlanner({ sb, primaryDeck, onChange, goodCards }) {
  const [leg, setLeg] = useState("goingFirst");
  const [cardMap, setCardMap] = useState({});
  const dl = primaryDeck ? getDeckPrimaryDecklist(primaryDeck) : null;
  const sideIds = useMemo(() => (dl && dl.side) || [], [dl]);
  const mainIds = useMemo(() => (dl && dl.main) || [], [dl]);
  const sideKey = sideIds.join(","), mainKey = mainIds.join(",");
  const deckId = primaryDeck && primaryDeck.deckId;

  // Stable deps (deckId + id-strings) so we fetch ONCE, not every render.
  useEffect(() => {
    let alive = true;
    if (!deckId) { setCardMap({}); return; }
    fetchCards([...mainIds, ...sideIds]).then(({ map }) => { if (alive) setCardMap(map); });
    return () => { alive = false; };
  }, [deckId, mainKey, sideKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pools as [{name, max}] — max = how many copies you actually run, so you can
  // side a specific number (e.g. 1 of your 3 Fuwalos).
  const pools = useMemo(() => {
    const TYPE_ORDER = { Monster: 0, Spell: 1, Trap: 2, Other: 3 };
    const build = (ids) => {
      const counts = new Map(); const type = new Map();
      for (const id of ids) {
        const c = cardMap[Number(id)]; const n = (c && c.name) || ("#" + id);
        counts.set(n, (counts.get(n) || 0) + 1);
        if (!type.has(n)) type.set(n, TYPE_ORDER[classifyCardBroadType(c)] ?? 3);
      }
      return [...counts.entries()].map(([name, max]) => ({ name, max, t: type.get(name) }))
        .sort((a, b) => a.t - b.t || a.name.localeCompare(b.name));
    };
    return { side: build(sideIds), main: build(mainIds) };
  }, [cardMap, sideKey, mainKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!primaryDeck) return <div className="deck-empty-hint">Pick <strong>your deck</strong> at the top of the Format tab to auto-load your side + main deck here.</div>;

  // Normalise to [{name, count}] (back-compat with old string arrays).
  const norm = (arr) => (arr || []).map((x) => (typeof x === "string" ? { name: x, count: 1 } : { name: x.name, count: x.count || 1 }));
  const plan = {
    goingFirst: { in: norm(sb?.goingFirst?.in), out: norm(sb?.goingFirst?.out) },
    goingSecond: { in: norm(sb?.goingSecond?.in), out: norm(sb?.goingSecond?.out) },
  };
  const l = plan[leg];
  const countFor = (dir, name) => { const e = l[dir].find((x) => x.name === name); return e ? e.count : 0; };
  const setCount = (dir, name, count, max) => {
    const arr = l[dir].filter((x) => x.name !== name);
    const c = Math.max(0, Math.min(count, max));
    if (c > 0) arr.push({ name, count: c });
    onChange({ ...plan, [leg]: { ...l, [dir]: arr } });
  };
  const totalIn = l.in.reduce((s, x) => s + x.count, 0);
  const totalOut = l.out.reduce((s, x) => s + x.count, 0);
  const summarize = (arr) => arr.length ? arr.map((x) => `${x.count}× ${x.name}`).join(", ") : "—";

  const good = new Set((goodCards || []).map((n) => String(n).toLowerCase()));

  // Copy-count selector: one dot per copy you run; click a dot to set the count.
  const Dots = ({ dir, name, max, n }) => (
    <span className="sbp-dots" onClick={(e) => e.stopPropagation()}>
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} type="button" className={"sbp-dot" + (i < n ? " is-on" : "")}
          title={`${i + 1} cop${i ? "ies" : "y"}`}
          onClick={() => setCount(dir, name, n === i + 1 ? i : i + 1, max)} />
      ))}
    </span>
  );

  const rows = (dir, pool) => (
    <div className="sbp-rows">
      {pool.map(({ name, max }) => {
        const n = countFor(dir, name);
        const c = lookupCardByName(name);
        const urls = c?.id ? getImageUrls(c.id) : [];
        const suggested = dir === "in" && good.has(name.toLowerCase());
        return (
          <div key={name} className={"sbp-row is-" + dir + (n > 0 ? " is-on" : "")}>
            {urls.length ? <img className="sbp-row-img" src={urls[0]} alt="" loading="lazy" /> : <span className="sbp-row-noimg" />}
            <span className="sbp-row-name">{name}{suggested && <span className="sbp-sugg" title="You flagged this as good vs this matchup">★</span>}</span>
            <Dots dir={dir} name={name} max={max} n={n} />
          </div>
        );
      })}
      {!pool.length && <div className="deck-empty-hint">No {dir === "in" ? "side-deck" : "main-deck"} cards.</div>}
    </div>
  );

  return (
    <div className="sbp">
      <div className="sbp-tabs">
        <button type="button" className={"sbp-tab" + (leg === "goingFirst" ? " active" : "")} onClick={() => setLeg("goingFirst")}>Going first</button>
        <button type="button" className={"sbp-tab" + (leg === "goingSecond" ? " active" : "")} onClick={() => setLeg("goingSecond")}>Going second</button>
        <span className={"sbp-balance" + (totalIn === totalOut && totalIn > 0 ? " ok" : totalIn !== totalOut ? " warn" : "")}>
          {totalIn} in / {totalOut} out {totalIn === totalOut ? (totalIn ? "✓ balanced" : "") : "⚠ unbalanced"}
        </span>
      </div>

      <div className="sbp-summary">
        <div><span className="sbp-sum-label is-out">− Out</span> {summarize(l.out)}</div>
        <div><span className="sbp-sum-label is-in">+ In</span> {summarize(l.in)}</div>
      </div>

      <div className="sbp-cols">
        <div className="sbp-col"><div className="sbp-col-title is-out">Take OUT — your main deck</div>{rows("out", pools.main)}</div>
        <div className="sbp-col"><div className="sbp-col-title is-in">Bring IN — your side deck <span className="sbp-hint">★ = good here</span></div>{rows("in", pools.side)}</div>
      </div>
    </div>
  );
}

// ── Tournament journal ──
function TournamentJournal({ format, deckNames, update }) {
  const tournaments = format.tournaments || [];
  const [openT, setOpenT] = useState(null);
  const addTournament = async () => { const name = await promptModal({ title: "New event", message: "Name the event (e.g. \"Locals 2026-06-01\").", placeholder: "Locals 2026-06-01", confirmText: "Create" }); if (name == null) return; update((f) => { f.tournaments = f.tournaments || []; f.tournaments.push({ tournamentId: "t_" + rid(), name: name.trim() || "Event", date: "", rounds: [] }); }); };
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
