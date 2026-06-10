import { useMemo, useReducer, useRef, useState } from "react";
import { getStoredTheme, setStoredTheme, loadDecks, loadFormats, loadSavedCombos, loadCardCache } from "../lib/storage.js";
import { loadMetaPack } from "../lib/metaPack.js";
import { downloadBackup, restoreMerge, restoreReplace, hasSafetySnapshot, undoReplace, storageStats, clearCardCache, clearAllData, lastBackupAt } from "../lib/backup.js";
import { confirmModal, alertModal, promptModal } from "../lib/modal.js";
import Icon from "../components/Icon.jsx";

const fmtKB = (chars) => (chars > 1024 * 1024 ? (chars / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(chars / 1024)) + " KB");
const fmtWhen = (iso) => {
  if (!iso) return "never";
  try { const d = new Date(iso); return d.toISOString().slice(0, 10) + " " + d.toTimeString().slice(0, 5); } catch { return "unknown"; }
};

export default function SettingsTab({ reload }) {
  const [theme, setTheme] = useState(getStoredTheme());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, bump] = useReducer((x) => x + 1, 0);
  const fileRef = useRef(null);
  const restoreMode = useRef("merge");

  const stats = useMemo(() => {
    const decks = loadDecks();
    return {
      mine: decks.filter((d) => (d.role || "primary") !== "matchup").length,
      matchup: decks.filter((d) => d.role === "matchup").length,
      combos: loadSavedCombos().length,
      formats: loadFormats().length,
      cards: Object.keys(loadCardCache()).length,
      size: storageStats().total,
      lastBackup: lastBackupAt(),
    };
  }, [status, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTheme = (t) => { setTheme(t); setStoredTheme(t); document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark"); };

  const onLoadMeta = async () => {
    setBusy(true); setStatus(null);
    try { const { added, refreshed } = await loadMetaPack(); setStatus({ ok: true, msg: `Loaded meta pack: +${added} new, ${refreshed} refreshed.` }); reload && reload(); }
    catch (e) { setStatus({ ok: false, msg: `Couldn't load the meta pack (${e.message}). Run on localhost.` }); }
    finally { setBusy(false); }
  };

  const onBackup = () => {
    const c = downloadBackup();
    setStatus({ ok: true, msg: `Backup saved: ${c.decks} decks · ${c.combos} combos · ${c.cachedCards} cards.` });
    bump();
  };

  const pickRestore = (mode) => { restoreMode.current = mode; fileRef.current?.click(); };

  const onRestoreFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    let json;
    try { json = JSON.parse(await file.text()); }
    catch { alertModal({ title: "Not valid JSON", message: "That file couldn't be parsed as a backup." }); return; }
    try {
      if (restoreMode.current === "replace") {
        const ok = await confirmModal({ title: "Replace ALL data?", message: "This wipes your current decks, combos, formats + settings and replaces them with the backup. A safety snapshot of what you have now is kept, so you can undo once if the file turns out to be wrong.", confirmText: "Replace everything", danger: true });
        if (!ok) return;
        const c = restoreReplace(json);
        setStatus({ ok: true, msg: `Replaced all data from backup (${c.decks || 0} decks · ${c.combos || 0} combos). Wrong file? Use “Undo replace” below.` });
      } else {
        const a = restoreMerge(json);
        setStatus({ ok: true, msg: `Merged backup: +${a.decks} decks · +${a.combos} combos · +${a.formats} formats · +${a.cards} cards.` });
      }
      reload && reload();
    } catch (err) { alertModal({ title: "Couldn't restore", message: err.message }); }
  };

  const onClearCache = async () => {
    if (await confirmModal({ title: "Clear card image cache?", message: "Frees space; card art + data re-download as you browse. Your decks, combos + plans are untouched.", confirmText: "Clear cache" })) {
      clearCardCache(); setStatus({ ok: true, msg: "Card cache cleared." }); reload && reload(); bump();
    }
  };

  const onWipe = async () => {
    if (!(await confirmModal({ title: "Delete ALL data?", message: "Every deck, combo, format plan, tournament log + setting in this browser will be permanently deleted. Back up first if unsure.", confirmText: "Continue", danger: true }))) return;
    const typed = await promptModal({ title: "Type DELETE to confirm", message: "This cannot be undone.", placeholder: "DELETE", confirmText: "Delete everything" });
    if (typed == null) return;
    if (typed.trim().toUpperCase() !== "DELETE") { alertModal({ title: "Not deleted", message: "You didn't type DELETE — nothing was removed." }); return; }
    clearAllData(); setStatus({ ok: true, msg: "All data deleted." }); reload && reload(); bump();
  };

  return (
    <div className="settings">
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onRestoreFile} />

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
        <h2 className="settings-section-title">Your data</h2>
        <div className="settings-stats">
          <div className="stat-cell"><span className="stat-num">{stats.mine}</span><span className="stat-lbl">my decks</span></div>
          <div className="stat-cell"><span className="stat-num">{stats.matchup}</span><span className="stat-lbl">matchup decks</span></div>
          <div className="stat-cell"><span className="stat-num">{stats.combos}</span><span className="stat-lbl">combos</span></div>
          <div className="stat-cell"><span className="stat-num">{stats.formats}</span><span className="stat-lbl">formats</span></div>
          <div className="stat-cell"><span className="stat-num">{stats.cards}</span><span className="stat-lbl">cached cards</span></div>
          <div className="stat-cell"><span className="stat-num">{fmtKB(stats.size)}</span><span className="stat-lbl">stored</span></div>
        </div>
        <div className="settings-hint">Everything lives in this browser only. Back up regularly — clearing site data wipes it.</div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Backup &amp; restore</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Download a backup</div>
            <div className="settings-hint">Saves a JSON of everything. Last backup: <strong>{fmtWhen(stats.lastBackup)}</strong>. Compatible with the original decoder app.</div>
          </div>
          <button type="button" className="btn-primary" onClick={onBackup}><Icon name="cards" size={16} /> Download backup</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Restore from a backup</div>
            <div className="settings-hint"><strong>Merge</strong> adds anything missing without touching what you have — the safe choice.</div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => pickRestore("merge")}>Restore (merge)</button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Meta decks</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Load / refresh meta matchups</div>
            <div className="settings-hint">Imports the bundled meta pack — the opponent decks + the pre-filled meta format. Re-run anytime to refresh to the latest bundled version.</div>
          </div>
          <button type="button" className="btn-primary" onClick={onLoadMeta} disabled={busy}>
            {busy ? "Loading…" : <><Icon name="summon" size={16} /> Load meta decks</>}
          </button>
        </div>
      </section>

      {status && <div className={"settings-status " + (status.ok ? "is-ok" : "is-err")}>{status.msg}</div>}

      <section className="settings-section is-danger">
        <h2 className="settings-section-title">Danger zone</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Clear card image cache</div>
            <div className="settings-hint">Frees the most space. Card art + data re-download as you browse.</div>
          </div>
          <button type="button" className="btn-secondary" onClick={onClearCache}>Clear cache</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Replace ALL data from a backup</div>
            <div className="settings-hint">Wipes current data and restores the backup verbatim. A one-shot safety snapshot is kept so this is undoable once.</div>
          </div>
          <button type="button" className="btn-secondary is-danger" onClick={() => pickRestore("replace")}>Replace from file…</button>
        </div>
        {hasSafetySnapshot() && (
          <div className="settings-row">
            <div>
              <div className="settings-label">Undo the last replace</div>
              <div className="settings-hint">Brings back the data you had before the last “Replace from file”. One use — the snapshot is consumed.</div>
            </div>
            <button type="button" className="btn-secondary" onClick={async () => {
              if (!(await confirmModal({ title: "Undo the last replace?", message: "Your data returns to exactly what it was before the replace. What you restored from the file is discarded.", confirmText: "Undo replace" }))) return;
              try { const c = undoReplace(); setStatus({ ok: true, msg: `Replace undone (${c.decks} decks · ${c.combos} combos back).` }); reload && reload(); bump(); }
              catch (err) { alertModal({ title: "Couldn't undo", message: err.message }); }
            }}>Undo replace</button>
          </div>
        )}
        <div className="settings-row">
          <div>
            <div className="settings-label">Delete everything</div>
            <div className="settings-hint">Permanently removes all decks, combos, formats + settings from this browser.</div>
          </div>
          <button type="button" className="btn-secondary is-danger" onClick={onWipe}>Delete all data</button>
        </div>
      </section>
    </div>
  );
}
