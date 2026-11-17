# Luckyhighlow

Higher or Lower with Bingo 75 balls, built in React + TypeScript (Vite). Play money only.

## How to play

A first-visit tour walks through the screen; reopen it any time with **How to play**.

- Rounds are live: after an 8-second betting window (5, 8, 10 or 15 seconds in Settings) bets close and the next ball (1–75, with its B-I-N-G-O letter) rolls in on the reel.
- During the betting window, set your bet (− / +, typed, ½, 2x or Max) and tap **Higher** or **Lower** (or the odds card beside the ball).
  The stake leaves your balance and the multiplier is locked. You can switch sides or cancel until the timer ends.
- A win pays `bet × multiplier` straight into your balance; a loss keeps the stake.
  Multiplier = `0.97 × balls left ÷ winning balls` (floored to 2 decimals, minimum ×1.01), so long shots pay more.
- Balls are drawn without replacement; the drum refills when it runs out. The middle ball is 38.
- Keys: H / ↑ higher, L / ↓ lower, Esc cancel.
- Sound effects are synthesised with Web Audio (no audio files): countdown ticks, a gong when bets close, the reel ratchet, the ball landing, a win jingle and a loss sting.
- Game settings (gear button, or the menu on phones): sound on/off and volume, round length, bet step, reduce motion, replay How to play, reset balance. Saved in localStorage.

## Run it

```bash
npm install
npm run dev          # local dev server
npm test             # game-rule unit tests
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

The ball stage is drawn on a canvas in `src/GameCanvas.tsx`. Game rules live in `src/game.ts` (pure functions, unit tested in `src/game.test.ts`); the UI is `src/App.tsx`.
The house edge is `RETURN_TO_PLAYER` in `src/game.ts`.
