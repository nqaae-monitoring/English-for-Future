/* =========================================================================
   English for Future — leaderboard.js
   Shared leaderboard: This week / This month / All time; filters by skill,
   CEFR level and organisation; podium for the top 3; Gold/Silver/Bronze/
   Rising leagues by percentile; the current user's row is always pinned.
   Data comes only from the SECURITY DEFINER function get_leaderboard().
   ========================================================================= */
(function () {
  "use strict";
  if (!window.ELH) return;
  var E = window.ELH, U = E.ui, el = U.el, esc = U.esc, toast = U.toast, t = E.t;

  var period = "week", skill = "", cefrOnly = false, org = "";
  var SKILLS = [["", "Overall", "Umumiy"], ["vocab", "Vocabulary", "Lug‘at"], ["grammar", "Grammar", "Grammatika"], ["listening", "Listening", "Tinglash"], ["speaking", "Speaking", "Nutq"], ["writing", "Writing", "Yozuv"], ["negotiation", "Negotiation", "Muzokara"], ["assessment", "Assessments", "Baholash"]];
  var MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

  function initials(name) { return String(name || "?").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase(); }
  function trendHtml(tr) { return { up: '<span class="trend-up">▲</span>', down: '<span class="trend-down">▼</span>', same: '<span class="trend-same">—</span>', new: '<span class="trend-new">new</span>' }[tr] || ""; }
  function periodLabel() { return { week: t("This week", "Bu hafta"), month: t("This month", "Bu oy"), all: t("All time", "Umumiy") }[period]; }

  function render(host) {
    var me = E.user();
    host.innerHTML = '<div class="section-head"><div><h1>🏆 ' + t("Leaderboard", "Reyting jadvali") + '</h1><p>' +
      t("Compete with peers at your level. Leagues reset every Monday 00:00 (Tashkent): Gold = top 10 %, Silver = next 20 %, Bronze = next 30 %, Rising = everyone else.",
        "O‘z darajangizdagi tengdoshlar bilan bellashing. Ligalar har dushanba 00:00 (Toshkent) yangilanadi: Oltin = eng yaxshi 10 %, Kumush = keyingi 20 %, Bronza = keyingi 30 %, Rising = qolganlar.") + '</p></div>' +
      '<div class="btn-row"><button class="btn" id="lb-history">📜 ' + t("Past winners", "Avvalgi g‘oliblar") + '</button></div></div>' +
      '<div class="card mb"><div class="flex between wrap" style="gap:10px"><div class="chip-row" id="lb-period">' +
      [["week", "This week", "Bu hafta"], ["month", "This month", "Bu oy"], ["all", "All time", "Umumiy"]].map(function (p) { return '<button class="chip ' + (period === p[0] ? "on" : "") + '" data-p="' + p[0] + '">' + t(p[1], p[2]) + '</button>'; }).join("") + '</div>' +
      '<div class="chip-row"><button class="chip ' + (cefrOnly ? "on" : "") + '" id="lb-cefr" ' + (E.cefr() ? "" : "disabled") + '>🎓 ' + t("My level", "Mening darajam") + (E.cefr() ? " (" + E.cefr() + ")" : "") + '</button>' +
      '<select class="chip" id="lb-skill" aria-label="Skill filter">' + SKILLS.map(function (s) { return '<option value="' + s[0] + '"' + (skill === s[0] ? " selected" : "") + '>' + t(s[1], s[2]) + '</option>'; }).join("") + '</select>' +
      '<input class="chip" id="lb-org" type="text" placeholder="' + t("Organisation…", "Tashkilot…") + '" value="' + esc(org) + '" style="min-width:150px" aria-label="Organisation filter"></div></div></div>' +
      '<div id="lb-body"><div class="podium">' + [2, 1, 3].map(function (n) { return '<div class="podium-card p' + n + ' empty"><div class="medal">' + MEDAL[n] + '</div><div class="skeleton" style="width:60%;margin:8px auto"></div><div class="skeleton" style="width:40%;margin:6px auto"></div></div>'; }).join("") + '</div>' +
      '<div class="card">' + [1, 2, 3, 4, 5, 6].map(function () { return '<div class="skeleton mb" style="height:18px"></div>'; }).join("") + '</div></div>';

    host.querySelectorAll("#lb-period .chip").forEach(function (b) { b.onclick = function () { period = b.dataset.p; E.nav("leaderboard"); }; });
    host.querySelector("#lb-cefr").onclick = function () { cefrOnly = !cefrOnly; E.nav("leaderboard"); };
    host.querySelector("#lb-skill").onchange = function () { skill = this.value; E.nav("leaderboard"); };
    var orgIn = host.querySelector("#lb-org"), orgT;
    orgIn.oninput = function () { clearTimeout(orgT); var v = this.value; orgT = setTimeout(function () { org = v.trim(); load(host); }, 400); };
    host.querySelector("#lb-history").onclick = showHistory;

    if (!E.online()) {
      host.querySelector("#lb-body").innerHTML = '<div class="card">' + U.emptyState(t("The leaderboard needs an account. Sign in (and configure Supabase — see SETUP.md) to compete with other learners.", "Reyting uchun hisob kerak. Boshqa o‘quvchilar bilan bellashish uchun tizimga kiring (Supabase sozlangan bo‘lishi kerak — SETUP.md).")) +
        '<div class="small muted mt">' + t("Your local XP", "Mahalliy XP") + ': <b>' + E.xp.total() + '</b></div></div>';
      return;
    }
    load(host);
  }

  function load(host) {
    var args = { p_period: period, p_skill: skill || null, p_cefr: cefrOnly ? E.cefr() : null, p_org: org || null, p_limit: 100 };
    E.sb.rpc("get_leaderboard", args).then(function (r) {
      if (r.error) throw r.error;
      draw(host, r.data || []);
    }).catch(function (e) {
      var b = host.querySelector("#lb-body"); if (b) b.innerHTML = '<div class="card">' + U.emptyState(t("Could not load the leaderboard: ", "Reytingni yuklab bo‘lmadi: ") + (e.message || e)) + '</div>';
    });
  }

  function draw(host, rows) {
    var body = host.querySelector("#lb-body"); if (!body) return;
    var ranked = rows.filter(function (r) { return r.rank != null; }).sort(function (a, b) { return a.rank - b.rank; });
    var meRow = rows.filter(function (r) { return r.is_me; })[0];
    var top = [ranked[1], ranked[0], ranked[2]], pos = [2, 1, 3];
    var podium = '<div class="podium">' + top.map(function (r, i) {
      var n = pos[i];
      if (!r) return '<div class="podium-card p' + n + ' empty"><div class="medal">' + MEDAL[n] + '</div><div class="name muted small">' + t("Open spot", "Bo‘sh o‘rin") + '</div></div>';
      return '<div class="podium-card p' + n + (r.is_me ? ' me' : '') + '"><div class="medal">' + MEDAL[n] + '</div><div class="avatar">' + esc(initials(r.display_name)) + '</div><div class="name" title="' + esc(r.display_name) + '">' + esc(r.display_name) + (r.is_me ? ' <span class="small muted">(' + t("you", "siz") + ')</span>' : '') + '</div>' +
        '<div class="small muted">' + esc(r.cefr_level || "—") + ' · Lv ' + esc(r.platform_level) + '</div><div class="xp">' + esc(r.xp) + ' XP</div>' + E.leagueBadge(r.league) + '</div>';
    }).join("") + '</div>';

    var table = '<div class="card"><div class="flex between wrap mb"><h3>' + periodLabel() + (skill ? ' · ' + esc(SKILLS.filter(function (s) { return s[0] === skill; })[0][1]) : '') + (cefrOnly ? ' · ' + E.cefr() : '') + '</h3><span class="small muted">' + ranked.length + ' ' + t("learners ranked", "ta o‘quvchi") + '</span></div>' +
      (ranked.length ? '<div class="lb-wrap"><table class="lb-table"><thead><tr><th>#</th><th>' + t("Learner", "O‘quvchi") + '</th><th>CEFR</th><th>Lv</th><th>' + t("League", "Liga") + '</th><th>XP</th><th>🔥</th><th>' + t("Trend", "Trend") + '</th></tr></thead><tbody>' +
        ranked.map(function (r) {
          return '<tr class="' + (r.is_me ? "me" : "") + '"><td>' + (MEDAL[r.rank] || r.rank) + '</td><td><span class="avatar">' + esc(initials(r.display_name)) + '</span>' + esc(r.display_name) + (r.organisation ? ' <span class="small faint">· ' + esc(r.organisation) + '</span>' : '') + '</td>' +
            '<td>' + esc(r.cefr_level || "—") + '</td><td>' + esc(r.platform_level) + '</td><td>' + E.leagueBadge(r.league) + '</td><td><b>' + esc(r.xp) + '</b></td><td>' + esc(r.streak) + '</td><td>' + trendHtml(r.trend) + (r.prev_rank ? ' <span class="small faint">#' + esc(r.prev_rank) + '</span>' : '') + '</td></tr>';
        }).join("") + '</tbody></table></div>' : U.emptyState(t("Nobody has earned XP in this period yet — be the first!", "Bu davrda hali hech kim XP olmagan — birinchi bo‘ling!"))) + '</div>';

    var meBar = "";
    if (meRow) {
      var hidden = E.state().settings.showOnLeaderboard === false;
      var gold = ranked.filter(function (r) { return r.league === "Gold"; });
      var toGold = gold.length ? Math.max(0, gold[gold.length - 1].xp - meRow.xp + 1) : Math.max(0, 1 - meRow.xp);
      meBar = '<div class="me-row"><div><b>' + (hidden ? '🙈 ' + t("You are hidden from the leaderboard", "Siz reytingda yashirinsiz") : (meRow.rank ? t("You are #", "Siz #") + meRow.rank : t("You are not ranked yet", "Siz hali reytingda emassiz"))) + '</b>' +
        ' · ' + E.leagueBadge(meRow.league) + ' · ' + esc(meRow.xp) + ' XP' + (meRow.league !== "Gold" && toGold > 0 ? ' · ' + toGold + ' XP ' + t("to Gold", "Oltingacha") : '') + '</div>' +
        '<div class="btn-row">' + (hidden ? '<button class="btn sm" data-go="settings">' + t("Show me", "Meni ko‘rsatish") + '</button>' : '') + '<button class="btn sm" data-go="today">' + t("Earn XP →", "XP yig‘ish →") + '</button></div></div>';
    }
    body.innerHTML = podium + table + meBar;
    U.wireGo(body);
  }

  function showHistory() {
    if (!E.online()) { toast(t("Sign in to see past winners.", "Avvalgi g‘oliblarni ko‘rish uchun tizimga kiring."), "warn"); return; }
    U.modal('<h2>📜 ' + t("Weekly winners", "Haftalik g‘oliblar") + '</h2><div id="wh"><span class="loader"></span></div><div class="btn-row mt2"><button class="btn" id="wh-c">' + t("Close", "Yopish") + '</button></div>');
    document.getElementById("wh-c").onclick = U.closeModal;
    E.sb.rpc("get_weekly_winners", { p_limit: 12 }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [], byWeek = {};
      rows.forEach(function (w) { (byWeek[w.week_start] = byWeek[w.week_start] || []).push(w); });
      var weeks = Object.keys(byWeek).sort().reverse();
      document.getElementById("wh").innerHTML = weeks.length ? weeks.map(function (wk) {
        return '<div class="mb"><div class="small muted">' + t("Week of", "Hafta") + ' ' + esc(wk) + '</div>' + byWeek[wk].sort(function (a, b) { return a.rank - b.rank; }).map(function (w) { return '<div class="flex between" style="padding:4px 0"><span>' + MEDAL[w.rank] + ' ' + esc(w.display_name) + '</span><b>' + esc(w.xp) + ' XP</b></div>'; }).join("") + '</div>';
      }).join("") : U.emptyState(t("No completed weeks yet.", "Hali tugallangan hafta yo‘q."));
    }).catch(function (e) { document.getElementById("wh").innerHTML = U.emptyState(String(e.message || e)); });
  }

  E.registerView("leaderboard", render);
})();
