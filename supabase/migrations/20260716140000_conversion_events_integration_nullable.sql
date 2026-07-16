-- Allow Purchase conversion_events rows before Meta/TikTok is connected (S8 dry-run).
alter table public.conversion_events
  alter column integration_id drop not null;
