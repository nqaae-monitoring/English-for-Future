-- =============================================================================
-- English for Future — Supabase schema
-- =============================================================================
-- Run this file in the Supabase SQL editor in one go (as the `postgres` role).
-- It is idempotent where practical: tables use IF NOT EXISTS, functions use
-- CREATE OR REPLACE, policies/triggers are dropped before being re-created.
--
-- The client-facing API is documented in docs/CONTRACTS.md
-- ("Supabase (supabase/schema.sql) — client-facing API"). Function names,
-- parameter names (p_ prefix) and JSON keys below follow that contract.
--
-- Conventions
--   * All "days", "weeks" and "months" are computed in Asia/Tashkent.
--     A week starts Monday 00:00 Tashkent (Postgres date_trunc('week') is
--     ISO, i.e. Monday based).
--   * Every RPC is SECURITY DEFINER with search_path = public and uses
--     auth.uid() to identify the caller. Clients never pass XP values.
--   * Errors that the client is expected to handle are returned as
--     { ok:false, error:'...' }; programming/authorisation errors are RAISEd
--     (not_authenticated, blocked, forbidden, invalid_type, ...).
--
-- Dashboard settings required: Authentication -> Providers -> Email ->
-- "Confirm email" OFF (the app signs up with synthetic
-- <login_id>@users.efuture.local addresses).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Pure helpers (time zone, XP table, level curve, skill mapping, leagues)
-- -----------------------------------------------------------------------------

-- Tashkent calendar day of a timestamp.
create or replace function public.tz_day(ts timestamptz)
returns date
language sql stable
as $$
  select (ts at time zone 'Asia/Tashkent')::date
$$;

-- Monday of the Tashkent week containing ts.
create or replace function public.tz_week_start(ts timestamptz)
returns date
language sql stable
as $$
  select date_trunc('week', ts at time zone 'Asia/Tashkent')::date
$$;

-- First day of the Tashkent month containing ts.
create or replace function public.tz_month_start(ts timestamptz)
returns date
language sql stable
as $$
  select date_trunc('month', ts at time zone 'Asia/Tashkent')::date
$$;

-- Midnight (Tashkent) of a calendar day, as an absolute instant. Used to turn
-- day/week/month boundaries back into index-friendly timestamptz ranges.
create or replace function public.tz_ts(d date)
returns timestamptz
language sql stable
as $$
  select (d::timestamp) at time zone 'Asia/Tashkent'
$$;

-- Index of a CEFR level in the platform order A2 -> B1 -> B2 -> C1 (1-based),
-- null for anything else.
create or replace function public.cefr_index(p_level text)
returns int
language sql immutable
as $$
  select array_position(array['A2','B1','B2','C1'], p_level)
$$;

-- XP table (mirrors XP_TABLE in js/app.js). Returns null for unknown types.
-- streak_bonus is never awarded through this function directly from the
-- client; award_xp computes it server-side (5 * min(streak, 10)).
create or replace function public.xp_for(p_type text, p_score int default null)
returns int
language sql immutable
as $$
  select case p_type
    when 'plan_step'     then 10
    when 'word_mastered' then 2
    when 'phrase_saved'  then 1
    when 'grammar'       then 5
    when 'listening'     then 8
    when 'speaking'      then 15
    when 'writing'       then 20
    when 'negotiation'   then 25
    when 'assessment'    then round(least(greatest(coalesce(p_score, 0), 0), 100) / 2.0)::int
    when 'streak_bonus'  then 0
    else null
  end
$$;

-- Type -> skill bucket mapping (mirrors the JS mapping).
create or replace function public.skill_for(p_type text)
returns text
language sql immutable
as $$
  select case p_type
    when 'plan_step'     then 'assessment'
    when 'word_mastered' then 'vocab'
    when 'phrase_saved'  then 'vocab'
    when 'grammar'       then 'grammar'
    when 'listening'     then 'listening'
    when 'speaking'      then 'speaking'
    when 'writing'       then 'writing'
    when 'negotiation'   then 'negotiation'
    when 'assessment'    then 'assessment'
    when 'streak_bonus'  then 'assessment'
    else null
  end
$$;

-- Platform level curve: level = min(30, floor(sqrt(total_xp / 50)) + 1).
create or replace function public.platform_level(p_total_xp int)
returns int
language sql immutable
as $$
  select least(30, floor(sqrt(greatest(coalesce(p_total_xp, 0), 0) / 50.0))::int + 1)
$$;

-- League by percentile of rank among p_n users with xp > 0 in the period:
-- Gold top 10 %, Silver next 20 %, Bronze next 30 %, Rising the rest.
-- Unranked users (no rank / 0 xp) are Rising.
create or replace function public.league_for(p_rank int, p_n int)
returns text
language sql immutable
as $$
  select case
    when p_rank is null or p_n is null or p_n <= 0            then 'Rising'
    when (p_rank - 1)::numeric / p_n < 0.10                   then 'Gold'
    when (p_rank - 1)::numeric / p_n < 0.30                   then 'Silver'
    when (p_rank - 1)::numeric / p_n < 0.60                   then 'Bronze'
    else 'Rising'
  end
$$;

-- A streak only "counts" while it is alive: the last active day must be
-- today or yesterday (Tashkent). Otherwise the displayed streak is 0.
create or replace function public.effective_streak(p_count int, p_last date)
returns int
language sql stable
as $$
  select case
    when p_last is not null and p_last >= public.tz_day(now()) - 1 then coalesce(p_count, 0)
    else 0
  end
$$;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  login_id            text not null unique
                      constraint profiles_login_id_format check (login_id ~ '^[a-z0-9_]{3,20}$'),
  display_name        text,
  organisation        text,
  position            text,
  role                text not null default 'learner'
                      constraint profiles_role_check check (role in ('learner', 'admin')),
  show_on_leaderboard boolean not null default true,
  cefr_level          text
                      constraint profiles_cefr_check check (cefr_level in ('A2', 'B1', 'B2', 'C1')),
  placement_taken_at  timestamptz,
  blocked             boolean not null default false,
  recovery_email      text,
  streak_count        int not null default 0,
  streak_last         date,
  created_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now()
);

-- Case-insensitive uniqueness of login_id (the trigger lower-cases on insert,
-- this index guarantees it regardless of the write path).
create unique index if not exists profiles_login_id_lower_idx
  on public.profiles (lower(login_id));
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);

comment on table public.profiles is 'One row per auth user. Created by trigger on auth.users.';

