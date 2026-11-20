/* Automatic calorie adjustment from the weight trend. */
import * as R from '../index';
import type { Ctx } from '../types';

const TODAY = '2026-11-20';
/** A profile with 28 days of daily weigh-ins changing by `perWeek` kg a week (with a little day-to-day noise). */
function make(goal: string, perWeek: number, opts: { kcal?: number; days?: number; start?: number } = {}): Ctx {
  const s = R.sampleState('2026-09-29');
  const P = s.profile; P.goal = goal; P.kcal = opts.kcal ?? 1800; P.protein = 140; P.carbs = 190; P.fat = 55; P.restTargets = null;
  P.sex = 'Female'; P.age = 32; P.heightCm = 168; P.startDate = '2026-09-01'; P.calReviewOn = null;
  const days = opts.days ?? 28; const start = opts.start ?? 75;
  s.weights = Array.from({ length: days }, (_, i) => ({ date: R.add(TODAY, i - days + 1), kg: +(start + perWeek * i / 7 + (i % 3 - 1) * 0.15).toFixed(2) }));
  return { s, today: TODAY };
}

describe('calorie advice', () => {
  it('needs at least 8 weigh-ins over 2 weeks', () => {
    expect(R.calorieAdvice(make('Fat loss', -0.1, { days: 6 })).status).toBe('not-enough-data');
  });
  it('fat loss stalled → suggests eating less (50–200 kcal)', () => {
    const a = R.calorieAdvice(make('Fat loss', -0.05));
    expect(a.status).toBe('adjust');
    expect(a.change).toBeLessThanOrEqual(-50); expect(a.change).toBeGreaterThanOrEqual(-200);
    expect(a.newKcal).toBe(1800 + a.change);
    expect(a.rateKg!).toBeCloseTo(-0.05, 1);
  });
  it('losing more than 1% a week → suggests eating more', () => {
    const a = R.calorieAdvice(make('Fat loss', -1.0));
    expect(a.status).toBe('adjust'); expect(a.change).toBeGreaterThan(0);
  });
  it('fat loss at about 0.5% a week → on track, no change', () => {
    const a = R.calorieAdvice(make('Fat loss', -0.37));
    expect(a.status).toBe('on-track'); expect(a.change).toBe(0);
  });
  it('muscle gain not gaining → suggests eating more', () => {
    const a = R.calorieAdvice(make('Muscle gain', 0));
    expect(a.status).toBe('adjust'); expect(a.change).toBeGreaterThan(0);
  });
  it('maintenance drifting up → suggests eating less', () => {
    const a = R.calorieAdvice(make('Maintenance', 0.5));
    expect(a.status).toBe('adjust'); expect(a.change).toBeLessThan(0);
  });
  it('never goes below the calorie floor', () => {
    const ctx = make('Fat loss', 0, { kcal: 1250 });
    const floor = R.calorieFloor(ctx.s.profile);
    const a = R.calorieAdvice(ctx);
    expect(a.newKcal).toBeGreaterThanOrEqual(Math.min(1250, floor));
    if (floor >= 1250) expect(a.status).toBe('at-floor');
  });
});

describe('applying and scheduling the review', () => {
  it('keeps protein, moves carbs and fat, and records the review date', () => {
    const ctx = make('Fat loss', -0.05); const P = ctx.s.profile;
    P.restTargets = { kcal: 1600, protein: 140, carbs: 150, fat: 50 };
    R.applyCalorieChange(ctx.s, -150, TODAY);
    expect(P.kcal).toBe(1650); expect(P.protein).toBe(140);
    expect(P.carbs).toBeLessThan(190); expect(P.fat).toBeLessThan(55);
    expect(P.restTargets.kcal).toBe(1450); expect(P.restTargets.protein).toBe(140);
    expect(P.calReviewOn).toBe(TODAY);
  });
  it('is due every 14 days', () => {
    const ctx = make('Fat loss', -0.05);
    expect(R.calorieReviewDue(ctx)).toBe(true);
    ctx.s.profile.calReviewOn = R.add(TODAY, -5); expect(R.calorieReviewDue(ctx)).toBe(false);
    ctx.s.profile.calReviewOn = R.add(TODAY, -14); expect(R.calorieReviewDue(ctx)).toBe(true);
  });
});
