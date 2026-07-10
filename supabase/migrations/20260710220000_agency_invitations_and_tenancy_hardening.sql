-- Agency invitations + tenancy hardening (phases A/B)
-- Apply with Supabase SQL editor or `supabase db push`. Do not edit historical migrations.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agency_invitation_status') then
    create type public.agency_invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;
end $$;

create table if not exists public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  email text not null,
  role public.agency_role not null,
  token_hash text not null unique,
  status public.agency_invitation_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_invitations_role_not_owner check (role <> 'owner'),
  constraint agency_invitations_email_normalized check (email = lower(trim(email)))
);

create unique index if not exists agency_invitations_active_unique
  on public.agency_invitations (agency_id, email)
  where status = 'pending';

create index if not exists agency_invitations_agency_id_idx on public.agency_invitations (agency_id);
create index if not exists agency_invitations_email_idx on public.agency_invitations (email);
create index if not exists agency_invitations_status_idx on public.agency_invitations (status);

comment on table public.agency_invitations is
  'Pending agency invites for emails that may not yet have Auth users. Tokens stored as hash only.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agency_invitations_set_updated_at on public.agency_invitations;
create trigger agency_invitations_set_updated_at
  before update on public.agency_invitations
  for each row execute function public.set_updated_at();

alter table public.agency_invitations enable row level security;

drop policy if exists agency_invitations_select_managers on public.agency_invitations;
create policy agency_invitations_select_managers
  on public.agency_invitations
  for select
  to authenticated
  using (public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[]));

drop policy if exists agency_invitations_insert_managers on public.agency_invitations;
create policy agency_invitations_insert_managers
  on public.agency_invitations
  for insert
  to authenticated
  with check (public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[]));

drop policy if exists agency_invitations_update_managers on public.agency_invitations;
create policy agency_invitations_update_managers
  on public.agency_invitations
  for update
  to authenticated
  using (public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[]))
  with check (public.has_agency_role(agency_id, array['owner', 'admin']::public.agency_role[]));

drop policy if exists agency_invitations_select_own_email on public.agency_invitations;
create policy agency_invitations_select_own_email
  on public.agency_invitations
  for select
  to authenticated
  using (
    status = 'pending'
    and expires_at > now()
    and email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

create or replace function public.accept_agency_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.agency_invitations%rowtype;
  v_existing_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or length(v_email) = 0 then
    raise exception 'email_missing';
  end if;

  select * into v_invite
  from public.agency_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'invitation_revoked';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'invitation_already_used';
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at <= now() then
    update public.agency_invitations
      set status = 'expired', updated_at = now()
      where id = v_invite.id and status = 'pending';
    raise exception 'invitation_expired';
  end if;

  if v_invite.email <> v_email then
    raise exception 'invitation_email_mismatch';
  end if;

  select id into v_existing_id
  from public.agency_members
  where agency_id = v_invite.agency_id and user_id = v_uid;

  if v_existing_id is null then
    insert into public.agency_members (agency_id, user_id, role, status, invited_by, joined_at)
    values (v_invite.agency_id, v_uid, v_invite.role, 'active', v_invite.invited_by, now());
  else
    update public.agency_members
    set role = v_invite.role,
        status = 'active',
        joined_at = coalesce(joined_at, now()),
        updated_at = now()
    where id = v_existing_id;
  end if;

  update public.agency_invitations
  set status = 'accepted',
      accepted_by = v_uid,
      accepted_at = now(),
      updated_at = now()
  where id = v_invite.id;

  return v_invite.agency_id;
end;
$$;

revoke all on function public.accept_agency_invitation(text) from public;
revoke all on function public.accept_agency_invitation(text) from anon;
grant execute on function public.accept_agency_invitation(text) to authenticated;

grant select, insert, update on public.agency_invitations to authenticated;
grant all on public.agency_invitations to service_role;
