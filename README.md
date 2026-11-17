# Luckyhighlow

Higher or Lower with Bingo 75 balls, built in React + TypeScript (Vite). Play money only.

## How to play

A first-visit tour walks through the screen; reopen it any time with **How to play**.

- Rounds are live: after an 8-second betting window bets close and the next ball (1–75, with its B-I-N-G-O letter) rolls in on the reel.
- During the betting window, set your bet (− / +, typed, or the 10, 50, 100 and 500 shortcuts) and tap **Higher** or **Lower** (on a computer you can also click the odds card beside the ball).
  The stake leaves your balance and the multiplier is locked. You can switch sides or cancel until the timer ends.
- A correct guess starts a win streak. Each further correct guess multiplies the streak's multiplier by that round's step. Pick again to let the pot ride, or press **Cash Out** to bank `stake × streak multiplier`. A wrong guess loses the pot; a round with no pick banks it automatically. A risk meter shows how much is on the line.
  Multiplier = `0.97 × balls left ÷ winning balls` (floored to 2 decimals, minimum ×1.01), so long shots pay more.
- Balls are drawn without replacement; the drum refills when it runs out. The middle ball is 38.
- Keys: H / ↑ higher, L / ↓ lower, C cash out, Esc cancel.
- Sound effects are synthesised with Web Audio (no audio files): countdown ticks, a gong when bets close, the reel ratchet, the ball landing, a win jingle and a loss sting.
- Game settings (gear button, or the menu on phones): sound on/off and volume, replay How to play, reset balance. Saved in localStorage.

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
