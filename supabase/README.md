# Supabase backend

Everything server-side for English for Future lives here. The frontend is a
static GitHub Pages app talking to Supabase with `supabase-js` v2 from a CDN;
there is no custom server. The exact client contract is in
[`docs/CONTRACTS.md`](../docs/CONTRACTS.md) (section "Supabase — client-facing API").

## Files

| Path | What it is |
|------|------------|
| `schema.sql` | Tables, view, triggers, RPCs, RLS, grants. Run in the SQL editor in one go. Re-runnable. |
| `functions/admin-actions/index.ts` | Deno Edge Function for password reset / block / unblock (needs the service-role key). |

## Setup

1. Create a project. In **Authentication → Providers → Email** turn **Confirm email off**
   (users sign up with synthetic `<login_id>@users.efuture.local` addresses).
2. Paste `schema.sql` into the SQL editor and run it.
3. Sign up the first user from the app, then promote them (snippet at the end of
   `schema.sql`): `update public.profiles set role = 'admin' where login_id = '...';`
4. Deploy the edge function: `supabase functions deploy admin-actions`.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
   automatically; nothing else to configure.
5. Put the project URL and anon key in the app's `config.js`.

## Time zone rules

Days, weeks and months are **Asia/Tashkent**. A week starts Monday 00:00
Tashkent (`date_trunc('week', created_at at time zone 'Asia/Tashkent')`). The
daily XP cap (300) and streaks use the Tashkent calendar day.

## Tables

- `profiles` — one row per auth user, created by the `on_auth_user_created`
  trigger from `raw_user_meta_data` (`login_id` lower-cased and validated
  against `^[a-z0-9_]{3,20}$`, `display_name`, `organisation`, `position`,
  `recovery_email`). Holds `role`, `cefr_level`, `placement_taken_at`,
  `blocked`, `show_on_leaderboard`, streak counters, `last_active_at`.
- `user_state` — the whole app state blob per learner (`state jsonb`, `updated_at`).
- `activity_log` — append-only XP ledger (`type`, `skill`, `xp`, `score`, `meta`).
  Written only by `award_xp`; clients have no insert privilege.
- `level_tests` — placement and level-up attempts.
- `badges` — `(user_id, code)`; codes are check-constrained.
- `weekly_winners` — top 3 of every completed week, filled lazily (see below).
- View `user_stats` — per-user totals: `total_xp`, `weekly_xp`, `monthly_xp`,
  `vocab_xp … assessment_xp`, `platform_level`, `cefr_level`, `streak`,
  `last_active_at`. `security_invoker`, so RLS applies (learners see their row,
  admins see all).

## Pure helpers (SQL mirrors of the JS constants)

- `xp_for(p_type, p_score)` — the XP table. `assessment` = `round(score / 2)`.
  Returns null for unknown types.
- `skill_for(p_type)` — type → skill bucket.
- `platform_level(total_xp)` — `min(30, floor(sqrt(total_xp / 50)) + 1)`.
- `league_for(rank, n)` — Gold top 10 %, Silver next 20 %, Bronze next 30 %,
  Rising the rest / unranked.
- `effective_streak(count, last)` — the stored streak, or 0 if the last active
  day is before yesterday (so stale streaks display as 0 until reset by the next
  activity).
- `tz_day`, `tz_week_start`, `tz_month_start`, `tz_ts`, `cefr_index`.

## Client RPCs (all `security definer`, caller = `auth.uid()`)

| Function | Notes |
|----------|-------|
| `login_id_available(p_login_id)` | Callable by `anon`. False for malformed / taken ids. |
| `save_state(p_state, p_base_updated_at)` | Last-write-wins with conflict detection. `conflict=true` (and the server `state`) when the server copy is newer than `p_base_updated_at`, **or when the base is null but a server row exists** (protects cloud progress from a fresh client). `updated_at` is stored at millisecond precision so JS dates round-trip. On success `state` is `null`. Updates `last_active_at`. |
| `load_state()` | `{ state, updated_at }` or SQL null. |
| `award_xp(p_type, p_score, p_meta)` | XP computed server-side; rejects blocked users and `streak_bonus`. Daily cap 300 (partial award, `capped=true`). Updates streak and `last_active_at`; writes the `streak_bonus` row once on the first activity of a new day (`5 * min(streak, 10)`, also under the cap). Evaluates badges. Returns the contract keys plus an extra `streak_bonus` (bonus XP granted in this call, 0 otherwise); `awarded` is the XP for the action only. |
| `record_level_test(p_kind, p_from, p_result, p_score, p_details)` | `placement`: `too_soon` if the last placement is < 30 days old. `level_up`: only to the next level, passes at ≥ 75; failed attempts are recorded with the level unchanged (`ok:true`). Other `error` values: `invalid_kind`, `invalid_level`, `no_placement`, `max_level`. Grants `b1/b2/c1_reached` for every level at or below the one reached. The server's current level is authoritative; `p_from` is informational. `details` is stored with `passed` (and `target` for level-up) merged in. |
| `get_my_stats()` | Exactly the contract keys. `xp_history` = last 90 Tashkent days, days without activity omitted. `rank_history` = weeks the user finished top 3 (from `weekly_winners`, league recomputed for that week) plus the current week. `xp_to_gold` = XP needed to match the lowest Gold user this week + 1 (0 if already Gold, 1 if nobody is ranked). |
| `get_leaderboard(p_period, p_skill, p_cefr, p_org, p_limit)` | Calls `ensure_weekly_history()` first. Ranks visible, non-blocked users with xp > 0 in the period (optional skill / cefr / org-ilike filters); xp desc, then display name. `prev_rank`/`trend` from the previous week/month (`new` when absent; `same` for `all`). The caller's row is always present with `is_me=true` (rank null when hidden / 0 XP / filtered out). `p_limit` is clamped to 1–200. |
| `get_weekly_winners(p_limit)` | `p_limit` = number of most recent completed **weeks** (default 12), up to 3 rows each. |
| `update_my_profile(p_patch)` | Only `display_name`, `organisation`, `position`, `show_on_leaderboard`, `recovery_email`. Returns the profile row as JSON. |

