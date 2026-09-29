export const r1 = (n: number) => Math.round(n * 10) / 10;
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Short random id, as in the prototype. Collisions are harmless because rows are keyed by (user_id, id). */
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Deterministic PRNG (mulberry32) used by the sample-data seed so it reproduces the prototype. */
export const mulberry = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

export const num = (n: number) => Math.round(n).toLocaleString('en-CA');
