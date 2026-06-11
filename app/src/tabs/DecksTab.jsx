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
  KEY_CARD_BUCKETS, STOP_PRIORITIES, classifyKeyCardCategory,
} from "../lib/deckModel.js";
import { pAtLeast, pct } from "../lib/deckMath.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { lookupCardByName } from "../lib/cardSearch.js";
import { confirmModal, alertModal } from "../lib/modal.js";
import CardsView from "../components/CardsView.jsx";
import CardPreview from "../components/CardPreview.jsx";
import PanelSection from "../components/PanelSection.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Dropdown from "../components/Dropdown.jsx";
import CardPicker from "../components/CardPicker.jsx";
import { PlaybookEditor } from "../components/Matchup.jsx";
import Icon from "../components/Icon.jsx";

// ════════════════════════════════════════════════════════════════════
// DECKS TAB — full parity with the original: role-filtered sidebar +
// rich deck panel (rename / role / delete, methodology editor, notes,
// multi-build decklists, key-card buckets, combos summary, card grid).
// ════════════════════════════════════════════════════════════════════
export default function DecksTab({ dataVersion = 0, reload, jump }) {
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

  // Cross-tab jump (Format "Edit in Decks →"): switch filter + select the deck.
  useEffect(() => {
    if (!jump || !jump.deckId) return;
    const d = loadDecks().find((x) => x.deckId === jump.deckId);
    if (!d) return;
    setRoleFilter(d.role === "matchup" ? "matchup" : "primary");
    setSelectedId(jump.deckId);
    setActiveDeckId(jump.deckId);
  }, [jump && jump.n]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!isNew) alertModal({ title: "Already imported", message: "That deck is already in your library — selected it." });
    } catch (err) {
      alertModal({ title: "Couldn't import that .ydk", message: err.message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onLoadMeta = async () => {
    setBusy(true);
    try { await loadMetaPack(); bumpLocal(); reload && reload(); }
    catch (e) { alertModal({ title: "Couldn't load the meta pack", message: e.message }); }
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
              <button type="button" data-role="primary" className={"decks-role-btn" + (roleFilter === "primary" ? " active" : "")} onClick={() => setRoleFilter("primary")}>My decks</button>
              <button type="button" data-role="matchup" className={"decks-role-btn" + (roleFilter === "matchup" ? " active" : "")} onClick={() => setRoleFilter("matchup")}>Matchup decks</button>
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

  // Card names actually in this deck (main + extra) — the pool the end-board
  // editor picks from, so you build boards from THEIR cards, no global search.
  const deckCardPool = useMemo(() => {
    const ids = [].concat(dl.main || [], dl.extra || []);
    const seen = new Set(); const out = [];
    for (const id of ids) { const c = cardMap[Number(id)]; const n = c && c.name; if (n && !seen.has(n)) { seen.add(n); out.push(n); } }
    return out.sort((a, b) => a.localeCompare(b));
  }, [dl, cardMap]);

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
            onClick={async () => { if (await confirmModal({ title: `Convert "${deck.name}"?`, message: `Move it to your ${isMatchup ? "My decks" : "Matchup decks"} list.`, confirmText: "Convert" })) { convertDeckRole(deck); onChanged && onChanged(); } }}>
            ↻ {isMatchup ? "→ My deck" : "→ Matchup"}
          </button>
          <button type="button" className="deck-mini-btn is-danger" title="Delete this deck"
            onClick={async () => { if (await confirmModal({ title: `Delete "${deck.name}"?`, message: "Combos linked to it become unassigned; formats lose it as primary.", confirmText: "Delete deck", danger: true })) { deleteDeck(deck.deckId); onChanged && onChanged(); } }}>
            × Delete
          </button>
        </span>
      </div>

      <PanelSection title="Decklist — the cards" defaultOpen={true}>
        <CardsView deck={deck} />
      </PanelSection>

      {!isMatchup && (
        <PanelSection title="Opening odds — deck health" defaultOpen={true}>
          <OddsSection deck={deck} cardMap={cardMap} />
        </PanelSection>
      )}

      <PanelSection title="Methodology — how this deck plays" defaultOpen={true}>
        <MethodologySection deck={deck} save={save} cardMap={cardMap} />
      </PanelSection>

      {isMatchup && (
        <PanelSection title="Playbook — how to beat this deck"
          subtitle="Shown read-only in Format → this matchup" defaultOpen={true}>
          <PlaybookEditor deck={deck} save={save} cardPool={deckCardPool} />
        </PanelSection>
      )}

      <PanelSection title="Key cards — what to protect / what to stop" defaultOpen={false}>
        <KeyCardsSection deck={deck} save={save} cardMap={cardMap} force={force} />
      </PanelSection>

      <PanelSection title="Builds — variants of this deck" defaultOpen={false}>
        <DecklistsSection deck={deck} save={save} onChanged={onChanged} />
      </PanelSection>

      <PanelSection title="Notes — anything else about this deck" defaultOpen={false}>
        <RichNotes value={deck.notes || ""} onSave={(v) => { deck.notes = v; save(); }} minHeight={90}
          placeholder="Build rationale, side-deck plans, things to remember. Type @ to mention a card." />
      </PanelSection>

      <PanelSection title="Combos for the active build" defaultOpen={false}>
        <CombosSection deck={deck} />
      </PanelSection>
    </div>
  );
}

// ── Opening odds — exact hypergeometric deck health (primary decks) ──
// Starter/handtrap tags come from the same KB+text classification the
// key-card buckets use, counted per copy across the active build's main.
function OddsSection({ deck, cardMap }) {
  const dl = getDeckPrimaryDecklist(deck);
  const main = (dl && dl.main) || [];
  const N = main.length;
  let starters = 0, handtraps = 0, unknown = 0;
  for (const id of main) {
    const card = cardMap[Number(id)];
    if (!card) { unknown++; continue; }
    const cat = classifyKeyCardCategory(card);
    if (cat === "Starter") starters++;
    else if (cat === "Handtrap") handtraps++;
  }
  if (!N) return <div className="read-field is-empty">— no main deck yet</div>;
  const rows = [["Going 1st", 5], ["Going 2nd", 6]].map(([lbl, k]) => ({
    lbl, k,
    s1: pAtLeast(N, starters, k, 1),
    s2: pAtLeast(N, starters, k, 2),
    t1: pAtLeast(N, handtraps, k, 1),
    brick: 1 - pAtLeast(N, starters, k, 1),
  }));
  return (
    <div className="odds">
      <div className="odds-counts">
        <strong>{starters}</strong> starters · <strong>{handtraps}</strong> handtraps · {N} cards
        {unknown ? <span className="odds-unknown" title="Cards without data are counted as neither — open the decklist so they load."> · {unknown} unclassified</span> : null}
        <span className="odds-hint"> — mis-tagged? Fix it in Key cards.</span>
      </div>
      <div className="odds-grid">
        <div className="odds-head"></div><div className="odds-head">≥1 starter</div><div className="odds-head">≥2 starters</div><div className="odds-head">≥1 handtrap</div><div className="odds-head">brick (0 starters)</div>
        {rows.map((r) => (
          <FragmentRow key={r.lbl} r={r} />
        ))}
      </div>
    </div>
  );
}
function FragmentRow({ r }) {
  return (
    <>
      <div className="odds-row-label">{r.lbl} <span className="odds-k">({r.k})</span></div>
      <div className="odds-cell is-good">{pct(r.s1)}</div>
      <div className="odds-cell">{pct(r.s2)}</div>
      <div className="odds-cell">{pct(r.t1)}</div>
      <div className={"odds-cell" + (r.brick > 0.15 ? " is-bad" : "")}>{pct(r.brick)}</div>
    </>
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
            onClick={() => { const h = buildKeyRatiosHtml(deck, cardMap); if (!h) { alertModal({ title: "Auto-fill unavailable", message: "The active build has no main-deck cards (or card data hasn't loaded yet)." }); return; } m.keyRatios = h; save(); }}>
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

// Category → accent colour for the mini card border + bucket header.
const CAT_COLOR = {
  Boss: "var(--role-handtrap)", Starter: "var(--role-starter)", Extender: "var(--role-extender)",
  Handtrap: "var(--role-handtrap)", Floodgate: "var(--role-floodgate)", Tech: "var(--role-engine)",
};

function KeyCardsSection({ deck, save, cardMap, force }) {
  const total = (deck.keyCards || []).length;
  const missing = countMissingCardData(deck, cardMap);
  const doExtract = () => { deck.keyCards = extractKeyCards(deck, cardMap); save(); };
  const [preview, setPreview] = useState(null); // { card, rect, pinned }

  // Resolve a keyCard to a card object for the preview (fetched map → cache).
  const cardFor = (kc) => cardMap[Number(kc.cardId)] || lookupCardByName(kc.name) || null;
  const onHover = (card, rect) => setPreview((p) => (p && p.pinned ? p : (card ? { card, rect, pinned: false } : null)));
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  return (
    <div onMouseLeave={clearHover}>
      <div className="key-cards-toolbar">
        <span className="key-cards-status">
          {total ? `${total} card${total === 1 ? "" : "s"} bucketed` + (missing ? ` · ${missing} need data (open Cards)` : "")
            : missing ? `${missing} cards need data — card images load on open`
            : "No key cards yet — click Extract to bucket the active build."}
        </span>
        <button type="button" className="deck-inline-btn" onClick={doExtract}>{total ? "↻ Re-extract" : "Extract key cards"}</button>
      </div>
      <div className="key-cards-grid">
        {KEY_CARD_BUCKETS.map((cat) => (
          <KeyCardBucket key={cat} deck={deck} category={cat} save={save} force={force}
            cardFor={cardFor} onHover={onHover} onPick={onPick} />
        ))}
      </div>
      {preview && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}

function KeyCardBucket({ deck, category, save, force, cardFor, onHover, onPick }) {
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
    else {
      const found = lookupCardByName(n);
      deck.keyCards.push({ name: found?.name || n, cardId: found?.id ? String(found.id) : "", category, stopPriority: "none", stopWith: "", notes: "", auto: false, priority: (deck.keyCards.length) });
    }
    save(); setAdding(false);
  };
  return (
    <div className="key-cards-bucket" data-cat={category}>
      <div className="key-cards-bucket-header"><span>{category}</span><span className="count">{cards.length}</span></div>
      <div className="key-cards-list">
        {!cards.length && <div className="key-cards-empty">—</div>}
        {cards.map((kc) => (
          <KeyCardRow key={kc.name} deck={deck} kc={kc} save={save} force={force}
            cardFor={cardFor} onHover={onHover} onPick={onPick} />
        ))}
        <CardPicker buttonClass="key-cards-add-card" buttonLabel="+ Add card" placeholder="Search a card…" onAdd={(name) => addCard(name)} />
      </div>
    </div>
  );
}

const PRIORITY_RING = { high: "var(--role-stopper)", medium: "var(--warning)", none: "" };

function KeyCardRow({ deck, kc, save, force, cardFor, onHover, onPick }) {
  const [open, setOpen] = useState(false);
  const remove = () => { deck.keyCards = deck.keyCards.filter((x) => x !== kc); save(); force(); };
  const card = cardFor(kc);
  const urls = kc.cardId ? getImageUrls(Number(kc.cardId)) : (card?.id ? getImageUrls(card.id) : []);
  const border = PRIORITY_RING[kc.stopPriority] || CAT_COLOR[kc.category] || "var(--border-strong)";
  return (
    <div className="key-card-row">
      <div className="key-card-row-head">
        <div className="key-card-mini" title={kc.name} style={{ borderColor: border }}
          onMouseEnter={(e) => onHover(card, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => onHover(null)}
          onClick={(e) => onPick(card, e.currentTarget.getBoundingClientRect())}>
          {urls.length ? <img src={urls[0]} alt={kc.name} loading="lazy" /> : <span className="key-card-mini-ph">{kc.name[0]}</span>}
        </div>
        <button type="button" className="key-card-toggle" onClick={() => setOpen((o) => !o)}>
          <span className="key-card-name">{kc.name}</span>
          {kc.stopPriority && kc.stopPriority !== "none" && <span className={"key-card-pri is-" + kc.stopPriority}>{kc.stopPriority === "high" ? "stop!" : "watch"}</span>}
          {kc.auto === false && <span className="key-card-manual">manual</span>}
        </button>
        <button type="button" className="key-card-remove" title="Remove from key cards" onClick={remove}>×</button>
      </div>
      {open && (
        <div className="key-card-editor">
          <label className="key-card-edit-row">
            <span>Category</span>
            <Dropdown className="key-card-pri-dd" value={kc.category || "Tech"}
              options={KEY_CARD_BUCKETS.map((c) => [c, c])}
              onChange={(v) => { kc.category = v; kc.auto = false; save(); force(); }} />
          </label>
          <label className="key-card-edit-row">
            <span>Stop priority</span>
            <Dropdown className="key-card-pri-dd" value={kc.stopPriority || "none"}
              options={STOP_PRIORITIES.map((p) => [p, p])}
              onChange={(v) => { kc.stopPriority = v; save(); }} />
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
    catch (err) { alertModal({ title: "Couldn't add build", message: err.message }); }
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
                  onClick={async () => { if (await confirmModal({ title: `Delete build "${d.name}"?`, confirmText: "Delete build", danger: true })) { deleteDecklist(deck, d.decklistId); onChanged && onChanged(); force(); } }}>×</button>
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
