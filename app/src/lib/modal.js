// ───────────────────────────────────────────────────────────────────
// Tiny promise-based modal API so we never use the browser's ugly
// window.confirm/prompt/alert. A single <ModalHost/> (mounted in App)
// subscribes and renders the styled dialog; these helpers return a promise
// that resolves when the user acts.
// ───────────────────────────────────────────────────────────────────
let _listener = null;
let _seq = 0;

export function _subscribe(fn) { _listener = fn; return () => { if (_listener === fn) _listener = null; }; }

function open(req) {
  return new Promise((resolve) => {
    const id = ++_seq;
    if (!_listener) { // no host mounted — fail safe to native
      if (req.kind === "confirm") resolve(window.confirm(req.message || req.title || "Are you sure?"));
      else if (req.kind === "prompt") resolve(window.prompt(req.message || req.title || "", req.value || ""));
      else { window.alert(req.message || req.title || ""); resolve(); }
      return;
    }
    _listener({ ...req, id, resolve });
  });
}

export const confirmModal = (opts = {}) => open({ kind: "confirm", confirmText: "Confirm", cancelText: "Cancel", ...opts });
export const promptModal = (opts = {}) => open({ kind: "prompt", confirmText: "Save", cancelText: "Cancel", value: "", ...opts });
export const alertModal = (opts = {}) => open({ kind: "alert", confirmText: "OK", ...opts });
