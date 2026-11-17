import { useLayoutEffect, useRef, useState } from 'react';
import { TOTAL_BALLS, letterFor } from './game';

const FILLERS = 14;
const SPIN_MS = 1400;

/** One ball face, sized by the reel. */
function ReelBall({ n }: { n: number | null }) {
  if (n === null) {
    return (
      <div className="ball ball-lg ball-empty">
        <span className="ball-face">?</span>
      </div>
    );
  }
  const l = letterFor(n);
  return (
    <div className={`ball ball-lg col-${l}`}>
      <span className="ball-face">
        <span className="ball-letter">{l}</span>
        <span className="ball-num">{n}</span>
      </span>
    </div>
  );
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Slot-style reel: when `target` changes, a strip of numbers slides from the
 * bottom up and stops on the new ball. `spinKey` restarts the spin even when
 * the same number would show (a new round).
 */
export function Reel({ target, spinKey, onDone }: { target: number | null; spinKey: number; onDone: () => void }) {
  const [strip, setStrip] = useState<(number | null)[]>([target]);
  const [spinning, setSpinning] = useState(false);
  const shown = useRef<number | null>(target);
  const stripEl = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    if (target === null || spinKey === 0) {
      shown.current = target;
      setStrip([target]);
      return;
    }
    if (prefersReducedMotion()) {
      shown.current = target;
      setStrip([target]);
      done.current();
      return;
    }
    const fillers = Array.from({ length: FILLERS }, () => 1 + Math.floor(Math.random() * TOTAL_BALLS));
    setStrip([shown.current, ...fillers, target]);
    setSpinning(true);
    shown.current = target;
  }, [target, spinKey]);

  useLayoutEffect(() => {
    const el = stripEl.current;
    if (!el || !spinning) return;
    const steps = strip.length - 1;
    el.style.transition = 'none';
    el.style.transform = 'translateY(0)';
    void el.offsetHeight; // commit the start position before animating
    el.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.15,.75,.25,1)`;
    el.style.transform = `translateY(calc(-${steps} * var(--reel-h)))`;
    const t = window.setTimeout(() => {
      setSpinning(false);
      setStrip([shown.current]);
      done.current();
    }, SPIN_MS + 50);
    return () => window.clearTimeout(t);
  }, [strip, spinning]);

  const resting = !spinning;
  return (
    <div
      className={`reel ${spinning ? 'spinning' : ''} ${resting && target ? `col-${letterFor(target)}` : ''}`}
      aria-live="polite"
      aria-label={resting && target ? `${letterFor(target)} ${target}` : 'Drawing'}
    >
      <div className="reel-rays" aria-hidden="true" />
      <div className="reel-strip" ref={stripEl} style={resting ? { transform: 'none', transition: 'none' } : undefined}>
        {strip.map((n, i) => (
          <div className="reel-item" key={i}>
            <ReelBall n={n} />
          </div>
        ))}
      </div>
    </div>
  );
}