create table if not exists public.user_state (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_state is 'Whole app state blob per learner (last-write-wins with conflict detection in save_state).';

create table if not exists public.activity_log (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null
             constraint activity_type_check check (type in (
               'plan_step','word_mastered','phrase_saved','grammar','listening',
               'speaking','writing','negotiation','assessment','streak_bonus')),
  skill      text not null
             constraint activity_skill_check check (skill in (
               'vocab','grammar','listening','speaking','writing','negotiation','assessment')),
  cefr_level text,
  xp         int not null default 0 check (xp >= 0),
  score      int check (score between 0 and 100),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_created_idx on public.activity_log (user_id, created_at);
create index if not exists activity_log_created_idx      on public.activity_log (created_at);
create index if not exists activity_log_user_type_idx    on public.activity_log (user_id, type);

comment on table public.activity_log is 'Append-only XP ledger. Rows are written only by award_xp (clients have no insert privilege).';

create table if not exists public.level_tests (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null
               constraint level_tests_kind_check check (kind in ('placement', 'level_up')),
  from_level   text,
  result_level text,
  score        int,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists level_tests_user_created_idx on public.level_tests (user_id, created_at desc);

create table if not exists public.badges (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  code      text not null
            constraint badges_code_check check (code in (
              'first_lesson','streak_7','streak_30','words_100','words_500',
              'first_negotiation','first_speech','b1_reached','b2_reached','c1_reached','weekly_1')),
  earned_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists public.weekly_winners (
  week_start date not null,
  rank       int  not null check (rank between 1 and 3),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  xp         int  not null,
  primary key (week_start, rank)
);

create index if not exists weekly_winners_user_idx on public.weekly_winners (user_id);

comment on table public.weekly_winners is 'Top 3 of every completed Tashkent week. Filled lazily by ensure_weekly_history() (no pg_cron).';

-- -----------------------------------------------------------------------------
-- 2. Authorisation helpers
-- -----------------------------------------------------------------------------

-- True when the caller's profile has role = 'admin'. SECURITY DEFINER so it can
-- be used inside RLS policies on profiles without recursion.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
$$;

-- Raises 'forbidden' unless the caller is an admin.
create or replace function public.assert_admin()
returns void
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------

-- 3a. auth.users -> profiles. Reads signUp options.data (raw_user_meta_data):
--     login_id (lower-cased, validated), display_name, organisation, position,
--     recovery_email. Raises on invalid or duplicate login_id, which makes the
--     whole signUp fail (nothing is left behind).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_login text;
begin
  -- Prefer the explicit login_id; fall back to the local part of the e-mail
  -- (users created from the dashboard without metadata).
  v_login := lower(trim(coalesce(v_meta->>'login_id', split_part(coalesce(new.email, ''), '@', 1))));

  if v_login is null or v_login !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_login_id' using errcode = '22023',
      detail = 'login_id must match ^[a-z0-9_]{3,20}$';
  end if;

  if exists (select 1 from public.profiles p where lower(p.login_id) = v_login) then
    raise exception 'login_id_taken' using errcode = '23505';
  end if;

  insert into public.profiles (id, login_id, display_name, organisation, position, recovery_email)
  values (
    new.id,
    v_login,
    nullif(trim(coalesce(v_meta->>'display_name', '')), ''),
    nullif(trim(coalesce(v_meta->>'organisation', '')), ''),
    nullif(trim(coalesce(v_meta->>'position', '')), ''),
    nullif(lower(trim(coalesce(v_meta->>'recovery_email', ''))), '')
  );

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Protect server-owned columns on profiles. Learners may update their own
--     row directly (RLS), but only the "cosmetic" columns. Any attempt to change
--     a protected column is silently reverted. Writes made by SECURITY DEFINER
--     RPCs run as the function owner (not `authenticated`) and are not touched.
create or replace function public.profiles_protect()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.id                 := old.id;
    new.login_id           := old.login_id;
    new.role               := old.role;
    new.blocked            := old.blocked;
    new.cefr_level         := old.cefr_level;
    new.placement_taken_at := old.placement_taken_at;
    new.streak_count       := old.streak_count;
    new.streak_last        := old.streak_last;
    new.created_at         := old.created_at;
  end if;
  -- login_id is always stored lower-case.
  new.login_id := lower(new.login_id);
  return new;
end
$$;

drop trigger if exists profiles_protect_trg on public.profiles;
create trigger profiles_protect_trg
  before update on public.profiles
  for each row execute function public.profiles_protect();

-- -----------------------------------------------------------------------------
-- 4. View user_stats
-- -----------------------------------------------------------------------------
-- security_invoker: the underlying RLS applies, so a learner sees only their own
-- row and admins see everyone. SECURITY DEFINER RPCs bypass RLS anyway.

drop view if exists public.user_stats;
create or replace view public.user_stats
with (security_invoker = true)
as
select
  p.id                                                                        as user_id,
  p.login_id,
  p.display_name,
  p.organisation,
  coalesce(sum(a.xp), 0)::int                                                 as total_xp,
  coalesce(sum(a.xp) filter (where a.created_at >= public.tz_ts(public.tz_week_start(now()))), 0)::int  as weekly_xp,
  coalesce(sum(a.xp) filter (where a.created_at >= public.tz_ts(public.tz_month_start(now()))), 0)::int as monthly_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'vocab'), 0)::int                as vocab_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'grammar'), 0)::int              as grammar_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'listening'), 0)::int            as listening_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'speaking'), 0)::int             as speaking_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'writing'), 0)::int              as writing_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'negotiation'), 0)::int          as negotiation_xp,
  coalesce(sum(a.xp) filter (where a.skill = 'assessment'), 0)::int           as assessment_xp,
  public.platform_level(coalesce(sum(a.xp), 0)::int)                          as platform_level,
  p.cefr_level,
  public.effective_streak(p.streak_count, p.streak_last)                      as streak,
  p.last_active_at
from public.profiles p
left join public.activity_log a on a.user_id = p.id
group by p.id;

-- -----------------------------------------------------------------------------
-- 5. Internal helpers (not callable by clients)
-- -----------------------------------------------------------------------------

