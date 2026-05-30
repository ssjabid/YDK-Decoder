import { useEffect, useMemo, useState } from "react";
import { loadDecks, loadFormats, getActiveDeckId, getActiveFormatId } from "../lib/storage.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import {
  shuffleArr, bumpStreak, loadPracticeStreaks, resetPracticeStreak,
  matchCombosToHand, isBreaker, isHandtrap, inferDisruption, BB_DISRUPTIONS,
  loadBbStreaks, bumpBb,
} from "../lib/practice.js";
import CardPreview from "../components/CardPreview.jsx";
import Icon from "../components/Icon.jsx";

// ════════════════════════════════════════════════════════════════════
// TESTING TAB — Going first (goldfish) + Going second (board breaker).
// Ported from the original decoder's Practice + Board-Breaker tabs.
// ════════════════════════════════════════════════════════════════════
export default function TestingTab({ dataVersion = 0 }) {
  const [mode, setMode] = useState("first");

  const myDeck = useMemo(() => {
    const id = getActiveDeckId();
    const decks = loadDecks();
    return (id && decks.find((d) => d.deckId === id)) || decks.find((d) => d.role !== "matchup") || null;
  }, [dataVersion]);

  return (
    <div className="testing-tab">
      <div className="testing-modebar">
        <button type="button" className={"testing-mode-btn" + (mode === "first" ? " active" : "")} onClick={() => setMode("first")}>
          <Icon name="cards" size={15} /> Going first — your openers
        </button>
        <button type="button" className={"testing-mode-btn" + (mode === "second" ? " active" : "")} onClick={() => setMode("second")}>
          <Icon name="swords" size={15} /> Going second — break boards
        </button>
      </div>

      {!myDeck ? (
        <div className="placeholder">
          <strong>Pick your deck first.</strong> Go to the <strong>Decks</strong> tab and
          select your deck (or import one), then come back to practise.
        </div>
      ) : mode === "first" ? (
        <Goldfish deck={myDeck} />
      ) : (
        <BoardBreaker myDeck={myDeck} dataVersion={dataVersion} />
      )}
    </div>
  );
}

