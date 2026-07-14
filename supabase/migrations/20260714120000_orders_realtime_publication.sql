-- Enable Supabase Realtime for ops order list/detail subscriptions.
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE events honor column filters (store_id / id).

alter table public.orders replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

comment on table public.orders is
  'Commerce orders. Included in supabase_realtime for tenant-scoped live UI refresh.';
