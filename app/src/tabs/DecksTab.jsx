import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  loadDecks, getActiveDeckId, setActiveDeckId, loadSavedCombos,
} from "../lib/storage.js";
import { loadMetaPack } from "../lib/metaPack.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import {
  getDeckPrimaryDecklist, ensureDeckShape, persistDeck, convertDeckRole, deleteDeck,
  setActiveBuild, addDecklistFromYdkText, deleteDecklist, downloadDecklist,
  extractKeyCards, countMissingCardData, buildKeyRatiosHtml,
  KEY_CARD_BUCKETS, STOP_PRIORITIES,
} from "../lib/deckModel.js";
import { fetchCards } from "../lib/ydk.js";
import CardsView from "../components/CardsView.jsx";
import PanelSection from "../components/PanelSection.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Icon from "../components/Icon.jsx";

// ════════════════════════════════════════════════════════════════════
// DECKS TAB — full parity with the original: role-filtered sidebar +
// rich deck panel (rename / role / delete, methodology editor, notes,
// multi-build decklists, key-card buckets, combos summary, card grid).
// ════════════════════════════════════════════════════════════════════
export default function DecksTab({ dataVersion = 0, reload }) {
  const [roleFilter, setRoleFilter] = useState("primary");
  const [localRev, bumpLocal] = useReducer((x) => x + 1, 0);
  const [selectedId, setSelectedId] = useState(getActiveDeckId());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const decks = useMemo(() => loadDecks(), [dataVersion, localRev]);
  const counts = useMemo(() => ({
    total: decks.length,
    primary: decks.filter((d) => (d.role || "primary") === "primary").length,
    matchup: decks.filter((d) => d.role === "matchup").length,
  }), [decks]);

  const filtered = decks.filter((d) => (d.role || "primary") === roleFilter)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Keep a valid selection within the current filter.
  const selected = decks.find((d) => d.deckId === selectedId) || filtered[0] || decks[0] || null;
  useEffect(() => {
    if (selected && selected.deckId !== selectedId) setSelectedId(selected.deckId);
  }, [selected, selectedId]);

  const pickDeck = (d) => { setSelectedId(d.deckId); setActiveDeckId(d.deckId); };

  const onImportFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { deck, isNew } = importDeckFromYdk(text, file.name);
      if (roleFilter === "matchup" && deck.role !== "matchup") { deck.role = "matchup"; persistDeck(deck); }
      setSelectedId(deck.deckId);
      bumpLocal();
      reload && reload();
      if (!isNew) alert("That deck is already imported — selected it.");
    } catch (err) {
      alert("Couldn't import that .ydk: " + err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onLoadMeta = async () => {
    setBusy(true);
    try { await loadMetaPack(); bumpLocal(); reload && reload(); }
    catch (e) { alert("Couldn't load the meta pack: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="decks-tab">
      <input ref={fileRef} type="file" accept=".ydk" hidden onChange={onImportFile} />

      <div className="decks-toolbar">
        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
          <Icon name="cards" size={16} /> {roleFilter === "matchup" ? "Import matchup deck (.ydk)" : "Import your deck (.ydk)"}
        </button>
        <button type="button" className="btn-secondary" onClick={onLoadMeta} disabled={busy}>
          {busy ? "Loading…" : <><Icon name="summon" size={16} /> Load meta decks</>}
        </button>
        <span className="decks-summary">
          <strong>{counts.total}</strong> decks · <strong>{counts.primary}</strong> mine · <strong>{counts.matchup}</strong> matchup
        </span>
      </div>

      {!decks.length ? (
        <div className="placeholder">
          No decks yet. <strong>Import your deck</strong> from a <code>.ydk</code> file, or
          <strong> Load meta decks</strong> to pull in the bundled opponents.
        </div>
      ) : (
        <div className="decks-layout">
          <aside className="decks-sidebar">
            <div className="decks-role-filter">
              <button type="button" className={"decks-role-btn" + (roleFilter === "primary" ? " active" : "")} onClick={() => setRoleFilter("primary")}>My decks</button>
              <button type="button" className={"decks-role-btn" + (roleFilter === "matchup" ? " active" : "")} onClick={() => setRoleFilter("matchup")}>Matchup</button>
            </div>
            {!filtered.length ? (
              <div className="decks-list-empty">
                {roleFilter === "matchup"
                  ? "No matchup decks yet — Load meta decks, or import opponent .ydk files."
                  : "No decks of yours yet — Import your deck (.ydk)."}
              </div>
            ) : filtered.map((d) => <DeckTile key={d.deckId} deck={d} active={selected && d.deckId === selected.deckId} onClick={() => pickDeck(d)} />)}
          </aside>

          <section className="deck-panel">
            {selected
              ? <DeckPanel key={selected.deckId} deck={ensureDeckShape(selected)} onChanged={() => { bumpLocal(); reload && reload(); }} onSelect={setSelectedId} />
              : <div className="decks-content-empty">Pick a deck from the left.</div>}
          </section>
        </div>
      )}
    </div>
  );
}

function DeckTile({ deck, active, onClick }) {
  const isMatchup = (deck.role || "primary") === "matchup";
  const dl = getDeckPrimaryDecklist(deck);
  const c = (dl && dl.counts) || deck.counts || { main: 0, extra: 0, side: 0 };
  const builds = Array.isArray(deck.decklists) ? deck.decklists.length : 1;
  return (
    <button type="button" className={"deck-tile" + (active ? " active" : "") + (isMatchup ? " is-matchup" : "")} onClick={onClick}>
      <span className="deck-tile-stripe" />
      <span className="deck-tile-body">
        <span className="deck-tile-name">{deck.name || "Untitled deck"}</span>
        <span className="deck-tile-meta">
          <span className="deck-tile-role-badge">{isMatchup ? "Matchup" : "My deck"}</span>
          <span>{c.main || 0}m · {c.extra || 0}e · {c.side || 0}s{builds > 1 ? ` · ${builds} builds` : ""}</span>
        </span>
      </span>
    </button>
  );
}

// ── The selected-deck panel ──────────────────────────────────────────
function DeckPanel({ deck, onChanged }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const [renaming, setRenaming] = useState(false);
  const [cardMap, setCardMap] = useState({});

  // Persist a mutation + re-render this panel + notify parent (so the
  // sidebar tile + other tabs see the change).
  const save = () => { persistDeck(deck); force(); onChanged && onChanged(); };

  // Fetch the active build's card data once (drives key-card extraction
  // + key-ratio auto-fill). CardsView fetches its own (cache dedupes).
  const dl = getDeckPrimaryDecklist(deck);
  const buildIds = useMemo(() => [].concat(dl.main || [], dl.extra || [], dl.side || []), [dl]);
  useEffect(() => {
    let alive = true;
    fetchCards(buildIds).then(({ map }) => { if (alive) setCardMap(map); });
    return () => { alive = false; };
  }, [buildIds]);

  const isMatchup = deck.role === "matchup";

  return (
    <div className="deck-panel-inner">
      <div className="deck-panel-header">
        {renaming ? (
          <input className="deck-rename-input" autoFocus defaultValue={deck.name}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { e.currentTarget.value = deck.name; e.currentTarget.blur(); } else e.stopPropagation(); }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== deck.name) { deck.name = v; save(); } setRenaming(false); }} />
        ) : (
          <h2 className="deck-panel-title" title="Click to rename" onClick={() => setRenaming(true)}>{deck.name}</h2>
        )}
        <span className={"deck-panel-role " + (isMatchup ? "is-matchup" : "is-mine")}>{isMatchup ? "Matchup" : "My deck"}</span>
        <span className="deck-panel-counts">{(dl.counts?.main ?? (deck.main || []).length)}m · {(dl.counts?.extra ?? (deck.extra || []).length)}e · {(dl.counts?.side ?? (deck.side || []).length)}s</span>
        <span className="deck-panel-actions">
          <button type="button" className="deck-mini-btn" title="Re-classify this deck"
            onClick={() => { if (confirm(`Convert "${deck.name}" to ${isMatchup ? "My deck" : "Matchup"}?`)) { convertDeckRole(deck); onChanged && onChanged(); } }}>
            ↻ {isMatchup ? "→ My deck" : "→ Matchup"}
          </button>
          <button type="button" className="deck-mini-btn is-danger" title="Delete this deck"
            onClick={() => { if (confirm(`Delete "${deck.name}"? Combos linked to it become unassigned.`)) { deleteDeck(deck.deckId); onChanged && onChanged(); } }}>
            × Delete
          </button>
        </span>
      </div>

      <PanelSection title="Methodology — how this deck plays" defaultOpen={true}>
        <MethodologySection deck={deck} save={save} cardMap={cardMap} />
      </PanelSection>

      <PanelSection title="Key cards — what to protect / what to stop" defaultOpen={false}>
        <KeyCardsSection deck={deck} save={save} cardMap={cardMap} force={force} />
      </PanelSection>

      <PanelSection title="Decklists — variants of this deck" defaultOpen={false}>
        <DecklistsSection deck={deck} save={save} onChanged={onChanged} />
      </PanelSection>

      <PanelSection title="Notes — anything else about this deck" defaultOpen={false}>
        <RichNotes value={deck.notes || ""} onSave={(v) => { deck.notes = v; save(); }} minHeight={90}
          placeholder="Build rationale, side-deck plans, things to remember. Type @ to mention a card." />
      </PanelSection>

      <PanelSection title="Combos for the active build" defaultOpen={false}>
        <CombosSection deck={deck} />
      </PanelSection>

      <PanelSection title="Cards" defaultOpen={true}>
        <CardsView deck={deck} />
      </PanelSection>
    </div>
  );
}