-- Grants a badge once. Returns true when it was newly earned.
create or replace function public.grant_badge(p_user uuid, p_code text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  insert into public.badges (user_id, code) values (p_user, p_code)
  on conflict do nothing;
  return found;
end
$$;

-- Ranking of visible (show_on_leaderboard and not blocked) users with xp > 0
-- in [p_start, p_end). Null bounds mean "all time". Optional skill / cefr / org
-- filters. Order: xp desc, display_name, user_id. `n` is the number of ranked
-- users (same on every row) and feeds league_for().
create or replace function public.period_ranking(
  p_start timestamptz,
  p_end   timestamptz,
  p_skill text default null,
  p_cefr  text default null,
  p_org   text default null
)
returns table (user_id uuid, xp int, rank int, n int)
language sql stable
set search_path = public
as $$
  with s as (
    select a.user_id, sum(a.xp)::int as xp
    from public.activity_log a
    join public.profiles p on p.id = a.user_id
    where p.show_on_leaderboard
      and not p.blocked
      and (p_start is null or a.created_at >= p_start)
      and (p_end   is null or a.created_at <  p_end)
      and (p_skill is null or a.skill = p_skill)
      and (p_cefr  is null or p.cefr_level = p_cefr)
      and (p_org   is null or p.organisation ilike '%' || p_org || '%')
    group by a.user_id
    having sum(a.xp) > 0
  )
  select
    s.user_id,
    s.xp,
    row_number() over (order by s.xp desc, lower(coalesce(p.display_name, p.login_id)), s.user_id)::int as rank,
    count(*) over ()::int as n
  from s
  join public.profiles p on p.id = s.user_id
$$;

-- Fills weekly_winners for every completed Tashkent week that has no rows yet
-- (top 3 by weekly XP among visible users) and grants weekly_1 to rank 1.
-- Called lazily from get_leaderboard / get_weekly_winners — no pg_cron needed.
-- Safe under concurrency (ON CONFLICT DO NOTHING + idempotent badge grant).
create or replace function public.ensure_weekly_history()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_first    timestamptz;
  v_week     date;
  v_cur_week date;
  v_last     date;
  v_winner   uuid;
begin
  select min(a.created_at) into v_first from public.activity_log a;
  if v_first is null then
    return;
  end if;

  v_cur_week := public.tz_week_start(now());
  v_week     := public.tz_week_start(v_first);

  -- Weeks up to the newest recorded one are done (or were empty): skip them.
  select max(w.week_start) into v_last from public.weekly_winners w;
  if v_last is not null and v_last + 7 > v_week then
    v_week := v_last + 7;
  end if;

  while v_week < v_cur_week loop
    if not exists (select 1 from public.weekly_winners w where w.week_start = v_week) then
      insert into public.weekly_winners (week_start, rank, user_id, xp)
      select v_week, r.rank, r.user_id, r.xp
      from public.period_ranking(public.tz_ts(v_week), public.tz_ts(v_week + 7), null, null, null) r
      where r.rank <= 3
      on conflict do nothing;

      select w.user_id into v_winner
      from public.weekly_winners w
      where w.week_start = v_week and w.rank = 1;

      if v_winner is not null then
        perform public.grant_badge(v_winner, 'weekly_1');
      end if;
    end if;
    v_week := v_week + 7;
  end loop;
end
$$;

-- Stats object for any user (shape of get_my_stats). Shared by get_my_stats and
-- admin_user_detail.
create or replace function public.stats_for(p_user uuid)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_prof        public.profiles%rowtype;
  v_total       int := 0;
  v_weekly      int := 0;
  v_monthly     int := 0;
  v_by_skill    jsonb;
  v_badges      jsonb;
  v_rank        int;
  v_n           int := 0;
  v_my_week_xp  int := 0;
  v_gold_min    int;
  v_league      text;
  v_xp_to_gold  int;
  v_history     jsonb;
  v_rank_hist   jsonb;
  v_tests       jsonb;
  v_week_start  date := public.tz_week_start(now());
  v_ws          timestamptz := public.tz_ts(public.tz_week_start(now()));
  v_we          timestamptz := public.tz_ts(public.tz_week_start(now()) + 7);
  v_ms          timestamptz := public.tz_ts(public.tz_month_start(now()));
begin
  select * into v_prof from public.profiles p where p.id = p_user;
  if not found then
    return null;
  end if;

  select
    coalesce(sum(a.xp), 0),
    coalesce(sum(a.xp) filter (where a.created_at >= v_ws), 0),
    coalesce(sum(a.xp) filter (where a.created_at >= v_ms), 0),
    jsonb_build_object(
      'vocab',       coalesce(sum(a.xp) filter (where a.skill = 'vocab'), 0),
      'grammar',     coalesce(sum(a.xp) filter (where a.skill = 'grammar'), 0),
      'listening',   coalesce(sum(a.xp) filter (where a.skill = 'listening'), 0),
      'speaking',    coalesce(sum(a.xp) filter (where a.skill = 'speaking'), 0),
      'writing',     coalesce(sum(a.xp) filter (where a.skill = 'writing'), 0),
      'negotiation', coalesce(sum(a.xp) filter (where a.skill = 'negotiation'), 0),
      'assessment',  coalesce(sum(a.xp) filter (where a.skill = 'assessment'), 0)
    )
  into v_total, v_weekly, v_monthly, v_by_skill
  from public.activity_log a
  where a.user_id = p_user;

  select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'earned_at', b.earned_at) order by b.earned_at), '[]'::jsonb)
  into v_badges
  from public.badges b
  where b.user_id = p_user;

  -- Current-week ranking (unfiltered, visible users only).
  select
    max(case when r.user_id = p_user then r.rank end),
    max(case when r.user_id = p_user then r.xp end),
    coalesce(max(r.n), 0),
    min(case when public.league_for(r.rank, r.n) = 'Gold' then r.xp end)
  into v_rank, v_my_week_xp, v_n, v_gold_min
  from public.period_ranking(v_ws, v_we, null, null, null) r;

  v_league := public.league_for(v_rank, v_n);
  v_xp_to_gold := case
    when v_league = 'Gold'   then 0
    when v_gold_min is null  then 1                                  -- nobody ranked yet: any XP is Gold
    else greatest(1, v_gold_min - coalesce(v_my_week_xp, v_weekly) + 1)
  end;

  -- Last 90 Tashkent days (days without activity are omitted).
  select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'xp', d.xp) order by d.day), '[]'::jsonb)
  into v_history
  from (
    select public.tz_day(a.created_at) as day, sum(a.xp)::int as xp
    from public.activity_log a
    where a.user_id = p_user
      and a.created_at >= public.tz_ts(public.tz_day(now()) - 89)
    group by 1
  ) d;

  -- Weeks in which the user finished top 3, plus the current (running) week.
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', to_char(h.week_start, 'YYYY-MM-DD'),
           'rank', h.rank,
           'league', h.league) order by h.week_start), '[]'::jsonb)
  into v_rank_hist
  from (
    select w.week_start, w.rank,
           public.league_for(w.rank, (
             select coalesce(max(r.n), 0)
             from public.period_ranking(public.tz_ts(w.week_start), public.tz_ts(w.week_start + 7), null, null, null) r
           )) as league
    from public.weekly_winners w
    where w.user_id = p_user
    union all
    select v_week_start, v_rank, v_league
  ) h;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_tests
  from public.level_tests t
  where t.user_id = p_user;

  return jsonb_build_object(
    'total_xp',       v_total,
    'weekly_xp',      v_weekly,
    'monthly_xp',     v_monthly,
    'by_skill',       v_by_skill,
    'streak',         public.effective_streak(v_prof.streak_count, v_prof.streak_last),
    'platform_level', public.platform_level(v_total),
    'cefr_level',     v_prof.cefr_level,
    'badges',         v_badges,
    'rank_week',      v_rank,
    'league_week',    v_league,
    'xp_to_gold',     v_xp_to_gold,
    'xp_history',     v_history,
    'rank_history',   v_rank_hist,
    'tests',          v_tests
  );
