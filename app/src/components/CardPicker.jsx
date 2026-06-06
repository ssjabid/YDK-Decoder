import { useEffect, useRef, useState } from "react";
import { searchLocal, searchApi, lookupCardByName } from "../lib/cardSearch.js";
import { getImageUrls } from "../lib/ydk.js";

// ════════════════════════════════════════════════════════════════════
// CardPicker — "+ Add" button that expands to a live card-search input.
// Searches the local cache instantly AND the YGOPRODeck fuzzy-name API, so
// you can add ANY card (even one not yet in the cache, e.g. "Fallen of the
// Virtuous"). Pick from the dropdown → onAdd(cardName). Used everywhere a
// card is added: end boards, good-cards, key cards, etc.
// ════════════════════════════════════════════════════════════════════
export default function CardPicker({ onAdd, placeholder = "Type a card name…", buttonLabel = "+ Add", buttonClass = "fmt-add-btn", pool = null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const wrapRef = useRef(null);

  const close = () => { setOpen(false); setQ(""); setItems([]); };

  // Search local first; hit the API (which caches) for queries ≥ 3 chars,
  // then re-read the now-warmer local index.
  const scoped = Array.isArray(pool) && pool.length > 0;

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    // Deck-scoped: search ONLY within the provided pool (the decklist) — no API.
    if (scoped) {
      const lc = query.toLowerCase();
      const names = lc ? pool.filter((n) => n.toLowerCase().includes(lc)) : pool;
      setItems(names.slice(0, 40).map((n) => lookupCardByName(n) || { name: n }));
      setActive(0);
      return;
    }
    setItems(searchLocal(query, 16));
    setActive(0);
    if (query.length >= 3) {
      let alive = true;
      searchApi(query).then(() => { if (alive && q.trim() === query) setItems(searchLocal(query, 16)); });
      return () => { alive = false; };
    }
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position the popover from the input; close on outside mousedown.
  useEffect(() => {
    if (!open) return;
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    const onDoc = (e) => { if (wrapRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; close(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (c) => { if (c && c.name) onAdd(c.name); close(); };
  const commitFree = () => { const v = q.trim(); if (!v) return; const hit = searchLocal(v, 1)[0]; onAdd(hit ? hit.name : v); close(); };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) pick(items[active]); else commitFree(); }
  };

  if (!open) return <button type="button" className={buttonClass} onClick={() => setOpen(true)}>{buttonLabel}</button>;

  const menuStyle = rect ? {
    position: "fixed",
    top: Math.min(rect.bottom + 4, window.innerHeight - 300),
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)),
    width: 300,
  } : {};

  return (
    <span className="cardpick" ref={wrapRef}>
      <input ref={inputRef} className="fmt-add-input is-wide" autoFocus value={q} placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} />
      <div ref={popRef} className="rt-mention-dropdown cardpick-menu" style={menuStyle} role="listbox">
        {items.length ? items.map((c, i) => {
          const urls = c.id ? getImageUrls(c.id) : [];
          return (
            <button key={(c.id || c.name) + ""} type="button" className={"rt-mention-item" + (i === active ? " is-active" : "")}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
              {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : <span className="rt-mention-item-fallback">?</span>}
              <span className="rt-mention-item-name">{c.name}</span>
              {c.type && <span className="rt-mention-item-meta">{c.type.split(" ")[0]}</span>}
            </button>
          );
        }) : <div className="rt-mention-empty">{scoped ? `No card in this deck matches "${q.trim()}"` : (q.trim().length < 3 ? "Type at least 3 letters…" : `No match for "${q.trim()}" yet…`)}</div>}
      </div>
    </span>
  );
}
