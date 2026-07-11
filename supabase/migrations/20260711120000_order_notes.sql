-- Sprint 1: internal order notes (additive). Apply after invitations migration.
-- Do not edit prior migrations.

create table if not exists public.order_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_notes_body_not_empty check (char_length(trim(body)) > 0)
);

create index if not exists order_notes_order_id_created_at_idx
  on public.order_notes (order_id, created_at desc);

create index if not exists order_notes_store_id_idx on public.order_notes (store_id);
create index if not exists order_notes_agency_id_idx on public.order_notes (agency_id);

comment on table public.order_notes is
  'Internal operator notes on orders. Not customer-facing. Tenant-scoped via store_id/agency_id.';

drop trigger if exists order_notes_set_updated_at on public.order_notes;
create trigger order_notes_set_updated_at
  before update on public.order_notes
  for each row execute function public.set_updated_at();

alter table public.order_notes enable row level security;

drop policy if exists order_notes_select_store_access on public.order_notes;
create policy order_notes_select_store_access
  on public.order_notes
  for select
  to authenticated
  using (public.has_store_access(store_id) or public.is_platform_admin());

drop policy if exists order_notes_insert_operators on public.order_notes;
create policy order_notes_insert_operators
  on public.order_notes
  for insert
  to authenticated
  with check (
    (public.has_store_access(store_id)
      and (
        public.has_store_role(
          array['owner', 'admin', 'operator']::public.store_role[],
          store_id
        )
        or public.has_agency_role(
          agency_id,
          array['owner', 'admin', 'manager']::public.agency_role[]
        )
      ))
    or public.is_platform_admin()
  );

drop policy if exists order_notes_update_author_or_managers on public.order_notes;
create policy order_notes_update_author_or_managers
  on public.order_notes
  for update
  to authenticated
  using (
    author_id = auth.uid()
    or public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[])
    or public.is_platform_admin()
  )
  with check (
    author_id = auth.uid()
    or public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[])
    or public.is_platform_admin()
  );
