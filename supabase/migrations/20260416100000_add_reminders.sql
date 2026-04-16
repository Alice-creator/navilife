-- Reminders
create table reminders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  task_id bigint references tasks(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz default now()
);

alter table reminders enable row level security;
create policy "own reminders" on reminders for all using (auth.uid() = user_id);

-- Index for the cron job to find due unsent reminders quickly
create index idx_reminders_due on reminders (remind_at) where sent = false;
