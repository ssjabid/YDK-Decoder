import { useMemo, useState } from "react";
import { loadDecks, getActiveDeckId, setActiveDeckId } from "../lib/storage.js";
import CardsView from "../components/CardsView.jsx";

// First parity milestone: list decks from the user's real localStorage and,
// on select, show that deck's cards (parse ids -> fetch -> render grid).
export default function DecksTab() {
  const decks = useMemo(() => loadDecks(), []);
  const [selectedId, setSelectedId] = useState(getActiveDeckId() || (decks[0] && decks[0].deckId) || null);

  if (!decks.length) {
    return (
      <div className="placeholder">
        No decks in this browser yet. Either open this on the same origin as your
        data (<code>localhost:8000</code>), or use <strong>Settings → Restore</strong>
        / <strong>⚡ Load meta decks</strong> once Settings is ported.
      </div>
    );
  }

  const selected = decks.find((d) => d.deckId === selectedId) || decks[0];

  return (
    <div className="decks-layout">
      <aside className="decks-sidebar">
        {decks.map((d) => {
          const role = d.role === "matchup" ? "Matchup" : "My deck";
          return (
            <button
              key={d.deckId}
              type="button"
              className={"deck-row" + (d.deckId === selected.deckId ? " active" : "")}
              onClick={() => { setSelectedId(d.deckId); setActiveDeckId(d.deckId); }}
            >
              <span className={"deck-role-dot " + (d.role === "matchup" ? "is-matchup" : "is-mine")} />
              <span className="deck-row-name">{d.name}</span>
              <span className="deck-row-meta">{role}</span>
            </button>
          );
        })}
      </aside>
      <section className="deck-panel">
        <div className="deck-panel-head">
          <h2 className="deck-panel-title">{selected.name}</h2>
          <span className="deck-panel-counts">
            {(selected.main?.length || 0)} main · {(selected.extra?.length || 0)} extra · {(selected.side?.length || 0)} side
          </span>
        </div>
        <CardsView deck={selected} />
      </section>
    </div>
  );
}
