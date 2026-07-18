-- Conversion release gate (hold → filter → released/confirmed → send).
-- Purchase candidates now land as queued + release_status; the live send to
-- Meta/TikTok only happens after the release filter (or a manual release).

alter table public.conversion_events
  add column if not exists release_status text not null default 'released',
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references auth.users (id) on delete set null,
  add column if not exists hold_reason text;

-- Existing rows predate the gate and were already sent: keep them as released.
-- New candidates must decide their release state explicitly; default to hold.
alter table public.conversion_events
  alter column release_status set default 'pending_review';

do $$ begin
  alter table public.conversion_events
    add constraint conversion_events_release_status_check
    check (release_status in ('pending_review', 'released', 'rejected'));
exception
  when duplicate_object then null;
end $$;

-- Review queue lookups: pending candidates per store.
create index if not exists idx_conversion_events_release_pending
  on public.conversion_events (store_id, created_at desc)
  where release_status = 'pending_review';

comment on column public.conversion_events.release_status is
  'Release gate: pending_review (held by filter), released (confirmed → send), rejected (never send).';
comment on column public.conversion_events.released_by is
  'User who manually released/rejected; null when the automatic filter decided.';
comment on column public.conversion_events.hold_reason is
  'Why the filter held (or an operator rejected) this candidate.';
