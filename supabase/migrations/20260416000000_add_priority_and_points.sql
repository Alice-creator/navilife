-- Add priority and points to tasks
alter table tasks add column priority text check (priority in ('low', 'medium', 'high'));
alter table tasks add column points integer;
