import { useState } from "react";

// Collapsible section with an animated chevron + body — mirrors the
// original deck-panel-section. `defaultOpen` controls initial state.
export default function PanelSection({ title, subtitle, defaultOpen = true, right, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={"panel-section" + (open ? "" : " is-collapsed")}>
      <div className="panel-section-header" role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}>
        <span className="panel-section-title">{title}</span>
        {subtitle && <span className="panel-section-sub">{subtitle}</span>}
        {right && <span className="panel-section-right" onClick={(e) => e.stopPropagation()}>{right}</span>}
        <span className="panel-section-chevron">▾</span>
      </div>
      <div className="panel-section-body">{children}</div>
    </section>
  );
}
