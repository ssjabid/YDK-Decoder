import { useEffect, useMemo, useState } from "react";
import { loadDecks, loadFormats, getActiveDeckId, setActiveDeckId, getActiveFormatId } from "../lib/storage.js";
import { fetchCards, getImageUrls } from "../lib/ydk.js";
import { getDeckPrimaryDecklist } from "../lib/deckModel.js";
import { classify, ROLE_COLORS, pickPrimaryRole } from "../lib/classify.js";
import {
  shuffleArr, bumpStreak, loadPracticeStreaks, resetPracticeStreak,
  matchCombosToHand, isBreaker, isHandtrap, inferDisruption, BB_DISRUPTIONS,
  loadBbStreaks, bumpBb,
} from "../lib/practice.js";
import { simulateCombo, describeStep } from "../lib/comboSim.js";
import { isCoreStep, comboBeatsTraps, COMMON_HANDTRAPS, trapShort } from "../lib/combos.js";
import { opponentHandtraps } from "../lib/matchupIntel.js";
import { getPlaybook } from "../components/Matchup.jsx";
import { getSidePlans, applyPlan, planMissing } from "../lib/sidePlans.js";
import CardPreview from "../components/CardPreview.jsx";
import EndBoardView from "../components/EndBoardView.jsx";
import Dropdown from "../components/Dropdown.jsx";
import Icon from "../components/Icon.jsx";

// ════════════════════════════════════════════════════════════════════
// TESTING TAB — Going first (goldfish: openers + which lines are live, with
// a walk-through) and Going second (board breaker: pick the opponent's end
// board, draw a Game-1 or sided Game-2 hand, judge if you can break it).
// ════════════════════════════════════════════════════════════════════
export default function TestingTab({ dataVersion = 0 }) {
  const [mode, setMode] = useState("first");
  const decks = useMemo(() => loadDecks(), [dataVersion]);
  const [deckId, setDeckId] = useState(() => getActiveDeckId() || (decks.find((d) => (d.role || "primary") !== "matchup") || decks[0] || {}).deckId || null);
  useEffect(() => { if (deckId && !decks.find((d) => d.deckId === deckId)) setDeckId((decks[0] || {}).deckId || null); }, [decks]); // eslint-disable-line react-hooks/exhaustive-deps
  const myDeck = decks.find((d) => d.deckId === deckId) || null;
  const pickDeck = (id) => { setDeckId(id); setActiveDeckId(id); }; // persists as the default

  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const mineDecks = decks.filter((d) => (d.role || "primary") !== "matchup").sort(byName);
  const oppDecks = decks.filter((d) => d.role === "matchup").sort(byName);
  const deckOpts = [
    ...(mineDecks.length ? [{ heading: "My decks" }, ...mineDecks.map((d) => [d.deckId, d.name])] : []),
    ...(oppDecks.length ? [{ heading: "Matchup decks" }, ...oppDecks.map((d) => [d.deckId, d.name])] : []),
  ];

  return (
    <div className="testing-tab">
      <div className="testing-modebar">
        <button type="button" className={"testing-mode-btn" + (mode === "first" ? " active" : "")} onClick={() => setMode("first")}>
          <Icon name="cards" size={15} /> Going first — your openers
        </button>
        <button type="button" className={"testing-mode-btn" + (mode === "second" ? " active" : "")} onClick={() => setMode("second")}>
          <Icon name="swords" size={15} /> Going second — break boards
        </button>
        <label className="testing-deck-field">
          <span className="testing-deck-label">Test with</span>
          <Dropdown className="testing-deck-dd" value={deckId || ""} placeholder="— pick a deck —" align="right"
            options={deckOpts} onChange={pickDeck} />
        </label>
      </div>

      {!myDeck ? (
        <div className="placeholder">
          <strong>No deck to test.</strong> Import one in <strong>Decks</strong>, then pick it above.
        </div>
      ) : mode === "first" ? (
        <Goldfish deck={myDeck} oppDecks={oppDecks} />
      ) : (
        <BoardBreaker myDeck={myDeck} dataVersion={dataVersion} />
      )}
    </div>
  );
}

