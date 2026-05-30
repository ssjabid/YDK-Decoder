import { getImageUrls } from "../lib/ydk.js";
import { classify, pickPrimaryRole, ROLE_COLORS } from "../lib/classify.js";

// Floating hover preview (image + role chips + stripped effect text).
// Shared by CardsView and the Testing tab so hover behaves identically
// everywhere. `rect` is the hovered tile's bounding rect (getBoundingClientRect).
export default function CardPreview({ card, rect }) {
  if (!card) return null;
  const urls = getImageUrls(card.id);
  const cls = classify(card);
  // Flip to the left if the tile is in the right half of the viewport.
  const onRight = rect.left > window.innerWidth / 2;
  const style = {
    position: "fixed",
    top: Math.min(Math.max(rect.top - 20, 12), window.innerHeight - 360),
    [onRight ? "right" : "left"]: onRight ? (window.innerWidth - rect.left + 12) : (rect.right + 12),
  };
  return (
    <div className="card-preview" style={style}>
      {urls[0] && <img className="card-preview-img" src={urls[0]} alt="" />}
      <div className="card-preview-body">
        <div className="card-preview-name">{card.name}</div>
        <div className="card-preview-roles">
          {cls.roles.map((r) => (
            <span key={r} className="role-chip" style={{ "--role": ROLE_COLORS[r] }}>{r}</span>
          ))}
        </div>
        <div className="card-preview-text">{cls.stripped[0]}</div>
      </div>
    </div>
  );
}

// Re-export so call sites can show the primary role without re-importing.
export { pickPrimaryRole };
