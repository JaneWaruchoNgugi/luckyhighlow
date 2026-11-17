# Luckyhighlow

Higher or Lower with Bingo 75 balls, built in React + TypeScript (Vite). Play money only.

## How to play
- A ball from 1–75 is showing, with its B-I-N-G-O letter. The middle ball is 38.
- Pick a bet with the chips (or type one), then tap **Higher** or **Lower**.
- The next ball rolls in on the reel. Balls are drawn without replacement; the drum refills when it runs out.
- A win pays `bet × multiplier` straight into your balance; a loss takes the bet.
  Multiplier = `0.97 × balls left ÷ winning balls` (floored to 2 decimals, minimum ×1.01), so long shots pay more.
- The bar under the reel shows where the ball sits on 1–75 and how many balls are left lower and higher.
- Keys: H / ↑ higher, L / ↓ lower.

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
