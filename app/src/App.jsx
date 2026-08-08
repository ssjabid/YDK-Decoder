import { Component, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getStoredTheme, KEYS, readLs, writeLs } from "./lib/storage.js";
import { popEscLayer } from "./lib/escStack.js";
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

const TAB_IDS = ["decks", "format", "combos", "testing", "settings"];

export default function App() {
  // Reopen where you left off — closing the app (or the phone killing it)
  // used to always dump you back on Decks, which read as "lost my progress".
  // All DATA is saved to localStorage on every action; this restores the UI.
  const [tab, setTab] = useState(() => {
    const t = readLs(KEYS.lastTab);
    return TAB_IDS.includes(t) ? t : "decks";
  });
  const [dataVersion, setDataVersion] = useState(0);
  const [deckJump, setDeckJump] = useState(null); // { deckId, n } — cross-tab "Edit in Decks"
  const reload = () => setDataVersion((v) => v + 1);

  // Jump to a deck in the Decks tab (used by Format's "Edit in Decks →" and
  // Testing's "Edit deck →"). With no deckId it just opens the Decks tab.
  const goToDeck = (deckId) => { if (deckId) setDeckJump((p) => ({ deckId, n: (p?.n || 0) + 1 })); setTab("decks"); };

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
    writeLs(KEYS.lastTab, tab);
  }, [tab]);

  // Hardware/browser Back = in-app back, not "kill the app". One guard entry
  // sits on the history stack; each Back press closes ONE layer — an open
  // modal, then whatever the Esc stack holds (pinned preview, matchup drill,
  // a mobile detail pane), then a non-Decks tab steps home to Decks — and
  // re-arms the guard. Only when there is nothing left to close does a Back
  // actually leave the app.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    try { history.replaceState({ ydkRoot: true }, ""); history.pushState({ ydkGuard: true }, ""); } catch { return; }
    const rearm = () => { try { history.pushState({ ydkGuard: true }, ""); } catch { /* noop */ } };
    const onPop = () => {
      const overlay = document.querySelector(".modal-overlay");
      if (overlay) {
        const btn = overlay.querySelector(".modal-btn"); // cancel when present, OK on alerts
        if (btn) btn.click();
        rearm();
        return;
      }
      if (popEscLayer()) { rearm(); return; }
      if (tabRef.current !== "decks") { setTab("decks"); rearm(); return; }
      try { history.back(); } catch { /* noop */ } // nothing left to close — leave
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
          <h1>
            {/* the mark — matches logo.svg / the app icon */}
            <svg className="app-logo-mark" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
              <rect x="7.6" y="8.8" width="12.6" height="17.6" rx="2.1" transform="rotate(-12 13.9 17.6)" fill="#8c3820" />
              <g transform="rotate(6 17.8 15.6)">
                <rect x="11.5" y="6.8" width="12.6" height="17.6" rx="2.1" fill="#e55b3c" />
                <path d="M17.8 10.6 L18.9 14.5 L22.8 15.6 L18.9 16.7 L17.8 20.6 L16.7 16.7 L12.8 15.6 L16.7 14.5 Z" fill="#ffecdb" />
              </g>
            </svg>
            YDK <span className="accent">Decoder</span>
          </h1>
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
          {tab === "testing" && <TestingTab dataVersion={dataVersion} onEditDeck={goToDeck} />}
          {tab === "settings" && <SettingsTab reload={reload} />}
        </TabErrorBoundary>
      </main>
      <ModalHost />
      <Splash />
    </div>
  );
}
