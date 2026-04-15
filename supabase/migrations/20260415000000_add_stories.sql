-- Stories (groups of tasks)
create table stories (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  color text not null default '#6B8AFF',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz default now()
);

-- Link tasks to stories (optional)
alter table tasks add column story_id bigint references stories(id) on delete set null;

-- RLS
alter table stories enable row level security;
create policy "own stories" on stories for all using (auth.uid() = user_id);
