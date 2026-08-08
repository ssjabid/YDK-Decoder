import { useEffect, useMemo, useState } from "react";
import {
  sessionsForDeck, newSession, persistSession, deleteSession,
  logGame, updateGame, removeGame, recordOf, aggregate, knownOpponents,
} from "../lib/sessions.js";
import { fetchCards } from "../lib/ydk.js";
import { getDeckPrimaryDecklist } from "../lib/deckModel.js";
import { confirmModal, promptModal } from "../lib/modal.js";
import Dropdown from "./Dropdown.jsx";
import Icon from "./Icon.jsx";

// ════════════════════════════════════════════════════════════════════
// GAME LOG — Testing → "Log games". You do the playing (locals, remote
// testing, wherever); the app makes recording it one tap: opponent deck +
// who went first stay set between games, W/L/D logs instantly, and notes /
// impactful cards attach to any game after the fact. Sessions group games
// by sitting (and tech configuration), so different builds can be compared.
// ════════════════════════════════════════════════════════════════════
export default function GameLog({ deck, oppDecks = [], onEditDeck, dataVersion = 0 }) {
  const [v, setV] = useState(0);
  const bump = () => setV((x) => x + 1);
  const sessions = useMemo(() => sessionsForDeck(deck.deckId), [deck.deckId, v, dataVersion]);

  const [sessionId, setSessionId] = useState(null);
  useEffect(() => {
    if (!sessions.find((s) => s.sessionId === sessionId)) setSessionId(sessions[0] ? sessions[0].sessionId : null);
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = sessions.find((s) => s.sessionId === sessionId) || null;

  const [scope, setScope] = useState("session"); // stats over this session | all sessions of this deck
  const [openGame, setOpenGame] = useState(null);

  // Sticky quick-log inputs — set once, log many.
  const [opp, setOpp] = useState("");
  const [custom, setCustom] = useState("");
  const [turn, setTurn] = useState(null); // true = 1st, false = 2nd, null = not recorded

  const oppNames = useMemo(() => knownOpponents(oppDecks), [oppDecks, v]);

  // Deck card names → <datalist> suggestions for the impactful/underperformed inputs.
  const [cardNames, setCardNames] = useState([]);
  useEffect(() => {
    let alive = true;
    const dl = getDeckPrimaryDecklist(deck) || {};
    const ids = [...new Set([...(dl.main || []), ...(dl.extra || []), ...(dl.side || [])].map(String))];
    fetchCards(ids).then(({ map }) => {
      if (!alive) return;
      setCardNames([...new Set(Object.values(map).map((c) => c && c.name).filter(Boolean))].sort());
    });
    return () => { alive = false; };
  }, [deck]);

  const start = () => { const s = newSession(deck.deckId); setSessionId(s.sessionId); setScope("session"); bump(); };
  const rename = async () => {
    if (!session) return;
    const name = await promptModal({ title: "Rename session", value: session.name, confirmText: "Save" });
    if (name != null && name.trim()) { session.name = name.trim(); persistSession(session); bump(); }
  };
  const del = async () => {
    if (!session) return;
    const n = (session.games || []).length;
    if (await confirmModal({ title: `Delete "${session.name}"?`, message: n ? `Its ${n} logged game${n === 1 ? "" : "s"} will be removed too.` : "It has no games logged.", confirmText: "Delete session", danger: true })) {
      deleteSession(session.sessionId); bump();
    }
  };

  const oppName = opp === "__custom" ? custom.trim() : opp;
  const log = (result) => {
    if (!session) return;
    logGame(session, { opp: oppName, result, first: turn });
    if (opp === "__custom" && custom.trim()) { setOpp(custom.trim()); setCustom(""); } // the new name is now a known opponent
    bump();
  };

  const games = scope === "all" ? sessions.flatMap((s) => s.games || []) : (session ? session.games || [] : []);
  const agg = useMemo(() => aggregate(games), [games]);

  // ── Empty state: no sessions for this deck yet ─────────────────────
  if (!sessions.length) {
    return (
      <div className="gamelog">
        <div className="gl-start">
          <div className="gl-start-copy">
            <strong>Track your real testing.</strong> Start a session for <strong>{deck.name}</strong>, play
            your games anywhere, and log each one in a single tap — opponent deck, result, who went first.
            Add notes and the cards that over/under-performed, and the tally builds your matchup spread as you play.
          </div>
          <button type="button" className="btn-primary" onClick={start}><Icon name="tally" size={16} /> Start a session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gamelog">
      <datalist id="gl-cardnames">{cardNames.map((n) => <option key={n} value={n} />)}</datalist>

      <div className="gl-sessionbar">
        <Dropdown className="gl-session-dd" value={sessionId || ""} placeholder="— session —" ariaLabel="Session"
          options={sessions.map((s) => { const r = recordOf(s.games); return [s.sessionId, `${s.name} · ${r.w}-${r.l}-${r.d}`]; })}
          onChange={(id) => { setSessionId(id); setScope("session"); setOpenGame(null); }} />
        <button type="button" className="btn-secondary gl-new-btn" onClick={start}>+ New session</button>
        <button type="button" className="btn-secondary gl-icon-btn" title="Rename session" aria-label="Rename session" onClick={rename}>✎</button>
        <button type="button" className="btn-secondary gl-icon-btn gl-del-btn" title="Delete session" aria-label="Delete session" onClick={del}>×</button>
        {onEditDeck ? <button type="button" className="link-btn gl-editdeck" onClick={() => onEditDeck(deck.deckId)}>Edit deck →</button> : null}
      </div>

      {session && (
        <label className="gl-tech">
          <span className="gl-tech-lbl">Testing</span>
          <input key={session.sessionId} className="gl-tech-input" defaultValue={session.tech}
            placeholder='What this session is testing — e.g. "3× Droll side, no Bystials"'
            onBlur={(e) => { if (e.target.value !== session.tech) { session.tech = e.target.value; persistSession(session); bump(); } }} />
        </label>
      )}

      <div className="practice-grid">
        {/* ── Left: one-tap logger + the session's games ── */}
        <section className="practice-panel">
          <div className="practice-panel-title">Log a game</div>
          <div className="gl-quick">
            <div className="gl-quick-row">
              <Dropdown className="gl-opp-dd" value={opp} placeholder="Opponent deck…" ariaLabel="Opponent deck"
                options={[...oppNames.map((n) => [n, n]), ["__custom", "✎ Type a name…"]]} onChange={(x) => setOpp(x)} />
              <div className="gl-turn" role="group" aria-label="Who went first">
                <button type="button" className={turn === true ? "active" : ""} onClick={() => setTurn((t) => (t === true ? null : true))}>1st</button>
                <button type="button" className={turn === false ? "active" : ""} onClick={() => setTurn((t) => (t === false ? null : false))}>2nd</button>
              </div>
              {opp === "__custom" && (
                <input className="gl-custom-input" placeholder="Opponent deck name" value={custom}
                  onChange={(e) => setCustom(e.target.value)} autoFocus />
              )}
            </div>
            <div className="gl-result-btns">
              <button type="button" className="gl-result-btn is-w" onClick={() => log("W")}>✓ Win</button>
              <button type="button" className="gl-result-btn is-d" onClick={() => log("D")}>– Draw</button>
              <button type="button" className="gl-result-btn is-l" onClick={() => log("L")}>✗ Loss</button>
            </div>
            <div className="gl-quick-hint">One tap logs it — opponent &amp; turn stay set for the next game. Tap a game below to add notes.</div>
          </div>

          <div className="gl-games-lbl">Games — {session ? session.name : "this session"}</div>
          {!(session && (session.games || []).length) ? (
            <div className="practice-empty">Nothing logged yet — play a game and hit <strong>Win</strong> / <strong>Loss</strong>.</div>
          ) : (
            <div className="gl-games">
              {session.games.map((g, idx) => (
                <div key={g.gameId} className={"gl-game" + (openGame === g.gameId ? " is-open" : "")}>
                  <button type="button" className="gl-game-head" onClick={() => setOpenGame((o) => (o === g.gameId ? null : g.gameId))}>
                    <span className="gl-game-n">#{session.games.length - idx}</span>
                    <span className={"gl-chip is-" + g.result.toLowerCase()}>{g.result}</span>
                    <span className="gl-game-opp">{g.opp || "Unknown deck"}</span>
                    {g.first != null && <span className="gl-game-turn">{g.first ? "1st" : "2nd"}</span>}
                    {(g.notes || g.mvp || g.dud) ? <span className="gl-game-hasnotes" title="Has notes">✎</span> : null}
                    <span className="gl-game-time">{fmtWhen(g.at)}</span>
                  </button>
                  {openGame === g.gameId && (
                    <div className="gl-game-edit">
                      <div className="gl-game-editrow">
                        <span className="gl-edit-lbl">Result</span>
                        {["W", "D", "L"].map((r) => (
                          <button key={r} type="button" className={"gl-chip-btn is-" + r.toLowerCase() + (g.result === r ? " active" : "")}
                            onClick={() => { updateGame(session, g.gameId, { result: r }); bump(); }}>{r}</button>
                        ))}
                        <span className="gl-edit-lbl">Turn</span>
                        <button type="button" className={"gl-mini" + (g.first === true ? " active" : "")}
                          onClick={() => { updateGame(session, g.gameId, { first: g.first === true ? null : true }); bump(); }}>1st</button>
                        <button type="button" className={"gl-mini" + (g.first === false ? " active" : "")}
                          onClick={() => { updateGame(session, g.gameId, { first: g.first === false ? null : false }); bump(); }}>2nd</button>
                        <button type="button" className="gl-game-del" title="Delete game" aria-label="Delete game"
                          onClick={async () => { if (await confirmModal({ title: "Delete this game?", confirmText: "Delete game", danger: true })) { removeGame(session, g.gameId); bump(); } }}>×</button>
                      </div>
                      <textarea className="gl-notes" defaultValue={g.notes} placeholder="Notes — what decided the game?"
                        onBlur={(e) => { if (e.target.value !== g.notes) { updateGame(session, g.gameId, { notes: e.target.value }); bump(); } }} />
                      <div className="gl-game-editrow">
                        <input className="gl-cardinput is-mvp" list="gl-cardnames" defaultValue={g.mvp} placeholder="Impactful cards (comma-separated)"
                          onBlur={(e) => { if (e.target.value !== g.mvp) { updateGame(session, g.gameId, { mvp: e.target.value }); bump(); } }} />
                        <input className="gl-cardinput is-dud" list="gl-cardnames" defaultValue={g.dud} placeholder="Underperformed"
                          onBlur={(e) => { if (e.target.value !== g.dud) { updateGame(session, g.gameId, { dud: e.target.value }); bump(); } }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Right: the tally — record, splits, matchup spread, card calls ── */}
        <section className="practice-panel">
          <div className="practice-panel-title gl-stats-title">
            <span>Results</span>
            {sessions.length > 1 && (
              <span className="gl-scope" role="group" aria-label="Stats scope">
                <button type="button" className={scope === "session" ? "active" : ""} onClick={() => setScope("session")}>This session</button>
                <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>All ({sessions.length})</button>
              </span>
            )}
          </div>
          {agg.record.n === 0 ? (
            <div className="practice-empty">The tally appears after the first logged game.</div>
          ) : (
            <>
              <div className="gl-tiles">
                <div className="gl-tile"><div className="gl-tile-num">{agg.record.n}</div><div className="gl-tile-lbl">Games</div></div>
                <div className="gl-tile"><div className="gl-tile-num">{agg.record.w}-{agg.record.l}-{agg.record.d}</div><div className="gl-tile-lbl">W-L-D</div></div>
                <div className="gl-tile"><div className="gl-tile-num">{agg.record.pct}%</div><div className="gl-tile-lbl">Win rate</div></div>
              </div>
              <Bar r={agg.record} />
              <div className="gl-bar-legend">
                <span><i className="seg-w" />{agg.record.w} W</span>
                {agg.record.d > 0 && <span><i className="seg-d" />{agg.record.d} D</span>}
                <span><i className="seg-l" />{agg.record.l} L</span>
              </div>

              {(agg.first.n > 0 || agg.second.n > 0) && (
                <>
                  <div className="gl-section-lbl">Going 1st vs 2nd</div>
                  <div className="gl-rows">
                    <StatRow label="Going 1st" r={agg.first} />
                    <StatRow label="Going 2nd" r={agg.second} />
                  </div>
                </>
              )}

              <div className="gl-section-lbl">By opponent</div>
              <div className="gl-rows">
                {agg.opps.map((o) => <StatRow key={o.opp} label={o.opp} r={o} strong />)}
              </div>

              {agg.mvps.length > 0 && (
                <>
                  <div className="gl-section-lbl">Impactful cards</div>
                  <div className="gl-cardtags">{agg.mvps.map(([n, c]) => <span key={n} className="gl-cardtag is-mvp">{n}{c > 1 ? ` ×${c}` : ""}</span>)}</div>
                </>
              )}
              {agg.duds.length > 0 && (
                <>
                  <div className="gl-section-lbl">Underperformed</div>
                  <div className="gl-cardtags">{agg.duds.map(([n, c]) => <span key={n} className="gl-cardtag is-dud">{n}{c > 1 ? ` ×${c}` : ""}</span>)}</div>
                </>
              )}

              {scope === "all" && sessions.length > 1 && (
                <>
                  <div className="gl-section-lbl">Sessions compared</div>
                  <div className="gl-rows">
                    {sessions.map((s) => {
                      const r = recordOf(s.games);
                      return (
                        <button key={s.sessionId} type="button" className="gl-sess-row"
                          title="Open this session" onClick={() => { setSessionId(s.sessionId); setScope("session"); }}>
                          <span className="gl-sess-name">
                            <span className="gl-opp-name">{s.name}</span>
                            {s.tech ? <span className="gl-sess-tech">{s.tech}</span> : null}
                          </span>
                          <span className="gl-rec">{r.w}-{r.l}-{r.d}</span>
                          <span className="gl-pct">{r.n ? r.pct + "%" : "—"}</span>
                          <Bar r={r} small />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// Stacked W/D/L proportion bar. Status colors are never the only encoding —
// the letters/records sit right beside every bar (and each segment has a title).
function Bar({ r, small = false }) {
  if (!r || !r.n) return small ? <span className="gl-bar gl-bar-sm is-empty" /> : null;
  return (
    <div className={"gl-bar" + (small ? " gl-bar-sm" : "")} role="img" aria-label={`${r.w} wins, ${r.d} draws, ${r.l} losses`}>
      {r.w > 0 && <span className="seg-w" style={{ flexGrow: r.w }} title={`${r.w} W`} />}
      {r.d > 0 && <span className="seg-d" style={{ flexGrow: r.d }} title={`${r.d} D`} />}
      {r.l > 0 && <span className="seg-l" style={{ flexGrow: r.l }} title={`${r.l} L`} />}
    </div>
  );
}

function StatRow({ label, r, strong = false }) {
  return (
    <div className="gl-opp-row">
      <span className={strong ? "gl-opp-name" : "gl-split-lbl"} title={label}>{label}</span>
      <span className="gl-rec">{r.w}-{r.l}-{r.d}</span>
      <span className="gl-pct">{r.n ? r.pct + "%" : "—"}</span>
      <Bar r={r} small />
    </div>
  );
}

function fmtWhen(at) {
  const d = new Date(at);
  if (isNaN(d)) return "";
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
