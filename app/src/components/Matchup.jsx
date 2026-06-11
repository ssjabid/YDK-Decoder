import { useState } from "react";
import { lookupCardByName } from "../lib/cardSearch.js";
import { getImageUrls } from "../lib/ydk.js";
import RichNotes, { normalizeNotesHtml } from "./RichNotes.jsx";
import EndBoardView, { ZONE_OPTIONS } from "./EndBoardView.jsx";
import Dropdown from "./Dropdown.jsx";
import CardPicker from "./CardPicker.jsx";
import CardPreview from "./CardPreview.jsx";

const rid = () => Math.random().toString(36).slice(2, 8);

// ════════════════════════════════════════════════════════════════════
// Matchup playbook — shared between the Decks tab (where it's EDITED, on
// the opponent deck's methodology = single source of truth) and the
// Format tab (where it's shown READ-ONLY in the matchup dashboard).
// getPlaybook() reads deck-first and falls back to any legacy data still
// stored on the format matchup, so nothing is lost.
// ════════════════════════════════════════════════════════════════════
const has = (v) => v != null && String(v).trim() !== "";
const txt = (a, b) => (has(a) ? a : (b || ""));
const list = (a, b) => (Array.isArray(a) && a.length ? a : (Array.isArray(b) ? b : []));

export function getPlaybook(m, deck) {
  const meth = (deck && deck.methodology) || {};
  m = m || {};
  const ebDeck = Array.isArray(meth.endboards) && meth.endboards.length ? meth.endboards : null;
  const ebMatch = Array.isArray(m.endboards) && m.endboards.length ? m.endboards
    : (Array.isArray(m.targetEndboard) && m.targetEndboard.length
        ? [{ id: "seed", name: "Typical board", cards: m.targetEndboard.slice() }] : []);
  const rawGood = list(meth.goodCards, m.counterCards);
  return {
    chokepoint: txt(meth.vsChokepoint, m.chokepointTheirs),
    planFirst: txt(meth.vsPlanFirst, m.gameplanFirst),
    planSecond: txt(meth.vsPlanSecond, m.gameplanSecond),
    priorityFirst: list(meth.vsPriorityFirst, m.priorityFirst),
    prioritySecond: list(meth.vsPrioritySecond, m.prioritySecond),
    goodCards: rawGood.filter((c) => c && c.side !== "bad").map((c) => ({ name: c.name, notes: c.notes || c.reason || "" })),
    endboards: ebDeck || ebMatch,
    ifThen: list(meth.vsIfThen),
    notes: txt(meth.vsNotes, m.freeformNotes),
  };
}

// First end board flattened to card names — feeds the Testing board breaker.
export function endboardNames(m, deck) {
  const pb = getPlaybook(m, deck);
  const b = pb.endboards[0];
  if (!b) return [];
  return (b.cards || []).map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
}

