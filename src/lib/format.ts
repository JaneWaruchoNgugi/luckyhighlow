/** Money with two decimals, in the player's locale. */
export const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A 0-1 chance as a whole percentage. */
export const pct = (n: number) => `${Math.round(n * 100)}%`;
