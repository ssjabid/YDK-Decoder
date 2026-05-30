import { useEffect, useMemo, useState } from "react";
import { fetchCards, getImageUrls, countCopies } from "../lib/ydk.js";
import { classify, pickPrimaryRole, ROLE_COLORS, groupByFrame, groupExtraByType } from "../lib/classify.js";
import CardPreview from "./CardPreview.jsx";

// Renders a deck's main/extra/side, grouped + sorted like the original:
// Monsters/Spells/Traps for main+side, by Extra type for extra. Each tile
// gets a role-colored stripe + a hover preview (image + effect).
export default function CardsView({ deck }) {
  const ids = useMemo(() => ({
    main: deck.main || [],
    extra: deck.extra || [],
    side: deck.side || [],
  }), [deck]);

  const [cards, setCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null); // { card, rect }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCards([...ids.main, ...ids.extra, ...ids.side]).then(({ map }) => {
      if (alive) { setCards(map); setLoading(false); }
    });
    return () => { alive = false; };
  }, [ids]);

  const mainGroups = useMemo(() => groupByFrame(countCopies(ids.main), cards), [ids, cards]);
  const extraGroups = useMemo(() => groupExtraByType(countCopies(ids.extra), cards), [ids, cards]);
  const sideGroups = useMemo(() => groupByFrame(countCopies(ids.side), cards), [ids, cards]);

  return (
    <div className="cards-view" onMouseLeave={() => setPreview(null)}>
      {loading && <div className="cards-loading">Loading card data…</div>}
      <GroupedSection title="Main Deck" total={ids.main.length} groups={mainGroups} onHover={setPreview} />
      <GroupedSection title="Extra Deck" total={ids.extra.length} groups={extraGroups} onHover={setPreview} />
      <GroupedSection title="Side Deck" total={ids.side.length} groups={sideGroups} onHover={setPreview} />
      {preview && <CardPreview card={preview.card} rect={preview.rect} />}
    </div>
  );
}

function GroupedSection({ title, total, groups, onHover }) {
  if (!total) return null;
  const subs = Object.entries(groups).filter(([, arr]) => arr.length);
  return (
    <div className="cards-section">
      <div className="cards-section-head">
        <span className="cards-section-title">{title}</span>
        <span className="cards-section-count">{total}</span>
      </div>
      {subs.map(([label, arr]) => (
        <div className="cards-subgroup" key={label}>
          <div className="cards-subgroup-label">{label} · {arr.reduce((n, e) => n + e.qty, 0)}</div>
          <div className="cards-grid">
            {arr.map((e) => <CardTile key={e.id} entry={e} onHover={onHover} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardTile({ entry, onHover }) {
  const { id, card, qty } = entry;
  const urls = getImageUrls(id);
  const [urlIdx, setUrlIdx] = useState(0);
  const name = card?.name || `#${id}`;
  const src = urls[urlIdx];
  const role = card ? pickPrimaryRole(classify(card).roles) : "Engine";
  const stripe = ROLE_COLORS[role] || "var(--role-engine)";

  return (
    <div
      className="card-tile"
      title={name}
      style={{ "--stripe": stripe }}
      onMouseEnter={(e) => card && onHover({ card, rect: e.currentTarget.getBoundingClientRect() })}
    >
      <span className="card-tile-stripe" />
      {src ? (
        <img src={src} alt={name} loading="lazy"
          onError={() => setUrlIdx((i) => (i + 1 < urls.length ? i + 1 : i))} />
      ) : (
        <div className="card-tile-noimg">{name}</div>
      )}
      {qty > 1 && <span className="card-tile-qty">×{qty}</span>}
      <span className="card-tile-name">{name}</span>
    </div>
  );
}
