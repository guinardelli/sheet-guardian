alter table subscriptions
  add column if not exists sheets_used_week integer not null default 0;
update subscriptions
set sheets_used_week = sheets_used_today
where last_sheet_date is not null;