// ── Card chip + add-by-name input (shared) ──────────────────────────
export function CardChip({ name, onHover, onPick, onRemove, tone, plain }) {
  const c = lookupCardByName(name);
  const urls = c?.id ? getImageUrls(c.id) : [];
  return (
    <span
      className={"fmt-chip" + (tone ? " is-" + tone : "") + (plain ? " is-plain" : "")}
      onMouseEnter={(e) => onHover && onHover(c, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={(e) => onPick && onPick(c, e.currentTarget.getBoundingClientRect())}
    >
      {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : null}
      <span className="fmt-chip-name">{name}</span>
      {onRemove && <button type="button" className="fmt-chip-x" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>}
    </span>
  );
}

export function CardAddInput({ onAdd, placeholder, wide }) {
  const [adding, setAdding] = useState(false);
  if (!adding) return <button type="button" className="fmt-add-btn" onClick={() => setAdding(true)}>+ Add</button>;
  const commit = (v) => { const t = v.trim(); if (t) onAdd((lookupCardByName(t) || {}).name || t); setAdding(false); };
  return (
    <input
      className={"fmt-add-input" + (wide ? " is-wide" : "")} autoFocus placeholder={placeholder || "Card name, Enter"}
      onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
      onBlur={(e) => commit(e.target.value)}
    />
  );
}

// ── Read-only rich-text field (edited in the Decks tab) with expand ──
export function ReadField({ label, value, hint }) {
  const [open, setOpen] = useState(false);
  const present = has(value);
  return (
    <div className="drill-field">
      <div className="drill-label">
        {label}
        {present ? <button type="button" className="read-expand" title="Expand" onClick={() => setOpen(true)}>⤢</button> : null}
      </div>
      {present
        ? <div className="read-field" dangerouslySetInnerHTML={{ __html: normalizeNotesHtml(value) }} />
        : <div className="read-field is-empty">{hint || "— set in Decks"}</div>}
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

// ── Priority steps: editable + read-only ────────────────────────────
export function StepEditor({ label, steps, onChange }) {
  const [adding, setAdding] = useState(false);
  const commit = (v) => { const t = v.trim(); if (t) onChange([...(steps || []), t]); setAdding(false); };
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <ol className="fmt-steps">
        {(steps || []).map((s, i) => (
          <li key={i} className="fmt-step"><span className="fmt-step-text">{s}</span>
            <button type="button" className="fmt-chip-x" onClick={() => onChange(steps.filter((_, j) => j !== i))}>×</button></li>
        ))}
      </ol>
      {adding ? (
        <input className="fmt-add-input is-wide" autoFocus placeholder="Step, then Enter"
          onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); else if (e.key === "Escape") setAdding(false); else e.stopPropagation(); }}
          onBlur={(e) => commit(e.target.value)} />
      ) : <button type="button" className="fmt-add-btn" onClick={() => setAdding(true)}>+ Add step</button>}
    </div>
  );
}

export function StepView({ label, steps }) {
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      {steps && steps.length
        ? <ol className="fmt-steps is-view">{steps.map((s, i) => <li key={i} className="fmt-step"><span className="fmt-step-text">{s}</span></li>)}</ol>
        : <div className="read-field is-empty">— no steps yet</div>}
    </div>
  );
}

// ── Mid-game "If / Then" calls: editable + read-only ────────────────
// The decision tree you actually recall at the table: "they resolved
// Fuwalos → pivot to the short line". Rows: { id, going, when, then }.
const GOING_OPTS = [["any", "Either"], ["first", "Going 1st"], ["second", "Going 2nd"]];
const goingBadge = (g) => (g === "first" ? "1st" : g === "second" ? "2nd" : "—");

export function IfThenEditor({ rows, onChange }) {
  const patch = (id, p) => onChange((rows || []).map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = () => onChange([...(rows || []), { id: "it_" + rid(), going: "any", when: "", then: "" }]);
  return (
    <div className="ifthen">
      {(rows || []).map((r) => (
        <div className="ifthen-row" key={r.id}>
          <Dropdown className="ifthen-going-dd" value={r.going || "any"} options={GOING_OPTS} onChange={(v) => patch(r.id, { going: v })} />
          <span className="ifthen-word">If</span>
          <input className="ifthen-input" defaultValue={r.when} placeholder="they resolve Fuwalos…"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => patch(r.id, { when: e.target.value })} />
          <span className="ifthen-word is-then">→</span>
          <input className="ifthen-input" defaultValue={r.then} placeholder="commit only the short line…"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => patch(r.id, { then: e.target.value })} />
          <button type="button" className="fmt-chip-x" title="Remove" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>×</button>
        </div>
      ))}
      <button type="button" className="fmt-add-btn" onClick={add}>+ Add a call</button>
    </div>
  );
}

export function IfThenView({ rows }) {
  const real = (rows || []).filter((r) => has(r.when) || has(r.then));
  if (!real.length) return <div className="read-field is-empty">— none yet (add them in Decks)</div>;
  return (
    <div className="ifthen is-view">
      {real.map((r) => (
        <div className="ifthen-row is-view" key={r.id}>
          <span className={"ifthen-badge is-" + (r.going || "any")}>{goingBadge(r.going)}</span>
          <span className="ifthen-text"><span className="ifthen-word">If</span> {r.when} <span className="ifthen-word is-then">→</span> {r.then}</span>
        </div>
      ))}
    </div>
  );
}