// ── Reusable autosaving textarea (debounced + save on blur) ──────────
function AutosaveTextarea({ value, onSave, placeholder, single }) {
  const [val, setVal] = useState(value || "");
  const latest = useRef(value || "");
  const timer = useRef(null);
  useEffect(() => { setVal(value || ""); latest.current = value || ""; }, [value]);
  const schedule = (v) => {
    setVal(v); latest.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(v), 600);
  };
  return (
    <textarea
      className={"deck-field-input" + (single ? " is-single" : "")}
      value={val}
      placeholder={placeholder}
      rows={single ? 1 : 3}
      onChange={(e) => schedule(e.target.value)}
      onBlur={() => { clearTimeout(timer.current); if (latest.current !== (value || "")) onSave(latest.current); }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

const METHOD_FIELDS = [
  { key: "summary", label: "Summary", placeholder: "One paragraph: what the deck does and why it's chosen for this format." },
  { key: "endboard", label: "Ideal end board", placeholder: "What you're aiming for on turn 1 / 3." },
  { key: "howItWins", label: "How it wins", placeholder: "Lethal lines, win conditions." },
  { key: "strengths", label: "Strengths", placeholder: "1-card combos, multi-negate, going first/second flex…" },
  { key: "weaknesses", label: "Weaknesses", placeholder: "Handtraps that hurt most, bricks, weak matchups." },
];

function MethodologySection({ deck, save, cardMap }) {
  const m = deck.methodology;
  return (
    <div className="method-fields">
      {METHOD_FIELDS.map((f) => (
        <div className="deck-field" key={f.key}>
          <div className="deck-field-label">{f.label}</div>
          <RichNotes value={m[f.key] || ""} placeholder={f.placeholder + " Type @ to mention a card."}
            onSave={(v) => { m[f.key] = v; save(); }} />
        </div>
      ))}
      <div className="deck-field">
        <div className="deck-field-label">
          Key ratios
          <button type="button" className="deck-inline-btn"
            onClick={() => { const h = buildKeyRatiosHtml(deck, cardMap); if (!h) { alert("The active build has no main-deck cards (or card data hasn't loaded yet)."); return; } m.keyRatios = h; save(); }}>
            ↺ Auto-fill from active build
          </button>
        </div>
        <RichNotes value={m.keyRatios || ""} placeholder="e.g. 3× Starter, 2× Extender, 3× Ash… or auto-fill above."
          onSave={(v) => { m.keyRatios = v; save(); }} />
      </div>
      <TechCards deck={deck} save={save} />
    </div>
  );
}

function TechCards({ deck, save }) {
  const list = deck.methodology.techCards || (deck.methodology.techCards = []);
  const [, force] = useReducer((x) => x + 1, 0);
  return (
    <div className="deck-field">
      <div className="deck-field-label">Tech cards (and why)</div>
      {list.map((tc, i) => (
        <div className="tech-card-row" key={i}>
          <input className="deck-field-input is-single" defaultValue={tc.name} placeholder="Card name"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => { tc.name = e.target.value; save(); }} />
          <input className="deck-field-input is-single" defaultValue={tc.reason} placeholder="Why it's in for this format"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => { tc.reason = e.target.value; save(); }} />
          <button type="button" className="tech-card-del" title="Remove" onClick={() => { list.splice(i, 1); save(); force(); }}>×</button>
        </div>
      ))}
      <button type="button" className="deck-inline-btn" onClick={() => { list.push({ name: "", reason: "" }); save(); force(); }}>+ Add tech card</button>
    </div>
  );
}

