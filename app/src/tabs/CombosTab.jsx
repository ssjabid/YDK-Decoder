import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadDecks } from "../lib/storage.js";
import {
  loadSavedCombos, VIEW_MODES, comboKey, comboTitle, comboOpeningHand,
  comboEndboard, comboAllCards, comboDeckIds, comboBeatsTraps, COMMON_HANDTRAPS, trapShort,
  isCoreStep, stepCards, groupCombos, comboSearchHaystack,
  renameCombo, setComboDecks, setComboNotes, setComboOpenerSize, deleteCombo, updateCombo,
  importCombosJson, addManualCombo,
} from "../lib/combos.js";
import { simulateCombo, describeStep, fieldToBoard } from "../lib/comboSim.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { lookupCardByName, resolveCardName } from "../lib/cardSearch.js";
import { confirmModal, promptModal, alertModal } from "../lib/modal.js";
import CardPreview from "../components/CardPreview.jsx";
import EndBoardView from "../components/EndBoardView.jsx";
import Dropdown from "../components/Dropdown.jsx";
import CardPicker from "../components/CardPicker.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Icon from "../components/Icon.jsx";

const OPENER_OPTS = [["", "Auto"], [1, "1-card"], [2, "2-card"], [3, "3-card"], [4, "4-card"]];
const fmtDate = (s) => (s ? String(s).slice(0, 10) : "");

// "Branded" or "Branded +1" when a combo is linked to multiple decks.
function deckLabel(c, deckNames) {
  const names = comboDeckIds(c).map((id) => deckNames[id]).filter(Boolean);
  if (!names.length) return null;
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
}

