/** Small inline SVG icons used across the UI. */

export function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="arrow">
      {up ? <path d="M12 3 4 13h5v8h6v-8h5z" /> : <path d="M12 21 4 11h5V3h6v8h5z" />}
    </svg>
  );
}

export function Crown() {
  return (
    <svg className="crown" viewBox="0 0 64 44" aria-hidden="true">
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset=".5" stopColor="#ffc928" />
          <stop offset="1" stopColor="#c47a00" />
        </linearGradient>
      </defs>
      <path
        d="M4 14 18 26 32 4l14 22 14-12-6 26H10z"
        fill="url(#crownGold)"
        stroke="#7a4500"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="13" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <circle cx="32" cy="5" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <circle cx="60" cy="13" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <rect x="10" y="36" width="44" height="6" rx="2" fill="#e9a400" stroke="#7a4500" strokeWidth="2" />
    </svg>
  );
}

export function Coins() {
  return (
    <svg className="icon coins" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="9" cy="17" rx="7" ry="3" fill="#e9a400" />
      <ellipse cx="9" cy="15" rx="7" ry="3" fill="#ffd34d" stroke="#b77800" />
      <ellipse cx="15" cy="10" rx="7" ry="3" fill="#e9a400" />
      <ellipse cx="15" cy="8" rx="7" ry="3" fill="#ffe27a" stroke="#b77800" />
    </svg>
  );
}

export function Clock() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.3-5.6" fill="none" stroke="#ffd34d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 4v4h4M12 7v5l3 2" fill="none" stroke="#ffd34d" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.3 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  );
}
