/** Balance and tour flags kept in localStorage. Every call survives storage being unavailable. */

export const START_BALANCE = 1000;
const STORAGE_KEY = 'luckyhighlow.balance';
const TOUR_KEY = 'luckyhighlow.tourSeen';

export function loadBalance(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

export function saveBalance(n: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* storage unavailable: balance lives for this visit only */
  }
}

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* fine: the tour just shows again next visit */
  }
}
