/* Clock format, per-day workout times, workout reminders that follow them, and suggested rest-day targets. */
import { fmtTime, reminderTimeOn, suggestRestTargets, workoutTimeOn } from '@/domain/clock';

describe('fmtTime', () => {
  test('12-hour by default', () => {
    expect(fmtTime('17:30')).toBe('5:30 PM');
    expect(fmtTime('00:05')).toBe('12:05 AM');
    expect(fmtTime('12:00')).toBe('12:00 PM');
    expect(fmtTime('7:15')).toBe('7:15 AM');
  });
  test('24-hour when chosen', () => expect(fmtTime('7:15', '24h')).toBe('07:15'));
  test('leaves blanks and junk alone', () => { expect(fmtTime('')).toBe(''); expect(fmtTime(undefined)).toBe(''); expect(fmtTime('soon')).toBe('soon'); });
});

describe('per-day workout times', () => {
  const p = { workoutTime: '17:30', dayTimes: { '0': '06:00', '3': '18:15' } };
  test('a day with its own time uses it; others use the default', () => {
    expect(workoutTimeOn(p, 0)).toBe('06:00');
    expect(workoutTimeOn(p, 3)).toBe('18:15');
    expect(workoutTimeOn(p, 1)).toBe('17:30');
    expect(workoutTimeOn({ workoutTime: '17:30' }, 0)).toBe('17:30');
  });
  test('workout reminders keep their gap from the workout; others do not move', () => {
    expect(reminderTimeOn(p, { type: 'Upcoming workout', time: '15:30' }, 0)).toBe('04:00'); // 2 h before 6:00
    expect(reminderTimeOn(p, { type: 'Start workout', time: '17:30' }, 3)).toBe('18:15');
    expect(reminderTimeOn(p, { type: 'Start workout', time: '17:30' }, 1)).toBe('17:30');
    expect(reminderTimeOn(p, { type: 'Weight log', time: '07:15' }, 0)).toBe('07:15');
  });
});

describe('suggestRestTargets', () => {
  test('same protein and fat, about 10% fewer calories from carbs', () => {
    expect(suggestRestTargets({ kcal: 1800, protein: 140, carbs: 190, fat: 55 }, 1300)).toEqual({ kcal: 1620, protein: 140, carbs: 145, fat: 55 });
  });
  test('never below the calorie floor', () => {
    expect(suggestRestTargets({ kcal: 1300, protein: 120, carbs: 120, fat: 45 }, 1290)).toEqual({ kcal: 1290, protein: 120, carbs: 118, fat: 45 });
    expect(suggestRestTargets({ kcal: 1200, protein: 120, carbs: 100, fat: 40 }, 1250)).toEqual({ kcal: 1200, protein: 120, carbs: 100, fat: 40 });
  });
  test('carbs stay at 50 g or more', () => {
    const r = suggestRestTargets({ kcal: 2000, protein: 200, carbs: 60, fat: 110 }, 1200);
    expect(r.carbs).toBe(50);
    expect(r.kcal).toBeGreaterThanOrEqual(200 * 4 + 50 * 4 + 110 * 9 - 10);
  });
});
