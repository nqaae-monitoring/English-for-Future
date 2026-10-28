# English for Future — module contracts

Shared reference for the modules of the multi-user platform. All files are plain
browser scripts (no build step, no ES modules). Load order in `index.html`:

```
config.js → supabase-js (CDN, UMD; window.supabase) → js/data.js → js/content.js
→ js/app.js → js/qualdata.js → js/qual.js → js/placement.js → js/leaderboard.js
→ js/admin.js → js/sync.js → js/auth.js
```

`js/app.js` no longer boots itself. It defines `window.ELH` and `ELH.boot()`;
`js/auth.js` calls `ELH.boot()` after sign-in (or in offline/demo mode).

## CEFR levels

`["A2","B1","B2","C1"]`, in that order. `ELH.cefr()` returns the learner's current
level, `ELH.LEVELS` the array, `ELH.levelIndex(l)` the index.

## window.ELH (defined in js/app.js)

Existing (unchanged):
```
ELH.state()            -> S (whole app state object)
ELH.save()             -> debounced save (localStorage + cloud via sync)
ELH.nav(viewName)      -> navigate
ELH.registerView(name, fn(host))     fn renders into host element
ELH.registerNav(title, [[name,label,icon,fn], ...])   adds a sidebar section
ELH.data               -> window.HUB_DATA
ELH.todayStr()         -> "YYYY-MM-DD"
ELH.makeRecognizer(onResult, onEnd)   -> SpeechRecognition wrapper or null
ELH.hasSR              -> bool
ELH.exportPrint(title, text)
ELH.ui = { el(tag, attrs, html), esc(s), toast(msg, kind "good"|"warn"|""), modal(html),
           closeModal(), speak(text, rate), bar(pct, color), ring(pct, label, val),
           scoreLine(label, val), field(label, innerHtml), emptyState(msg),
           trendArrow(cur, prev), wireGo(host) /* wires [data-go] buttons */,
           shuffle(arr), clamp(n,a,b), hash(str), uz(text) /* uzbek hint span if enabled */ }
ELH.scoring = { scoreResponse(text, opts), recordActivity(type, score, indicatorKeys, note),
                analyseWriting(text), nextStepAdvice(score) }
```

New (phase 1–4):
```
ELH.boot()                       -> builds shell, routes; called once by auth.js
ELH.LEVELS, ELH.cefr(), ELH.levelIndex(l)
ELH.setCefr(level, source)       -> updates profile, chrome, saves, pushes to profiles table
ELH.t(en, uz)                    -> uz when Uzbek UI is on and uz given, else en
ELH.uzHints()                    -> bool: Uzbek hints on (default true at A2)
ELH.user()                       -> { id, loginId, displayName, role, organisation } | null (null in offline mode)
ELH.isAdmin()                    -> bool
ELH.online()                     -> bool: signed in with a live Supabase client
ELH.sb                           -> supabase client or null
ELH.content                      -> window.HUB_CONTENT
ELH.levelOf(kind, item)          -> CEFR level string for a content item
ELH.forLevel(kind, items, opts)  -> items at learner's level (+ i+1 sample)
ELH.xp.award(type, opts)         -> awards XP (see XP types); returns Promise<{awarded,total}>
ELH.xp.level(totalXp)            -> { level, pct, nextAt, current }
ELH.xp.total()                   -> cached total XP
ELH.levels.recordTest(kind, fromLevel, resultLevel, score, details) -> Promise<profile>
ELH.levels.canRetakePlacement()  -> bool (30 days)
ELH.badges()                     -> [{code, earned_at}]
ELH.refreshChrome()
```

### XP types (client constant `XP_TABLE` in app.js, mirrored in SQL `xp_for`)

| type              | xp                       |
|-------------------|--------------------------|
| plan_step         | 10                       |
| word_mastered     | 2                        |
| phrase_saved      | 1                        |
| grammar           | 5                        |
| listening         | 8                        |
| speaking          | 15                       |
| writing           | 20                       |
| negotiation       | 25                       |
| assessment        | round(score / 2)         |
| streak_bonus      | 5 × min(streak, 10) (server-side, once per day) |

Daily cap 300 XP (Asia/Tashkent day), enforced in Postgres `award_xp`.

Skill buckets (for per-skill XP and leaderboard filter): `vocab`, `grammar`,
`listening`, `speaking`, `writing`, `negotiation`, `assessment`.
Type → skill mapping used everywhere (JS and SQL):
`plan_step:assessment, word_mastered:vocab, phrase_saved:vocab, grammar:grammar,
listening:listening, speaking:speaking, writing:writing, negotiation:negotiation,
assessment:assessment, streak_bonus:assessment`.

Platform level curve (JS + SQL): `level = min(30, floor(sqrt(total_xp / 50)) + 1)`,
XP needed for level n: `50 * (n-1)^2`.

Badges codes: `first_lesson, streak_7, streak_30, words_100, words_500,
first_negotiation, first_speech, b1_reached, b2_reached, c1_reached, weekly_1`.

Leagues by percentile of period XP among users with xp > 0: Gold top 10 %,
Silver next 20 %, Bronze next 30 %, Rising the rest (and everyone with 0 XP).

## window.HUB_CONTENT (js/content.js)