end
$$;

-- -----------------------------------------------------------------------------
-- 6. Client RPCs
-- -----------------------------------------------------------------------------

-- login_id_available(p_login_id) -> bool            (anon + authenticated)
-- False for malformed ids, taken profiles, or an auth user already holding the
-- synthetic e-mail.
create or replace function public.login_id_available(p_login_id text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v text := lower(trim(p_login_id));
begin
  if v is null or v !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;
  if exists (select 1 from public.profiles p where lower(p.login_id) = v) then
    return false;
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v || '@users.efuture.local') then
    return false;
  end if;
  return true;
end
$$;

-- save_state(p_state, p_base_updated_at)
--   -> { ok, updated_at, conflict, state }
-- Last-write-wins with conflict detection: when the server copy is newer than
-- the client's base timestamp the write is rejected and the server copy is
-- returned (conflict=true). updated_at is stored with millisecond precision so
-- JS Date round-trips compare equal. A null base with an existing server row
-- is treated as a conflict (protects against a fresh client overwriting cloud
-- progress before it has loaded it).
create or replace function public.save_state(p_state jsonb, p_base_updated_at timestamptz default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_blocked  boolean;
  v_server   timestamptz;
  v_state    jsonb;
  v_now      timestamptz := date_trunc('milliseconds', now());
  v_base     timestamptz := date_trunc('milliseconds', p_base_updated_at);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  select p.blocked into v_blocked from public.profiles p where p.id = v_uid;
  if coalesce(v_blocked, false) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  select s.updated_at, s.state into v_server, v_state
  from public.user_state s
  where s.user_id = v_uid
  for update;

  if v_server is not null and (v_base is null or v_server > v_base) then
    return jsonb_build_object(
      'ok', false, 'conflict', true, 'updated_at', v_server, 'state', v_state);
  end if;

  insert into public.user_state (user_id, state, updated_at)
  values (v_uid, p_state, v_now)
  on conflict (user_id) do update
    set state = excluded.state, updated_at = excluded.updated_at;

  update public.profiles set last_active_at = now() where id = v_uid;

  return jsonb_build_object('ok', true, 'conflict', false, 'updated_at', v_now, 'state', null);
end
$$;

-- load_state() -> { state, updated_at } | null
create or replace function public.load_state()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('state', s.state, 'updated_at', s.updated_at)
  from public.user_state s
  where s.user_id = auth.uid()
$$;

-- award_xp(p_type, p_score, p_meta)
--   -> { awarded, streak_bonus, total_xp, today_xp, capped, streak, new_badges, platform_level }
-- XP is computed server-side from the XP table; the client never passes XP.
-- Daily cap 300 XP per Tashkent day (partial award up to the cap, capped=true
-- when hit). Maintains streak_count/streak_last/last_active_at, awards the
-- streak_bonus row once per new day (5 * min(streak, 10), also under the cap)
-- and evaluates badges.
create or replace function public.award_xp(p_type text, p_score int default null, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_prof        public.profiles%rowtype;
  v_type        text := lower(trim(p_type));
  v_score       int  := case when p_score is null then null else least(greatest(p_score, 0), 100) end;
  v_meta        jsonb := case when p_meta is not null and jsonb_typeof(p_meta) = 'object' then p_meta else '{}'::jsonb end;
  v_xp          int;
  v_award       int := 0;
  v_bonus       int := 0;
  v_bonus_award int := 0;
  v_today       date := public.tz_day(now());
  v_day_start   timestamptz;
  v_day_end     timestamptz;
  v_today_xp    int := 0;
  v_capped      boolean := false;
  v_new_day     boolean := false;
  v_streak      int;
  v_new         text[] := '{}';
  v_total       int := 0;
  v_words       int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_type is null or v_type = '' or v_type = 'streak_bonus' then
    raise exception 'invalid_type' using errcode = '22023';
  end if;
  v_xp := public.xp_for(v_type, v_score);
  if v_xp is null then
    raise exception 'invalid_type' using errcode = '22023';
  end if;

  -- Lock the profile row: serialises concurrent awards for the same user so
  -- the daily cap and the once-per-day bonus are enforced exactly.
  select * into v_prof from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;
  if v_prof.blocked then
    raise exception 'blocked' using errcode = '42501';
  end if;

  v_day_start := public.tz_ts(v_today);
  v_day_end   := public.tz_ts(v_today + 1);

  select coalesce(sum(a.xp), 0) into v_today_xp
  from public.activity_log a
  where a.user_id = v_uid and a.created_at >= v_day_start and a.created_at < v_day_end;

  -- Streak: consecutive Tashkent days with any activity.
  v_streak := coalesce(v_prof.streak_count, 0);
  if v_prof.streak_last is distinct from v_today then
    v_new_day := true;
    if v_prof.streak_last = v_today - 1 then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;
  end if;

  -- Main award (partial up to the cap). The row is always written, even with
  -- 0 XP, so activity counts (words mastered, streak) stay correct.
  v_award := least(v_xp, greatest(300 - v_today_xp, 0));
  if v_award < v_xp then
    v_capped := true;
  end if;

  insert into public.activity_log (user_id, type, skill, cefr_level, xp, score, meta)
  values (v_uid, v_type, public.skill_for(v_type), v_prof.cefr_level, v_award, v_score, v_meta);
  v_today_xp := v_today_xp + v_award;

  -- Streak bonus: once per day, on the first activity of a new day.
  if v_new_day and not exists (
    select 1 from public.activity_log a
    where a.user_id = v_uid and a.type = 'streak_bonus'
      and a.created_at >= v_day_start and a.created_at < v_day_end
  ) then
    v_bonus       := 5 * least(v_streak, 10);
    v_bonus_award := least(v_bonus, greatest(300 - v_today_xp, 0));
    if v_bonus_award < v_bonus then
      v_capped := true;
    end if;
    insert into public.activity_log (user_id, type, skill, cefr_level, xp, score, meta)
    values (v_uid, 'streak_bonus', 'assessment', v_prof.cefr_level, v_bonus_award, null,
            jsonb_build_object('streak', v_streak));
    v_today_xp := v_today_xp + v_bonus_award;
  end if;

  update public.profiles
  set streak_count = v_streak, streak_last = v_today, last_active_at = now()
  where id = v_uid;

  -- Badges.
  if v_type = 'plan_step' and public.grant_badge(v_uid, 'first_lesson') then
    v_new := array_append(v_new, 'first_lesson');
  end if;
  if v_streak >= 7 and public.grant_badge(v_uid, 'streak_7') then
    v_new := array_append(v_new, 'streak_7');
  end if;
  if v_streak >= 30 and public.grant_badge(v_uid, 'streak_30') then
    v_new := array_append(v_new, 'streak_30');
  end if;
  if v_type = 'word_mastered' then
    select count(*) into v_words from public.activity_log a
    where a.user_id = v_uid and a.type = 'word_mastered';
    if v_words >= 100 and public.grant_badge(v_uid, 'words_100') then
      v_new := array_append(v_new, 'words_100');
    end if;
    if v_words >= 500 and public.grant_badge(v_uid, 'words_500') then
      v_new := array_append(v_new, 'words_500');
    end if;
  end if;
  if v_type = 'negotiation' and public.grant_badge(v_uid, 'first_negotiation') then
    v_new := array_append(v_new, 'first_negotiation');
  end if;
  if v_type = 'speaking' and v_meta->>'kind' = 'speech' and public.grant_badge(v_uid, 'first_speech') then
    v_new := array_append(v_new, 'first_speech');
  end if;

  select coalesce(sum(a.xp), 0) into v_total from public.activity_log a where a.user_id = v_uid;

  return jsonb_build_object(
    'awarded',        v_award,
    'streak_bonus',   v_bonus_award,
    'total_xp',       v_total,
    'today_xp',       v_today_xp,
    'capped',         v_capped,
    'streak',         v_streak,
    'new_badges',     to_jsonb(v_new),
    'platform_level', public.platform_level(v_total)
  );
end
$$;

-- record_level_test(p_kind, p_from, p_result, p_score, p_details)
--   -> { ok, cefr_level, placement_taken_at, new_badges, error }
-- placement: allowed when placement_taken_at is null or older than 30 days,
--            otherwise { ok:false, error:'too_soon' }. Sets cefr_level.
-- level_up:  only to the next level (A2->B1->B2->C1); passes at score >= 75.
--            A failed attempt is recorded, level unchanged, ok:true.
-- The server's current cefr_level is authoritative (p_from is informational).
create or replace function public.record_level_test(
  p_kind    text,
  p_from    text,
  p_result  text,
  p_score   int,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%rowtype;
  v_kind     text := lower(trim(p_kind));
  v_result   text := upper(trim(p_result));
  v_score    int  := least(greatest(coalesce(p_score, 0), 0), 100);
  v_details  jsonb := case when p_details is not null and jsonb_typeof(p_details) = 'object' then p_details else '{}'::jsonb end;
  v_newlevel text;
  v_passed   boolean;
  v_new      text[] := '{}';
  v_taken_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_prof from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;
  if v_prof.blocked then
    raise exception 'blocked' using errcode = '42501';
  end if;

  if v_kind is null or v_kind not in ('placement', 'level_up') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind',
      'cefr_level', v_prof.cefr_level, 'placement_taken_at', v_prof.placement_taken_at, 'new_badges', '[]'::jsonb);
  end if;
  if v_result is null or public.cefr_index(v_result) is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_level',
      'cefr_level', v_prof.cefr_level, 'placement_taken_at', v_prof.placement_taken_at, 'new_badges', '[]'::jsonb);
  end if;

  if v_kind = 'placement' then
    if v_prof.placement_taken_at is not null and v_prof.placement_taken_at > now() - interval '30 days' then
      return jsonb_build_object('ok', false, 'error', 'too_soon',
        'cefr_level', v_prof.cefr_level, 'placement_taken_at', v_prof.placement_taken_at, 'new_badges', '[]'::jsonb);
    end if;

    v_newlevel := v_result;
    v_taken_at := now();

    insert into public.level_tests (user_id, kind, from_level, result_level, score, details)
    values (v_uid, 'placement', v_prof.cefr_level, v_newlevel, v_score,
            v_details || jsonb_build_object('passed', true));

    update public.profiles
    set cefr_level = v_newlevel, placement_taken_at = v_taken_at, last_active_at = now()
    where id = v_uid;

  else -- level_up
    if v_prof.cefr_level is null then
      return jsonb_build_object('ok', false, 'error', 'no_placement',
        'cefr_level', null, 'placement_taken_at', null, 'new_badges', '[]'::jsonb);
    end if;
    if v_prof.cefr_level = 'C1' then
      return jsonb_build_object('ok', false, 'error', 'max_level',
        'cefr_level', v_prof.cefr_level, 'placement_taken_at', v_prof.placement_taken_at, 'new_badges', '[]'::jsonb);
    end if;
    if public.cefr_index(v_result) <> public.cefr_index(v_prof.cefr_level) + 1 then
      return jsonb_build_object('ok', false, 'error', 'invalid_level',
        'cefr_level', v_prof.cefr_level, 'placement_taken_at', v_prof.placement_taken_at, 'new_badges', '[]'::jsonb);
    end if;

    v_passed   := v_score >= 75;
    v_newlevel := case when v_passed then v_result else v_prof.cefr_level end;
    v_taken_at := v_prof.placement_taken_at;

    insert into public.level_tests (user_id, kind, from_level, result_level, score, details)
    values (v_uid, 'level_up', v_prof.cefr_level, v_newlevel, v_score,
            v_details || jsonb_build_object('passed', v_passed, 'target', v_result));

    update public.profiles
    set cefr_level = v_newlevel, last_active_at = now()
    where id = v_uid;
  end if;

  -- Level badges: every level at or below the one reached (B1 and up).
  if public.cefr_index(v_newlevel) >= 2 and public.grant_badge(v_uid, 'b1_reached') then
    v_new := array_append(v_new, 'b1_reached');
  end if;
  if public.cefr_index(v_newlevel) >= 3 and public.grant_badge(v_uid, 'b2_reached') then
    v_new := array_append(v_new, 'b2_reached');
  end if;
  if public.cefr_index(v_newlevel) >= 4 and public.grant_badge(v_uid, 'c1_reached') then
    v_new := array_append(v_new, 'c1_reached');
  end if;

  return jsonb_build_object(
    'ok',                 true,
    'cefr_level',         v_newlevel,
    'placement_taken_at', v_taken_at,
    'new_badges',         to_jsonb(v_new),
    'error',              null
  );
end
$$;

-- get_my_stats() -> see stats_for()
create or replace function public.get_my_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return public.stats_for(auth.uid());
end
$$;

-- get_leaderboard(p_period 'week'|'month'|'all', p_skill, p_cefr, p_org, p_limit)
--   -> rows: rank, user_id, display_name, organisation, cefr_level, platform_level,
--            league, xp, streak, prev_rank, trend, is_me
-- Only visible, non-blocked users with xp > 0 in the period are ranked.
-- prev_rank/trend compare with the previous week/month ('new' when absent;
-- 'same' for p_period = 'all'). The caller's row is always included with
-- is_me = true: within the top p_limit, appended after it, or appended with
-- rank null when hidden / blocked / filtered out / 0 XP.
create or replace function public.get_leaderboard(
  p_period text default 'week',
  p_skill  text default null,
  p_cefr   text default null,
  p_org    text default null,
  p_limit  int  default 50
)
returns table (
  rank           int,
  user_id        uuid,
  display_name   text,
  organisation   text,
  cefr_level     text,
  platform_level int,
  league         text,
  xp             int,
  streak         int,
  prev_rank      int,
  trend          text,
  is_me          boolean
)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me     uuid := auth.uid();
  v_period text := lower(trim(coalesce(p_period, 'week')));
  v_skill  text := nullif(trim(p_skill), '');
  v_cefr   text := upper(nullif(trim(p_cefr), ''));
  v_org    text := nullif(trim(p_org), '');
  v_limit  int  := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_start  timestamptz;
  v_end    timestamptz;
  v_pstart timestamptz;
  v_pend   timestamptz;
  v_wk     date := public.tz_week_start(now());
  v_mo     date := public.tz_month_start(now());
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_period not in ('week', 'month', 'all') then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  if v_skill is not null and v_skill not in ('vocab','grammar','listening','speaking','writing','negotiation','assessment') then
    raise exception 'invalid_skill' using errcode = '22023';
  end if;
  if v_cefr is not null and public.cefr_index(v_cefr) is null then
    raise exception 'invalid_cefr' using errcode = '22023';
  end if;

  perform public.ensure_weekly_history();

  if v_period = 'week' then
    v_start  := public.tz_ts(v_wk);
    v_end    := public.tz_ts(v_wk + 7);
    v_pstart := public.tz_ts(v_wk - 7);
    v_pend   := v_start;
  elsif v_period = 'month' then
    v_start  := public.tz_ts(v_mo);
    v_end    := public.tz_ts((v_mo + interval '1 month')::date);
    v_pstart := public.tz_ts((v_mo - interval '1 month')::date);
    v_pend   := v_start;
  else
    v_start  := null;                 -- all time
    v_end    := null;
    v_pstart := now();                -- empty range: no previous period
    v_pend   := now();
  end if;

  return query
  with cur as (
    select r.user_id, r.xp, r.rank, r.n
    from public.period_ranking(v_start, v_end, v_skill, v_cefr, v_org) r
  ),
  prev as (
    select r.user_id, r.rank
    from public.period_ranking(v_pstart, v_pend, v_skill, v_cefr, v_org) r
  ),
  shown as (
    select c.user_id, c.xp, c.rank, c.n
    from cur c
    where c.rank <= v_limit or c.user_id = v_me
  ),
  me_xp as (
    -- Caller's own period XP (skill filter applied) for the unranked case.
    select coalesce(sum(a.xp), 0)::int as xp
    from public.activity_log a
    where a.user_id = v_me
      and (v_start is null or a.created_at >= v_start)
      and (v_end   is null or a.created_at <  v_end)
      and (v_skill is null or a.skill = v_skill)
  ),
  all_rows as (
    select s.user_id, s.xp, s.rank, s.n from shown s
    union all
    select v_me, m.xp, null::int, null::int
    from me_xp m
    where not exists (select 1 from shown s where s.user_id = v_me)
  )
  select
    ar.rank,
    ar.user_id,
    coalesce(p.display_name, p.login_id)                           as display_name,
    p.organisation,
    p.cefr_level,
    public.platform_level(coalesce(t.total, 0)::int)               as platform_level,
    public.league_for(ar.rank, ar.n)                               as league,
    ar.xp,
    public.effective_streak(p.streak_count, p.streak_last)         as streak,
    pr.rank                                                        as prev_rank,
    case
      when v_period = 'all' or ar.rank is null then 'same'
      when pr.rank is null                     then 'new'
      when ar.rank < pr.rank                   then 'up'
      when ar.rank > pr.rank                   then 'down'
      else 'same'
    end                                                            as trend,
    (ar.user_id = v_me)                                            as is_me
  from all_rows ar
  join public.profiles p on p.id = ar.user_id
  left join prev pr on pr.user_id = ar.user_id
  left join lateral (
    select sum(al.xp) as total from public.activity_log al where al.user_id = ar.user_id
  ) t on true
  order by ar.rank nulls last, ar.xp desc;
end
$$;

-- get_weekly_winners(p_limit) -> rows: week_start, rank, display_name, xp
-- p_limit = number of most recent completed weeks (default 12; up to 3 rows each).
create or replace function public.get_weekly_winners(p_limit int default 12)
returns table (week_start date, rank int, display_name text, xp int)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 104);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.ensure_weekly_history();

  return query
  select w.week_start, w.rank, coalesce(p.display_name, p.login_id) as display_name, w.xp
  from public.weekly_winners w
  join public.profiles p on p.id = w.user_id
  where w.week_start in (
    select ww.week_start from public.weekly_winners ww
    group by ww.week_start
    order by ww.week_start desc
    limit v_limit
  )
  order by w.week_start desc, w.rank asc;
