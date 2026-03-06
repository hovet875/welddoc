create or replace function public.list_ubibot_channels()
returns table (
  channel_id text,
  last_bucket_start timestamptz
)
language sql
stable
set search_path = public
as $$
  select distinct on (u.channel_id)
    u.channel_id,
    u.bucket_start as last_bucket_start
  from public.ubibot_hourly u
  where coalesce(u.channel_id, '') <> ''
  order by u.channel_id, u.bucket_start desc
$$;

grant execute on function public.list_ubibot_channels() to authenticated;
grant execute on function public.list_ubibot_channels() to service_role;
