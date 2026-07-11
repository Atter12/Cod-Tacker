-- Sprint 8: WhatsApp templates + conversation inbox helpers
-- Additive only.

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  name text not null,
  language text not null default 'es',
  category text not null default 'utility',
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  is_active boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint whatsapp_templates_status_check
    check (status in ('draft', 'approved', 'rejected', 'paused')),
  constraint whatsapp_templates_name_len check (char_length(name) between 1 and 120),
  constraint whatsapp_templates_body_len check (char_length(body) between 1 and 4000)
);

create unique index if not exists whatsapp_templates_store_name_lang_uidx
  on public.whatsapp_templates (store_id, name, language)
  where store_id is not null;

create index if not exists whatsapp_templates_agency_idx
  on public.whatsapp_templates (agency_id, updated_at desc);

alter table public.whatsapp_templates enable row level security;

drop policy if exists whatsapp_templates_select on public.whatsapp_templates;
create policy whatsapp_templates_select
  on public.whatsapp_templates for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

drop policy if exists whatsapp_templates_write on public.whatsapp_templates;
create policy whatsapp_templates_write
  on public.whatsapp_templates for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  )
  with check (
    public.is_platform_admin()
    or public.has_agency_access(agency_id)
    or (store_id is not null and public.has_store_access(store_id))
  );

-- Conversation inbox helpers
alter table public.whatsapp_conversations
  add column if not exists unread_count integer not null default 0,
  add column if not exists last_message_preview text;

create index if not exists whatsapp_conversations_store_last_msg_idx
  on public.whatsapp_conversations (store_id, last_message_at desc nulls last);

-- Message template linkage
alter table public.whatsapp_messages
  add column if not exists template_id uuid references public.whatsapp_templates (id) on delete set null;

comment on table public.whatsapp_templates is
  'Sprint 8 mock WhatsApp templates. Status approved/rejected is demo-only — not Meta approval.';
