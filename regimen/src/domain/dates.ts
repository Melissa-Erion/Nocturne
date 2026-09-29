import type { ISODate } from './types';

export const D = (s: ISODate) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const iso = (dt: Date): ISODate => dt.toISOString().slice(0, 10);
export const add = (s: ISODate, n: number): ISODate => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
/** Day of week with Monday = 0. */
export const dow = (s: ISODate) => (D(s).getUTCDay() + 6) % 7;
export const diff = (a: ISODate, b: ISODate) => Math.round((D(b).getTime() - D(a).getTime()) / 864e5);
export const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DFULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtD = (s: ISODate) => `${DN[dow(s)]} ${D(s).getUTCDate()} ${MN[D(s).getUTCMonth()]}`;
export const fmtShort = (s: ISODate) => `${D(s).getUTCDate()} ${MN[D(s).getUTCMonth()]}`;
export const monday = (d: ISODate) => add(d, -dow(d));

/** The user's local calendar date. */
export const localToday = (): ISODate => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
