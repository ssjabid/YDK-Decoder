import { useEffect, useRef, useState } from "react";

// ════════════════════════════════════════════════════════════════════
// Reusable dropdown — replaces the browser's grey/white native <select>
// with a control that matches the app's modal/panel aesthetic. The menu
// is positioned `fixed` from the trigger's rect so it never gets clipped
// by a panel's overflow. Keyboard: ↑/↓ to move, Enter to pick, Esc to
// close. Click-outside / scroll / resize all dismiss it.
//   options: ["a","b"] | [["v","Label"]] | [{ value, label }]
// ════════════════════════════════════════════════════════════════════
function normOpts(options) {
  return (options || []).map((o) => {
    if (Array.isArray(o)) return { value: o[0], label: o[1] };
    if (o && typeof o === "object") return { value: o.value, label: o.label ?? String(o.value) };
    return { value: o, label: String(o) };
  });
}

export default function Dropdown({
  value, onChange, options, placeholder = "Select…", className = "",
  align = "left", disabled = false, ariaLabel, title,
}) {
  const opts = normOpts(options);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(0);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const selIdx = opts.findIndex((o) => String(o.value) === String(value));
  const current = selIdx >= 0 ? opts[selIdx] : null;

  const openMenu = () => {
    if (disabled) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    setActive(selIdx >= 0 ? selIdx : 0);
    setOpen(true);
  };
  const pick = (v) => { onChange && onChange(v); setOpen(false); btnRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const dismiss = () => setOpen(false);
    // Close on OUTSIDE scroll only — scrolling within the menu (mouse wheel or
    // its own scrollbar) must NOT dismiss it.
    const onScroll = (e) => { if (popRef.current && popRef.current.contains(e.target)) return; setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
      return;
    }
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(opts.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (opts[active]) pick(opts[active].value); }
  };

  const menuStyle = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + 5, window.innerHeight - 12),
        minWidth: rect.width,
        ...(align === "right"
          ? { right: Math.max(8, window.innerWidth - rect.right) }
          : { left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) }),
      }
    : {};

  return (
    <span className={"dd " + className}>
      <button
        ref={btnRef} type="button" className={"dd-trigger" + (open ? " is-open" : "")}
        disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} title={title}
        onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKeyDown}
      >
        <span className={"dd-value" + (current ? "" : " is-placeholder")}>{current ? current.label : placeholder}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open && (
        <div ref={popRef} className="dd-menu" style={menuStyle} role="listbox">
          {opts.length ? opts.map((o, i) => (
            <button
              key={String(o.value)} type="button" role="option"
              aria-selected={i === selIdx}
              className={"dd-option" + (i === selIdx ? " is-selected" : "") + (i === active ? " is-active" : "")}
              onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}
            >
              <span className="dd-option-label">{o.label}</span>
              {i === selIdx && <span className="dd-check">✓</span>}
            </button>
          )) : <div className="dd-empty">No options</div>}
        </div>
      )}
    </span>
  );
}