end
$$;

-- update_my_profile(p_patch) -> profile row (jsonb)
-- Allowed keys: display_name, organisation, position, show_on_leaderboard,
-- recovery_email. Everything else in the patch is ignored.
create or replace function public.update_my_profile(p_patch jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_patch jsonb := case when p_patch is not null and jsonb_typeof(p_patch) = 'object' then p_patch else '{}'::jsonb end;
  v_row   public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.profiles p
  set
    display_name        = case when v_patch ? 'display_name'
                               then left(nullif(trim(coalesce(v_patch->>'display_name', '')), ''), 60)
                               else p.display_name end,
    organisation        = case when v_patch ? 'organisation'
                               then left(nullif(trim(coalesce(v_patch->>'organisation', '')), ''), 120)
                               else p.organisation end,
    position            = case when v_patch ? 'position'
                               then left(nullif(trim(coalesce(v_patch->>'position', '')), ''), 120)
                               else p.position end,
    show_on_leaderboard = case when v_patch ? 'show_on_leaderboard'
                               then coalesce((v_patch->>'show_on_leaderboard')::boolean, p.show_on_leaderboard)
                               else p.show_on_leaderboard end,
    recovery_email      = case when v_patch ? 'recovery_email'
                               then left(nullif(lower(trim(coalesce(v_patch->>'recovery_email', ''))), ''), 254)
                               else p.recovery_email end,
    last_active_at      = now()
  where p.id = v_uid
  returning p.* into v_row;

  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  return to_jsonb(v_row);
end
$$;

-- -----------------------------------------------------------------------------
-- 7. Admin RPCs (role = 'admin' in profiles; otherwise raise 'forbidden')
-- -----------------------------------------------------------------------------

-- admin_summary() -> { total_users, active_today, active_week, avg_xp, by_cefr, inactive_7d }
-- active_today: last_active_at within the current Tashkent day;
-- active_week / inactive_7d: rolling 7 days.
create or replace function public.admin_summary()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(
    'total_users',  count(*),
    'active_today', count(*) filter (where p.last_active_at >= public.tz_ts(public.tz_day(now()))),
    'active_week',  count(*) filter (where p.last_active_at >= now() - interval '7 days'),
    'inactive_7d',  count(*) filter (where p.last_active_at is null or p.last_active_at < now() - interval '7 days'),
    'avg_xp',       coalesce(round(avg(coalesce(x.total, 0))), 0)::int,
    'by_cefr',      jsonb_build_object(
                      'A2',   count(*) filter (where p.cefr_level = 'A2'),
                      'B1',   count(*) filter (where p.cefr_level = 'B1'),
                      'B2',   count(*) filter (where p.cefr_level = 'B2'),
                      'C1',   count(*) filter (where p.cefr_level = 'C1'),
                      'none', count(*) filter (where p.cefr_level is null))
  )
  into v_out
  from public.profiles p
  left join (
    select a.user_id, sum(a.xp) as total from public.activity_log a group by a.user_id
  ) x on x.user_id = p.id;

  return v_out;
end
$$;

-- admin_users(p_search, p_org, p_cefr, p_league, p_sort, p_dir, p_limit, p_offset)
--   -> rows: id, login_id, display_name, organisation, position, role, cefr_level,
--            platform_level, total_xp, weekly_xp, streak, league, last_active_at,
--            created_at, blocked, show_on_leaderboard, total
-- p_search matches login_id / display_name / organisation (ilike). p_sort is
-- whitelisted (default last_active_at), p_dir 'asc'|'desc' (default desc).
-- `total` = number of rows matching the filters (same value on every row).
create or replace function public.admin_users(
  p_search text default null,
  p_org    text default null,
  p_cefr   text default null,
  p_league text default null,
  p_sort   text default 'last_active_at',
  p_dir    text default 'desc',
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id                  uuid,
  login_id            text,
  display_name        text,
  organisation        text,
  "position"          text,
  role                text,
  cefr_level          text,
  platform_level      int,
  total_xp            int,
  weekly_xp           int,
  streak              int,
  league              text,
  last_active_at      timestamptz,
  created_at          timestamptz,
  blocked             boolean,
  show_on_leaderboard boolean,
  total               int
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_sort   text;
  v_dir    text;
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_ws     timestamptz := public.tz_ts(public.tz_week_start(now()));
  v_we     timestamptz := public.tz_ts(public.tz_week_start(now()) + 7);
  v_sql    text;
begin
  perform public.assert_admin();

  v_sort := case
    when coalesce(p_sort, '') in ('last_active_at','created_at','total_xp','weekly_xp','streak',
                                  'display_name','login_id','organisation','position','role',
                                  'cefr_level','platform_level','league','blocked')
    then p_sort else 'last_active_at' end;
  v_dir := case when lower(coalesce(p_dir, '')) = 'asc' then 'asc' else 'desc' end;

  v_sql := $q$
    with xp as (
      select a.user_id,
             sum(a.xp)::int as total_xp,
             coalesce(sum(a.xp) filter (where a.created_at >= $5 and a.created_at < $6), 0)::int as weekly_xp
      from public.activity_log a
      group by a.user_id
    ),
    rk as (
      select r.user_id, r.rank, r.n
      from public.period_ranking($5, $6, null, null, null) r
    ),
    base as (
      select p.id, p.login_id, p.display_name, p.organisation, p.position, p.role, p.cefr_level,
             public.platform_level(coalesce(x.total_xp, 0))          as platform_level,
             coalesce(x.total_xp, 0)                                 as total_xp,
             coalesce(x.weekly_xp, 0)                                as weekly_xp,
             public.effective_streak(p.streak_count, p.streak_last)  as streak,
             public.league_for(rk.rank, rk.n)                        as league,
             p.last_active_at, p.created_at, p.blocked, p.show_on_leaderboard
      from public.profiles p
      left join xp x  on x.user_id  = p.id
      left join rk    on rk.user_id = p.id
    ),
    filtered as (
      select b.*
      from base b
      where ($1 is null
             or b.login_id     ilike '%' || $1 || '%'
             or b.display_name ilike '%' || $1 || '%'
             or b.organisation ilike '%' || $1 || '%')
        and ($2 is null or b.organisation ilike '%' || $2 || '%')
        and ($3 is null or b.cefr_level = $3)
        and ($4 is null or b.league = $4)
    )
    select f.*, (count(*) over ())::int as total
    from filtered f
  $q$
  || ' order by ' || quote_ident(v_sort) || ' ' || v_dir || ' nulls last, f.id'
  || ' limit $7 offset $8';

  return query execute v_sql
  using nullif(trim(p_search), ''),
        nullif(trim(p_org), ''),
        upper(nullif(trim(p_cefr), '')),
        initcap(nullif(trim(p_league), '')),
        v_ws,
        v_we,
        v_limit,
        v_offset;
end
$$;

-- admin_user_detail(p_user_id) -> { profile, stats, activity (last 200), tests, badges }
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_profile  jsonb;
  v_activity jsonb;
  v_tests    jsonb;
  v_badges   jsonb;
begin
  perform public.assert_admin();

  select to_jsonb(p) into v_profile from public.profiles p where p.id = p_user_id;
  if v_profile is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
  into v_activity
  from (
    select * from public.activity_log al
    where al.user_id = p_user_id
    order by al.created_at desc
    limit 200
  ) a;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_tests
  from public.level_tests t
  where t.user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'earned_at', b.earned_at) order by b.earned_at), '[]'::jsonb)
  into v_badges
  from public.badges b
  where b.user_id = p_user_id;

  return jsonb_build_object(
    'profile',  v_profile,
    'stats',    public.stats_for(p_user_id),
    'activity', v_activity,
    'tests',    v_tests,
    'badges',   v_badges
  );
