-- Per-user settings (timezone + daily digest preferences)
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  daily_digest_enabled boolean not null default false,
  daily_digest_time time not null default '08:00',
  daily_digest_last_sent date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;
create policy "own settings" on user_settings for all using (auth.uid() = user_id);

-- Index for the cron job scanning enabled users
create index idx_user_settings_digest_enabled on user_settings (daily_digest_enabled) where daily_digest_enabled = true;
