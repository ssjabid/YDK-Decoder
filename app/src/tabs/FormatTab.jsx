import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadFormats, saveFormats, getActiveFormatId, setActiveFormatId, loadDecks } from "../lib/storage.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import { persistDeck, getDeckPrimaryDecklist, classifyCardBroadType } from "../lib/deckModel.js";
import { lookupCardByName } from "../lib/cardSearch.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { confirmModal, promptModal, alertModal } from "../lib/modal.js";
import CardPreview from "../components/CardPreview.jsx";
import PanelSection from "../components/PanelSection.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { getPlaybook, GamePlanView, EndBoardsView, GoodCardsView, ReadField } from "../components/Matchup.jsx";
import { getSidePlans, newPlan, planTotals } from "../lib/sidePlans.js";
import Icon from "../components/Icon.jsx";

const TIER_LABEL = { tier1: "Tier 1", tier2: "Tier 2", rogue: "Rogue" };
const TIER_OPTIONS = [["tier1", "Tier 1"], ["tier2", "Tier 2"], ["rogue", "Rogue"]];
const TOURNAMENT_TYPES = [
  ["Locals", "Weekly store tournament"],
  ["OTS", "Official Tournament Store event"],
  ["Regionals", "Regional qualifier"],
  ["OPEN", "Open / side event"],
  ["Nationals", "National championship"],
  ["YCS", "Yu-Gi-Oh! Championship Series"],
];
const rid = () => Math.random().toString(36).slice(2, 8);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function FormatTab({ dataVersion = 0, onEditDeck }) {
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
    const primaryDecks = ds.filter((d) => (d.role || "primary") === "primary").sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return { formats: fmts, format: fmt, decks: ds, deckNames: names, primaryDecks };
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

  const onHover = (card, rect) => setPreview((p) => (p && p.pinned ? p : (card ? { card, rect, pinned: false } : null)));
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
          <Dropdown className="format-picker-dd" value={format.formatId}
            options={formats.map((f) => [f.formatId, f.name])}
            onChange={(v) => { setActiveFormatId(v); setSelectedMatchupId(null); bump(); }} />
          <button type="button" className="format-act" title="New format" onClick={() => newFormat(false)}>+ New</button>
          {format.matchups?.length ? <button type="button" className="format-act" title="New format cloning these matchups" onClick={() => newFormat(true)}>Clone</button> : null}
          <button type="button" className="format-act" title="Rename" onClick={renameFormat}>✎</button>
          {formats.length > 1 && <button type="button" className="format-act is-danger" title="Delete format" onClick={deleteFormat}>×</button>}
        </div>
        <label className="format-primary">
          <span>Your deck</span>
          <Dropdown className="format-picker-dd" value={format.primaryDeckId || ""} align="right"
            placeholder="— pick your deck —"
            options={primaryDecks.map((d) => [d.deckId, d.name])}
            onChange={(v) => update((f) => { f.primaryDeckId = v || null; })} />
        </label>
      </div>

      {selected ? (
        <MatchupBreakdown
          key={selected.matchupId}
          m={selected} format={format} primaryDeck={primaryDeck} deckNames={deckNames}
          opponentDeck={decks.find((d) => d.deckId === selected.opponentDeckId) || null}
          update={update} onHover={onHover} onPick={onPick} onEditDeck={onEditDeck}
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
            <TournamentJournal format={format} deckNames={deckNames} primaryDecks={primaryDecks} update={update} />
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

// ── Full-screen matchup breakdown — a READ-ONLY dashboard. Everything
//    about the opponent (how they win, the plan vs them, their end boards,
//    cards that shine) is edited in Decks → that matchup deck, so there's
//    one source of truth. Only the side-deck plan + your scouting notes
//    are interactive here (they're scoped to your deck in this format). ──
function MatchupBreakdown({ m, format, primaryDeck, deckNames, opponentDeck, update, onHover, onPick, onEditDeck, onBack, onRemove }) {
  const upd = useMatchupUpdate(update, m.matchupId);
  const [, forceRev] = useReducer((x) => x + 1, 0);
  const name = (opponentDeck && opponentDeck.name) || deckNames[m.opponentDeckId] || "Unknown deck";
  const meth = (opponentDeck && opponentDeck.methodology) || {};
  const pb = getPlaybook(m, opponentDeck);

  // Warm the card cache for the opponent's deck so the end-board playmat can
  // place spells/traps in the right zones (lookupCardByName reads the cache).
  const oppId = opponentDeck && opponentDeck.deckId;
  useEffect(() => {
    if (!opponentDeck) return;
    let alive = true;
    const ids = [...(opponentDeck.main || []), ...(opponentDeck.extra || []), ...(opponentDeck.side || [])];
    fetchCards(ids).then(() => { if (alive) forceRev(); });
    return () => { alive = false; };
  }, [oppId]); // eslint-disable-line react-hooks/exhaustive-deps
  const editHint = (
    <button type="button" className="panel-edit-hint is-link" title="Open this deck in the Decks tab to edit"
      onClick={() => opponentDeck && onEditDeck && onEditDeck(opponentDeck.deckId)}>
      ✎ Edit in Decks → {name}
    </button>
  );
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
        <Dropdown className="tier-dd" value={m.tier || "tier1"} options={TIER_OPTIONS} align="right"
          ariaLabel="Tier" onChange={(v) => upd((x) => { x.tier = v; })} />
        <button type="button" className="back-btn is-danger" onClick={remove}>× Remove matchup</button>
      </div>

      <div className="matchup-dash">
        <PanelSection title="How they win + their line" defaultOpen={true} right={editHint}>
          <div className="dash-2up">
            <ReadField label="How they win" value={meth.howItWins} />
            <ReadField label="Their combo line" value={meth.summary} />
            <ReadField label="How it loses / weaknesses" value={meth.weaknesses} />
          </div>
        </PanelSection>

        <PanelSection title="Game plan — your plan vs them" defaultOpen={true} right={editHint}>
          <GamePlanView pb={pb} />
        </PanelSection>

        <PanelSection title="Their end boards" defaultOpen={true} right={editHint}>
          <EndBoardsView boards={pb.endboards} onHover={onHover} onPick={onPick} />
          <div className="drill-hint">Feeds <strong>Testing → Going second</strong> — practise breaking these.</div>
        </PanelSection>

        <PanelSection title="Cards that are really good here" defaultOpen={true} right={editHint}>
          <GoodCardsView cards={pb.goodCards} onHover={onHover} onPick={onPick} />
        </PanelSection>

        <PanelSection title="Side-deck plan — auto-pulled from your deck" defaultOpen={true}>
          <SideboardPlanner plans={getSidePlans(m)} primaryDeck={primaryDeck} onChange={(plans) => upd((x) => { x.sidePlans = plans; })}
            goodCards={pb.goodCards.map((c) => c.name)} />
        </PanelSection>

        <PanelSection title="Your notes on this matchup" defaultOpen={true} right={editHint}>
          <ReadField label="Scouting notes" value={pb.notes} hint="— add your notes in the Decks tab" />
        </PanelSection>
      </div>
    </div>
  );
}

// Visual siding summary row — small card thumbs of what goes OUT / comes IN.
function SbpSumRow({ dir, arr }) {
  return (
    <div className={"sbp-sum-row is-" + dir}>
      <span className={"sbp-sum-label is-" + dir}>{dir === "out" ? "− Take out" : "+ Bring in"}</span>
      {arr.length ? arr.map((x, i) => {
        const c = lookupCardByName(x.name);
        const urls = c?.id ? getImageUrls(c.id) : [];
        return (
          <span key={i} className="sbp-sum-chip" title={`${x.count}× ${x.name}`}>
            {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : null}
            <span className="sbp-sum-n">{x.count}×</span><span className="sbp-sum-name">{x.name}</span>
          </span>
        );
      }) : <span className="sbp-sum-empty">nothing yet</span>}
    </div>
  );
}

// ── Side-deck planner — auto-pulls your side deck (→ bring IN) + main deck
//    (→ take OUT). Going first / second is a toggle (one leg at a time), and
//    each pool is a clean uniform list. Memoised + stable fetch deps for speed. ──
function SideboardPlanner({ plans, primaryDeck, onChange, goodCards }) {
  const [selId, setSelId] = useState(null);
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

  const list = plans || [];
  const sel = list.find((p) => p.id === selId) || list[0] || null;
  const good = new Set((goodCards || []).map((n) => String(n).toLowerCase()));

  const writePlan = (patch) => { if (!sel) return; onChange(list.map((p) => (p.id === sel.id ? { ...p, ...patch } : p))); };
  const addPlan = () => { const p = newPlan("second", list.length + 1); onChange([...list, p]); setSelId(p.id); };
  const delPlan = async () => { if (!sel) return; if (await confirmModal({ title: `Delete "${sel.name}"?`, message: "This siding pattern will be removed.", confirmText: "Delete", danger: true })) { const next = list.filter((p) => p.id !== sel.id); onChange(next); setSelId(next[0] ? next[0].id : null); } };
  const renamePlan = async () => { if (!sel) return; const v = await promptModal({ title: "Rename side plan", value: sel.name, confirmText: "Save" }); if (v == null) return; writePlan({ name: v.trim() || sel.name }); };

  const countFor = (dir, name) => { const e = sel ? (sel[dir] || []).find((x) => x.name === name) : null; return e ? e.count : 0; };
  const setCount = (dir, name, count, max) => {
    if (!sel) return;
    const arr = (sel[dir] || []).filter((x) => x.name !== name);
    const c = Math.max(0, Math.min(count, max));
    if (c > 0) arr.push({ name, count: c });
    writePlan({ [dir]: arr });
  };

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

  const t = sel ? planTotals(sel) : null;

  return (
    <div className="sbp">
      <div className="sbp-planbar">
        {list.map((p) => {
          const pt = planTotals(p);
          return (
            <button key={p.id} type="button" className={"sbp-plan-chip" + (sel && p.id === sel.id ? " active" : "")} onClick={() => setSelId(p.id)}>
              <span className="sbp-plan-name">{p.name}</span>
              <span className="sbp-plan-meta">{p.going === "first" ? "1st" : "2nd"} · {pt.in}/{pt.out}</span>
            </button>
          );
        })}
        <button type="button" className="sbp-plan-add" onClick={addPlan}>+ New plan</button>
      </div>

      {!sel ? (
        <div className="deck-empty-hint">No siding patterns yet. Click <strong>+ New plan</strong> to build one — patterns save to this matchup and you can apply them in <strong>Testing</strong>.</div>
      ) : (
        <>
          <div className="sbp-plan-head">
            <button type="button" className="sbp-plan-rename" onClick={renamePlan} title="Rename">{sel.name} ✎</button>
            <Dropdown className="sbp-going-dd" value={sel.going || "second"} options={[["first", "Going first"], ["second", "Going second"]]} onChange={(v) => writePlan({ going: v })} />
            <span className={"sbp-balance" + (t.balanced ? " ok" : (t.in !== t.out ? " warn" : ""))}>{t.in} in / {t.out} out {t.balanced ? "✓" : (t.in !== t.out ? "⚠" : "")}</span>
            <button type="button" className="fmt-chip-x" title="Delete plan" onClick={delPlan}>×</button>
          </div>

          <div className="sbp-summary">
            <SbpSumRow dir="out" arr={sel.out || []} />
            <SbpSumRow dir="in" arr={sel.in || []} />
          </div>

          <div className="sbp-cols">
            <div className="sbp-col"><div className="sbp-col-title is-out">Take OUT — your main deck</div>{rows("out", pools.main)}</div>
            <div className="sbp-col"><div className="sbp-col-title is-in">Bring IN — your side deck <span className="sbp-hint">★ = good here</span></div>{rows("in", pools.side)}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tournament journal — guided "log an event" form + incremental rounds ──
function TournamentJournal({ format, deckNames, primaryDecks, update }) {
  const tournaments = format.tournaments || [];
  const [openT, setOpenT] = useState(null);
  const [creating, setCreating] = useState(false);
  const [evName, setEvName] = useState("");
  const [type, setType] = useState("Locals");
  const [date, setDate] = useState(todayStr());
  const [deckId, setDeckId] = useState(format.primaryDeckId || (primaryDecks[0] && primaryDecks[0].deckId) || "");

  const create = () => {
    const d = date || todayStr();
    const nm = evName.trim();
    const name = [nm, type, d].filter(Boolean).join(" · ");
    update((f) => {
      f.tournaments = f.tournaments || [];
      f.tournaments.push({ tournamentId: "t_" + rid(), name, title: nm, type, date: d, deckId, rounds: [] });
    });
    setCreating(false); setEvName(""); setType("Locals"); setDate(todayStr());
  };

  // Win/loss/draw record per opponent across every event (only scored rounds).
  const record = {};
  for (const t of tournaments) for (const r of (t.rounds || [])) {
    if (!r.result) continue;
    const k = r.opponentDeckId || "_other";
    record[k] = record[k] || { w: 0, l: 0, d: 0 };
    if (r.result === "W") record[k].w++; else if (r.result === "L") record[k].l++; else record[k].d++;
  }

  return (
    <div className="journal">
      {!creating ? (
        <div className="journal-bar"><button type="button" className="btn-secondary" onClick={() => setCreating(true)}>+ Log a new event</button></div>
      ) : (
        <div className="journal-newform">
          <div className="jnf-head">Log a new event</div>
          <label className="jnf-field jnf-grow">
            <span className="jnf-label">Event name <span className="jnf-opt">(e.g. Europa Locals)</span></span>
            <input className="jnf-name" autoFocus value={evName} placeholder="Name this event…"
              onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setEvName(e.target.value)} />
          </label>
          <div className="jnf-field">
            <span className="jnf-label">Type of event</span>
            <div className="jnf-types">
              {TOURNAMENT_TYPES.map(([v, hint]) => (
                <button key={v} type="button" title={hint} className={"jnf-type" + (type === v ? " active" : "")} onClick={() => setType(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className="jnf-row">
            <label className="jnf-field">
              <span className="jnf-label">Date</span>
              <input type="date" className="jnf-date" value={date} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="jnf-field jnf-grow">
              <span className="jnf-label">Deck you're playing</span>
              <Dropdown className="jnf-deck-dd" value={deckId} placeholder="— your deck —"
                options={primaryDecks.map((d) => [d.deckId, d.name])} onChange={setDeckId} />
            </div>
          </div>
          <div className="jnf-actions">
            <button type="button" className="btn-primary" onClick={create}>Create event</button>
            <button type="button" className="back-btn" onClick={() => { setCreating(false); setType("Locals"); setDate(todayStr()); }}>Cancel</button>
          </div>
        </div>
      )}

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

      {!tournaments.length && !creating && <div className="deck-empty-hint">No events logged yet. Click <strong>+ Log a new event</strong>, then add each round.</div>}

      {tournaments.map((t) => {
        const open = openT === t.tournamentId;
        const w = (t.rounds || []).filter((r) => r.result === "W").length;
        const l = (t.rounds || []).filter((r) => r.result === "L").length;
        const d = (t.rounds || []).filter((r) => r.result === "D").length;
        const del = async () => { if (await confirmModal({ title: "Delete this event?", message: `"${t.name}" and its ${(t.rounds || []).length} round(s).`, confirmText: "Delete event", danger: true })) update((f) => { f.tournaments = (f.tournaments || []).filter((x) => x.tournamentId !== t.tournamentId); }); };
        return (
          <div key={t.tournamentId} className="journal-event">
            <button type="button" className="journal-event-head" onClick={() => setOpenT(open ? null : t.tournamentId)}>
              {t.type && <span className="journal-type-badge">{t.type}</span>}
              <span className="journal-event-name">{t.title || t.name}</span>
              <span className="journal-event-date">{t.date}</span>
              {t.deckId && deckNames[t.deckId] && <span className="journal-event-deck">{deckNames[t.deckId]}</span>}
              <span className="journal-event-rec">{w}-{l}{d ? "-" + d : ""}</span>
              <span className="matchup-chevron">{open ? "▾" : "▸"}</span>
            </button>
            {open && <RoundEditor t={t} format={format} deckNames={deckNames} update={update} onDelete={del} />}
          </div>
        );
      })}
    </div>
  );
}

function RoundEditor({ t, format, deckNames, update, onDelete }) {
  const updT = (fn) => update((f) => { const tt = (f.tournaments || []).find((x) => x.tournamentId === t.tournamentId); if (tt) fn(tt); });
  const opponents = (format.matchups || []).map((m) => m.opponentDeckId);
  const addRound = () => updT((tt) => { tt.rounds = tt.rounds || []; tt.rounds.push({ roundId: "r_" + rid(), opponentDeckId: "", result: "", notes: "" }); });
  const rounds = t.rounds || [];
  return (
    <div className="journal-rounds">
      {rounds.map((r, i) => (
        <div key={r.roundId} className="journal-round">
          <div className="journal-round-top">
            <span className="journal-round-n">Round {i + 1}</span>
            <button type="button" className="fmt-chip-x" title="Remove round" onClick={() => updT((tt) => { tt.rounds = tt.rounds.filter((_, j) => j !== i); })}>×</button>
          </div>
          <div className="journal-round-fields">
            <div className="journal-rf">
              <span className="journal-rf-label">What did you play against?</span>
              <Dropdown className="journal-opp-dd" value={r.opponentDeckId || ""} placeholder="— opponent deck —"
                options={opponents.map((id) => [id, deckNames[id] || id])}
                onChange={(v) => updT((tt) => { tt.rounds[i].opponentDeckId = v; })} />
            </div>
            <div className="journal-rf">
              <span className="journal-rf-label">Did you win?</span>
              <div className="journal-wl">
                {[["W", "Win"], ["L", "Loss"], ["D", "Draw"]].map(([res, lbl]) => (
                  <button key={res} type="button" className={"journal-wl-btn is-" + res.toLowerCase() + (r.result === res ? " active" : "")}
                    onClick={() => updT((tt) => { tt.rounds[i].result = res; })}>{lbl}</button>
                ))}
              </div>
            </div>
            <label className="journal-rf jnf-grow">
              <span className="journal-rf-label">Any notes?</span>
              <input className="fmt-add-input is-wide" defaultValue={r.notes} placeholder="how it went, what you'd change next time…"
                onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updT((tt) => { tt.rounds[i].notes = e.target.value; })} />
            </label>
          </div>
        </div>
      ))}
      <div className="journal-rounds-actions">
        <button type="button" className="fmt-add-btn" onClick={addRound}>+ Add round {rounds.length + 1}</button>
        {onDelete && <button type="button" className="back-btn is-danger" onClick={onDelete}>× Delete event</button>}
      </div>
    </div>
  );
}
