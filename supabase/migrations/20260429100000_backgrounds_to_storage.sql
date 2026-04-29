-- Move background images from /public/backgrounds (slug-based) to a public
-- Supabase Storage bucket. user_settings.background now stores the full image URL
-- (empty string = no background).

-- Public bucket for background images. Anyone (signed-in or anon) can read.
insert into storage.buckets (id, name, public)
  values ('backgrounds', 'backgrounds', true)
  on conflict (id) do update set public = true;

drop policy if exists "Anyone can view background images" on storage.objects;
create policy "Anyone can view background images"
  on storage.objects for select
  using (bucket_id = 'backgrounds');

-- Existing rows had slug values like 'none', 'lake', 'desert'. Wipe them — the
-- frontend now stores full URLs starting with http(s)://.
alter table user_settings alter column background set default '';
update user_settings set background = '' where background not like 'http%';