// ════════════════════════════════════════════════════════════════════
// COMBOS TAB — master list (grouped by opener size, searchable, filterable
// by deck) + a detail view that shows the opening hand, the step-by-step
// line (Full / Core), the final board on the visual playmat, the GY/Banish
// piles, and rich notes. Combos come from the Chrome extension (which writes
// to ydk_saved_combos) or JSON import.
// ════════════════════════════════════════════════════════════════════
export default function CombosTab({ dataVersion = 0, reload }) {
  const [rev, bump] = useReducer((x) => x + 1, 0);
  const [selKey, setSelKey] = useState(null);
  const [search, setSearch] = useState("");
  const [deckFilter, setDeckFilter] = useState("all");
  const [galleryView, setGalleryView] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const { combos, decks, deckNames } = useMemo(() => {
    const combos = loadSavedCombos();
    const decks = loadDecks();
    const deckNames = {};
    decks.forEach((d) => { deckNames[d.deckId] = d.name; });
    return { combos, decks, deckNames };
  }, [dataVersion, rev]);

  const onHover = (card, rect) => setPreview((p) => (p && p.pinned ? p : (card ? { card, rect, pinned: false } : null)));
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  const q = search.trim().toLowerCase();
  const matches = (c) =>
    (deckFilter === "all" || comboDeckIds(c).includes(deckFilter)) &&
    (!q || comboSearchHaystack(c).includes(q));

  const groups = groupCombos(combos)
    .map((g) => ({ ...g, items: g.items.filter(({ c }) => matches(c)) }))
    .filter((g) => g.items.length);

  const allVisible = groups.flatMap((g) => g.items);
  const selected = allVisible.find(({ c, i }) => comboKey(c, i) === selKey) || allVisible[0] || null;

  const refresh = () => { bump(); reload && reload(); };

  const onImportFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const { added, skipped } = importCombosJson(await file.text());
      refresh();
      alertModal({ title: "Import complete", message: `Added ${added} combo${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped} (duplicate or invalid)` : ""}.` });
    } catch (err) { alertModal({ title: "Couldn't import that JSON", message: err.message }); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const onPasteImport = async () => {
    const text = await promptModal({ title: "Paste combo JSON", message: "Paste a combo object or array exported from the extension / sample data.", placeholder: '{ "comboName": … }', confirmText: "Import", multiline: true });
    if (text == null || !text.trim()) return;
    try {
      const { added, skipped } = importCombosJson(text);
      refresh();
      alertModal({ title: "Import complete", message: `Added ${added} combo${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}.` });
    } catch (err) { alertModal({ title: "That wasn't valid JSON", message: err.message }); }
  };

  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const mineDecks = decks.filter((d) => (d.role || "primary") !== "matchup").sort(byName);
  const oppDecks = decks.filter((d) => d.role === "matchup").sort(byName);
  const deckFilterOpts = [
    ["all", "All decks"],
    ...(mineDecks.length ? [{ heading: "My decks" }, ...mineDecks.map((d) => [d.deckId, d.name])] : []),
    ...(oppDecks.length ? [{ heading: "Matchup decks" }, ...oppDecks.map((d) => [d.deckId, d.name])] : []),
  ];

  return (
    <div className="combos-tab" onMouseLeave={clearHover}>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImportFile} />

      <div className="combos-toolbar">
        <Dropdown className="combos-deck-dd" value={deckFilter} options={deckFilterOpts} onChange={setDeckFilter} ariaLabel="Filter by deck" />
        <div className="combo-search-wrap">
          <input className="combo-search-input" placeholder="Search combos + cards…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          {search && <button type="button" className="combo-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>
        <span className="combo-viewtoggle">
          <button type="button" className={"combo-viewtoggle-btn" + (!galleryView ? " active" : "")} onClick={() => setGalleryView(false)} title="List view">List</button>
          <button type="button" className={"combo-viewtoggle-btn" + (galleryView ? " active" : "")} onClick={() => setGalleryView(true)} title="Gallery view">Gallery</button>
        </span>
        <span className="combos-toolbar-spacer" />
        <button type="button" className="btn-primary" onClick={() => { setCreating(true); setSelKey(null); }}>+ New combo</button>
        <button type="button" className="btn-secondary" onClick={onPasteImport}>Paste JSON</button>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><Icon name="summon" size={15} /> Import .json</button>
      </div>

      {creating ? (
        <ComboBuilder decks={decks} onCancel={() => setCreating(false)}
          onCreate={(form) => { const key = addManualCombo(form); setCreating(false); setGalleryView(false); setSelKey(key); refresh(); }}
          onHover={onHover} onPick={onPick} />
      ) : !combos.length ? (
        <div className="placeholder">
          No combos yet. <button type="button" className="link-btn" onClick={() => setCreating(true)}>Build one by hand</button>,
          extract one with the <strong>Chrome extension</strong> on a DuelingBook replay,
          or <button type="button" className="link-btn" onClick={onPasteImport}>paste combo JSON</button>.
        </div>
      ) : galleryView ? (
        !allVisible.length
          ? <div className="decks-list-empty">No combos match{q ? ` "${search}"` : ""}{deckFilter !== "all" ? " for this deck" : ""}.</div>
          : <ComboGallery groups={groups} deckNames={deckNames} onHover={onHover} onPick={onPick}
              onOpen={(key) => { setGalleryView(false); setSelKey(key); }} />
      ) : (
        <div className="combos-layout">
          <aside className="combos-sidebar">
            {!allVisible.length ? (
              <div className="decks-list-empty">No combos match{q ? ` "${search}"` : ""}{deckFilter !== "all" ? " for this deck" : ""}.</div>
            ) : groups.map((g) => (
              <div key={g.bucket} className="combo-picker-group">
                <div className="combo-picker-group-header">{g.bucket} <span className="count">{g.items.length}</span></div>
                {g.items.map(({ c, i }) => (
                  <ComboTile key={comboKey(c, i)} c={c} active={selected && comboKey(selected.c, selected.i) === comboKey(c, i)}
                    deckName={deckLabel(c, deckNames)} onClick={() => setSelKey(comboKey(c, i))} />
                ))}
              </div>
            ))}
          </aside>

          <section className="combo-detail-panel">
            {selected
              ? <ComboDetail key={comboKey(selected.c, selected.i)} c={selected.c} idx={selected.i} decks={decks} deckNames={deckNames}
                  onChange={refresh} onHover={onHover} onPick={onPick} />
              : <div className="decks-content-empty">Pick a combo from the left.</div>}
          </section>
        </div>
      )}

      {preview && preview.card && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Thumb({ name, onHover, onPick }) {
  const c = lookupCardByName(name);
  const urls = c?.id ? getImageUrls(c.id) : [];
  return (
    <span className="combo-thumb" title={name}
      onMouseEnter={(e) => onHover && onHover(c, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={(e) => { e.stopPropagation(); onPick && onPick(c, e.currentTarget.getBoundingClientRect()); }}>
      {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : <span className="combo-thumb-ph">{name[0]}</span>}
      <span className="combo-thumb-name">{name}</span>
    </span>
  );
}

function ComboTile({ c, active, deckName, onClick }) {
  const hand = comboOpeningHand(c).slice(0, 3);
  const steps = (c.steps || []).length;
  return (
    <button type="button" className={"combo-tile" + (active ? " active" : "")} onClick={onClick}>
      <span className="combo-tile-arts">
        {hand.length ? hand.map((n, i) => {
          const card = lookupCardByName(n); const urls = card?.id ? getImageUrls(card.id) : [];
          return <span key={i} className="combo-tile-art">{urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : <span className="combo-tile-art-ph">{n[0]}</span>}</span>;
        }) : <span className="combo-tile-art combo-tile-art-ph">?</span>}
      </span>
      <span className="combo-tile-body">
        <span className="combo-tile-name">{comboTitle(c)}</span>
        <span className="combo-tile-meta">
          <span>{steps} steps</span>
          {deckName && <span className="combo-tile-deck">{deckName}</span>}
          {c.userNotes && String(c.userNotes).trim() && <span className="combo-tile-badge" title="Has notes">✎</span>}
        </span>
      </span>
    </button>
  );
}

// ── Detail / line view ───────────────────────────────────────────────
function ComboDetail({ c, idx, decks, deckNames, onChange, onHover, onPick }) {
  const [, forceRev] = useReducer((x) => x + 1, 0);
  const [view, setView] = useState("full");
  const [mode, setMode] = useState("line");
  const [editing, setEditing] = useState(false);

  const hand = comboOpeningHand(c);
  const board = comboEndboard(c);
  const steps = (c.steps || []).filter((s) => view === "full" || isCoreStep(s));

  // Warm the card cache: batch-fetch the linked deck by id, and resolve any
  // remaining combo card names by fuzzy name, so thumbs + board placement work.
  useEffect(() => {
    let alive = true;
    (async () => {
      const deck = decks.find((d) => d.deckId === c.deckId);
      if (deck) { try { await fetchCards([...(deck.main || []), ...(deck.extra || []), ...(deck.side || [])]); } catch (_) {} }
      const missing = comboAllCards(c).filter((n) => n && !lookupCardByName(n));
      let got = false;
      // resolveCardName memoises failures, so unknown names cost one API call
      // per session — not one per combo open.
      for (const n of missing.slice(0, 40)) { if (await resolveCardName(n)) got = true; }
      if (alive && (deck || got)) forceRev();
    })();
    return () => { alive = false; };
  }, [c.replayId, c.replayUrl, c.deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rename = async () => {
    const v = await promptModal({ title: "Rename combo", value: comboTitle(c), confirmText: "Save" });
    if (v == null) return; renameCombo(idx, v.trim()); onChange();
  };
  const remove = async () => {
    if (await confirmModal({ title: "Delete this combo?", message: `"${comboTitle(c)}" will be removed from your saved combos.`, confirmText: "Delete combo", danger: true })) { deleteCombo(idx); onChange(); }
  };

  if (editing) {
    return (
      <ComboEditor c={c} idx={idx} decks={decks} onHover={onHover} onPick={onPick}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChange(); }} />
    );
  }

  return (
    <div className="combo-detail">
      <div className="combo-detail-bar">
        <h2 className="combo-detail-title" title="Click to rename" onClick={rename}>{comboTitle(c)}</h2>
        {c.replayUrl && <a className="combo-replay-link" href={c.replayUrl} target="_blank" rel="noreferrer" title="Open the DuelingBook replay">↗ replay</a>}
        <span className="combo-detail-bar-spacer" />
        <button type="button" className="back-btn" onClick={() => setEditing(true)}>✎ Edit</button>
        <button type="button" className="back-btn is-danger" onClick={remove}>× Delete</button>
      </div>

      <div className="combo-meta-row">
        <label className="combo-meta-field combo-meta-field-wide">
          <span>Decks</span>
          <DeckLinks c={c} idx={idx} decks={decks} onChange={onChange} />
        </label>
        <label className="combo-meta-field">
          <span>Opener size</span>
          <Dropdown className="combo-opener-dd" value={c.userOpenerSize == null ? "" : c.userOpenerSize}
            options={OPENER_OPTS} onChange={(v) => { setComboOpenerSize(idx, v === "" ? null : Number(v)); onChange(); }} />
        </label>
        <span className="combo-meta-info">{(c.steps || []).length} steps{c.extractedAt ? ` · extracted ${fmtDate(c.extractedAt)}` : ""}</span>
      </div>

      {comboBeatsTraps(c).length ? (
        <div className="combo-trap-row">
          <span className="combo-trap-row-label">Plays through</span>
          {comboBeatsTraps(c).map((t) => <span key={t} className="combo-trap-chip" title={t}>{trapShort(t)}</span>)}
        </div>
      ) : null}

      <div className="combo-mode-switch">
        {[["line", "Line"], ["sim", "Simulate"], ["drill", "Drill"]].map(([m, lbl]) => (
          <button key={m} type="button" className={"combo-mode-btn" + (mode === m ? " active" : "")} onClick={() => setMode(m)}>{lbl}</button>
        ))}
      </div>

      {mode === "line" && (
        <>
          {!!hand.length && (
            <section className="combo-block">
              <div className="combo-block-label">Opening hand</div>
              <div className="combo-hand-row">{hand.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />)}</div>
            </section>
          )}

          <section className="combo-block">
            <div className="combo-block-label">
              The line <span className="combo-block-hint">{steps.length} {view === "core" ? "key plays" : "steps"}</span>
              <Dropdown className="combo-view-dd combo-block-dd" value={view} options={VIEW_MODES} onChange={setView} ariaLabel="View mode" />
            </div>
            {!steps.length ? <div className="read-field is-empty">No steps recorded.</div> : (
              <ol className="combo-steps">
                {steps.map((s, i) => {
                  const cards = stepCards(s);
                  return (
                    <li key={i} className="combo-step">
                      <span className="combo-step-time">{s.timestamp || ""}</span>
                      <span className={"combo-step-action act-" + (s.action || "other").toLowerCase().replace(/\s+/g, "-")}>{s.action || "—"}</span>
                      <span className="combo-step-detail">{s.detail || cards.join(", ")}</span>
                      {cards.length ? <span className="combo-step-cards">{cards.map((n, j) => <Thumb key={j} name={n} onHover={onHover} onPick={onPick} />)}</span> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="combo-block">
            <div className="combo-block-label">End board</div>
            <EndBoardView cards={board} onHover={onHover} onPick={onPick} />
            <ComboPile title="Graveyard" cards={c.endboardGraveyard} cls="is-gy" onHover={onHover} onPick={onPick} />
            <ComboPile title="Banished" cards={c.endboardBanished} cls="is-banish" onHover={onHover} onPick={onPick} />
          </section>
        </>
      )}

      {mode === "sim" && <SimulatorView combo={c} onHover={onHover} onPick={onPick} />}
      {mode === "drill" && <DrillView combo={c} onHover={onHover} onPick={onPick} />}

      <section className="combo-block">
        <div className="combo-block-label">Notes on this combo</div>
        <RichNotes value={c.userNotes || ""} placeholder="Why this line, where it can brick, what to do through handtraps. Type @ to mention a card."
          onSave={(v) => { setComboNotes(idx, v); }} minHeight={80} />
      </section>
    </div>
  );
}

function ComboPile({ title, cards, cls, onHover, onPick }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(cards) || !cards.length) return null;
  return (
    <div className={"endboard-pile " + cls + (open ? "" : " collapsed")}>
      <button type="button" className="endboard-pile-header" onClick={() => setOpen((o) => !o)}>
        <span className="endboard-pile-title">{title}</span>
        <span className="endboard-pile-count">{cards.length}</span>
        <span className="endboard-pile-chevron">▾</span>
      </button>
      {open && <div className="endboard-pile-grid">{cards.map((n, i) => <Thumb key={i} name={typeof n === "string" ? n : (n.card || n.name)} onHover={onHover} onPick={onPick} />)}</div>}
    </div>
  );
}

// ── Step simulator — scrub the board as the combo builds ─────────────
function SimulatorView({ combo, onHover, onPick }) {
  const sim = simulateCombo(combo);
  const [i, setI] = useState(sim.length ? sim.length - 1 : 0);
  useEffect(() => { setI((combo.steps || []).length ? simulateCombo(combo).length - 1 : 0); }, [combo.replayId, combo.replayUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sim.length) return <section className="combo-block"><div className="read-field is-empty">No steps to simulate.</div></section>;
  const idx = Math.max(0, Math.min(i, sim.length - 1));
  const step = sim[idx];
  const st = step.stateAfter || { hand: [], field: [], gy: [], banished: [] };
  return (
    <section className="combo-block">
      <div className="combo-sim-controls">
        <button type="button" className="combo-sim-btn" disabled={idx <= 0} onClick={() => setI(idx - 1)}>◀ Prev</button>
        <input className="combo-sim-range" type="range" min={0} max={sim.length - 1} value={idx} onChange={(e) => setI(Number(e.target.value))} />
        <button type="button" className="combo-sim-btn" disabled={idx >= sim.length - 1} onClick={() => setI(idx + 1)}>Next ▶</button>
        <span className="combo-sim-count">Step {idx + 1} / {sim.length}</span>
      </div>
      <div className="combo-sim-narration">
        <span className={"combo-step-action act-" + (step.action || "other").toLowerCase().replace(/\s+/g, "-")}>{step.action || "—"}</span>
        <span className="combo-sim-narration-text">{describeStep(step)}</span>
      </div>
      <EndBoardView cards={fieldToBoard(st.field)} onHover={onHover} onPick={onPick} />
      <div className="combo-sim-piles">
        <SimPile label="Hand" cards={st.hand} onHover={onHover} onPick={onPick} />
        <SimPile label="Graveyard" cards={st.gy} onHover={onHover} onPick={onPick} />
        <SimPile label="Banished" cards={st.banished} onHover={onHover} onPick={onPick} />
      </div>
    </section>
  );
}

function SimPile({ label, cards, onHover, onPick }) {
  return (
    <div className="combo-sim-pile">
      <div className="combo-sim-pile-label">{label} <span className="count">{cards.length}</span></div>
      <div className="combo-hand-row">{cards.length ? cards.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />) : <span className="combo-sim-pile-empty">—</span>}</div>
    </div>
  );
}

// ── Drill — reveal the line one play at a time (test your recall) ────
function DrillView({ combo, onHover, onPick }) {
  const plays = simulateCombo(combo).filter(isCoreStep);
  const hand = comboOpeningHand(combo);
  const [revealed, setRevealed] = useState(0);
  useEffect(() => { setRevealed(0); }, [combo.replayId, combo.replayUrl]);
  return (
    <section className="combo-block">
      <div className="combo-drill">
        <div className="combo-drill-opener">
          <div className="combo-block-label">You open with</div>
          {hand.length
            ? <div className="combo-hand-row">{hand.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />)}</div>
            : <div className="read-field is-empty">No opener recorded — play from the first step.</div>}
        </div>
        <ol className="combo-drill-list">
          {plays.slice(0, revealed).map((s, i) => (
            <li key={i} className="combo-drill-step"><span className="combo-drill-n">{i + 1}</span><span>{describeStep(s)}</span></li>
          ))}
        </ol>
        {revealed < plays.length ? (
          <button type="button" className="btn-primary combo-drill-reveal" onClick={() => setRevealed(revealed + 1)}>
            {revealed === 0 ? "Reveal first play →" : `Reveal play ${revealed + 1} →`}
          </button>
        ) : (
          <div className="combo-drill-done">✓ That's the full line ({plays.length} plays). <button type="button" className="link-btn" onClick={() => setRevealed(0)}>Restart drill</button></div>
        )}
      </div>
    </section>
  );
}

// ── Removable card-chip row with a live picker (builder) ─────────────
function ChipRow({ items, onChange, onHover, onPick, placeholder }) {
  return (
    <div className="fmt-chip-row">
      {items.map((n, i) => {
        const c = lookupCardByName(n);
        const urls = c?.id ? getImageUrls(c.id) : [];
        return (
          <span key={i} className="fmt-chip"
            onMouseEnter={(e) => onHover && onHover(c, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => onHover && onHover(null)}
            onClick={(e) => onPick && onPick(c, e.currentTarget.getBoundingClientRect())}>
            {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : null}
            <span className="fmt-chip-name">{n}</span>
            <button type="button" className="fmt-chip-x" onClick={(e) => { e.stopPropagation(); onChange(items.filter((_, j) => j !== i)); }}>×</button>
          </span>
        );
      })}
      <CardPicker placeholder={placeholder} onAdd={(name) => onChange([...items, name])} />
    </div>
  );
}

// ── Build a combo by hand (opener + end board you specify) ──────────
function ComboBuilder({ decks, onCancel, onCreate, onHover, onPick }) {
  const [title, setTitle] = useState("");
  const [deckIds, setDeckIds] = useState([]);
  const [openerSize, setOpenerSize] = useState("");
  const [opener, setOpener] = useState([]);
  const [endboard, setEndboard] = useState([]);
  const [notes, setNotes] = useState("");
  const linkOpts = deckLinkOpts(decks, deckIds);
  const linked = deckIds.map((id) => decks.find((d) => d.deckId === id)).filter(Boolean);
  const canSave = opener.length || endboard.length || title.trim();
  return (
    <div className="combo-detail combo-builder">
      <div className="combo-detail-bar">
        <h2 className="combo-detail-title">New combo</h2>
        <span className="combo-detail-bar-spacer" />
        <button type="button" className="btn-primary" disabled={!canSave}
          onClick={() => onCreate({ title, deckIds, openerSize, opener, endboard, notes })}>Create combo</button>
        <button type="button" className="back-btn" onClick={onCancel}>Cancel</button>
      </div>
      <div className="combo-meta-row">
        <label className="combo-meta-field combo-meta-field-wide">
          <span>Name</span>
          <input className="jnf-name" value={title} placeholder="e.g. 1-card Elara" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="combo-meta-field">
          <span>Opener size</span>
          <Dropdown className="combo-opener-dd" value={openerSize} options={OPENER_OPTS} onChange={setOpenerSize} />
        </label>
      </div>
      <div className="combo-meta-row">
        <div className="combo-meta-field combo-meta-field-wide">
          <span>Linked decks <span className="combo-block-hint">link this line to every deck it works in</span></span>
          <div className="combo-deck-links">
            {linked.length
              ? linked.map((d) => (
                  <span key={d.deckId} className="combo-deck-chip">{d.name}
                    <button type="button" className="combo-deck-chip-x" title="Unlink"
                      onClick={() => setDeckIds((ids) => ids.filter((x) => x !== d.deckId))}>×</button>
                  </span>))
              : <span className="combo-deck-none">— not linked —</span>}
            {linkOpts.length
              ? <Dropdown className="combo-deck-add-dd" value="" options={linkOpts}
                  placeholder={linked.length ? "+ link another" : "+ link a deck"}
                  onChange={(v) => setDeckIds((ids) => [...new Set([...ids, v])])} />
              : null}
          </div>
        </div>
      </div>
      <section className="combo-block">
        <div className="combo-block-label">Opening hand <span className="combo-block-hint">the cards you start with</span></div>
        <ChipRow items={opener} onChange={setOpener} onHover={onHover} onPick={onPick} placeholder="Search an opener card…" />
      </section>
      <section className="combo-block">
        <div className="combo-block-label">End board <span className="combo-block-hint">what you end on</span></div>
        <ChipRow items={endboard} onChange={setEndboard} onHover={onHover} onPick={onPick} placeholder="Search a board piece…" />
        {!!endboard.length && <EndBoardView cards={endboard} onHover={onHover} onPick={onPick} />}
      </section>
      <section className="combo-block">
        <div className="combo-block-label">Notes</div>
        <RichNotes value={notes} onSave={setNotes} minHeight={70} placeholder="How the line goes, what to watch for. Type @ to mention a card." />
      </section>
    </div>
  );
}

// Grouped deck options (My decks / Matchup decks) for a link picker,
// excluding ids that are already linked.
function deckLinkOpts(decks, excludeIds) {
  const ex = new Set(excludeIds || []);
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const mine = decks.filter((d) => (d.role || "primary") !== "matchup" && !ex.has(d.deckId)).sort(byName);
  const opp = decks.filter((d) => d.role === "matchup" && !ex.has(d.deckId)).sort(byName);
  return [
    ...(mine.length ? [{ heading: "My decks" }, ...mine.map((d) => [d.deckId, d.name])] : []),
    ...(opp.length ? [{ heading: "Matchup decks" }, ...opp.map((d) => [d.deckId, d.name])] : []),
  ];
}

// ── Multi-deck link control — removable chips + a grouped "+ link" dropdown.
//    One combo can belong to several decks (e.g. two DoomZ variants). This
//    one persists immediately (used in the detail meta row). ──────────────
function DeckLinks({ c, idx, decks, onChange }) {
  const ids = comboDeckIds(c);
  const linked = ids.map((id) => decks.find((d) => d.deckId === id)).filter(Boolean);
  const opts = deckLinkOpts(decks, ids);
  return (
    <div className="combo-deck-links">
      {linked.length
        ? linked.map((d) => (
            <span key={d.deckId} className="combo-deck-chip">{d.name}
              <button type="button" className="combo-deck-chip-x" title="Unlink"
                onClick={() => { setComboDecks(idx, ids.filter((x) => x !== d.deckId)); onChange(); }}>×</button>
            </span>))
        : <span className="combo-deck-none">— not linked —</span>}
      {opts.length
        ? <Dropdown className="combo-deck-add-dd" value="" options={opts}
            placeholder={linked.length ? "+ link another" : "+ link a deck"}
            onChange={(v) => { setComboDecks(idx, [...ids, v]); onChange(); }} />
        : null}
    </div>
  );
}

// ── Full combo editor — rename, link multiple decks, fix the opener size,
//    edit the opening hand / end board, and fully edit the step line (add /
//    remove / reorder / retext each step + its cards). Simulate & Drill read
//    straight from these steps, so every edit re-flows both. A live simulated
//    board shows the result as you edit. ──────────────────────────────────
const ACTION_OPTS = [
  "Draw", "Search", "Add", "Normal Summon", "Special Summon", "Link Summon",
  "Synchro Summon", "Xyz Summon", "Fusion Summon", "Pendulum Summon", "Tribute Summon",
  "Flip Summon", "Set", "Activate", "Send to GY", "Discard", "Destroy", "Banish",
  "Tribute", "Return", "Move", "Overlay", "Detach", "AttachMaterial", "Reveal", "Pass",
].map((a) => [a, a]);
// Keep the current action selectable even if it's not in the standard list.
const actionOptsFor = (cur) => (!cur || ACTION_OPTS.some(([v]) => v === cur)) ? ACTION_OPTS : [[cur, cur], ...ACTION_OPTS];

// ── Handtrap-resistance multi-select — chips + a dropdown of the common
//    traps (short labels), excluding ones already tagged. ────────────────
function TrapPicker({ value, onChange }) {
  const sel = value || [];
  const opts = COMMON_HANDTRAPS.filter((t) => !sel.includes(t)).map((t) => [t, trapShort(t)]);
  return (
    <div className="combo-trap-picker">
      {sel.length
        ? sel.map((t) => (
            <span key={t} className="combo-trap-chip is-edit" title={t}>{trapShort(t)}
              <button type="button" className="combo-trap-chip-x" title="Remove"
                onClick={() => onChange(sel.filter((x) => x !== t))}>×</button>
            </span>))
        : <span className="combo-deck-none">— none tagged —</span>}
      {opts.length
        ? <Dropdown className="combo-trap-add-dd" value="" options={opts} placeholder="+ plays through…"
            onChange={(v) => onChange([...new Set([...sel, v])])} />
        : null}
    </div>
  );
}

function ComboEditor({ c, idx, decks, onCancel, onSaved, onHover, onPick }) {
  const initialTitle = (c.userTitle && c.userTitle.trim())
    || (c.comboName && c.comboName !== "Untitled combo" ? c.comboName : "");
  const [title, setTitle] = useState(initialTitle);
  const [deckIds, setDeckIds] = useState(comboDeckIds(c));
  const [openerSize, setOpenerSize] = useState(c.userOpenerSize == null ? "" : c.userOpenerSize);
  const [hand, setHand] = useState(comboOpeningHand(c));
  const [steps, setSteps] = useState(() => (c.steps || []).map((s) => ({
    action: s.action || "", detail: s.detail || "", cards: [...(s.cards || [])], timestamp: s.timestamp || "",
  })));
  const origBoard = useMemo(() => comboEndboard(c), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [ebNames, setEbNames] = useState(origBoard.map((x) => x.name));
  const [traps, setTraps] = useState(comboBeatsTraps(c));
  const [notes, setNotes] = useState(c.userNotes || "");

  const linkOpts = deckLinkOpts(decks, deckIds);
  const linked = deckIds.map((id) => decks.find((d) => d.deckId === id)).filter(Boolean);

  const moveStep = (i, dir) => setSteps((s) => {
    const a = [...s]; const j = i + dir; if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]]; return a;
  });
  const removeStep = (i) => setSteps((s) => s.filter((_, j) => j !== i));
  const patchStep = (i, patch) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const addStep = () => setSteps((s) => [...s, { action: "Activate", detail: "", cards: [], timestamp: "" }]);

  // Preserve extractor zone/material data for end-board cards left untouched;
  // newly added pieces save as plain names (auto-placed by type).
  const save = () => {
    const keep = new Map(origBoard.map((x) => [x.name, x]));
    const endboard = ebNames.map((n) => keep.get(n) || n);
    updateCombo(idx, { title, deckIds, openerSize, openingHand: hand, steps, endboard, beatsTraps: traps, notes });
    onSaved();
  };

  // Live simulated board from the edited steps — proves Simulate/Drill re-flow.
  const simmed = useMemo(() => {
    const sim = simulateCombo({ ...c, steps: steps.map((s, i) => ({ ...s, n: i + 1 })) });
    return fieldToBoard(sim.length ? ((sim[sim.length - 1].stateAfter || {}).field || []) : []);
  }, [steps]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="combo-detail combo-editor">
      <div className="combo-detail-bar">
        <h2 className="combo-detail-title">Edit combo</h2>
        <span className="combo-detail-bar-spacer" />
        <button type="button" className="btn-primary" onClick={save}>Save changes</button>
        <button type="button" className="back-btn" onClick={onCancel}>Cancel</button>
      </div>

      <div className="combo-meta-row">
        <label className="combo-meta-field combo-meta-field-wide">
          <span>Name <span className="combo-block-hint">call it whatever helps you remember it</span></span>
          <input className="jnf-name" value={title} placeholder="e.g. 1-card Elara → full board"
            onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="combo-meta-field">
          <span>Opener size <span className="combo-block-hint">controls its group</span></span>
          <Dropdown className="combo-opener-dd" value={openerSize} options={OPENER_OPTS} onChange={setOpenerSize} />
        </label>
      </div>

      <div className="combo-meta-row">
        <div className="combo-meta-field combo-meta-field-wide">
          <span>Linked decks <span className="combo-block-hint">link the same line to every deck variant it works in</span></span>
          <div className="combo-deck-links">
            {linked.length
              ? linked.map((d) => (
                  <span key={d.deckId} className="combo-deck-chip">{d.name}
                    <button type="button" className="combo-deck-chip-x" title="Unlink"
                      onClick={() => setDeckIds((ids) => ids.filter((x) => x !== d.deckId))}>×</button>
                  </span>))
              : <span className="combo-deck-none">— not linked —</span>}
            {linkOpts.length
              ? <Dropdown className="combo-deck-add-dd" value="" options={linkOpts}
                  placeholder={linked.length ? "+ link another" : "+ link a deck"}
                  onChange={(v) => setDeckIds((ids) => [...new Set([...ids, v])])} />
              : null}
          </div>
        </div>
      </div>

      <section className="combo-block">
        <div className="combo-block-label">Opening hand <span className="combo-block-hint">the cards you start with</span></div>
        <ChipRow items={hand} onChange={setHand} onHover={onHover} onPick={onPick} placeholder="Search an opener card…" />
      </section>

      <section className="combo-block">
        <div className="combo-block-label">
          Steps <span className="combo-block-hint">{steps.length} step{steps.length === 1 ? "" : "s"} · reorder with ↑↓, delete the draw noise, retext anything</span>
        </div>
        {!steps.length ? <div className="read-field is-empty">No steps yet. Add the first play below.</div> : (
          <ol className="combo-edit-steps">
            {steps.map((s, i) => (
              <li key={i} className="combo-edit-step">
                <div className="combo-edit-step-head">
                  <span className="combo-edit-step-n">{i + 1}</span>
                  <Dropdown className="combo-edit-action-dd" value={s.action} options={actionOptsFor(s.action)}
                    placeholder="Action" onChange={(v) => patchStep(i, { action: v })} />
                  <input className="combo-edit-detail" value={s.detail} placeholder="What happens (free text)…"
                    onKeyDown={(e) => e.stopPropagation()} onChange={(e) => patchStep(i, { detail: e.target.value })} />
                  <span className="combo-edit-step-ctrls">
                    <button type="button" className="combo-edit-mini" title="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)}>↑</button>
                    <button type="button" className="combo-edit-mini" title="Move down" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>↓</button>
                    <button type="button" className="combo-edit-mini is-danger" title="Delete step" onClick={() => removeStep(i)}>×</button>
                  </span>
                </div>
                <div className="combo-edit-step-cards">
                  <ChipRow items={s.cards} onChange={(cards) => patchStep(i, { cards })} onHover={onHover} onPick={onPick} placeholder="+ card this step touches…" />
                </div>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="btn-secondary combo-edit-addstep" onClick={addStep}>+ Add step</button>
      </section>

      <section className="combo-block">
        <div className="combo-block-label">End board <span className="combo-block-hint">what you end on</span></div>
        <ChipRow items={ebNames} onChange={setEbNames} onHover={onHover} onPick={onPick} placeholder="Search a board piece…" />
        {!!ebNames.length && <EndBoardView cards={ebNames} onHover={onHover} onPick={onPick} />}
      </section>

      <section className="combo-block">
        <div className="combo-block-label">Plays through <span className="combo-block-hint">handtraps this line still resolves through — drives the Testing "if they have…" filter</span></div>
        <TrapPicker value={traps} onChange={setTraps} />
      </section>

      {!!steps.length && (
        <section className="combo-block">
          <div className="combo-block-label">Board after these steps <span className="combo-block-hint">simulated live from the steps above</span></div>
          <EndBoardView cards={simmed} onHover={onHover} onPick={onPick} />
        </section>
      )}

      <section className="combo-block">
        <div className="combo-block-label">Notes on this combo</div>
        <RichNotes value={notes} onSave={setNotes} minHeight={70} placeholder="Why this line, where it bricks, how to play through handtraps. Type @ to mention a card." />
      </section>

      <div className="combo-editor-footer">
        <button type="button" className="btn-primary" onClick={save}>Save changes</button>
        <button type="button" className="back-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Gallery view — image-first cards: starting hand → end board ─────
function ComboGallery({ groups, deckNames, onHover, onPick, onOpen }) {
  return (
    <div className="combo-gallery">
      {groups.map((g) => (
        <div key={g.bucket} className="combo-gallery-group">
          <div className="combo-picker-group-header">{g.bucket} <span className="count">{g.items.length}</span></div>
          <div className="combo-gallery-grid">
            {g.items.map(({ c, i }) => (
              <ComboGalleryCard key={comboKey(c, i)} c={c} deckName={deckLabel(c, deckNames)} onHover={onHover} onPick={onPick} onOpen={() => onOpen(comboKey(c, i))} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComboGalleryCard({ c, deckName, onHover, onPick, onOpen }) {
  const hand = comboOpeningHand(c);
  const board = comboEndboard(c).map((x) => x.name);
  return (
    <div className="combo-gcard">
      <div className="combo-gcard-head">
        <span className="combo-gcard-name">{comboTitle(c)}</span>
        <button type="button" className="combo-gcard-open" onClick={onOpen}>Open →</button>
      </div>
      <div className="combo-gcard-cols">
        <div className="combo-gcol">
          <div className="combo-gcol-label">Starting hand</div>
          <div className="combo-gcol-cards">{hand.length ? hand.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />) : <span className="muted">—</span>}</div>
        </div>
        <div className="combo-gcard-arrow">→</div>
        <div className="combo-gcol">
          <div className="combo-gcol-label">End board</div>
          <div className="combo-gcol-cards">{board.length ? board.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />) : <span className="muted">—</span>}</div>
        </div>
      </div>
      {deckName && <div className="combo-gcard-deck">{deckName}</div>}
    </div>
  );
}
