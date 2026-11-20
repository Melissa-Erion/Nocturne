-- Date of the last automatic calorie review the user answered (applied, snoozed or "on track").
alter table public.profiles add column if not exists cal_review_on date;
