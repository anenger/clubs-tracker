-- Run manually in the Supabase SQL editor or through your migration pipeline.
create table public.tracked_clubs (
  platform text not null check (platform = 'common-gen5'),
  club_id text not null check (club_id ~ '^[0-9]{1,20}$'),
  competition text not null check (competition in ('leagueMatch', 'friendlyMatch', 'playoffMatch')),
  tracking_started_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'complete', 'partial', 'failed')),
  primary key (platform, club_id, competition)
);
create index tracked_clubs_schedule on public.tracked_clubs (last_attempt_at, club_id, competition);

create table public.club_snapshots (
  platform text not null,
  club_id text not null,
  competition text not null,
  endpoint text not null check (endpoint in ('clubs/info', 'members/stats', 'clubs/matches', 'clubs/overallStats', 'members/career/stats')),
  request_scope text generated always as (case when endpoint = 'clubs/matches' then competition else '' end) stored,
  fetched_at timestamptz not null,
  stored_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (platform, club_id, endpoint, request_scope, fetched_at),
  foreign key (platform, club_id, competition) references public.tracked_clubs on delete cascade
);
create index club_snapshots_retention on public.club_snapshots (stored_at);

create table public.club_matches (
  platform text not null,
  club_id text not null,
  competition text not null,
  match_id text not null check (length(match_id) between 1 and 100),
  match_timestamp numeric not null check (match_timestamp between 0 and 253402300799),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (platform, club_id, competition, match_id),
  foreign key (platform, club_id, competition) references public.tracked_clubs on delete cascade
);
create index club_matches_history on public.club_matches (platform, club_id, competition, match_timestamp desc, match_id desc);

alter table public.tracked_clubs enable row level security;
alter table public.club_snapshots enable row level security;
alter table public.club_matches enable row level security;
revoke all on public.tracked_clubs, public.club_snapshots, public.club_matches from public, anon, authenticated;
grant select, insert, update, delete on public.tracked_clubs, public.club_snapshots, public.club_matches to service_role;

-- Invoker security: only the server service role can execute or touch tables.
create function public.ingest_club_observations(
  p_platform text, p_club_id text, p_competition text,
  p_observations jsonb, p_matches jsonb,
  p_matches_fetched_at timestamptz, p_status text
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations) > 5
    or jsonb_typeof(p_matches) is distinct from 'array' or jsonb_array_length(p_matches) > 200
    or p_status is null or p_status not in ('complete', 'partial', 'failed') then
    raise exception 'Invalid ingestion batch';
  end if;
  if jsonb_array_length(p_matches) > 0 and p_matches_fetched_at is null then
    raise exception 'Match observation timestamp required';
  end if;

  insert into public.tracked_clubs (platform, club_id, competition, last_synced_at, sync_status)
  values (p_platform, p_club_id, p_competition, p_matches_fetched_at, p_status)
  on conflict (platform, club_id, competition) do update set
    last_synced_at = greatest(public.tracked_clubs.last_synced_at, excluded.last_synced_at),
    last_attempt_at = now(),
    lease_until = null,
    sync_status = excluded.sync_status;

  insert into public.club_snapshots (platform, club_id, competition, endpoint, fetched_at, payload)
  select p_platform, p_club_id, p_competition, item->>'endpoint', (item->>'fetched_at')::timestamptz, item->'payload'
  from jsonb_array_elements(p_observations) item
  on conflict (platform, club_id, endpoint, request_scope, fetched_at) do nothing;

  insert into public.club_matches (platform, club_id, competition, match_id, match_timestamp, first_seen_at, last_seen_at, payload)
  select p_platform, p_club_id, p_competition, item->>'matchId', (item->>'timestamp')::numeric,
    p_matches_fetched_at, p_matches_fetched_at, item
  from (select distinct on (value->>'matchId') value as item from jsonb_array_elements(p_matches)) deduplicated
  on conflict (platform, club_id, competition, match_id) do update set
    first_seen_at = least(public.club_matches.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(public.club_matches.last_seen_at, excluded.last_seen_at),
    match_timestamp = case when excluded.last_seen_at >= public.club_matches.last_seen_at then excluded.match_timestamp else public.club_matches.match_timestamp end,
    payload = case when excluded.last_seen_at >= public.club_matches.last_seen_at then excluded.payload else public.club_matches.payload end;
end;
$$;

create function public.claim_tracked_clubs(p_limit integer default 2)
returns table (club_id text, competition text)
language sql security invoker set search_path = '' as $$
  with candidates as (
    select t.platform, t.club_id, t.competition
    from public.tracked_clubs t
    where t.platform = 'common-gen5'
      and (t.lease_until is null or t.lease_until < now())
      and t.last_attempt_at < now() - interval '5 minutes'
    order by t.last_attempt_at, t.club_id, t.competition
    limit greatest(0, least(coalesce(p_limit, 2), 2))
    for update skip locked
  )
  update public.tracked_clubs t
  set last_attempt_at = now(), lease_until = now() + interval '5 minutes'
  from candidates c
  where t.platform = c.platform and t.club_id = c.club_id and t.competition = c.competition
  returning t.club_id, t.competition;
$$;

revoke all on function public.ingest_club_observations(text, text, text, jsonb, jsonb, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_tracked_clubs(integer) from public, anon, authenticated;
grant execute on function public.ingest_club_observations(text, text, text, jsonb, jsonb, timestamptz, text) to service_role;
grant execute on function public.claim_tracked_clubs(integer) to service_role;