Blocked users get `blocked` raised from `award_xp`, `save_state` and
`record_level_test`. Unauthenticated calls raise `not_authenticated`.

### Weekly history without pg_cron

`ensure_weekly_history()` runs at the start of `get_leaderboard` and
`get_weekly_winners`. For every completed Tashkent week since the first activity
that has no `weekly_winners` rows, it inserts the top 3 and grants `weekly_1` to
rank 1. It is idempotent and safe under concurrent callers.

## Admin RPCs (caller must have `role = 'admin'`, otherwise `forbidden`)

| Function | Notes |
|----------|-------|
| `admin_summary()` | `total_users`, `active_today` (Tashkent day), `active_week` and `inactive_7d` (rolling 7 days), `avg_xp`, `by_cefr` (`A2…C1` + `none`). |
| `admin_users(p_search, p_org, p_cefr, p_league, p_sort, p_dir, p_limit, p_offset)` | Search on login_id / display_name / organisation (ilike). Sort whitelist: last_active_at, created_at, total_xp, weekly_xp, streak, display_name, login_id, organisation, position, role, cefr_level, platform_level, league, blocked (default `last_active_at desc`). `total` = count of all matching rows, repeated on every row. `league` is the current-week league. |
| `admin_user_detail(p_user_id)` | `{ profile, stats, activity (last 200), tests, badges }`; `stats` has the `get_my_stats` shape. |
| `admin_update_user(p_user_id, p_patch)` | Only `role`, `cefr_level` (null allowed), `show_on_leaderboard`, `blocked`. An admin cannot demote or block themselves. `blocked` here only sets the profile flag — use the edge function to also ban the auth user. |

## Security model

- RLS on every table. Learners: own rows in `profiles` (select/insert/update),
  `user_state` (select/insert/update); select-only on own `activity_log`,
  `level_tests`, `badges`; `weekly_winners` readable by all signed-in users.
  Admins can select everything. No client insert/update/delete on
  `activity_log`, `level_tests`, `badges`, `weekly_winners`.
- The `profiles_protect` trigger reverts changes to `id`, `login_id`, `role`,
  `blocked`, `cefr_level`, `placement_taken_at`, `streak_count`, `streak_last`,
  `created_at` when the update comes directly from a non-admin client
  (`current_user` = `authenticated`). Writes from `security definer` RPCs run as
  the function owner and are not affected.
- Internal helpers (`period_ranking`, `stats_for`, `grant_badge`,
  `ensure_weekly_history`, `assert_admin`) have EXECUTE revoked from clients.

## Edge function `admin-actions`

`POST` with the admin's access token as `Authorization: Bearer …` (supabase-js
`functions.invoke('admin-actions', { body })` does this automatically).

| Body | Effect |
|------|--------|
| `{ action: "reset_password", user_id, new_password }` | `auth.admin.updateUserById(user_id, { password })`; password must be ≥ 8 chars. |
| `{ action: "block", user_id }` | Bans the auth user (`ban_duration: '876000h'`) and sets `profiles.blocked = true`. Cannot block yourself. |
| `{ action: "unblock", user_id }` | `ban_duration: 'none'` and `profiles.blocked = false`. |

Flow: verify the JWT with an anon client (`auth.getUser`) → check
`profiles.role = 'admin'` with the service client → check the target exists →
act. Responses are `{ ok: true }` or `{ ok: false, error }` with 400/401/403/
404/405/500. `GET` returns a health JSON; `OPTIONS` answers the CORS preflight
(any origin). A banned user's existing access token stays valid until it
expires (≤ 1 h), but every RPC already rejects `blocked` profiles.
