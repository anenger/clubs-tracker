-- Club and match statistics originate from EA's public Clubs endpoints.
-- Keep raw endpoint snapshots and all writes private; expose only bounded history inputs.
grant usage on schema public to anon, authenticated;

grant select (
  platform, club_id, competition, tracking_started_at, last_synced_at, sync_status
) on public.tracked_clubs to anon, authenticated;

grant select (
  platform, club_id, competition, match_id, match_timestamp, payload
) on public.club_matches to anon, authenticated;

create policy "Public read access to tracked club status"
on public.tracked_clubs for select
to anon, authenticated
using (true);

create policy "Public read access to collected EA matches"
on public.club_matches for select
to anon, authenticated
using (true);
