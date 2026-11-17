import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

interface TourStep {
  /** `data-tour` value of the element to spotlight; none for a centered card. */
  target?: string;
  title: string;
  body: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Luckyhighlow',
    body: 'A live Higher or Lower game played with 75 bingo balls. Here is a quick tour of how to play.',
  },
  {
    target: 'ball',
    title: 'The ball showing now',
    body: 'Each bingo ball has a number from 1 to 75 and a B-I-N-G-O letter. You bet on whether the next ball will be higher or lower than this one.',
  },
  {
    target: 'arena',
    title: 'Read the odds',
    body: 'The cards beside the ball show each side’s multiplier and chance. The fewer balls that can win, the bigger the multiplier.',
  },
  {
    target: 'range',
    title: 'Where the ball sits',
    body: 'This bar runs from 1 to 75. 38 is the middle. The ticks are balls still in the drum, so you can see how many are lower and higher.',
  },
  {
    target: 'bet',
    title: 'Choose your bet',
    body: 'Tap a chip or type an amount. ½ halves your bet and 2× doubles it.',
  },
  {
    target: 'guess',
    title: 'Pick Higher or Lower',
    body: 'Tap a button to place your bet. The stake leaves your balance and your multiplier is locked. You can switch sides or cancel until the timer runs out.',
  },
  {
    target: 'timer',
    title: 'Live rounds',
    body: 'Every round lasts 15 seconds. When the timer hits zero, bets close and the next ball rolls in on the reel. Balls are not put back until the drum is empty.',
  },
  {
    target: 'balance',
    title: 'Get paid',
    body: 'A winning bet pays your stake times the multiplier straight into your balance. A losing bet keeps the stake. Play money only.',
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 320;

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step.target]);

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    measure();
  }, [step.target, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (last) onClose();
        else setI((n) => n + 1);
      } else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [last, onClose]);

  // Card goes below the target if it fits, otherwise above, otherwise centered.
  const cardW = Math.min(CARD_W, vw - 32);
  let cardStyle: React.CSSProperties;
  if (box) {
    const left = Math.min(Math.max(16, box.left + box.width / 2 - cardW / 2), vw - cardW - 16);
    const below = box.top + box.height + 12;
    const spaceBelow = vh - below;
    cardStyle =
      spaceBelow > 220
        ? { top: below, left, width: cardW }
        : box.top > 232
          ? { bottom: vh - box.top + 12, left, width: cardW }
          : { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' };
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? <div className="tour-spot" style={box} /> : <div className="tour-dim" />}
      <div className="tour-card" style={cardStyle}>
        <div className="tour-step">
          Step {i + 1} of {TOUR_STEPS.length}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, n) => (
            <span key={n} className={n === i ? 'on' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={onClose}>
            {last ? 'Close' : 'Skip tour'}
          </button>
          <span className="tour-nav">
            {i > 0 && (
              <button className="mini" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            <button className="tour-next" onClick={() => (last ? onClose() : setI(i + 1))} autoFocus>
              {last ? 'Start playing' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
