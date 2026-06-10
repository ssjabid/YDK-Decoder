import { useEffect, useRef, useState } from "react";
import { getImageUrls } from "../lib/ydk.js";
import { searchLocal, searchApi, lookupCardByName } from "../lib/cardSearch.js";
import CardPreview from "./CardPreview.jsx";

// Light-touch sanitizer — keeps the formatting tags the editor produces,
// strips active content (scripts, inline handlers, javascript: URLs).
// Defense-in-depth: stored notes round-trip through innerHTML, and HTML can
// arrive from outside via imported backups / pasted combo JSON.
export function sanitizeNotesHtml(html) {
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, "");
}

// Plain text → <p> (preserving blank-line paragraphs + <br>); HTML passes
// through sanitized. Idempotent.
export function normalizeNotesHtml(raw) {
  if (!raw) return "";
  if (/<[a-z][^>]*>/i.test(raw)) return sanitizeNotesHtml(raw); // already HTML
  const esc = String(raw).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
}

// ════════════════════════════════════════════════════════════════════
// Reusable rich-text notes editor. Bold/italic/lists + @-mention card
// chips (type @ → search any card → insert a hoverable/pinnable chip).
// Uncontrolled contentEditable: innerHTML is set imperatively so the
// caret never jumps; onSave fires the stored HTML (debounced + on blur).
// ════════════════════════════════════════════════════════════════════
export default function RichNotes({ value, onSave, placeholder, minHeight = 58 }) {
  const ref = useRef(null);
  const focused = useRef(false);
  const saveTimer = useRef(null);
  const [mention, setMention] = useState(null); // { items, activeIdx, query, rect }
  const mentionRef = useRef(null);
  mentionRef.current = mention;
  const [preview, setPreview] = useState(null); // { card, rect, pinned }
  const [expanded, setExpanded] = useState(false);

  // Set initial HTML on mount + on external value change (only when the
  // editor isn't focused, so typing is never clobbered — e.g. autofill).
  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    const html = normalizeNotesHtml(value || "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const fireSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { if (ref.current) onSave(ref.current.innerHTML); }, 400);
  };

  // Walk back from the caret to the triggering "@" and capture the token.
  const caretQuery = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const node = r.endContainer;
    if (!ref.current || !ref.current.contains(node) || node.nodeType !== 3) return null;
    const text = node.textContent.slice(0, r.endOffset);
    const at = text.lastIndexOf("@");
    if (at < 0) return null;
    const query = text.slice(at + 1);
    if (/\s/.test(query)) return null; // single-token mentions only
    return { node, atOffset: at, query, rect: r.getBoundingClientRect() };
  };

  const apiTimer = useRef(null);
  const detectMention = () => {
    const ctx = caretQuery();
    if (!ctx) { setMention(null); return; }
    setMention({ query: ctx.query, items: searchLocal(ctx.query, 10), activeIdx: 0, rect: ctx.rect });
    if (ctx.query.length >= 3) {
      // Debounced — local results stay instant, the API fires once per pause.
      clearTimeout(apiTimer.current);
      apiTimer.current = setTimeout(() => {
        searchApi(ctx.query).then(() => {
          const cur = caretQuery();
          if (!cur || cur.query !== ctx.query) return; // user moved on
          setMention((m) => (m ? { ...m, items: searchLocal(ctx.query, 10) } : m));
        });
      }, 300);
    }
  };

  const commitMention = (card) => {
    const ctx = caretQuery();
    if (!ctx || !card) { setMention(null); return; }
    const node = ctx.node;
    const before = node.textContent.slice(0, ctx.atOffset);
    const after = node.textContent.slice(ctx.atOffset + 1 + ctx.query.length);
    const chip = document.createElement("span");
    chip.className = "rt-card-mention";
    chip.dataset.card = card.name;
    chip.contentEditable = "false";
    chip.title = card.name;
    const urls = card.id ? getImageUrls(card.id) : [];
    if (urls.length) {
      const img = document.createElement("img");
      img.src = urls[0]; img.alt = card.name; img.loading = "lazy";
      chip.appendChild(img);
    } else {
      const fb = document.createElement("span");
      fb.className = "rt-card-mention-fallback"; fb.textContent = "?";
      chip.appendChild(fb);
    }
    chip.appendChild(document.createTextNode(card.name));
    const afterNode = document.createTextNode(" " + after);
    const parent = node.parentNode;
    parent.insertBefore(afterNode, node);
    parent.insertBefore(chip, afterNode);
    if (before) parent.insertBefore(document.createTextNode(before), chip);
    parent.removeChild(node);
    // Caret just after the chip.
    const nr = document.createRange();
    nr.setStart(afterNode, 1); nr.collapse(true);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(nr);
    setMention(null);
    if (ref.current) onSave(ref.current.innerHTML);
  };

  const exec = (cmd, arg) => {
    ref.current?.focus();
    try { document.execCommand(cmd, false, arg == null ? null : arg); } catch (_) { /* noop */ }
    fireSave();
  };
  const insertAt = () => { ref.current?.focus(); try { document.execCommand("insertText", false, "@"); } catch (_) {} detectMention(); };

  const onKeyDown = (e) => {
    e.stopPropagation(); // keep app-level key handlers out of the editor
    const m = mentionRef.current;
    if (!m) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMention((s) => ({ ...s, activeIdx: Math.min(s.items.length - 1, s.activeIdx + 1) })); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMention((s) => ({ ...s, activeIdx: Math.max(0, s.activeIdx - 1) })); }
    else if (e.key === "Enter") { if (m.items[m.activeIdx]) { e.preventDefault(); commitMention(m.items[m.activeIdx]); } }
    else if (e.key === "Escape") { e.preventDefault(); setMention(null); }
  };

  // Hover/click a chip → show/pin the big card preview.
  const chipFromEvent = (e) => (e.target.closest ? e.target.closest(".rt-card-mention") : null);
  const onMouseOver = (e) => {
    const chip = chipFromEvent(e); if (!chip) return;
    const card = lookupCardByName(chip.dataset.card); if (!card) return;
    setPreview((p) => (p && p.pinned ? p : { card, rect: chip.getBoundingClientRect(), pinned: false }));
  };
  const onChipClick = (e) => {
    const chip = chipFromEvent(e); if (!chip) return;
    const card = lookupCardByName(chip.dataset.card); if (!card) return;
    setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect: chip.getBoundingClientRect(), pinned: true }));
  };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));

  return (
    <>
      {expanded && <div className="rt-backdrop" onClick={() => setExpanded(false)} />}
      <div className={"rt-editor" + (expanded ? " is-expanded" : "")}>
        <div className="rt-toolbar">
          <button type="button" className="rt-btn" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></button>
          <button type="button" className="rt-btn" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></button>
          <span className="rt-div" />
          <button type="button" className="rt-btn" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>•</button>
          <button type="button" className="rt-btn" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>1.</button>
          <span className="rt-div" />
          <button type="button" className="rt-btn rt-btn-at" title="Mention a card (@)" onMouseDown={(e) => e.preventDefault()} onClick={insertAt}>@</button>
          <button type="button" className="rt-btn rt-btn-expand" title={expanded ? "Collapse" : "Expand to a large editor"} onMouseDown={(e) => e.preventDefault()} onClick={() => setExpanded((v) => !v)}>{expanded ? "⤡" : "⤢"}</button>
        </div>
      <div
        ref={ref}
        className="rt-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={() => { fireSave(); detectMention(); }}
        onKeyDown={onKeyDown}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; clearTimeout(saveTimer.current); if (ref.current) onSave(ref.current.innerHTML); setMention(null); }}
        onMouseOver={onMouseOver}
        onMouseLeave={clearHover}
        onClick={onChipClick}
      />

      {mention && (
        <div className="rt-mention-dropdown" style={{ position: "fixed", left: Math.min(mention.rect.left, window.innerWidth - 280), top: Math.min(mention.rect.bottom + 4, window.innerHeight - 260) }}>
          {mention.items.length ? mention.items.map((c, i) => {
            const urls = c.id ? getImageUrls(c.id) : [];
            return (
              <button key={(c.id || c.name) + ""} type="button" className={"rt-mention-item" + (i === mention.activeIdx ? " is-active" : "")}
                onMouseDown={(e) => e.preventDefault()} onClick={() => commitMention(c)}>
                {urls.length ? <img src={urls[0]} alt="" loading="lazy" /> : <span className="rt-mention-item-fallback">?</span>}
                <span className="rt-mention-item-name">{c.name}</span>
                {c.type && <span className="rt-mention-item-meta">{c.type.split(" ")[0]}</span>}
              </button>
            );
          }) : (
            <div className="rt-mention-empty">{mention.query ? `No cards match "@${mention.query}"` : "Type a card name…"}</div>
          )}
        </div>
      )}

        {preview && preview.card && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
      </div>
    </>
  );
}
