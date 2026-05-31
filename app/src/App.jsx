import { useEffect, useState } from "react";
import { getStoredTheme } from "./lib/storage.js";
import { ensureMetaFresh, backfillPlaybookFromMatchups } from "./lib/metaPack.js";
import { ingestComboFromUrl } from "./lib/combos.js";
import DecksTab from "./tabs/DecksTab.jsx";
import SettingsTab from "./tabs/SettingsTab.jsx";
import FormatTab from "./tabs/FormatTab.jsx";
import CombosTab from "./tabs/CombosTab.jsx";
import TestingTab from "./tabs/TestingTab.jsx";
import ModalHost from "./components/ModalHost.jsx";
import Icon from "./components/Icon.jsx";

const TABS = [
  { id: "decks", label: "Decks", icon: "cards" },
  { id: "format", label: "Format", icon: "swords" },
  { id: "combos", label: "Combos", icon: "summon" },
  { id: "testing", label: "Testing", icon: "target" },
  { id: "settings", label: "Settings", icon: "sliders", iconOnly: true },
];

export default function App() {
  const [tab, setTab] = useState("decks");
  // Bumped whenever localStorage data changes (e.g. after loading the meta
  // pack) so tabs re-read from storage.
  const [dataVersion, setDataVersion] = useState(0);
  const reload = () => setDataVersion((v) => v + 1);

  // Apply persisted theme to <html data-theme> (matches the original).
  useEffect(() => {
    const t = getStoredTheme();
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
  }, []);

  // Auto-refresh the meta pack if a newer bundled version exists (only if the
  // user has already loaded it once) — so the latest lists + deep breakdowns
  // always show without manually re-clicking "Load meta decks".
  useEffect(() => {
    let alive = true;
    // Backfill the per-deck playbook from any legacy format-matchup data first
    // (idempotent), then auto-refresh the meta pack if a newer one is bundled.
    try { backfillPlaybookFromMatchups(); } catch (_) { /* noop */ }
    try { if (ingestComboFromUrl() > 0) reload(); } catch (_) { /* noop */ }
    ensureMetaFresh().then((r) => { if (alive && r && r.updated) reload(); });
    return () => { alive = false; };
  }, []);

  // The Chrome extension fires this after writing a combo into localStorage —
  // re-read so it shows up live without a manual refresh.
  useEffect(() => {
    const onInjected = () => reload();
    window.addEventListener("ydk:combo-injected", onInjected);
    return () => window.removeEventListener("ydk:combo-injected", onInjected);
  }, []);

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1>YDK <span className="accent">Decoder</span></h1>
          <div className="subtitle">Strip cards to function. Learn decks faster.</div>
        </div>
        <span className="build-badge">React build · preview</span>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
            type="button"
            title={t.label}
          >
            <Icon name={t.icon} size={16} />
            {!t.iconOnly && <span className="tab-label">{t.label}</span>}
          </button>
        ))}
      </nav>

      <main key={tab} className="tab-content">
        {tab === "decks" && <DecksTab dataVersion={dataVersion} reload={reload} />}
        {tab === "format" && <FormatTab dataVersion={dataVersion} />}
        {tab === "combos" && <CombosTab dataVersion={dataVersion} reload={reload} />}
        {tab === "testing" && <TestingTab dataVersion={dataVersion} />}
        {tab === "settings" && <SettingsTab reload={reload} />}
      </main>
      <ModalHost />
    </div>
  );
}

function Placeholder({ name }) {
  return (
    <div className="placeholder">
      <strong>{name}</strong> — coming next in the rewrite. The original app
      stays fully working at <code>decoder/ydk_decoder.html</code> until this
      reaches parity.
    </div>
  );
}
