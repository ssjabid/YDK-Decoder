// Hand-built SVG icons — custom, YGO-flavored line icons (no emoji).
// stroke uses currentColor so they inherit text color. 24x24 grid.
const PATHS = {
  // Summon burst — a 4-point star with sparkles. Replaces the ⚡ on actions.
  summon: (
    <>
      <path d="M12 2.5 L13.7 9.4 L20.5 11 L13.7 12.6 L12 21.5 L10.3 12.6 L3.5 11 L10.3 9.4 Z"
        fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="18.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Stacked cards — Decks tab.
  cards: (
    <>
      <rect x="7" y="3.5" width="11" height="15" rx="2" transform="rotate(8 12.5 11)" />
      <rect x="4.5" y="6" width="11" height="15" rx="2" />
    </>
  ),
  // Crossed swords — Format / matchups.
  swords: (
    <>
      <path d="M4 4 L13 13" /><path d="M20 4 L11 13" />
      <path d="M3.2 6.5 L6.5 3.2" /><path d="M20.8 6.5 L17.5 3.2" />
      <path d="M9 15 L5.5 18.5 L4 17 L7.5 13.5" />
      <path d="M15 15 L18.5 18.5 L20 17 L16.5 13.5" />
    </>
  ),
  // Target — Testing.
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Sliders — Settings.
  sliders: (
    <>
      <path d="M4 7 H20" /><path d="M4 12 H20" /><path d="M4 17 H20" />
      <circle cx="9" cy="7" r="2.1" fill="var(--bg-elevated)" />
      <circle cx="16" cy="12" r="2.1" fill="var(--bg-elevated)" />
      <circle cx="8" cy="17" r="2.1" fill="var(--bg-elevated)" />
    </>
  ),
  // Die — shuffle / draw.
  die: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.7 }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={"icon " + className}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      style={{ display: "inline-block", verticalAlign: "-0.18em", flexShrink: 0 }}
    >
      {body}
    </svg>
  );
}
