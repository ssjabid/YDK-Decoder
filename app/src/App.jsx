import { useEffect, useState } from "react";
import { getStoredTheme } from "./lib/storage.js";
import DecksTab from "./tabs/DecksTab.jsx";
import SettingsTab from "./tabs/SettingsTab.jsx";

const TABS = [
  { id: "decks", label: "Decks" },
  { id: "format", label: "Format" },
  { id: "testing", label: "Testing" },
  { id: "settings", label: "⚙", icon: true },
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
            className={"tab" + (t.icon ? " tab-icon" : "") + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "decks" && <DecksTab dataVersion={dataVersion} reload={reload} />}
        {tab === "format" && <Placeholder name="Format" />}
        {tab === "testing" && <Placeholder name="Testing" />}
        {tab === "settings" && <SettingsTab reload={reload} />}
      </main>
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