// ── "Cards that are really good here": editable + read-only ─────────
export function GoodCardsEditor({ cards, onChange, onHover, onPick }) {
  const setReason = (i, reason) => onChange((cards || []).map((c, j) => (j === i ? { ...c, notes: reason } : c)));
  const remove = (i) => onChange((cards || []).filter((_, j) => j !== i));
  return (
    <div className="rg-list">
      {(cards || []).map((c, i) => (
        <div className="rg-row" key={i}>
          <CardChip name={c.name} tone="good" plain onHover={onHover} onPick={onPick} onRemove={() => remove(i)} />
          <input className="rg-reason" defaultValue={c.notes || c.reason || ""} placeholder="why it's good here…"
            onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => setReason(i, e.target.value)} />
        </div>
      ))}
      <CardPicker placeholder="Search any card…" onAdd={(name) => onChange([...(cards || []), { name, notes: "" }])} />
    </div>
  );
}

export function GoodCardsView({ cards, onHover, onPick }) {
  if (!cards || !cards.length) return <div className="read-field is-empty">— none yet</div>;
  return (
    <div className="rg-list">
      {cards.map((c, i) => (
        <div className="rg-row is-view" key={i}>
          <CardChip name={c.name} tone="good" plain onHover={onHover} onPick={onPick} />
          {has(c.notes) ? <span className="rg-reason-view">{c.notes}</span> : <span className="rg-reason-view is-empty">—</span>}
        </div>
      ))}
    </div>
  );
}