end
$$;

-- admin_update_user(p_user_id, p_patch) -> profile row (jsonb)
-- Allowed keys: role, cefr_level, show_on_leaderboard, blocked.
-- An admin cannot change their own role or block themselves.
-- Note: `blocked` here only sets the profile flag (all RPCs reject blocked
-- users). To also ban the auth session use the admin-actions edge function.
create or replace function public.admin_update_user(p_user_id uuid, p_patch jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_patch jsonb := case when p_patch is not null and jsonb_typeof(p_patch) = 'object' then p_patch else '{}'::jsonb end;
  v_role  text;
  v_cefr  text;
  v_row   public.profiles%rowtype;
begin
  perform public.assert_admin();

  if v_patch ? 'role' then
    v_role := lower(trim(v_patch->>'role'));
    if v_role is null or v_role not in ('learner', 'admin') then
      raise exception 'invalid_role' using errcode = '22023';
    end if;
    if p_user_id = auth.uid() and v_role <> 'admin' then
      raise exception 'cannot_change_own_role' using errcode = '22023';
    end if;
  end if;

  if v_patch ? 'cefr_level' then
    v_cefr := upper(nullif(trim(coalesce(v_patch->>'cefr_level', '')), ''));
    if v_cefr is not null and public.cefr_index(v_cefr) is null then
      raise exception 'invalid_level' using errcode = '22023';
    end if;
  end if;

  if (v_patch ? 'blocked') and p_user_id = auth.uid() and coalesce((v_patch->>'blocked')::boolean, false) then
    raise exception 'cannot_block_self' using errcode = '22023';
  end if;

  update public.profiles p
  set
    role                = case when v_patch ? 'role' then v_role else p.role end,
    cefr_level          = case when v_patch ? 'cefr_level' then v_cefr else p.cefr_level end,
    show_on_leaderboard = case when v_patch ? 'show_on_leaderboard'
                               then coalesce((v_patch->>'show_on_leaderboard')::boolean, p.show_on_leaderboard)
                               else p.show_on_leaderboard end,
    blocked             = case when v_patch ? 'blocked'
                               then coalesce((v_patch->>'blocked')::boolean, p.blocked)
                               else p.blocked end
  where p.id = p_user_id
  returning p.* into v_row;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return to_jsonb(v_row);
end
$$;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.user_state     enable row level security;
alter table public.activity_log   enable row level security;
alter table public.level_tests    enable row level security;
alter table public.badges         enable row level security;
alter table public.weekly_winners enable row level security;

-- profiles: own row (select/insert/update), admins read all. Protected columns
-- are enforced by the profiles_protect trigger.
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'learner' and blocked = false);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_state: own row only; admins read all.
drop policy if exists user_state_select_own_or_admin on public.user_state;
create policy user_state_select_own_or_admin on public.user_state
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_state_insert_own on public.user_state;
create policy user_state_insert_own on public.user_state
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_state_update_own on public.user_state;
create policy user_state_update_own on public.user_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- activity_log: read own (admins all). No client writes at all (award_xp only).
drop policy if exists activity_log_select_own_or_admin on public.activity_log;
create policy activity_log_select_own_or_admin on public.activity_log
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- level_tests: read own (admins all). Writes only via record_level_test.
drop policy if exists level_tests_select_own_or_admin on public.level_tests;
create policy level_tests_select_own_or_admin on public.level_tests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- badges: read own (admins all). Writes only via grant_badge.
drop policy if exists badges_select_own_or_admin on public.badges;
create policy badges_select_own_or_admin on public.badges
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- weekly_winners: readable by every signed-in user.
drop policy if exists weekly_winners_select_authenticated on public.weekly_winners;
create policy weekly_winners_select_authenticated on public.weekly_winners
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 9. Privileges
-- -----------------------------------------------------------------------------
-- Supabase grants anon/authenticated broad default privileges on new objects in
-- public; tighten them explicitly.