function KeyCardsSection({ deck, save, cardMap, force }) {
  const total = (deck.keyCards || []).length;
  const missing = countMissingCardData(deck, cardMap);
  const doExtract = () => { deck.keyCards = extractKeyCards(deck, cardMap); save(); };
  return (
    <div>
      <div className="key-cards-toolbar">
        <span className="key-cards-status">
          {total ? `${total} card${total === 1 ? "" : "s"} bucketed` + (missing ? ` · ${missing} need data (open Cards)` : "")
            : missing ? `${missing} cards need data — card images load on open`
            : "No key cards yet — click Extract to bucket the active build."}
        </span>
        <button type="button" className="deck-inline-btn" onClick={doExtract}>{total ? "↻ Re-extract" : "Extract key cards"}</button>
      </div>
      <div className="key-cards-grid">
        {KEY_CARD_BUCKETS.map((cat) => <KeyCardBucket key={cat} deck={deck} category={cat} save={save} force={force} />)}
      </div>
    </div>
  );
}

function KeyCardBucket({ deck, category, save, force }) {
  const [adding, setAdding] = useState(false);
  const cards = (deck.keyCards || []).filter((kc) => kc && kc.category === category)
    .sort((a, b) => {
      const rank = (p) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
      return rank(a.stopPriority) - rank(b.stopPriority) || (a.priority || 0) - (b.priority || 0);
    });
  const addCard = (name) => {
    const n = (name || "").trim();
    if (!n) return;
    const existing = (deck.keyCards || []).find((kc) => kc && kc.name.toLowerCase() === n.toLowerCase());
    if (existing) { existing.category = category; }
    else deck.keyCards.push({ name: n, category, stopPriority: "none", stopWith: "", notes: "", auto: false, priority: (deck.keyCards.length) });
    save(); setAdding(false);
  };
  return (
    <div className="key-cards-bucket" data-cat={category}>
      <div className="key-cards-bucket-header"><span>{category}</span><span className="count">{cards.length}</span></div>
      <div className="key-cards-list">
        {!cards.length && <div className="key-cards-empty">—</div>}
        {cards.map((kc) => <KeyCardRow key={kc.name} deck={deck} kc={kc} save={save} force={force} />)}
        {adding ? (
          <input className="key-cards-add-input" autoFocus placeholder="Card name, Enter to add"
            onKeyDown={(e) => { if (e.key === "Enter") addCard(e.target.value); else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
            onBlur={(e) => { if (e.target.value.trim()) addCard(e.target.value); else setAdding(false); }} />
        ) : (
          <button type="button" className="key-cards-add-card" onClick={() => setAdding(true)}>+ Add card</button>
        )}
      </div>
    </div>
  );
}

const PRIORITY_DOT = { high: "var(--role-stopper)", medium: "var(--warning)", none: "transparent" };

function KeyCardRow({ deck, kc, save, force }) {
  const [open, setOpen] = useState(false);
  const remove = () => { deck.keyCards = deck.keyCards.filter((x) => x !== kc); save(); force(); };
  return (
    <div className="key-card-row">
      <div className="key-card-row-head">
        <button type="button" className="key-card-toggle" onClick={() => setOpen((o) => !o)}>
          <span className="key-card-dot" style={{ background: PRIORITY_DOT[kc.stopPriority] || "transparent", borderColor: kc.stopPriority === "none" ? "var(--border-strong)" : "transparent" }} />
          <span className="key-card-name">{kc.name}</span>
          {kc.auto === false && <span className="key-card-manual">manual</span>}
        </button>
        <button type="button" className="key-card-remove" title="Remove from key cards" onClick={remove}>×</button>
      </div>
      {open && (
        <div className="key-card-editor">
          <label className="key-card-edit-row">
            <span>Stop priority</span>
            <select value={kc.stopPriority || "none"} onChange={(e) => { kc.stopPriority = e.target.value; save(); }}>
              {STOP_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <input className="deck-field-input is-single" defaultValue={kc.stopWith} placeholder="Stop it with… (e.g. Ash, Imperm)"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => { kc.stopWith = e.target.value; save(); }} />
          <AutosaveTextarea value={kc.notes || ""} placeholder="Notes — why it matters, how to play around it"
            onSave={(v) => { kc.notes = v; save(); }} />
        </div>
      )}
    </div>
  );
}

function DecklistsSection({ deck, save, onChanged }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef(null);
  const decklists = Array.isArray(deck.decklists) ? deck.decklists : [];

  const onAddFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try { addDecklistFromYdkText(deck, await file.text()); onChanged && onChanged(); force(); }
    catch (err) { alert("Couldn't add build: " + err.message); }
    finally { if (fileRef.current) fileRef.current.value = ""; setAdding(false); }
  };

  if (!decklists.length) return <div className="deck-empty-hint">This deck has a single build (no variants tracked).</div>;

  return (
    <div className="decklists">
      <input ref={fileRef} type="file" accept=".ydk" hidden onChange={onAddFile} />
      {decklists.map((d) => {
        const active = d.decklistId === deck.primaryDecklistId;
        const c = d.counts || { main: 0, extra: 0, side: 0 };
        return (
          <div className={"decklist-row" + (active ? " is-active" : "")} key={d.decklistId}>
            <RenamableName value={d.name || "Untitled build"} onSave={(v) => { d.name = v; save(); }} />
            <span className="decklist-counts">{c.main || 0}m · {c.extra || 0}e · {c.side || 0}s</span>
            <span className="decklist-actions">
              <button type="button" className="decklist-action" title={active ? "Active build" : "Set active"}
                onClick={() => { if (!active) { setActiveBuild(deck, d.decklistId); onChanged && onChanged(); force(); } }}>{active ? "●" : "○"}</button>
              <button type="button" className="decklist-action" title="Download .ydk" onClick={() => downloadDecklist(deck, d)}>↓</button>
              {decklists.length > 1 && (
                <button type="button" className="decklist-action" title="Delete build"
                  onClick={() => { if (confirm(`Delete build "${d.name}"?`)) { deleteDecklist(deck, d.decklistId); onChanged && onChanged(); force(); } }}>×</button>
              )}
            </span>
          </div>
        );
      })}
      {adding ? (
        <div className="decklist-add">
          <button type="button" className="deck-inline-btn" onClick={() => fileRef.current?.click()}>Choose a .ydk file…</button>
          <button type="button" className="deck-inline-btn" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="deck-inline-btn" onClick={() => setAdding(true)}>+ Add a build</button>
      )}
    </div>
  );
}

function RenamableName({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <input className="deck-field-input is-single decklist-name-input" autoFocus defaultValue={value}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { e.currentTarget.value = value; e.currentTarget.blur(); } else e.stopPropagation(); }}
      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) onSave(v); setEditing(false); }} />;
  }
  return <span className="decklist-name" title="Click to rename" onClick={() => setEditing(true)}>{value}</span>;
}

function CombosSection({ deck }) {
  const combos = loadSavedCombos().filter((c) => c && c.deckId === deck.deckId);
  if (!combos.length) {
    return <div className="deck-empty-hint">No combos yet for this deck. Extract one with the Chrome extension on a DuelingBook replay — they'll show here and power the Testing tab's "Playable lines".</div>;
  }
  return (
    <div className="deck-combos-mini">
      {combos.map((c, i) => (
        <div className="deck-combo-row" key={i}>
          <span className="deck-combo-name">{c.title || c.name || (c.openingHand || []).join(" + ") || "Combo"}</span>
          <span className="deck-combo-steps">{(c.steps || []).length} steps</span>
        </div>
      ))}
    </div>
  );
}
