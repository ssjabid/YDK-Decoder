import { useEffect, useState } from "react";
import { KEYS, writeLs } from "../lib/storage.js";

// A quick branded launch animation — two cards fan out, the lockup fades in,
// then the whole thing dissolves. Tap to skip; honours reduced-motion via CSS.
// Plays on EVERY page load — Abid wants the animation on every real open, and
// quick app-switches never remount the page anyway, so there's nothing to
// gate. (A 3-min cooldown tried here just made the splash look broken: he
// reopens the app more often than that, so it never played. 2026-08-08.)
export default function Splash() {
  const [show, setShow] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    writeLs(KEYS.splashAt, Date.now()); // stamp kept for diagnostics only
    const t1 = setTimeout(() => setHiding(true), 1150);
    const t2 = setTimeout(() => setShow(false), 1560);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;
  const skip = () => { setHiding(true); setTimeout(() => setShow(false), 340); };

  return (
    <div className={"splash" + (hiding ? " is-hiding" : "")} onClick={skip} role="presentation">
      <div className="splash-mark">
        <span className="splash-card splash-card-back" />
        <span className="splash-card splash-card-front" />
      </div>
      <div className="splash-word">
        <span className="splash-word-ydk">YDK</span>
        <span className="splash-word-decoder">Decoder</span>
      </div>
    </div>
  );
}
