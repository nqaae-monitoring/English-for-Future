/* =========================================================================
   English for Future — admin.js
   Admin panel (role = 'admin' only): summary cards, searchable/sortable user
   table, user detail, actions (reset password / block / unblock via the
   admin-actions Edge Function; role, CEFR level, visibility via RPC), CSV export.
   ========================================================================= */
(function () {
  "use strict";
  if (!window.ELH) return;
  var E = window.ELH, U = E.ui, el = U.el, esc = U.esc, toast = U.toast, t = E.t, modal = U.modal, closeModal = U.closeModal;
  var CFG = window.EFUTURE_CONFIG || {};
  var q = { search: "", org: "", cefr: "", league: "", sort: "last_active_at", dir: "desc", limit: 25, offset: 0 };
  var detailUser = null;

  function forbidden(host) { host.innerHTML = '<div class="section-head"><div><h1>🛡 Admin</h1></div></div><div class="card">' + U.emptyState(t("Admin access only.", "Faqat administratorlar uchun.")) + '</div>'; }

  function render(host) {
    if (!E.online() || !E.isAdmin()) return forbidden(host);
    if (detailUser) return renderDetail(host, detailUser);
    host.innerHTML = '<div class="section-head"><div><h1>🛡 ' + t("Admin panel", "Admin paneli") + '</h1><p>' + t("Monitor all learners, manage accounts and export statistics.", "Barcha o‘quvchilarni kuzating, hisoblarni boshqaring va statistikani eksport qiling.") + '</p></div>' +
      '<div class="btn-row"><button class="btn" id="adm-export">⬇ ' + t("Export CSV", "CSV eksport") + '</button><button class="btn" id="adm-refresh">🔄</button></div></div>' +
      '<div class="kpi-band mb" id="adm-summary">' + [1, 2, 3, 4].map(function () { return '<div class="kpi"><div class="skeleton" style="width:60%"></div><div class="skeleton mt" style="width:40%;height:24px"></div></div>'; }).join("") + '</div>' +
      '<div class="grid cols-2 mb"><div class="card"><h3>' + t("Learners by CEFR level", "O‘quvchilar CEFR bo‘yicha") + '</h3><div id="adm-dist"><div class="skeleton"></div></div></div>' +
      '<div class="card"><h3>' + t("Attention", "E’tibor") + '</h3><div id="adm-attn"><div class="skeleton"></div></div></div></div>' +
      '<div class="card"><div class="adm-filters mb">' +
      U.field(t("Search (ID, name, organisation)", "Qidiruv (ID, ism, tashkilot)"), '<input id="f-search" type="search" value="' + esc(q.search) + '">') +
      U.field(t("Organisation", "Tashkilot"), '<input id="f-org" type="text" value="' + esc(q.org) + '">') +
      U.field("CEFR", '<select id="f-cefr"><option value="">' + t("All", "Barchasi") + '</option>' + ["A2", "B1", "B2", "C1"].map(function (l) { return '<option' + (q.cefr === l ? " selected" : "") + '>' + l + '</option>'; }).join("") + '<option value="none"' + (q.cefr === "none" ? " selected" : "") + '>' + t("No placement", "Testsiz") + '</option></select>') +
      U.field(t("League", "Liga"), '<select id="f-league"><option value="">' + t("All", "Barchasi") + '</option>' + ["Gold", "Silver", "Bronze", "Rising"].map(function (l) { return '<option' + (q.league === l ? " selected" : "") + '>' + l + '</option>'; }).join("") + '</select>') +
      '<button class="btn primary" id="f-apply">' + t("Apply", "Qo‘llash") + '</button></div>' +
      '<div class="lb-wrap" id="adm-users">' + [1, 2, 3, 4, 5].map(function () { return '<div class="skeleton mb" style="height:18px"></div>'; }).join("") + '</div><div class="pager" id="adm-pager"></div></div>';

    host.querySelector("#f-apply").onclick = function () { q.search = host.querySelector("#f-search").value.trim(); q.org = host.querySelector("#f-org").value.trim(); q.cefr = host.querySelector("#f-cefr").value; q.league = host.querySelector("#f-league").value; q.offset = 0; loadUsers(host); };
    host.querySelector("#f-search").onkeydown = function (e) { if (e.key === "Enter") host.querySelector("#f-apply").click(); };
    host.querySelector("#adm-refresh").onclick = function () { E.nav("admin"); };
    host.querySelector("#adm-export").onclick = exportCsv;
    loadSummary(host); loadUsers(host);
  }

  function loadSummary(host) {
    E.sb.rpc("admin_summary").then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      var kpi = function (l, v) { return '<div class="kpi"><div class="lbl">' + esc(l) + '</div><div class="num">' + esc(v) + '</div></div>'; };
      host.querySelector("#adm-summary").innerHTML = kpi(t("Total learners", "Jami o‘quvchilar"), d.total_users || 0) + kpi(t("Active today / week", "Faol bugun / hafta"), (d.active_today || 0) + " / " + (d.active_week || 0)) + kpi(t("Average XP", "O‘rtacha XP"), Math.round(d.avg_xp || 0)) + kpi(t("Inactive 7+ days", "7+ kun nofaol"), d.inactive_7d || 0);
      var by = d.by_cefr || {}, total = 0; Object.keys(by).forEach(function (k) { total += by[k]; });
      var colors = { A2: "var(--green)", B1: "var(--teal)", B2: "var(--navy-500)", C1: "var(--accent)", none: "var(--border)" };
      host.querySelector("#adm-dist").innerHTML = '<div class="dist-bar">' + ["A2", "B1", "B2", "C1", "none"].map(function (k) { return '<span style="width:' + (total ? (by[k] || 0) / total * 100 : 0) + '%;background:' + colors[k] + '" title="' + k + ': ' + (by[k] || 0) + '"></span>'; }).join("") + '</div>' +
        '<div class="flex wrap mt" style="gap:12px">' + ["A2", "B1", "B2", "C1", "none"].map(function (k) { return '<span class="small"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + colors[k] + ';margin-right:4px"></span>' + (k === "none" ? t("No placement", "Testsiz") : k) + ' <b>' + (by[k] || 0) + '</b></span>'; }).join("") + '</div>';
      host.querySelector("#adm-attn").innerHTML = '<div class="small">⚠ <b>' + (d.inactive_7d || 0) + '</b> ' + t("learners inactive for 7+ days", "o‘quvchi 7+ kundan beri nofaol") + '</div><div class="small mt">🧪 <b>' + (by.none || 0) + '</b> ' + t("have not taken the placement test", "darajani aniqlash testini topshirmagan") + '</div><div class="small mt">' + t("Tip: filter the table by “No placement” or sort by last active to follow up.", "Maslahat: jadvalni “Testsiz” bo‘yicha filtrlang yoki oxirgi faollik bo‘yicha saralang.") + '</div>';
    }).catch(function (e) { host.querySelector("#adm-summary").innerHTML = '<div class="card" style="grid-column:span 4">' + U.emptyState(String(e.message || e)) + '</div>'; });
  }

  var COLS = [["login_id", "ID"], ["display_name", "Name", "Ism"], ["organisation", "Organisation", "Tashkilot"], ["cefr_level", "CEFR"], ["platform_level", "Lv"], ["total_xp", "XP"], ["weekly_xp", "Week XP", "Hafta XP"], ["streak", "🔥"], ["league", "League", "Liga"], ["last_active_at", "Last active", "Oxirgi faollik"]];
  function loadUsers(host) {
    E.sb.rpc("admin_users", { p_search: q.search || null, p_org: q.org || null, p_cefr: q.cefr || null, p_league: q.league || null, p_sort: q.sort, p_dir: q.dir, p_limit: q.limit, p_offset: q.offset }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [], total = rows.length ? rows[0].total : 0;
      var box = host.querySelector("#adm-users");
      if (!rows.length) { box.innerHTML = U.emptyState(t("No learners match these filters.", "Filtrga mos o‘quvchi yo‘q.")); host.querySelector("#adm-pager").innerHTML = ""; return; }
      box.innerHTML = '<table class="adm-table"><thead><tr>' + COLS.map(function (c) { return '<th data-sort="' + c[0] + '" class="' + (q.sort === c[0] ? "sorted" : "") + '">' + esc(t(c[1], c[2] || c[1])) + (q.sort === c[0] ? (q.dir === "asc" ? " ▲" : " ▼") : "") + '</th>'; }).join("") + '<th></th></tr></thead><tbody>' +
        rows.map(function (u) {
          return '<tr class="' + (u.blocked ? "blocked" : "") + '"><td><b>' + esc(u.login_id) + '</b>' + (u.role === "admin" ? ' <span class="tag">admin</span>' : '') + '</td><td>' + esc(u.display_name) + '</td><td>' + esc(u.organisation || "") + '</td><td>' + esc(u.cefr_level || "—") + '</td><td>' + esc(u.platform_level) + '</td><td>' + esc(u.total_xp) + '</td><td>' + esc(u.weekly_xp) + '</td><td>' + esc(u.streak) + '</td><td>' + E.leagueBadge(u.league) + '</td><td>' + (u.last_active_at ? esc(new Date(u.last_active_at).toLocaleDateString()) : "—") + '</td><td><button class="btn sm" data-user="' + esc(u.id) + '">' + t("Open", "Ochish") + '</button></td></tr>';
        }).join("") + '</tbody></table>';
      box.querySelectorAll("th[data-sort]").forEach(function (th) { th.onclick = function () { var s = th.dataset.sort; if (q.sort === s) q.dir = q.dir === "asc" ? "desc" : "asc"; else { q.sort = s; q.dir = s === "display_name" || s === "login_id" ? "asc" : "desc"; } loadUsers(host); }; });
      box.querySelectorAll("[data-user]").forEach(function (b) { b.onclick = function () { detailUser = b.dataset.user; E.nav("admin"); }; });
      var pages = Math.ceil(total / q.limit), cur = Math.floor(q.offset / q.limit) + 1;
      host.querySelector("#adm-pager").innerHTML = '<span class="small muted">' + total + ' ' + t("learners", "o‘quvchi") + ' · ' + t("page", "sahifa") + ' ' + cur + '/' + Math.max(1, pages) + '</span><button class="btn sm" id="pg-prev"' + (cur <= 1 ? " disabled" : "") + '>←</button><button class="btn sm" id="pg-next"' + (cur >= pages ? " disabled" : "") + '>→</button>';
      host.querySelector("#pg-prev").onclick = function () { q.offset = Math.max(0, q.offset - q.limit); loadUsers(host); };
      host.querySelector("#pg-next").onclick = function () { q.offset += q.limit; loadUsers(host); };
    }).catch(function (e) { host.querySelector("#adm-users").innerHTML = U.emptyState(String(e.message || e)); });
  }

  /* ---------- user detail ---------- */
  function renderDetail(host, uid) {
    host.innerHTML = '<div class="section-head"><div><h1>🛡 ' + t("Learner", "O‘quvchi") + '</h1></div><div class="btn-row"><button class="btn" id="d-back">← ' + t("Back to list", "Ro‘yxatga qaytish") + '</button></div></div><div id="d-body"><div class="card"><div class="skeleton mb"></div><div class="skeleton mb"></div><div class="skeleton"></div></div></div>';
    host.querySelector("#d-back").onclick = function () { detailUser = null; E.nav("admin"); };
    E.sb.rpc("admin_user_detail", { p_user_id: uid }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {}, p = d.profile || {}, s = d.stats || {}, by = s.by_skill || {};
      var skills = ["vocab", "grammar", "listening", "speaking", "writing", "negotiation", "assessment"], maxS = 1; skills.forEach(function (k) { maxS = Math.max(maxS, by[k] || 0); });
      host.querySelector("#d-body").innerHTML =
        '<div class="grid cols-3 mb"><div class="card" style="grid-column:span 2"><div class="flex between wrap"><div><h2 style="margin:0">' + esc(p.display_name) + ' <span class="small muted">@' + esc(p.login_id) + '</span></h2><div class="small muted">' + esc(p.organisation || "—") + ' · ' + esc(p.position || "—") + (p.recovery_email ? ' · ' + esc(p.recovery_email) : '') + '</div></div>' +
        '<div>' + (p.blocked ? '<span class="tag" style="color:var(--rose)">BLOCKED</span> ' : '') + '<span class="tag">' + esc(p.role) + '</span> <span class="tag lvl lvl-' + esc(p.cefr_level || "B2") + '">' + esc(p.cefr_level || "—") + '</span> ' + E.leagueBadge(s.league_week) + '</div></div>' +
        '<div class="kpi-band mt" style="grid-template-columns:repeat(4,1fr)">' + [[t("Total XP", "Jami XP"), s.total_xp || 0], [t("This week", "Bu hafta"), s.weekly_xp || 0], ["Lv", s.platform_level || 1], ["🔥", s.streak || 0]].map(function (k) { return '<div class="kpi"><div class="lbl">' + esc(k[0]) + '</div><div class="num">' + esc(k[1]) + '</div></div>'; }).join("") + '</div>' +
        '<div class="small muted mt">' + t("Joined", "Qo‘shilgan") + ': ' + (p.created_at ? new Date(p.created_at).toLocaleDateString() : "—") + ' · ' + t("Last active", "Oxirgi faollik") + ': ' + (p.last_active_at ? new Date(p.last_active_at).toLocaleString() : "—") + ' · ' + t("Placement", "Test") + ': ' + (p.placement_taken_at ? new Date(p.placement_taken_at).toLocaleDateString() : t("not taken", "topshirilmagan")) + '</div></div>' +
        '<div class="card"><h3>' + t("Actions", "Amallar") + '</h3><div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn" id="a-pw">🔑 ' + t("Reset password", "Parolni tiklash") + '</button>' +
        '<button class="btn ' + (p.blocked ? "" : "danger") + '" id="a-block">' + (p.blocked ? '✅ ' + t("Unblock", "Blokdan chiqarish") : '⛔ ' + t("Block", "Bloklash")) + '</button>' +
        U.field(t("Role", "Rol"), '<select id="a-role"><option value="learner"' + (p.role === "learner" ? " selected" : "") + '>learner</option><option value="admin"' + (p.role === "admin" ? " selected" : "") + '>admin</option></select>') +
        U.field(t("CEFR level (manual)", "CEFR daraja (qo‘lda)"), '<select id="a-cefr"><option value="">—</option>' + ["A2", "B1", "B2", "C1"].map(function (l) { return '<option' + (p.cefr_level === l ? " selected" : "") + '>' + l + '</option>'; }).join("") + '</select>') +
        '<label class="switch"><input type="checkbox" id="a-lb"' + (p.show_on_leaderboard !== false ? " checked" : "") + '><span class="track"></span><span class="small">' + t("Visible on leaderboard", "Reytingda ko‘rinadi") + '</span></label>' +
        '<button class="btn primary" id="a-save">' + t("Save changes", "O‘zgarishlarni saqlash") + '</button></div></div></div>' +
        '<div class="grid cols-2 mb"><div class="card"><h3>' + t("XP by skill", "XP ko‘nikmalar bo‘yicha") + '</h3>' + skills.map(function (k) { return '<div class="indicator-row"><span class="name">' + esc(k) + '</span>' + U.bar(Math.round((by[k] || 0) / maxS * 100)) + '<span class="val">' + (by[k] || 0) + '</span></div>'; }).join("") + '</div>' +
        '<div class="card"><h3>' + t("XP over time", "XP dinamikasi") + '</h3><canvas id="d-xp" width="520" height="200" style="width:100%"></canvas></div></div>' +
        '<div class="grid cols-3"><div class="card"><h3>' + t("Level tests", "Daraja testlari") + '</h3>' + ((d.tests || []).length ? d.tests.map(function (x) { return '<div class="flex between small" style="padding:5px 0;border-bottom:1px dashed var(--border)"><span>' + esc(x.kind) + ' ' + esc(x.from_level || "") + '→' + esc(x.result_level) + '</span><b>' + esc(x.score) + '% · ' + esc(String(x.created_at).slice(0, 10)) + '</b></div>'; }).join("") : U.emptyState("—")) + '</div>' +
        '<div class="card"><h3>' + t("Badges", "Nishonlar") + '</h3><div class="badge-row">' + Object.keys(E.badgeMeta).map(function (c) { var has = (d.badges || []).some(function (b) { return b.code === c; }); return '<span class="badge-chip ' + (has ? "on" : "") + '" title="' + esc(E.badgeMeta[c][1]) + '">' + E.badgeMeta[c][0] + '</span>'; }).join("") + '</div></div>' +
        '<div class="card"><h3>' + t("Activity log", "Faoliyat jurnali") + '</h3><div style="max-height:280px;overflow:auto">' + ((d.activity || []).length ? d.activity.slice(0, 60).map(function (a) { return '<div class="flex between small" style="padding:4px 0;border-bottom:1px dashed var(--border)"><span><b>' + esc(a.type) + '</b> <span class="faint">' + esc((a.meta && a.meta.note) || "") + '</span></span><span>+' + esc(a.xp) + ' · ' + esc(String(a.created_at).slice(0, 10)) + '</span></div>'; }).join("") : U.emptyState("—")) + '</div></div></div>';
      drawXp(host.querySelector("#d-xp"), s.xp_history || []);
      host.querySelector("#a-pw").onclick = function () { resetPassword(p); };
      host.querySelector("#a-block").onclick = function () { blockToggle(p, !p.blocked); };
      host.querySelector("#a-save").onclick = function () {
        var patch = { role: host.querySelector("#a-role").value, show_on_leaderboard: host.querySelector("#a-lb").checked };
        var lvl = host.querySelector("#a-cefr").value; if (lvl) patch.cefr_level = lvl;
        E.sb.rpc("admin_update_user", { p_user_id: p.id, p_patch: patch }).then(function (r) { if (r.error) throw r.error; toast(t("Saved.", "Saqlandi."), "good"); E.nav("admin"); }).catch(function (e) { toast(e.message || String(e), "warn"); });
      };
    }).catch(function (e) { host.querySelector("#d-body").innerHTML = '<div class="card">' + U.emptyState(String(e.message || e)) + '</div>'; });
  }
  function drawXp(cv, hist) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d"), W = cv.width, H = cv.height, pad = 26, max = 10, map = {};
    hist.forEach(function (h) { map[h.day] = h.xp; if (h.xp > max) max = h.xp; });
    ctx.clearRect(0, 0, W, H); var bw = (W - pad * 2) / 30;
    for (var i = 29; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), v = map[d] || 0, h = (H - pad * 2) * v / max, x = pad + (29 - i) * bw; ctx.fillStyle = v ? "#2a5ca8" : "rgba(128,128,128,.15)"; ctx.fillRect(x + 1, H - pad - h, Math.max(2, bw - 3), Math.max(1, h)); }
    ctx.fillStyle = "#888"; ctx.font = "10px sans-serif"; ctx.fillText(max + " XP", 2, 12); ctx.fillText(t("last 30 days", "oxirgi 30 kun"), 2, H - 6);
  }

  /* ---------- Edge Function actions ---------- */
  function callAdmin(payload) {
    return E.sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("No session");
      return fetch(CFG.SUPABASE_URL + "/functions/v1/" + (CFG.ADMIN_FUNCTION || "admin-actions"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, apikey: CFG.SUPABASE_ANON_KEY }, body: JSON.stringify(payload) });
    }).then(function (res) { return res.json().then(function (j) { if (!res.ok || !j.ok) throw new Error(j.error || ("HTTP " + res.status)); return j; }); });
  }
  function resetPassword(p) {
    modal('<h2>🔑 ' + t("Reset password for", "Parolni tiklash:") + ' ' + esc(p.display_name) + '</h2><p class="small muted">' + t("Set a temporary password and tell the learner to change it in Settings.", "Vaqtinchalik parol o‘rnating va o‘quvchiga Sozlamalardan o‘zgartirishni ayting.") + '</p>' +
      U.field(t("New password (min 8)", "Yangi parol (kamida 8)"), '<input id="rp-pw" type="text" autocomplete="off" value="' + esc("Tmp" + Math.random().toString(36).slice(2, 8) + "!" + Math.floor(Math.random() * 90 + 10)) + '">') +
      '<div class="small err-word" id="rp-err"></div><div class="btn-row mt2"><button class="btn primary" id="rp-go">' + t("Reset", "Tiklash") + '</button><button class="btn" id="rp-c">' + t("Cancel", "Bekor qilish") + '</button></div>');
    document.getElementById("rp-c").onclick = closeModal;
    document.getElementById("rp-go").onclick = function () {
      var pw = document.getElementById("rp-pw").value; if (pw.length < 8) { document.getElementById("rp-err").textContent = t("At least 8 characters.", "Kamida 8 belgi."); return; }
      this.disabled = true;
      callAdmin({ action: "reset_password", user_id: p.id, new_password: pw }).then(function () { closeModal(); toast(t("Password reset. Share it with the learner securely.", "Parol tiklandi. Uni o‘quvchiga xavfsiz yetkazing."), "good"); })
        .catch(function (e) { document.getElementById("rp-err").textContent = t("Failed: ", "Xato: ") + e.message + " — " + t("is the admin-actions Edge Function deployed? See SETUP.md.", "admin-actions Edge Function joylanganmi? SETUP.md ga qarang."); document.getElementById("rp-go").disabled = false; });
    };
  }
  function blockToggle(p, block) {
    if (!confirm(block ? t("Block this account? The learner will not be able to sign in.", "Bu hisobni bloklaysizmi? O‘quvchi tizimga kira olmaydi.") : t("Unblock this account?", "Blokdan chiqarasizmi?"))) return;
    callAdmin({ action: block ? "block" : "unblock", user_id: p.id }).then(function () { toast(block ? t("Account blocked.", "Hisob bloklandi.") : t("Account unblocked.", "Hisob blokdan chiqarildi."), "good"); E.nav("admin"); })
      .catch(function (e) {
        // Fallback: at least flag the profile via RPC (RLS + login check) if the Edge Function is missing.
        E.sb.rpc("admin_update_user", { p_user_id: p.id, p_patch: { blocked: block } }).then(function (r) { if (r.error) throw r.error; toast(t("Edge Function unavailable (" + e.message + "); profile flag updated only.", "Edge Function mavjud emas (" + e.message + "); faqat profil belgisi yangilandi."), "warn"); E.nav("admin"); }).catch(function (e2) { toast(e2.message || String(e2), "warn"); });
      });
  }

  /* ---------- CSV export ---------- */
  function exportCsv() {
    E.sb.rpc("admin_users", { p_search: q.search || null, p_org: q.org || null, p_cefr: q.cefr || null, p_league: q.league || null, p_sort: q.sort, p_dir: q.dir, p_limit: 500, p_offset: 0 }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      var cols = ["login_id", "display_name", "organisation", "position", "role", "cefr_level", "platform_level", "total_xp", "weekly_xp", "streak", "league", "blocked", "show_on_leaderboard", "created_at", "last_active_at"];
      var csv = "﻿" + cols.join(",") + "\n" + rows.map(function (u) { return cols.map(function (c) { var v = u[c] == null ? "" : String(u[c]); return '"' + v.replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "efuture-learners-" + E.todayStr() + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast(t("CSV exported (opens in Excel).", "CSV eksport qilindi (Excel da ochiladi)."), "good");
    }).catch(function (e) { toast(e.message || String(e), "warn"); });
  }

  E.registerView("admin", render);
})();
