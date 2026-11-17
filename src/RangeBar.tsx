import { TOTAL_BALLS, letterFor } from './game';

/** Middle of 1–75: 37 balls below it, 37 above. */
export const MIDDLE = Math.ceil(TOTAL_BALLS / 2);

const pos = (n: number) => `${((n - 0.5) / TOTAL_BALLS) * 100}%`;

/**
 * A 1–75 track: one tick per ball still in the drum, the middle (38) marked,
 * and a pin on the ball showing now. Lets the player see the odds at a glance.
 */
export function RangeBar({ current, remaining }: { current: number | null; remaining: readonly number[] }) {
  const left = new Set(remaining);
  const lower = current === null ? 0 : remaining.filter((b) => b < current).length;
  const higher = current === null ? 0 : remaining.filter((b) => b > current).length;
  return (
    <div className="range">
      <div className="range-counts">
        <span className="range-low">▼ {current === null ? '–' : lower} lower</span>
        <span className="range-high">{current === null ? '–' : higher} higher ▲</span>
      </div>
      <div
        className="range-track"
        role="img"
        aria-label={current === null ? 'No ball yet' : `${lower} balls lower and ${higher} higher than ${current}`}
      >
        {Array.from({ length: TOTAL_BALLS }, (_, i) => i + 1).map((n) => (
          <span key={n} className={`tick col-${letterFor(n)} ${left.has(n) || current === null ? 'in' : 'out'}`} />
        ))}
        <span className="range-mid" style={{ left: pos(MIDDLE) }} />
        {current !== null && (
          <span className={`range-pin col-${letterFor(current)}`} style={{ left: pos(current) }}>
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
