import { useMemo, useRef, useState } from "react";
import { loadDecks, getActiveDeckId, setActiveDeckId } from "../lib/storage.js";
import { loadMetaPack } from "../lib/metaPack.js";
import { importDeckFromYdk } from "../lib/deckImport.js";
import CardsView from "../components/CardsView.jsx";
import Icon from "../components/Icon.jsx";

// Sort: your own decks first, then matchups, alphabetical within each group.
function sortDecks(decks) {
  const rank = (d) => (d.role === "matchup" ? 1 : 0);
  return [...decks].sort((a, b) =>
    rank(a) - rank(b) || (a.name || "").localeCompare(b.name || ""));
}

export default function DecksTab({ dataVersion = 0, reload }) {
  const decks = useMemo(() => sortDecks(loadDecks()), [dataVersion]);
  const [selectedId, setSelectedId] = useState(getActiveDeckId() || (decks[0] && decks[0].deckId) || null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onImportFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { deck, isNew } = importDeckFromYdk(text, file.name);
      setSelectedId(deck.deckId);
      reload && reload();
      if (!isNew) alert("That deck is already imported — selected it.");
    } catch (err) {
      alert("Couldn't import that .ydk: " + err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onLoadMeta = async () => {
    setBusy(true);
    try { await loadMetaPack(); reload && reload(); }
    catch (e) { alert("Couldn't load the meta pack: " + e.message); }
    finally { setBusy(false); }
  };

  const selected = decks.find((d) => d.deckId === selectedId) || decks[0] || null;

  return (
    <div className="decks-tab">
      <input ref={fileRef} type="file" accept=".ydk" hidden onChange={onImportFile} />
      <div className="decks-toolbar">
        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
          <Icon name="cards" size={16} /> Import your deck (.ydk)
        </button>
        <button type="button" className="btn-secondary" onClick={onLoadMeta} disabled={busy}>
          {busy ? "Loading…" : <><Icon name="summon" size={16} /> Load meta decks</>}
        </button>
      </div>

      {!decks.length ? (
        <div className="placeholder">
          No decks yet. <strong>Import your deck</strong> from a <code>.ydk</code> file
          (export it from DuelingBook or your deck builder), or <strong>Load meta decks</strong>
          to pull in the bundled opponents.
        </div>
      ) : (
        <div className="decks-layout">
          <aside className="decks-sidebar">
            {decks.map((d, i) => {
              const isMatchup = d.role === "matchup";
              const prev = decks[i - 1];
              const showHeader = i === 0 || (prev && (prev.role === "matchup") !== isMatchup);
              return (
                <div key={d.deckId}>
                  {showHeader && (
                    <div className="deck-group-label">{isMatchup ? "Matchup decks" : "My decks"}</div>
                  )}
                  <button
                    type="button"
                    className={"deck-row" + (selected && d.deckId === selected.deckId ? " active" : "")}
                    onClick={() => { setSelectedId(d.deckId); setActiveDeckId(d.deckId); }}
                  >
                    <span className={"deck-role-dot " + (isMatchup ? "is-matchup" : "is-mine")} />
                    <span className="deck-row-name">{d.name}</span>
                  </button>
                </div>
              );
            })}
          </aside>
          <section className="deck-panel">
            <div className="deck-panel-head">
              <h2 className="deck-panel-title">{selected.name}</h2>
              <span className={"deck-panel-role " + (selected.role === "matchup" ? "is-matchup" : "is-mine")}>
                {selected.role === "matchup" ? "Matchup" : "My deck"}
              </span>
              <span className="deck-panel-counts">
                {(selected.main?.length || 0)} main · {(selected.extra?.length || 0)} extra · {(selected.side?.length || 0)} side
              </span>
            </div>
            {selected.methodology?.howItWins && (
              <div className="deck-howitwins"><strong>How it wins:</strong> {selected.methodology.howItWins}</div>
            )}
            <CardsView deck={selected} />
          </section>
        </div>
      )}
    </div>
  );
}