revoke all on table public.profiles, public.user_state, public.activity_log,
              public.level_tests, public.badges, public.weekly_winners
  from anon, authenticated;

grant select, insert, update on public.profiles   to authenticated;
grant select, insert, update on public.user_state to authenticated;
grant select on public.activity_log, public.level_tests, public.badges, public.weekly_winners
  to authenticated;
grant select on public.user_stats to authenticated;

-- Pure helpers (used by the view and harmless).
grant execute on function
  public.tz_day(timestamptz), public.tz_week_start(timestamptz), public.tz_month_start(timestamptz),
  public.tz_ts(date), public.cefr_index(text), public.xp_for(text, int), public.skill_for(text),
  public.platform_level(int), public.league_for(int, int), public.effective_streak(int, date),
  public.is_admin()
  to anon, authenticated;

-- Client RPCs.
grant execute on function public.login_id_available(text) to anon, authenticated;
grant execute on function
  public.save_state(jsonb, timestamptz),
  public.load_state(),
  public.award_xp(text, int, jsonb),
  public.record_level_test(text, text, text, int, jsonb),
  public.get_my_stats(),
  public.get_leaderboard(text, text, text, text, int),
  public.get_weekly_winners(int),
  public.update_my_profile(jsonb),
  public.admin_summary(),
  public.admin_users(text, text, text, text, text, text, int, int),
  public.admin_user_detail(uuid),
  public.admin_update_user(uuid, jsonb)
  to authenticated;

-- Internal helpers: not callable from the client.
revoke execute on function
  public.assert_admin(),
  public.grant_badge(uuid, text),
  public.period_ranking(timestamptz, timestamptz, text, text, text),
  public.ensure_weekly_history(),
  public.stats_for(uuid)
  from public, anon, authenticated;

-- Anon must not call anything but login_id_available.
revoke execute on function
  public.save_state(jsonb, timestamptz),
  public.load_state(),
  public.award_xp(text, int, jsonb),
  public.record_level_test(text, text, text, int, jsonb),
  public.get_my_stats(),
  public.get_leaderboard(text, text, text, text, int),
  public.get_weekly_winners(int),
  public.update_my_profile(jsonb),
  public.admin_summary(),
  public.admin_users(text, text, text, text, text, text, int, int),
  public.admin_user_detail(uuid),
  public.admin_update_user(uuid, jsonb)
  from anon;

-- -----------------------------------------------------------------------------
-- 10. Promote the first admin (run manually after that user has signed up)
-- -----------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where login_id = 'your_login_id';
-- -----------------------------------------------------------------------------
