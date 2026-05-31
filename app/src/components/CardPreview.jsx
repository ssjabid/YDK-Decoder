import { getImageUrls } from "../lib/ydk.js";
import { classify, ROLE_COLORS } from "../lib/classify.js";
import { getCardSummary } from "../lib/cardFx.js";

// Floating card preview (large image + role chips + effect text). Shared by
// CardsView and the Testing tab so hover/pin behaves identically everywhere.
// `rect` is the hovered/clicked tile's bounding rect. When `pinned`, it stays
// put and becomes clickable (click to dismiss).
export default function CardPreview({ card, rect, pinned, onClose }) {
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
