-- Per-user theme + background image preference

alter table user_settings
  add column theme text not null default 'dark' check (theme in ('dark', 'light')),
  add column background text not null default 'none';

-- background is a slug: 'none' | 'lake' | 'desert' | 'moon-night' | etc.
-- Image files live in app/public/backgrounds/<slug>.jpg.
