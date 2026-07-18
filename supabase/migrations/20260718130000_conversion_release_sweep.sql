-- Release-gate sweep worker support: the cron re-evaluates held candidates and
-- retries failed sends by scanning rows whose next_retry_at is due.

create index if not exists idx_conversion_events_retry_due
  on public.conversion_events (next_retry_at)
  where sent_at is null and next_retry_at is not null;

comment on column public.conversion_events.next_retry_at is
  'Sweep schedule: next automatic recheck (pending_review) or send retry (released, unsent). Null when sent, exhausted, or terminal.';
