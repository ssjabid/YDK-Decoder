import { useEffect } from "react";
import { getImageUrls } from "../lib/ydk.js";
import { classify, ROLE_COLORS } from "../lib/classify.js";
import { getCardSummary } from "../lib/cardFx.js";
import { registerEsc } from "../lib/escStack.js";

// Floating card preview (large image + role chips + effect text). Shared by
// CardsView and the Testing tab so hover/pin behaves identically everywhere.
// `rect` is the hovered/clicked tile's bounding rect. When `pinned`, it stays
// put and becomes clickable (click to dismiss).
export default function CardPreview({ card, rect, pinned, onClose }) {
  // When pinned, a mousedown anywhere outside the preview dismisses it (so
  // clicking out of "hover/pin mode" exits it). Deferred a tick so the click
  // that pinned it doesn't immediately close it.
  useEffect(() => {
    if (!pinned || !onClose) return;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest(".card-preview")) return;
      // Swallow the follow-up click: without this, clicking another card while
      // pinned closes the pin on mousedown and the click instantly RE-pins to
      // that card — the second click "sticks". A pinned preview's next click,
      // anywhere, should only dismiss.
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); cleanup(); };
      const cleanup = () => { document.removeEventListener("click", swallow, true); clearTimeout(tid); };
      const tid = setTimeout(cleanup, 600); // safety: no click followed (drag etc.)
      document.addEventListener("click", swallow, true);
      onClose();
    };
    const id = setTimeout(() => document.addEventListener("mousedown", onDown, true), 0);
    const unEsc = registerEsc(onClose); // Esc dismisses a pinned preview (peels off first)
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown, true); unEsc(); };
  }, [pinned, onClose]);

  if (!card) return null;
  const urls = getImageUrls(card.id);
  const cls = classify(card);
  // Flip to the left if the tile is in the right half of the viewport.
  const onRight = rect.left > window.innerWidth / 2;
  const style = {
    position: "fixed",
    // Keep it high enough that the (scrollable) panel fits within the viewport.
    top: Math.max(12, Math.min(rect.top - 24, window.innerHeight * 0.12)),
    [onRight ? "right" : "left"]: onRight ? (window.innerWidth - rect.left + 14) : (rect.right + 14),
  };
  const fullText = (card.desc || "").trim() || cls.stripped[0] || "(no effect text)";
  const summary = getCardSummary(card.name);
  return (
    <div className={"card-preview" + (pinned ? " is-pinned" : "")} style={style}
      onClick={pinned && onClose ? onClose : undefined}>
      {urls[0] && <img className="card-preview-img" src={urls[0]} alt="" />}
      <div className="card-preview-body">
        <div className="card-preview-name">{card.name}</div>
        {(card.type || card.race || card.attribute) && (
          <div className="card-preview-meta">
            {[card.type, card.race, card.attribute].filter(Boolean).join(" · ")}
            {card.atk != null && card.def != null ? ` · ${card.atk}/${card.def}` : ""}
          </div>
        )}
        <div className="card-preview-roles">
          {cls.roles.map((r) => (
            <span key={r} className="role-chip" style={{ "--role": ROLE_COLORS[r] }}>{r}</span>
          ))}
        </div>
        {summary && (
          <div className="card-preview-short">
            <span className="card-preview-short-label">In short</span>
            {summary}
          </div>
        )}
        <div className="card-preview-text">{fullText}</div>
      </div>
    </div>
  );
}
