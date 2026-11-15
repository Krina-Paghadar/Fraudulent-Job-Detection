export const pct = (x: number | null | undefined, digits = 1): string =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`;

export const num = (x: number | null | undefined, digits = 3): string =>
  x == null ? '—' : x.toFixed(digits);

export const int = (x: number): string => x.toLocaleString('en-US');

export const signed = (x: number, digits = 2): string =>
  `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;

/** clamp helper */
export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));