// ── End boards: editable (visual + zone pickers) + read-only ────────
export function EndBoardsEditor({ boards, onChange, onHover, onPick, pool }) {
  const setBoard = (bi, patch) => onChange(boards.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  const setCards = (bi, cards) => setBoard(bi, { cards });
  return (
    <div className="endboards">
      {(boards || []).map((b, bi) => {
        const cards = b.cards || [];
        return (
          <div className="endboard" key={b.id || bi}>
            <div className="endboard-head">
              <input className="endboard-name" defaultValue={b.name || "Board " + (bi + 1)} onKeyDown={(e) => e.stopPropagation()}
                onBlur={(e) => setBoard(bi, { name: e.target.value.trim() || b.name })} />
              {boards.length > 1 && <button type="button" className="fmt-chip-x" title="Remove this board" onClick={() => onChange(boards.filter((_, i) => i !== bi))}>×</button>}
            </div>
            <EndBoardView cards={cards} onHover={onHover} onPick={onPick} />
            <div className="eb-edit-rows">
              {cards.map((c, ci) => {
                const card = typeof c === "string" ? { name: c } : c;
                return (
                  <div className="eb-edit-row" key={ci}>
                    <CardChip name={card.name} plain onHover={onHover} onPick={onPick} />
                    <Dropdown className="eb-zone-dd" value={card.zone || "auto"} options={ZONE_OPTIONS}
                      onChange={(z) => setCards(bi, cards.map((x, j) => (j === ci ? { name: card.name, zone: z } : (typeof x === "string" ? { name: x } : x))))} />
                    <button type="button" className="fmt-chip-x" title="Remove card" onClick={() => setCards(bi, cards.filter((_, j) => j !== ci))}>×</button>
                  </div>
                );
              })}
              <CardPicker pool={pool} placeholder={pool && pool.length ? "Pick a card from this deck…" : "Search a board piece…"}
                onAdd={(name) => setCards(bi, [...cards, { name, zone: "auto" }])} />
            </div>
          </div>
        );
      })}
      <button type="button" className="fmt-add-btn is-block" onClick={() => onChange([...(boards || []), { id: "eb_" + rid(), name: "Board " + ((boards || []).length + 1), cards: [] }])}>+ Add another end board</button>
    </div>
  );
}

export function EndBoardsView({ boards, onHover, onPick }) {
  if (!boards || !boards.length) return <div className="read-field is-empty">— none yet (build it in Decks)</div>;
  return (
    <div className="endboards is-view">
      {boards.map((b, bi) => (
        <div className="endboard is-view" key={b.id || bi}>
          {boards.length > 1 || (b.name && b.name !== "Typical board") ? <div className="endboard-view-name">{b.name || "Board " + (bi + 1)}</div> : null}
          <EndBoardView cards={b.cards || []} onHover={onHover} onPick={onPick} />
        </div>
      ))}
    </div>
  );
}

// ── Game plan read-only (Format dashboard) ──────────────────────────
export function GamePlanView({ pb }) {
  return (
    <div className="dash-2up">
      <ReadField label="Chokepoint — what to Ash / stop" value={pb.chokepoint} />
      <ReadField label="Going first vs them" value={pb.planFirst} />
      <ReadField label="Going second — break their board" value={pb.planSecond} />
      <div className="dash-spacer" />
      <StepView label="Priority plays — going first" steps={pb.priorityFirst} />
      <StepView label="Priority plays — going second" steps={pb.prioritySecond} />
    </div>
  );
}

// Editable rich-text field (Decks playbook editor).
function EditField({ label, value, onSave }) {
  return (
    <div className="drill-field">
      <div className="drill-label">{label}</div>
      <RichNotes value={value || ""} placeholder="Notes… @ for cards" onSave={onSave} />
    </div>
  );
}

// ── Full playbook editor — lives in the Decks tab for matchup decks.
//    Writes to the opponent deck's methodology (single source of truth that
//    the Format dashboard reads). Owns its own card preview. ──
export function PlaybookEditor({ deck, save, cardPool }) {
  const meth = deck.methodology || (deck.methodology = {});
  const [preview, setPreview] = useState(null);
  const onHover = (card, rect) => setPreview((p) => (p && p.pinned ? p : (card ? { card, rect, pinned: false } : null)));
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clear = () => setPreview((p) => (p && p.pinned ? p : null));
  const set = (k, v) => { meth[k] = v; save(); };
  return (
    <div className="playbook-editor" onMouseLeave={clear}>
      <div className="pb-group">
        <div className="pb-group-title">Game plan — your plan vs this deck</div>
        <div className="dash-2up">
          <EditField label="Chokepoint — what to Ash / stop" value={meth.vsChokepoint} onSave={(v) => set("vsChokepoint", v)} />
          <EditField label="Going first vs them" value={meth.vsPlanFirst} onSave={(v) => set("vsPlanFirst", v)} />
          <EditField label="Going second — break their board" value={meth.vsPlanSecond} onSave={(v) => set("vsPlanSecond", v)} />
          <div className="dash-spacer" />
          <StepEditor label="Priority plays — going first" steps={meth.vsPriorityFirst || []} onChange={(s) => set("vsPriorityFirst", s)} />
          <StepEditor label="Priority plays — going second" steps={meth.vsPrioritySecond || []} onChange={(s) => set("vsPrioritySecond", s)} />
        </div>
      </div>

      <div className="pb-group">
        <div className="pb-group-title">Mid-game calls — if / then</div>
        <IfThenEditor rows={meth.vsIfThen || []} onChange={(r) => set("vsIfThen", r)} />
      </div>

      <div className="pb-group">
        <div className="pb-group-title">Their end boards</div>
        <EndBoardsEditor boards={meth.endboards || []} onChange={(b) => set("endboards", b)} onHover={onHover} onPick={onPick} pool={cardPool} />
      </div>

      <div className="pb-group">
        <div className="pb-group-title">Cards that are really good here</div>
        <GoodCardsEditor cards={meth.goodCards || []} onChange={(c) => set("goodCards", c)} onHover={onHover} onPick={onPick} />
      </div>

      <div className="pb-group">
        <div className="pb-group-title">Your notes / scouting vs this deck</div>
        <RichNotes value={meth.vsNotes || ""} placeholder="Scouting notes… @ for cards"
          onSave={(v) => set("vsNotes", v)} minHeight={90} />
      </div>

      {preview && preview.card && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}
