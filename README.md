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

## Project structure

```
src/
  main.tsx              entry point
  App.tsx               the game screen: live rounds, betting, streaks, cash out
  components/
    GameCanvas.tsx      ball stage drawn on a canvas (reel, lights, countdown ring)
    RangeBar.tsx        Round Progress bar (1-75)
    SettingsPanel.tsx   game settings sheet
    Tour.tsx            How to play tour
    Icons.tsx           inline SVG icons
  game/
    game.ts             game rules (pure functions)
    game.test.ts        Vitest tests for the rules
  lib/
    format.ts           money and percent formatting
    settings.ts         saved settings (sound, volume)
    sound.ts            Web Audio sound effects
    storage.ts          saved balance and tour flag
  styles/
    index.css           colour tokens and base styles
    App.css             game styles
```

The house edge is `RETURN_TO_PLAYER` in `src/game/game.ts`.
