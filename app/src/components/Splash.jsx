import { useEffect, useState } from "react";
import { KEYS, readLs, writeLs } from "../lib/storage.js";

// A quick branded launch animation — two cards fan out, the wordmark fades in,
// then the whole thing dissolves. Tap to skip; honours reduced-motion via CSS.
// COOLDOWN: it only plays on a genuinely cold open (>3 min since last shown).
// Quickly hopping out of the app and back used to replay it every time, which
// read as "the app restarted and I lost my place". StrictMode-safe: the gate
// is READ in the initializer but only WRITTEN in the effect (double-invoked
// initial renders both read the old stamp, so both agree).
const COOLDOWN_MS = 3 * 60 * 1000;

export default function Splash() {
  const [show, setShow] = useState(() => {
    const at = Number(readLs(KEYS.splashAt) || 0);
    return !(at && Date.now() - at < COOLDOWN_MS);
  });
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!show) return;
    writeLs(KEYS.splashAt, Date.now());
    const t1 = setTimeout(() => setHiding(true), 1150);
    const t2 = setTimeout(() => setShow(false), 1560);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;
  const skip = () => { setHiding(true); setTimeout(() => setShow(false), 340); };

  return (
    <div className={"splash" + (hiding ? " is-hiding" : "")} onClick={skip} role="presentation">
      <div className="splash-mark">
        <span className="splash-card splash-card-back" />
        <span className="splash-card splash-card-front" />
      </div>
      <div className="splash-word">YDK Decoder</div>
    </div>
  );
}
