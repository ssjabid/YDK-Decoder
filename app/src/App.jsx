import { Component, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getStoredTheme } from "./lib/storage.js";
import { ensureMetaFresh, backfillPlaybookFromMatchups } from "./lib/metaPack.js";
import { ingestComboFromUrl } from "./lib/combos.js";
import { slimCardCache } from "./lib/ydk.js";
import DecksTab from "./tabs/DecksTab.jsx";
import SettingsTab from "./tabs/SettingsTab.jsx";
import FormatTab from "./tabs/FormatTab.jsx";
import CombosTab from "./tabs/CombosTab.jsx";
import TestingTab from "./tabs/TestingTab.jsx";
import ModalHost from "./components/ModalHost.jsx";
import Splash from "./components/Splash.jsx";
import Icon from "./components/Icon.jsx";

const TABS = [
  { id: "decks", label: "Decks", icon: "cards" },
  { id: "format", label: "Format", icon: "swords" },
  { id: "combos", label: "Combos", icon: "summon" },
  { id: "testing", label: "Testing", icon: "target" },
];

// One bad render (e.g. a malformed combo object) used to blank the whole app
// with no recovery. Now it's contained to the tab with a way back.
class TabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error, info) { console.error("[YDK] render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="placeholder error-boundary">
          <strong>Something broke while drawing this view.</strong>
          <div className="error-boundary-msg">{String((this.state.error && this.state.error.message) || this.state.error)}</div>
          <div>Your data is safe — this is a display error, nothing was deleted.</div>
          <button type="button" className="btn-secondary" onClick={this.props.onReset}>← Back to Decks</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [tab, setTab] = useState("decks");
  const [dataVersion, setDataVersion] = useState(0);
  const [deckJump, setDeckJump] = useState(null); // { deckId, n } — cross-tab "Edit in Decks"
  const reload = () => setDataVersion((v) => v + 1);

  // Jump to a deck in the Decks tab (used by Format's "Edit in Decks →").
  const goToDeck = (deckId) => { if (!deckId) return; setDeckJump((p) => ({ deckId, n: (p?.n || 0) + 1 })); setTab("decks"); };

  // Per-tab scroll memory — switching tabs remounts <main key={tab}>, which
  // used to drop you back at the top (or mid-scroll on a shorter tab). Save
  // the outgoing tab's offset, restore the incoming tab's. (P5 · D3)
  const scrollByTab = useRef({});
  useLayoutEffect(() => {
    window.scrollTo(0, scrollByTab.current[tab] || 0);
    return () => { scrollByTab.current[tab] = window.scrollY; };
  }, [tab]);

  // The browser tab title says where you are — like the legacy app. (P5 · D5)
  useEffect(() => {
    const label = (TABS.find((t) => t.id === tab) || {}).label || "Settings";
    document.title = `${label} · YDK Decoder`;
  }, [tab]);

  useEffect(() => {
    const t = getStoredTheme();
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    let alive = true;
    try { slimCardCache(); } catch (_) { /* noop */ } // one-time: shrink heavyweight cached cards
    try { backfillPlaybookFromMatchups(); } catch (_) { /* noop */ }
    try { if (ingestComboFromUrl() > 0) reload(); } catch (_) { /* noop */ }
    ensureMetaFresh().then((r) => { if (alive && r && r.updated) reload(); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onInjected = () => reload();
    window.addEventListener("ydk:combo-injected", onInjected);
    // Live cross-tab sync: another tab (or the extension injecting into the
    // legacy decoder on the same origin) writing any ydk_* key refreshes this
    // tab too — no manual reload needed. `storage` only fires for OTHER tabs'
    // writes, so this can't loop on our own saves.
    const onStorage = (e) => { if (e.key == null || String(e.key).startsWith("ydk_")) reload(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ydk:combo-injected", onInjected);
      window.removeEventListener("storage", onStorage);
    };
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
        <TabErrorBoundary resetKey={tab + ":" + dataVersion} onReset={() => { setTab("decks"); reload(); }}>
          {tab === "decks" && <DecksTab dataVersion={dataVersion} reload={reload} jump={deckJump} />}
          {tab === "format" && <FormatTab dataVersion={dataVersion} onEditDeck={goToDeck} />}
          {tab === "combos" && <CombosTab dataVersion={dataVersion} reload={reload} />}
          {tab === "testing" && <TestingTab dataVersion={dataVersion} />}
          {tab === "settings" && <SettingsTab reload={reload} />}
        </TabErrorBoundary>
      </main>
      <ModalHost />
      <Splash />
    </div>
  );
}