```
HUB_CONTENT = {
  LEVELS: ["A2","B1","B2","C1"],
  // CEFR tags for EXISTING items in js/data.js (default when absent: "B2")
  tags: {
    vocabulary: { "<term>": "C1", ... },        // only list non-B2 terms
    phrases:    { "<phrase text>": "C1", ... },  // only list non-B2 phrases
    grammar:    { "G1": "B2", ... },             // by id, list all
    listening:  { "L1": "B2", ... },             // by id (data items also have .level)
    writing:    { "W1": "B2", ... },
    negotiations: { "<id>": "B2"|"C1" },
    difficult:  { "<index>": "B2"|"C1" },        // index in HUB_DATA.DIFFICULT
    speeches:   { "<speech type>": "B2"|"C1" }
  },
  A2: { vocabulary: [...], phrases: [...], grammar: [...], listening: [...],
        writing: [...], speaking: [...], negotiations: [...], difficult: [...] },
  B1: { same keys }
}
```
Item shapes MUST match `js/data.js` (V() for vocabulary, P() for phrases, GRAMMAR,
LISTENING, WRITING, NEGOTIATIONS, DIFFICULT objects) plus `level: "A2"|"B1"`.
Speaking tasks match `SPEAK_TASKS` in js/app.js:
`{ title, prompt, seconds, expected: [keywords], keys: [indicator keys], level, uz }`.
Every A2/B1 item has a non-empty `uz` field (Uzbek Latin hint/translation).
Vocabulary ids: `term` is the key (unique across levels). Grammar ids `A2G1..`,
`B1G1..`; listening `A2L1..`; writing `A2W1..`; negotiations id slug `a2-...`/`b1-...`.

## window.ELH_PLACEMENT (js/placement.js)

```
ELH_PLACEMENT.start({ kind: "placement"|"level_up", fromLevel: "A2"|..., targetLevel })
  -> registers/navigates to view "placement" and runs the test UI;
     on completion calls ELH.levels.recordTest(kind, fromLevel, resultLevel, score, details)
     then navigates to "dashboard" with a toast.
ELH_PLACEMENT.ready -> true
```
Details object: `{ sections: { vocabulary:{correct,total,level}, grammar:{...},
reading:{...}, listening:{...} }, path: ["B1","B2",...], durationSec }`.
Placement is adaptive across A2–C1; level_up tests only the target level and
passes at ≥ 75 %.

## Supabase (supabase/schema.sql) — client-facing API

Auth: email = `<login_id lowercase>@users.efuture.local`, `signUp` with
`options.data = { login_id, display_name, organisation, position, recovery_email }`;
trigger creates `profiles` row. Email confirmation disabled in dashboard.

Tables: `profiles, user_state, activity_log, level_tests, badges, weekly_winners`;
view `user_stats`.

RPC (all `security definer`, `auth.uid()` based):
```
login_id_available(p_login_id text) -> bool                  (anon + authed)
save_state(p_state jsonb, p_base_updated_at timestamptz)
   -> { ok bool, updated_at timestamptz, conflict bool, state jsonb }
   conflict=true when server updated_at > p_base_updated_at (returns server state, does not overwrite)
load_state() -> { state jsonb, updated_at timestamptz } | null
award_xp(p_type text, p_score int, p_meta jsonb)
   -> { awarded int, total_xp int, today_xp int, capped bool, streak int, new_badges text[], platform_level int }
record_level_test(p_kind text, p_from text, p_result text, p_score int, p_details jsonb)
   -> { ok bool, cefr_level text, placement_taken_at timestamptz, new_badges text[], error text }
get_my_stats() -> { total_xp, weekly_xp, monthly_xp, by_skill jsonb, streak, platform_level,
                    cefr_level, badges jsonb, rank_week int, league_week text, xp_to_gold int,
                    xp_history jsonb [{day, xp}] (last 90 days), rank_history jsonb [{week_start, rank, league}],
                    tests jsonb [...level_tests] }
get_leaderboard(p_period 'week'|'month'|'all', p_skill text, p_cefr text, p_org text, p_limit int)
   -> rows: rank, user_id, display_name, organisation, cefr_level, platform_level, league,
            xp, streak, prev_rank, trend ('up'|'down'|'same'|'new'), is_me
   (always includes caller's row with is_me=true even when beyond limit or hidden; hidden → rank null)
get_weekly_winners(p_limit int) -> rows: week_start, rank, display_name, xp
update_my_profile(p_patch jsonb) -> profile   (display_name, organisation, position, show_on_leaderboard, recovery_email)
admin_summary() -> { total_users, active_today, active_week, avg_xp, by_cefr jsonb, inactive_7d }
admin_users(p_search, p_org, p_cefr, p_league, p_sort, p_dir, p_limit, p_offset)
   -> rows: id, login_id, display_name, organisation, position, role, cefr_level, platform_level,
            total_xp, weekly_xp, streak, league, last_active_at, created_at, blocked, show_on_leaderboard, total int
admin_user_detail(p_user_id) -> { profile, stats (same as get_my_stats), activity jsonb (last 200), tests, badges }
admin_update_user(p_user_id, p_patch jsonb) -> profile   (role, cefr_level, show_on_leaderboard, blocked)
```
Edge function `admin-actions` (POST, bearer = admin's JWT):
`{ action: "reset_password", user_id, new_password } | { action: "block"|"unblock", user_id }`.
