# Luckyhighlow

Higher or Lower with Bingo 75 balls, built in React + TypeScript (Vite). Play money only.

## How to play
- Pick a stake and draw the first ball (1–75, with its B-I-N-G-O letter).
- Guess whether the next ball is **higher** or **lower**. Balls are drawn without replacement.
- Each correct guess multiplies your win by that guess's odds: `0.97 × balls left ÷ winning balls`
  (floored to 2 decimals, minimum ×1.01). Long shots pay more.
- A wrong guess loses the stake. Cash out any time after your first correct guess.
- Keys: H / ↑ higher, L / ↓ lower, C cash out, Enter to draw.

## Run it
```bash
npm install
npm run dev          # local dev server
npm test             # game-rule unit tests
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

Game rules live in `src/game.ts` (pure functions, unit tested in `src/game.test.ts`); the UI is `src/App.tsx`.
The house edge is `RETURN_TO_PLAYER` in `src/game.ts`.
