import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadDecks } from "../lib/storage.js";
import {
  loadSavedCombos, VIEW_MODES, comboKey, comboTitle, comboOpeningHand, comboOpenerSize,
  comboEndboard, comboAllCards, isCoreStep, stepCards, groupCombos, comboSearchHaystack,
  renameCombo, setComboDeck, setComboNotes, setComboOpenerSize, deleteCombo, importCombosJson,
} from "../lib/combos.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { lookupCardByName, searchApi } from "../lib/cardSearch.js";
import { confirmModal, promptModal, alertModal } from "../lib/modal.js";
import CardPreview from "../components/CardPreview.jsx";
import EndBoardView from "../components/EndBoardView.jsx";
import Dropdown from "../components/Dropdown.jsx";
import RichNotes from "../components/RichNotes.jsx";
import Icon from "../components/Icon.jsx";

const OPENER_OPTS = [["", "Auto"], [1, "1-card"], [2, "2-card"], [3, "3-card"], [4, "4-card"]];
const fmtDate = (s) => (s ? String(s).slice(0, 10) : "");

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
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const { combos, decks, deckNames } = useMemo(() => {
    const combos = loadSavedCombos();
    const decks = loadDecks();
    const deckNames = {};
    decks.forEach((d) => { deckNames[d.deckId] = d.name; });
    return { combos, decks, deckNames };
  }, [dataVersion, rev]);

  const onHover = (card, rect) => { if (card) setPreview((p) => (p && p.pinned ? p : { card, rect, pinned: false })); };
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  const q = search.trim().toLowerCase();
  const matches = (c) =>
    (deckFilter === "all" || (c.deckId || "") === deckFilter) &&
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

  const deckFilterOpts = [["all", "All decks"], ...decks.map((d) => [d.deckId, d.name])];

  return (
    <div className="combos-tab" onMouseLeave={clearHover}>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImportFile} />

      <div className="combos-toolbar">
        <Dropdown className="combos-deck-dd" value={deckFilter} options={deckFilterOpts} onChange={setDeckFilter} ariaLabel="Filter by deck" />
        <div className="combo-search-wrap">
          <input className="combo-search-input" placeholder="Search combos + cards…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          {search && <button type="button" className="combo-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>
        <span className="combos-toolbar-spacer" />
        <button type="button" className="btn-secondary" onClick={onPasteImport}>Paste JSON</button>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><Icon name="summon" size={15} /> Import .json</button>
      </div>

      {!combos.length ? (
        <div className="placeholder">
          No combos yet. Extract one with the <strong>Chrome extension</strong> on a DuelingBook replay
          (it writes straight into here), or <button type="button" className="link-btn" onClick={onPasteImport}>paste combo JSON</button>.
        </div>
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
                    deckName={deckNames[c.deckId]} onClick={() => setSelKey(comboKey(c, i))} />
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
  const [renaming, setRenaming] = useState(false);

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
      for (const n of missing.slice(0, 40)) { try { const r = await searchApi(n); if (r && r.length) got = true; } catch (_) {} }
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

  const deckOpts = [["", "— not linked —"], ...decks.filter((d) => (d.role || "primary") === "primary").map((d) => [d.deckId, d.name])];

  return (
    <div className="combo-detail">
      <div className="combo-detail-bar">
        <h2 className="combo-detail-title" title="Click to rename" onClick={rename}>{comboTitle(c)}</h2>
        <Dropdown className="combo-view-dd" value={view} options={VIEW_MODES} onChange={setView} ariaLabel="View mode" />
        {c.replayUrl && <a className="combo-replay-link" href={c.replayUrl} target="_blank" rel="noreferrer" title="Open the DuelingBook replay">↗ replay</a>}
        <button type="button" className="back-btn is-danger" onClick={remove}>× Delete</button>
      </div>

      <div className="combo-meta-row">
        <label className="combo-meta-field">
          <span>Deck</span>
          <Dropdown className="combo-deck-dd" value={c.deckId || ""} options={deckOpts} placeholder="— not linked —"
            onChange={(v) => { setComboDeck(idx, v); onChange(); }} />
        </label>
        <label className="combo-meta-field">
          <span>Opener size</span>
          <Dropdown className="combo-opener-dd" value={c.userOpenerSize == null ? "" : c.userOpenerSize}
            options={OPENER_OPTS} onChange={(v) => { setComboOpenerSize(idx, v === "" ? null : Number(v)); onChange(); }} />
        </label>
        <span className="combo-meta-info">{(c.steps || []).length} steps{c.extractedAt ? ` · extracted ${fmtDate(c.extractedAt)}` : ""}</span>
      </div>

      {!!hand.length && (
        <section className="combo-block">
          <div className="combo-block-label">Opening hand</div>
          <div className="combo-hand-row">{hand.map((n, i) => <Thumb key={i} name={n} onHover={onHover} onPick={onPick} />)}</div>
        </section>
      )}

      <section className="combo-block">
        <div className="combo-block-label">The line <span className="combo-block-hint">{steps.length} {view === "core" ? "key plays" : "steps"}</span></div>
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
