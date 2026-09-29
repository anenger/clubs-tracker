-- One live EA refresh per club/competition per window; other callers get stored snapshots.
create table public.club_refresh_leases (
  platform text not null check (platform = 'common-gen5'),
  club_id text not null check (club_id ~ '^[0-9]{1,20}$'),
  competition text not null check (competition in ('leagueMatch', 'friendlyMatch', 'playoffMatch')),
  refreshed_at timestamptz not null default now(),
  primary key (platform, club_id, competition)
);

alter table public.club_refresh_leases enable row level security;
revoke all on public.club_refresh_leases from public, anon, authenticated;
grant select, insert, update, delete on public.club_refresh_leases to service_role;

create function public.claim_club_refresh(
  p_club_id text, p_competition text, p_interval_seconds integer default 300
) returns boolean language sql security invoker set search_path = '' as $$
  with claimed as (
    insert into public.club_refresh_leases (platform, club_id, competition, refreshed_at)
    values ('common-gen5', p_club_id, p_competition, now())
    on conflict (platform, club_id, competition) do update set refreshed_at = now()
    where public.club_refresh_leases.refreshed_at
      < now() - make_interval(secs => greatest(60, least(coalesce(p_interval_seconds, 300), 3600)))
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_club_refresh(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_club_refresh(text, text, integer) to service_role;
