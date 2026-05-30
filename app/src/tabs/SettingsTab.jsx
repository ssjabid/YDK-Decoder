import { useState } from "react";
import { getStoredTheme, setStoredTheme } from "../lib/storage.js";
import { loadMetaPack } from "../lib/metaPack.js";

export default function SettingsTab({ reload }) {
  const [theme, setTheme] = useState(getStoredTheme());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyTheme = (t) => {
    setTheme(t);
    setStoredTheme(t);
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
  };

  const onLoadMeta = async () => {
    setBusy(true); setStatus(null);
    try {
      const { added, refreshed } = await loadMetaPack();
      setStatus({ ok: true, msg: `Loaded meta pack: +${added} new, ${refreshed} refreshed.` });
      reload && reload();
    } catch (e) {
      setStatus({ ok: false, msg: `Couldn't load the meta pack (${e.message}). Run on localhost.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings">
      <section className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Theme</div>
            <div className="settings-hint">Dark by default. Light mirrors the original palette.</div>
          </div>
          <div className="theme-toggle" role="radiogroup" aria-label="Theme">
            <button type="button" className={"theme-toggle-btn" + (theme === "dark" ? " active" : "")} onClick={() => applyTheme("dark")}>Dark</button>
            <button type="button" className={"theme-toggle-btn" + (theme === "light" ? " active" : "")} onClick={() => applyTheme("light")}>Light</button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Meta decks</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Load / refresh meta matchups</div>
            <div className="settings-hint">
              Imports the bundled May 2026 TCG meta pack — 17 opponent decks + a
              pre-filled "Meta - May 2026" format. Re-run anytime to refresh.
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={onLoadMeta} disabled={busy}>
            {busy ? "Loading…" : "⚡ Load meta decks"}
          </button>
        </div>
        {status && (
          <div className={"settings-status " + (status.ok ? "is-ok" : "is-err")}>{status.msg}</div>
        )}
      </section>
    </div>
  );
}