// ── Shared: a face-up card with image + name + optional role tint ────
function HandCard({ id, name, card, onHover, tagClass, tagLabel }) {
  const urls = getImageUrls(id);
  const [i, setI] = useState(0);
  const src = urls[i];
  return (
    <div
      className={"hand-card" + (tagClass ? " " + tagClass : "")}
      onMouseEnter={(e) => card && onHover && onHover({ card, rect: e.currentTarget.getBoundingClientRect() })}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} loading="lazy"
          onError={() => setI((n) => (n + 1 < urls.length ? n + 1 : n))} />
      ) : (
        <div className="hand-card-noimg">{name}</div>
      )}
      <div className="hand-card-name">{name}</div>
      {tagLabel && <span className={"hand-card-tag " + (tagClass || "")}>{tagLabel}</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// GOING FIRST — Goldfish: shuffle a 5-card opener, see playable combos.
// ════════════════════════════════════════════════════════════════════
function Goldfish({ deck }) {
  const [cardMap, setCardMap] = useState({});
  const [hand, setHand] = useState(null); // { ids:[], names:[] }
  const [preview, setPreview] = useState(null);
  const [streak, setStreak] = useState(() => loadPracticeStreaks()[deck.deckId] || null);

  const main = useMemo(() => (deck.main || []).map(String), [deck]);

  // Resolve the whole main deck once so shuffles are instant + named.
  useEffect(() => {
    let alive = true;
    setHand(null);
    setStreak(loadPracticeStreaks()[deck.deckId] || null);
    fetchCards(main).then(({ map }) => { if (alive) setCardMap(map); });
    return () => { alive = false; };
  }, [deck.deckId, main]);

  const nameOf = (id) => (cardMap[Number(id)] && cardMap[Number(id)].name) || `#${id}`;

  const shuffle = () => {
    if (!main.length) return;
    const ids = shuffleArr(main).slice(0, Math.min(5, main.length));
    const names = ids.map(nameOf);
    const { anyPossible } = matchCombosToHand(names, deck.deckId);
    setStreak(bumpStreak(deck.deckId, anyPossible));
    setHand({ ids, names });
  };

  const lines = hand ? matchCombosToHand(hand.names, deck.deckId).combos : [];

  return (
    <div className="goldfish" onMouseLeave={() => setPreview(null)}>
      <div className="practice-head">
        <div className="practice-head-left">
          <div className="practice-deckname">{deck.name}</div>
          <div className="practice-streak">
            {streak && streak.hands > 0 ? (
              <>
                <strong>{streak.hits}</strong> openable / {streak.hands} hands ·{" "}
                <strong>{Math.round((100 * streak.hits) / streak.hands)}%</strong> consistency
                <button type="button" className="link-btn"
                  onClick={() => { resetPracticeStreak(deck.deckId); setStreak(null); }}>reset</button>
              </>
            ) : "Shuffle a few hands to see this deck's opening consistency."}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={shuffle} disabled={!main.length}>
          <Icon name="die" size={16} /> Shuffle &amp; draw 5
        </button>
      </div>

      <div className="practice-grid">
        <section className="practice-panel">
          <div className="practice-panel-title">Opening hand</div>
          {!hand ? (
            <div className="practice-empty">Click <strong>Shuffle &amp; draw 5</strong> to see what you'd open with.</div>
          ) : (
            <div className="hand-row">
              {hand.ids.map((id, idx) => (
                <HandCard key={idx} id={id} name={hand.names[idx]} card={cardMap[Number(id)]} onHover={setPreview} />
              ))}
            </div>
          )}
        </section>

        <section className="practice-panel">
          <div className="practice-panel-title">Playable lines</div>
          {!hand ? (
            <div className="practice-empty">Draw a hand to see which saved combos are live.</div>
          ) : !lines.length ? (
            <div className="practice-empty">
              No combos saved for <strong>{deck.name}</strong> yet.<br />
              Extract some with the Chrome extension and they'll be matched here.
            </div>
          ) : (
            <div className={"lines-list" + (lines.length > 4 ? " is-full" : "")}>
              {lines.map((r) => <ComboLine key={r.idx} r={r} handNames={hand.names} />)}
            </div>
          )}
        </section>
      </div>

      {preview && <CardPreview card={preview.card} rect={preview.rect} />}
    </div>
  );
}

function ComboLine({ r, handNames }) {
  const c = r.combo;
  const icon = r.status === "possible" ? "✓" : r.status === "partial" ? "⚠" : "✗";
  const statusText = r.status === "possible" ? "Playable"
    : r.status === "partial" ? `Need 1 more: ${r.missing[0]}`
    : `Need ${r.missing.length}: ${r.missing.slice(0, 2).join(", ")}${r.missing.length > 2 ? "…" : ""}`;
  const have = new Set((handNames || []).filter(Boolean));
  const title = c.title || c.name || (c.openingHand || []).join(" + ") || "Combo";
  return (
    <div className={"combo-line is-" + r.status}>
      <div className="combo-line-head">
        <span className="combo-line-status">{icon}</span>
        <span className="combo-line-name">{title}</span>
      </div>
      <div className="combo-line-needs">
        <span className="muted">Starter{r.need.length === 1 ? "" : "s"}:</span>{" "}
        {r.need.map((n, i) => (
          <span key={i} className={have.has(n) ? "have" : "miss"}>{n}{i < r.need.length - 1 ? " · " : ""}</span>
        ))}
        <span className="muted" style={{ marginLeft: 8 }}>· {statusText}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// GOING SECOND — Board Breaker: opponent's board (seeded from the
// matchup plan) vs your 6-card hand; highlight breakers/handtraps; gauge
// + self-assess Break / Partial / No (per-matchup tally).
// ════════════════════════════════════════════════════════════════════
function BoardBreaker({ myDeck, dataVersion }) {
  // Opponent decks come from the active format's matchups (resolved to decks).
  const { opponents, matchupOf } = useMemo(() => {
    const decks = loadDecks();
    const fmts = loadFormats();
    const fmt = fmts.find((f) => f.formatId === getActiveFormatId()) || fmts[0] || null;
    const matchups = (fmt && fmt.matchups) || [];
    const opps = matchups.map((m) => decks.find((d) => d.deckId === m.opponentDeckId)).filter(Boolean);
    const byId = {};
    matchups.forEach((m) => { byId[m.opponentDeckId] = m; });
    // Fall back to any matchup-role decks if no format is set.
    const list = opps.length ? opps : decks.filter((d) => d.role === "matchup");
    return { opponents: list, matchupOf: byId };
  }, [dataVersion]);

  const [oppId, setOppId] = useState(opponents[0] ? opponents[0].deckId : null);
  useEffect(() => {
    if (!opponents.find((d) => d.deckId === oppId)) setOppId(opponents[0] ? opponents[0].deckId : null);
  }, [opponents, oppId]);

  const opp = opponents.find((d) => d.deckId === oppId) || null;
  const matchup = oppId ? matchupOf[oppId] : null;

  const [myCardMap, setMyCardMap] = useState({});
  const [oppCardMap, setOppCardMap] = useState({}); // name(lower) -> card
  const [hand, setHand] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tally, setTally] = useState(null);

  const myMain = useMemo(() => (myDeck.main || []).map(String), [myDeck]);
  const tallyKey = myDeck.deckId + ":" + (oppId || "");

  // My deck cards (for hand classification).
  useEffect(() => {
    let alive = true;
    fetchCards(myMain).then(({ map }) => { if (alive) setMyCardMap(map); });
    return () => { alive = false; };
  }, [myMain]);

  // Opponent deck cards → name→card map, so we can tag board pieces.
  useEffect(() => {
    let alive = true;
    setHand(null);
    setTally(loadBbStreaks()[tallyKey] || null);
    if (!opp) { setOppCardMap({}); return; }
    const ids = [...(opp.main || []), ...(opp.extra || []), ...(opp.side || [])];
    fetchCards(ids).then(({ map }) => {
      if (!alive) return;
      const byName = {};
      Object.values(map).forEach((c) => { if (c && c.name) byName[c.name.toLowerCase()] = c; });
      setOppCardMap(byName);
    });
    return () => { alive = false; };
  }, [opp, tallyKey]);

  const board = (matchup && matchup.targetEndboard || []).filter(Boolean).map((name) => {
    const card = oppCardMap[String(name).toLowerCase()] || null;
    return { name, card, disruption: card ? inferDisruption(card) : "negate" };
  });
  const sidePlan = matchup && matchup.sideboard && matchup.sideboard.goingSecond;

  const nameOf = (id) => (myCardMap[Number(id)] && myCardMap[Number(id)].name) || `#${id}`;

  const shuffle = () => {
    if (!myMain.length) return;
    const ids = shuffleArr(myMain).slice(0, Math.min(6, myMain.length));
    setHand({ ids, names: ids.map(nameOf) });
  };

  const assess = (verdict) => { setTally(bumpBb(tallyKey, verdict)); };

  if (!opponents.length) {
    return (
      <div className="placeholder">
        <strong>No opponent decks yet.</strong> Load the meta decks (Decks → Load meta decks)
        or import opponent <code>.ydk</code> files, then come back to practise breaking their board.
      </div>
    );
  }

  const handCards = hand ? hand.ids.map((id) => myCardMap[Number(id)]) : [];
  const breakers = handCards.filter(isBreaker).length;
  const handtraps = handCards.filter(isHandtrap).length;
  const disruptions = board.filter((p) => p.disruption !== "body").length;

  return (
    <div className="board-breaker" onMouseLeave={() => setPreview(null)}>
      <div className="bb-bar">
        <label className="bb-field">
          <span className="bb-field-label">Opponent</span>
          <select className="bb-select" value={oppId || ""} onChange={(e) => setOppId(e.target.value)}>
            {opponents.map((d) => <option key={d.deckId} value={d.deckId}>{d.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={shuffle} disabled={!myMain.length}>
          <Icon name="die" size={16} /> Shuffle going 2nd (6)
        </button>
      </div>

      {sidePlan && ((sidePlan.in || []).length || (sidePlan.out || []).length) ? (
        <div className="bb-sideplan">
          <span className="bb-sideplan-label">Side plan (going 2nd):</span>
          {(sidePlan.in || []).length ? <span className="bb-in">+ {sidePlan.in.join(", ")}</span> : null}
          {(sidePlan.out || []).length ? <span className="bb-out">− {sidePlan.out.join(", ")}</span> : null}
        </div>
      ) : null}

      <div className="bb-puzzle">
        <section className="bb-col">
          <div className="bb-col-title">{opp ? opp.name : "Opponent"}'s typical board</div>
          {!board.length ? (
            <div className="practice-empty">
              No end board recorded for this matchup yet. Add one in <strong>Format → {opp ? opp.name : "this matchup"} →
              Their typical end board</strong>, and it'll seed here.
            </div>
          ) : (
            <div className="bb-board">
              {board.map((p, i) => {
                const dis = BB_DISRUPTIONS.find((d) => d.value === p.disruption) || BB_DISRUPTIONS[0];
                return (
                  <div key={i} className={"bb-piece " + dis.cls}
                    onMouseEnter={(e) => p.card && setPreview({ card: p.card, rect: e.currentTarget.getBoundingClientRect() })}>
                    <span className="bb-piece-name">{p.name}</span>
                    <span className="bb-piece-tag">{dis.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bb-col">
          <div className="bb-col-title">Your hand (going 2nd)</div>
          {!hand ? (
            <div className="practice-empty">Shuffle a going-second hand to start the puzzle.</div>
          ) : (
            <div className="hand-row">
              {hand.ids.map((id, idx) => {
                const card = myCardMap[Number(id)];
                const br = isBreaker(card), ht = isHandtrap(card);
                return (
                  <HandCard key={idx} id={id} name={hand.names[idx]} card={card} onHover={setPreview}
                    tagClass={br ? "is-breaker" : ht ? "is-handtrap" : ""}
                    tagLabel={br ? "breaker" : ht ? "handtrap" : ""} />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {hand && board.length ? (
        <div className="bb-assess">
          <div className="bb-gauge">
            <span className="bb-gauge-stat"><strong>{breakers}</strong> board breaker{breakers === 1 ? "" : "s"}</span>
            <span className="bb-gauge-stat"><strong>{handtraps}</strong> handtrap{handtraps === 1 ? "" : "s"}</span>
            <span className="bb-gauge-vs">vs</span>
            <span className="bb-gauge-stat is-dis"><strong>{disruptions}</strong> disruption{disruptions === 1 ? "" : "s"}</span>
            <span className="bb-gauge-hint">— a rough gauge, not a verdict. Work out the actual line.</span>
          </div>
          <div className="bb-assess-q">Can you break this board? Think it through, then record it:</div>
          <div className="bb-assess-btns">
            <button type="button" className="bb-assess-btn is-break" onClick={() => assess("break")}>✓ Broke it</button>
            <button type="button" className="bb-assess-btn is-partial" onClick={() => assess("partial")}>~ Partial</button>
            <button type="button" className="bb-assess-btn is-no" onClick={() => assess("no")}>✗ Couldn't</button>
          </div>
          {tally && tally.tries ? (
            <div className="bb-tally">
              vs <strong>{opp ? opp.name : "them"}</strong>: broke <strong>{tally.breaks}</strong> / {tally.tries}{" "}
              ({Math.round((100 * tally.breaks) / tally.tries)}%){tally.partials ? ` · ${tally.partials} partial` : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview && <CardPreview card={preview.card} rect={preview.rect} />}
    </div>
  );
}
