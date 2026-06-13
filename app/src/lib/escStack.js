// ───────────────────────────────────────────────────────────────────
// One Escape, one back-out order. Layers that can be "backed out of" (a
// pinned card preview, a full-screen matchup breakdown) register a handler;
// the most-recently-registered wins, so Esc peels them off top-down —
// preview before the detail it floats over. (P5 · D4)
//
// Deliberately NOT in charge of modals: an open modal owns Esc itself
// (ModalHost, focus-based), so this bails while a .modal-overlay exists.
// It also never steals Esc from a focused text field — Esc there means
// "revert / clear", not "leave the view".
// ───────────────────────────────────────────────────────────────────
const stack = [];
let wired = false;

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function onKeyDown(e) {
  if (e.key !== "Escape") return;
  if (isEditable(document.activeElement)) return;     // field owns its own Esc
  if (document.querySelector(".modal-overlay")) return; // modal owns Esc
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  top();
}

// Register an Esc handler; returns an unregister fn (call it on cleanup).
export function registerEsc(handler) {
  if (typeof handler !== "function") return () => {};
  if (!wired) { window.addEventListener("keydown", onKeyDown, true); wired = true; }
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}