const roleColor = (card) => {
  const r = card ? pickPrimaryRole(classify(card).roles || []) : null;
  return r ? ROLE_COLORS[r] || null : null;
};
const roleLabel = (card) => (card ? pickPrimaryRole(classify(card).roles || []) : null);

// ── Shared: a face-up card with image + name + role/util tag ─────────
function HandCard({ id, name, card, onHover, onPick, tagClass, tagLabel, role }) {
  const urls = getImageUrls(id);
  const [i, setI] = useState(0);
  const src = urls[i];
  const stripe = role ? ROLE_COLORS[role] : null;
  return (
    <div
      className={"hand-card" + (tagClass ? " " + tagClass : "")}
      style={stripe ? { borderTopColor: stripe } : undefined}
      title={name}
      onMouseEnter={(e) => card && onHover && onHover(card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={(e) => card && onPick && onPick(card, e.currentTarget.getBoundingClientRect())}
    >
      {src ? (
        <img src={src} alt={name} loading="lazy" onError={() => setI((n) => (n + 1 < urls.length ? n + 1 : n))} />
      ) : (
        <div className="hand-card-noimg">{name}</div>
      )}
      {tagLabel ? <span className={"hand-card-tag " + (tagClass || "")}>{tagLabel}</span>
        : role ? <span className="hand-card-tag is-role" style={{ color: stripe, borderColor: stripe }}>{role}</span> : null}
    </div>
  );
}

function usePreview() {
  const [preview, setPreview] = useState(null);
  const onHover = (card, rect) => setPreview((p) => (p && p.pinned ? p : (card ? { card, rect, pinned: false } : null)));
  const onPick = (card, rect) => { if (card) setPreview((p) => (p && p.pinned && p.card.id === card.id ? null : { card, rect, pinned: true })); };
  const clearHover = () => setPreview((p) => (p && p.pinned ? p : null));
  return { preview, setPreview, onHover, onPick, clearHover };
}

// ════════════════════════════════════════════════════════════════════
// GOING FIRST — Goldfish.
// ════════════════════════════════════════════════════════════════════
function Goldfish({ deck, oppDecks = [] }) {
  const [cardMap, setCardMap] = useState({});
  const [hand, setHand] = useState(null);
  const [streak, setStreak] = useState(() => loadPracticeStreaks()[deck.deckId] || null);
  const [vsTraps, setVsTraps] = useState([]); // "if they have…" handtraps to test against
  const [vsOppId, setVsOppId] = useState(""); // preset: pick an opponent → their traps
  const { preview, setPreview, onHover, onPick, clearHover } = usePreview();

  const main = useMemo(() => (deck.main || []).map(String), [deck]);

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

  const match = hand ? matchCombosToHand(hand.names, deck.deckId) : null;
  const lines = match ? match.combos : [];
  const handCards = hand ? hand.ids.map((id) => cardMap[Number(id)]) : [];

  // Hand readout — role tallies + a combo-driven verdict.
  const tally = { Starter: 0, Extender: 0, Handtrap: 0 };
  handCards.forEach((c) => { const rs = c ? (classify(c).roles || []) : []; ["Starter", "Extender", "Handtrap"].forEach((r) => { if (rs.includes(r)) tally[r]++; }); });
  const best = lines[0] && lines[0].status;
  const verdict = !hand ? null
    : best === "possible" ? { cls: "ok", text: "✓ A saved line opens from this hand" }
    : best === "likely" ? { cls: "ok", text: "≈ A line is likely live — starter in hand" }
    : best === "partial" ? { cls: "warn", text: "⚠ One card away from a saved line" }
    : { cls: "no", text: "No saved line opens — work it out by hand" };

  // "If they have…" — float the lines that play through the chosen handtraps.
  const statusOrder = { possible: 0, likely: 1, partial: 2, no: 3 };
  const beatsAllSel = (r) => vsTraps.length > 0 && vsTraps.every((t) => comboBeatsTraps(r.combo).includes(t));
  const shownLines = vsTraps.length
    ? [...lines].sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || ((beatsAllSel(b) ? 1 : 0) - (beatsAllSel(a) ? 1 : 0)))
    : lines;
  const toggleTrap = (t) => { setVsOppId(""); setVsTraps((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t])); };
  // Preset: pick an opponent → pre-select the handtraps THEY actually run.
  const pickVsOpp = (id) => {
    setVsOppId(id);
    if (!id) { setVsTraps([]); return; }
    const opp = oppDecks.find((d) => d.deckId === id);
    setVsTraps(opponentHandtraps(opp));
  };

  return (
    <div className="goldfish" onMouseLeave={clearHover}>
      <div className="practice-head">
        <div className="practice-head-left">
          <div className="practice-deckname">{deck.name}</div>
          <div className="practice-streak">
            {streak && streak.hands > 0 ? (
              <>
                <strong>{streak.hits}</strong> openable / {streak.hands} hands ·{" "}
                <strong>{Math.round((100 * streak.hits) / streak.hands)}%</strong> consistency
                <button type="button" className="link-btn" onClick={() => { resetPracticeStreak(deck.deckId); setStreak(null); }}>reset</button>
              </>
            ) : "Shuffle a few hands for a consistency read."}
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
            <div className="practice-empty">Shuffle to draw a hand.</div>
          ) : (
            <>
              <div className="hand-row">
                {hand.ids.map((id, idx) => (
                  <HandCard key={idx} id={id} name={hand.names[idx]} card={cardMap[Number(id)]}
                    onHover={onHover} onPick={onPick} role={roleLabel(cardMap[Number(id)])} />
                ))}
              </div>
              <div className="hand-readout">
                <span className={"hand-verdict is-" + verdict.cls}>{verdict.text}</span>
                <span className="hand-tally">
                  <span>{tally.Starter} starter{tally.Starter === 1 ? "" : "s"}</span>
                  <span>{tally.Extender} extender{tally.Extender === 1 ? "" : "s"}</span>
                  <span>{tally.Handtrap} handtrap{tally.Handtrap === 1 ? "" : "s"}</span>
                </span>
              </div>
            </>
          )}
        </section>

        <section className="practice-panel">
          <div className="practice-panel-title">Playable lines</div>
          {hand && lines.length ? (
            <div className="gf-trapfilter">
              <span className="gf-trapfilter-label">If they have</span>
              {COMMON_HANDTRAPS.map((t) => (
                <button key={t} type="button" title={t}
                  className={"gf-trap-toggle" + (vsTraps.includes(t) ? " active" : "")}
                  onClick={() => toggleTrap(t)}>{trapShort(t)}</button>
              ))}
              {oppDecks.length ? (
                <Dropdown className="gf-vsopp-dd" value={vsOppId} placeholder="vs deck…" align="right"
                  options={[["", "— any"], ...oppDecks.map((d) => [d.deckId, d.name])]} onChange={pickVsOpp} ariaLabel="Preset: opponent's handtraps" />
              ) : null}
              {vsTraps.length ? <button type="button" className="gf-trap-clear" onClick={() => { setVsTraps([]); setVsOppId(""); }}>clear</button> : null}
            </div>
          ) : null}
          {!hand ? (
            <div className="practice-empty">Draw a hand first.</div>
          ) : !lines.length ? (
            <div className="practice-empty">
              No combos saved for <strong>{deck.name}</strong> yet.<br />
              Extract some with the Chrome extension (or import JSON in the <strong>Combos</strong> tab) and they'll match here.
            </div>
          ) : (
            <div className={"lines-list" + (shownLines.length > 4 ? " is-full" : "")}>
              {shownLines.map((r) => <ComboLine key={r.idx} r={r} handNames={hand.names} vsTraps={vsTraps} onHover={onHover} onPick={onPick} />)}
            </div>
          )}
        </section>
      </div>

      {preview && preview.card && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ComboLine({ r, handNames, vsTraps, onHover, onPick }) {
  const [open, setOpen] = useState(false);
  const c = r.combo;
  const icon = r.status === "possible" ? "✓" : r.status === "likely" ? "≈" : r.status === "partial" ? "⚠" : "✗";
  const statusText = r.status === "possible" ? "Playable"
    : r.status === "likely" ? `Likely playable — ${c.userOpenerSize} opener piece${c.userOpenerSize === 1 ? "" : "s"} incl. a starter`
    : r.status === "partial" ? `Need 1 more: ${r.missing[0]}`
    : `Need ${r.missing.length}: ${r.missing.slice(0, 2).join(", ")}${r.missing.length > 2 ? "…" : ""}`;
  const have = new Set((handNames || []).filter(Boolean));
  const title = c.userTitle || c.title || c.comboName || c.name || (c.openingHand || []).join(" + ") || "Combo";
  const plays = open ? simulateCombo(c).filter(isCoreStep) : [];
  const traps = comboBeatsTraps(c);
  const vs = vsTraps || [];
  const folds = vs.filter((t) => !traps.includes(t));
  const survives = vs.length > 0 && folds.length === 0;
  return (
    <div className={"combo-line is-" + r.status + (vs.length ? (survives ? " vs-ok" : " vs-fold") : "")}>
      <div className="combo-line-head">
        <span className="combo-line-status">{icon}</span>
        <span className="combo-line-name">{title}</span>
        {traps.length ? (
          <span className="combo-line-traps">
            {traps.map((t) => <span key={t} className={"combo-line-trap" + (vs.includes(t) ? " is-sel" : "")} title={"Plays through " + t}>{trapShort(t)}</span>)}
          </span>
        ) : null}
        {(c.steps || []).length ? <button type="button" className="combo-line-walk" onClick={() => setOpen((o) => !o)}>{open ? "Hide line" : "Walk the line ▸"}</button> : null}
      </div>
      {vs.length ? (
        <div className={"combo-line-vs " + (survives ? "is-ok" : "is-fold")}>
          {survives ? `✓ Plays through ${vs.map(trapShort).join(" + ")}` : `✗ Folds to ${folds.map(trapShort).join(" + ")}`}
        </div>
      ) : null}
      <div className="combo-line-needs">
        <span className="muted">Need{r.need.length === 1 ? "" : "s"}:</span>{" "}
        {r.need.map((n, i) => (
          <span key={i} className={have.has(n) ? "have" : "miss"}>{n}{i < r.need.length - 1 ? " · " : ""}</span>
        ))}
        <span className="muted" style={{ marginLeft: 8 }}>· {statusText}</span>
      </div>
      {c.userOpenerSize != null && (c.openingHand || []).length > c.userOpenerSize && (
        <div className="combo-line-trim-hint" title="Matching requires every recorded opener card to be in your hand — extracted combos record the whole 5-card hand, so trim it down to the real opener.">
          ✂ {(c.openingHand || []).length} cards recorded for a {c.userOpenerSize}-card line — trim it in <strong>Combos → ✎ Edit</strong>.
        </div>
      )}
      {open && (
        <ol className="combo-line-steps">
          {plays.length ? plays.map((s, i) => <li key={i}><span className="combo-drill-n">{i + 1}</span><span>{describeStep(s)}</span></li>)
            : <li className="muted">No detailed steps recorded for this combo.</li>}
        </ol>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// GOING SECOND — Board Breaker.
// ════════════════════════════════════════════════════════════════════
function BoardBreaker({ myDeck, dataVersion }) {
  const { opponents, matchupOf } = useMemo(() => {
    const decks = loadDecks();
    const fmts = loadFormats();
    const fmt = fmts.find((f) => f.formatId === getActiveFormatId()) || fmts[0] || null;
    const matchups = (fmt && fmt.matchups) || [];
    const opps = matchups.map((m) => decks.find((d) => d.deckId === m.opponentDeckId)).filter(Boolean);
    const byId = {};
    matchups.forEach((m) => { byId[m.opponentDeckId] = m; });
    const list = opps.length ? opps : decks.filter((d) => d.role === "matchup");
    return { opponents: list, matchupOf: byId };
  }, [dataVersion]);

  const [oppId, setOppId] = useState(opponents[0] ? opponents[0].deckId : null);
  useEffect(() => { if (!opponents.find((d) => d.deckId === oppId)) setOppId(opponents[0] ? opponents[0].deckId : null); }, [opponents, oppId]);

  const opp = opponents.find((d) => d.deckId === oppId) || null;
  const matchup = oppId ? matchupOf[oppId] : null;
  const pb = getPlaybook(matchup, opp);
  const boards = pb.endboards || [];

  const [boardIdx, setBoardIdx] = useState(0);
  const [sidePlanId, setSidePlanId] = useState(null); // null = Game 1 (no siding)
  const [myCardMap, setMyCardMap] = useState({});
  const [oppCardMap, setOppCardMap] = useState({});
  const [hand, setHand] = useState(null);
  const [tally, setTally] = useState(null);
  const { preview, setPreview, onHover, onPick, clearHover } = usePreview();

  const dl = useMemo(() => getDeckPrimaryDecklist(myDeck), [myDeck]);
  const myMain = useMemo(() => (dl.main || []).map(String), [dl]);
  const mySide = useMemo(() => (dl.side || []).map(String), [dl]);
  const myAll = useMemo(() => [...myMain, ...mySide], [myMain, mySide]);
  const tallyKey = myDeck.deckId + ":" + (oppId || "");

  useEffect(() => { let alive = true; fetchCards(myAll).then(({ map }) => { if (alive) setMyCardMap(map); }); return () => { alive = false; }; }, [myAll]);

  useEffect(() => {
    let alive = true;
    setHand(null); setBoardIdx(0); setSidePlanId(null);
    setTally(loadBbStreaks()[tallyKey] || null);
    if (!opp) { setOppCardMap({}); return; }
    fetchCards([...(opp.main || []), ...(opp.extra || []), ...(opp.side || [])]).then(({ map }) => {
      if (!alive) return;
      const byName = {};
      Object.values(map).forEach((c) => { if (c && c.name) byName[c.name.toLowerCase()] = c; });
      setOppCardMap(byName);
    });
    return () => { alive = false; };
  }, [opp, tallyKey]);

  const nameOf = (id) => (myCardMap[Number(id)] && myCardMap[Number(id)].name) || `#${id}`;
  const sideIdByName = useMemo(() => {
    const m = {};
    mySide.forEach((id) => { const n = myCardMap[Number(id)] && myCardMap[Number(id)].name; if (n && !m[n.toLowerCase()]) m[n.toLowerCase()] = id; });
    return m;
  }, [mySide, myCardMap]);

  // Side plans live on the matchup (built in Format); pick one to draw a sided
  // hand. Missing-card flagging if your decklist no longer has a plan's cards.
  const plans = getSidePlans(matchup);
  const activePlan = plans.find((p) => p.id === sidePlanId) || null;
  const mainNames = useMemo(() => myMain.map(nameOf), [myMain, myCardMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const sideNames = useMemo(() => mySide.map(nameOf), [mySide, myCardMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const sidedDeck = useMemo(() => applyPlan(myMain, activePlan, nameOf, sideIdByName), [myMain, activePlan, sideIdByName, myCardMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = activePlan ? planMissing(activePlan, mainNames, sideNames) : { out: [], in: [] };
  const fmtSide = (arr) => (arr || []).map((x) => `${x.count}× ${x.name}`).join(", ");
  const drawPool = sidedDeck;

  const board = (boards[boardIdx] ? (boards[boardIdx].cards || []) : []).map((x) => (typeof x === "string" ? x : x.name)).filter(Boolean).map((name) => {
    const card = oppCardMap[String(name).toLowerCase()] || null;
    return { name, card, disruption: card ? inferDisruption(card) : "negate" };
  });
  const boardNames = board.map((p) => p.name);

  const shuffle = () => { if (!drawPool.length) return; const ids = shuffleArr(drawPool).slice(0, Math.min(6, drawPool.length)); setHand({ ids, names: ids.map(nameOf) }); };
  const assess = (verdict) => setTally(bumpBb(tallyKey, verdict));

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
    <div className="board-breaker" onMouseLeave={clearHover}>
      <div className="bb-bar">
        <label className="bb-field">
          <span className="bb-field-label">Opponent</span>
          <Dropdown className="bb-opp-dd" value={oppId || ""} ariaLabel="Opponent deck"
            options={opponents.map((d) => [d.deckId, d.name])} onChange={(v) => setOppId(v)} />
        </label>
        {boards.length > 1 && (
          <label className="bb-field">
            <span className="bb-field-label">Their board</span>
            <Dropdown className="bb-board-dd" value={String(boardIdx)} ariaLabel="End board"
              options={boards.map((b, i) => [String(i), b.name || `Board ${i + 1}`])} onChange={(v) => setBoardIdx(Number(v))} />
          </label>
        )}
        <label className="bb-field">
          <span className="bb-field-label">Side plan</span>
          <Dropdown className="bb-side-dd" value={sidePlanId || ""} ariaLabel="Side plan"
            options={[["", "Game 1 — no siding"], ...plans.map((p) => [p.id, `${p.name} · ${p.going === "first" ? "1st" : "2nd"}`])]}
            onChange={(v) => { setSidePlanId(v || null); setHand(null); }} />
        </label>
        <button type="button" className="btn-primary bb-shuffle" onClick={shuffle} disabled={!drawPool.length}>
          <Icon name="die" size={16} /> Shuffle 6
        </button>
      </div>

      {activePlan ? (
        <div className="bb-sideplan">
          <span className="bb-sideplan-label">{activePlan.name}:</span>
          {(activePlan.in || []).length ? <span className="bb-in">+ {fmtSide(activePlan.in)}</span> : null}
          {(activePlan.out || []).length ? <span className="bb-out">− {fmtSide(activePlan.out)}</span> : null}
          {(missing.out.length || missing.in.length) ? <span className="bb-side-missing" title="These plan cards aren't in your current decklist">⚠ not in deck: {[...missing.out, ...missing.in].join(", ")}</span> : null}
        </div>
      ) : plans.length ? (
        <div className="bb-sideplan is-hint"><span className="bb-sideplan-label">Tip:</span> pick a <strong>Side plan</strong> above to draw your post-side hand.</div>
      ) : (
        <div className="bb-sideplan is-hint"><span className="bb-sideplan-label">Tip:</span> build side plans in <strong>Format → {opp ? opp.name : "this matchup"} → Side-deck plan</strong>, then apply them here.</div>
      )}

      <div className="bb-puzzle">
        <section className="bb-col">
          <div className="bb-col-title">{opp ? opp.name : "Opponent"}'s board{boards.length > 1 && boards[boardIdx]?.name ? ` — ${boards[boardIdx].name}` : ""}</div>
          {!board.length ? (
            <div className="practice-empty">
              No end board recorded for this matchup yet. Add one in <strong>Decks → {opp ? opp.name : "this matchup"} →
              Playbook → Their end boards</strong>, and it'll show here.
            </div>
          ) : (
            <>
              <EndBoardView cards={boardNames} onHover={onHover} onPick={onPick} />
              {disruptions ? (
                <div className="bb-disruptions">
                  {board.filter((p) => p.disruption !== "body").map((p, i) => {
                    const dis = BB_DISRUPTIONS.find((d) => d.value === p.disruption) || BB_DISRUPTIONS[0];
                    return (
                      <span key={i} className={"bb-dis-chip " + dis.cls}
                        onMouseEnter={(e) => p.card && onHover(p.card, e.currentTarget.getBoundingClientRect())}
                        onClick={(e) => p.card && onPick(p.card, e.currentTarget.getBoundingClientRect())}>
                        <span className="bb-dis-name">{p.name}</span>
                        <span className="bb-dis-tag">{dis.label}</span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="bb-col">
          <div className="bb-col-title">Your hand — {activePlan ? activePlan.name : "game 1 (no side)"}</div>
          {!hand ? (
            <div className="practice-empty">Shuffle a hand to start.</div>
          ) : (
            <div className="hand-row">
              {hand.ids.map((id, idx) => {
                const card = myCardMap[Number(id)];
                const br = isBreaker(card), ht = isHandtrap(card);
                return (
                  <HandCard key={idx} id={id} name={hand.names[idx]} card={card} onHover={onHover} onPick={onPick}
                    tagClass={br ? "is-breaker" : ht ? "is-handtrap" : ""} tagLabel={br ? "breaker" : ht ? "handtrap" : ""} />
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
            <span className="bb-gauge-hint">— a gauge, not a verdict.</span>
          </div>
          <div className="bb-assess-q">Can you break it? Record the call:</div>
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

      {preview && preview.card && <CardPreview card={preview.card} rect={preview.rect} pinned={preview.pinned} onClose={() => setPreview(null)} />}
    </div>
  );
}
