import { useEffect, useState } from "react";

// A quick branded launch animation — two cards fan out, the wordmark fades in,
// then the whole thing dissolves. Shows on mount (a fresh PWA launch is a new
// page load, so you get it on open). Tap to skip; honours reduced-motion via
// CSS. No persistent "shown" gate on purpose — that breaks under StrictMode's
// mount→unmount→remount.
export default function Splash() {
  const [show, setShow] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
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
      <div className="splash-word">YDK <span className="accent">Decoder</span></div>
    </div>
  );
}
