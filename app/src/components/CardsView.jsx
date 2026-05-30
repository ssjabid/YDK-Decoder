import { useEffect, useMemo, useState } from "react";
import { fetchCards, getImageUrls, countCopies } from "../lib/ydk.js";

// Renders a deck's main/extra/side as a card grid. Fetches card data
// (cached) and shows image + name + copy count. Role tagging + hover
// preview come once classify() is ported (next lib pass).
export default function CardsView({ deck }) {
  const ids = useMemo(() => ({
    main: deck.main || [],
    extra: deck.extra || [],
    side: deck.side || [],
  }), [deck]);

  const [cards, setCards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const all = [...ids.main, ...ids.extra, ...ids.side];
    fetchCards(all).then(({ map }) => {
      if (alive) { setCards(map); setLoading(false); }
    });
    return () => { alive = false; };
  }, [ids]);

  return (
    <div className="cards-view">
      {loading && <div className="cards-loading">Loading card data…</div>}
      <Section title="Main Deck" ids={ids.main} cards={cards} />
      <Section title="Extra Deck" ids={ids.extra} cards={cards} />
      <Section title="Side Deck" ids={ids.side} cards={cards} />
    </div>
  );
}

function Section({ title, ids, cards }) {
  if (!ids.length) return null;
  const counts = countCopies(ids);
  const unique = Object.keys(counts).map(Number);
  return (
    <div className="cards-section">
      <div className="cards-section-head">
        <span className="cards-section-title">{title}</span>
        <span className="cards-section-count">{ids.length}</span>
      </div>
      <div className="cards-grid">
        {unique.map((id) => (
          <CardTile key={id} id={id} qty={counts[id]} card={cards[id]} />
        ))}
      </div>
    </div>
  );
}

function CardTile({ id, qty, card }) {
  const urls = getImageUrls(id);
  const [urlIdx, setUrlIdx] = useState(0);
  const name = card?.name || `#${id}`;
  const src = urls[urlIdx];
  return (
    <div className="card-tile" title={name}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setUrlIdx((i) => (i + 1 < urls.length ? i + 1 : i))}
        />
      ) : (
        <div className="card-tile-noimg">{name}</div>
      )}
      {qty > 1 && <span className="card-tile-qty">×{qty}</span>}
      <span className="card-tile-name">{name}</span>
    </div>
  );
}
