import { useEffect, useRef, useState } from "react";
import { _subscribe } from "../lib/modal.js";

// Renders the active styled modal. Mount once near the app root.
export default function ModalHost() {
  const [req, setReq] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => _subscribe((r) => setReq(r)), []);
  useEffect(() => { if (req && req.kind === "prompt" && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [req]);

  if (!req) return null;

  const close = (value) => { const resolve = req.resolve; setReq(null); resolve && resolve(value); };
  const onConfirm = () => close(req.kind === "prompt" ? (inputRef.current ? inputRef.current.value : (req.value || "")) : (req.kind === "confirm" ? true : undefined));
  const onCancel = () => close(req.kind === "confirm" ? false : (req.kind === "prompt" ? null : undefined));

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && req.kind !== "alert") onCancel(); }}>
      <div className={"modal" + (req.danger ? " is-danger" : "")} role="dialog" aria-modal="true"
        onKeyDown={(e) => { if (e.key === "Escape" && req.kind !== "alert") onCancel(); else if (e.key === "Enter" && req.kind !== "prompt") onConfirm(); }}>
        {req.title && <div className="modal-title">{req.title}</div>}
        {req.message && <div className="modal-message">{req.message}</div>}
        {req.kind === "prompt" && (
          <input ref={inputRef} className="modal-input" defaultValue={req.value || ""} placeholder={req.placeholder || ""}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onConfirm(); } else if (e.key === "Escape") { e.preventDefault(); onCancel(); } else e.stopPropagation(); }} />
        )}
        <div className="modal-actions">
          {req.kind !== "alert" && <button type="button" className="btn-secondary modal-btn" onClick={onCancel}>{req.cancelText || "Cancel"}</button>}
          <button type="button" className={"btn-primary modal-btn" + (req.danger ? " is-danger" : "")} autoFocus={req.kind !== "prompt"} onClick={onConfirm}>{req.confirmText || "OK"}</button>
        </div>
      </div>
    </div>
  );
}
