import { TOTAL_BALLS } from '../game/game';

/** Middle of 1–75: 37 balls below it, 37 above. */
const MIDDLE = Math.ceil(TOTAL_BALLS / 2);

const pos = (n: number) => `${((n - 0.5) / TOTAL_BALLS) * 100}%`;

/**
 * Round Progress: a 1–75 track. Balls still in the drum below the current ball
 * are red, above it green; drawn balls are dimmed. A gold pin marks the ball
 * showing now and a line marks the middle (38).
 */
export function RangeBar({ current, remaining }: { current: number | null; remaining: readonly number[] }) {
  const left = new Set(remaining);
  const lower = current === null ? 0 : remaining.filter((b) => b < current).length;
  const higher = current === null ? 0 : remaining.filter((b) => b > current).length;
  return (
    <div className="range">
      <div className="range-head">
        <span className="range-title">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2" y="11" width="4" height="7" rx="1" />
            <rect x="8" y="7" width="4" height="11" rx="1" />
            <rect x="14" y="3" width="4" height="15" rx="1" />
          </svg>
          Round Progress
        </span>
        <span className="range-counts">
          <span className="range-low">▼ {lower} lower</span>
          <span className="range-high">▲ {higher} higher</span>
        </span>
      </div>
      <div className="range-body">
        <div
          className="range-track"
          role="img"
          aria-label={current === null ? 'No ball yet' : `${lower} balls lower and ${higher} higher than ${current}`}
        >
          {Array.from({ length: TOTAL_BALLS }, (_, i) => i + 1).map((n) => {
            const kind = n === current ? 'now' : !left.has(n) ? 'out' : current !== null && n < current ? 'lo' : 'hi';
            return <span key={n} className={`tick ${kind}`} />;
          })}
          <span className="range-mid" style={{ left: pos(MIDDLE) }} />
        </div>
        {current !== null && (
          <span className="range-pin" style={{ left: pos(current) }}>
            {current}
          </span>
        )}
      </div>
      <div className="range-scale">
        <span>1</span>
        <span className="range-mid-label" style={{ left: pos(MIDDLE) }}>
          {MIDDLE} middle
        </span>
        <span>{TOTAL_BALLS}</span>
      </div>
    </div>
  );
}
