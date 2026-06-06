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
];

export default function App() {
  const [tab, setTab] = useState("decks");
  const [dataVersion, setDataVersion] = useState(0);
  const [deckJump, setDeckJump] = useState(null); // { deckId, n } — cross-tab "Edit in Decks"
  const reload = () => setDataVersion((v) => v + 1);

  // Jump to a deck in the Decks tab (used by Format's "Edit in Decks →").
  const goToDeck = (deckId) => { if (!deckId) return; setDeckJump((p) => ({ deckId, n: (p?.n || 0) + 1 })); setTab("decks"); };

  useEffect(() => {
    const t = getStoredTheme();
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    let alive = true;
    try { backfillPlaybookFromMatchups(); } catch (_) { /* noop */ }
    try { if (ingestComboFromUrl() > 0) reload(); } catch (_) { /* noop */ }
    ensureMetaFresh().then((r) => { if (alive && r && r.updated) reload(); });
    return () => { alive = false; };
  }, []);

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
        <div className="app-header-right">
          <span className="build-badge">React build · preview</span>
          <button type="button" className={"app-gear" + (tab === "settings" ? " active" : "")} title="Settings"
            aria-label="Settings" onClick={() => setTab((t) => (t === "settings" ? "decks" : "settings"))}>
            <Icon name="sliders" size={18} />
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={"tab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)} type="button" title={t.label}>
            <Icon name={t.icon} size={16} />
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main key={tab} className="tab-content">
        {tab === "decks" && <DecksTab dataVersion={dataVersion} reload={reload} jump={deckJump} />}
        {tab === "format" && <FormatTab dataVersion={dataVersion} onEditDeck={goToDeck} />}
        {tab === "combos" && <CombosTab dataVersion={dataVersion} reload={reload} />}
        {tab === "testing" && <TestingTab dataVersion={dataVersion} />}
        {tab === "settings" && <SettingsTab reload={reload} />}
      </main>
      <ModalHost />
    </div>
  );
}
