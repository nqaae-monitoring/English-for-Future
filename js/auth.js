/* =========================================================================
   English for Future — auth.js
   Accounts with Login ID + password on Supabase Auth. The learner never sees
   an email address: the ID is mapped to <id>@users.efuture.local internally.
   Gates the application: nothing renders until a session exists (or the
   learner chooses the local-only mode when Supabase is not configured).
   Exposes window.ELH_AUTH.
   ========================================================================= */
(function () {
  "use strict";

  var CFG = window.EFUTURE_CONFIG || {};
  var EMAIL_DOMAIN = "users.efuture.local";
  var ID_RE = /^[a-z0-9_]{3,20}$/;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- i18n (auth screen only; the app uses ELH.t) ---------- */
  var I18N = {
    en: {
      hero_title: "Professional English for education leaders — from A2 to C1.",
      hero_sub: "Quality assurance, accreditation, meetings, negotiation and conference speaking. A placement test sets your level; daily plans, XP and a leaderboard keep you moving.",
      pt_1: "Placement test → personal CEFR path A2 → B1 → B2 → C1", pt_2: "Progress saved to the cloud — continue on any device",
      pt_3: "XP, badges and a weekly leaderboard with Gold · Silver · Bronze leagues", pt_4: "Uzbek hints for beginners, English-only mode for advanced learners",
      tab_login: "Sign in", tab_signup: "Create account", f_id: "Login ID", f_pw: "Password", f_pw2: "Confirm password", f_name: "Display name",
      f_org: "Organisation (optional)", f_pos: "Position (optional)", f_email: "Recovery email (optional)", f_remember: "Remember me on this device",
      btn_login: "Sign in", btn_signup: "Create account", help_forgot: "Forgot your password? Ask your administrator to reset it from the admin panel.",
      hint_id: "3–20 characters: letters, digits, underscore. Can be a number (e.g. 20451).", hint_pw: "At least 8 characters. Mix letters, digits and symbols for a strong password.",
      offline_msg: "Cloud accounts are not configured yet (config.js). You can still use the platform on this device only.",
      btn_offline: "Continue without an account (this device only)", um_settings: "Settings", um_progress: "My progress", um_signout: "Sign out",
      e_id: "Login ID must be 3–20 characters: letters, digits or underscore.", e_name: "Please enter your display name.", e_pw: "Password must be at least 8 characters.",
      e_pw2: "Passwords do not match.", e_email: "Recovery email looks invalid.", e_taken: "This Login ID is already taken — try another.",
      e_cred: "Wrong Login ID or password.", e_rate: "Too many attempts. Please wait {s} seconds and try again.", e_net: "Cannot reach the server. Check your connection.",
      e_blocked: "This account is blocked. Contact your administrator.", e_generic: "Something went wrong: {m}",
      s_checking: "Checking…", s_signing: "Signing in…", s_creating: "Creating your account…", s_loading: "Loading your progress…",
      s_welcome: "Welcome back, {n}!", s_created: "Account created. Welcome, {n}!", s_confirm: "Account created. Please ask the administrator to enable it, then sign in.",
      pw_weak: "Weak", pw_fair: "Fair", pw_good: "Good", pw_strong: "Strong"
    },
    uz: {
      hero_title: "Ta’lim rahbarlari uchun professional ingliz tili — A2 dan C1 gacha.",
      hero_sub: "Sifat ta’minoti, akkreditatsiya, yig‘ilishlar, muzokaralar va konferensiya nutqi. Darajani aniqlash testi sizning darajangizni belgilaydi; kunlik reja, XP va reyting jadvali oldinga undaydi.",
      pt_1: "Darajani aniqlash testi → shaxsiy CEFR yo‘li A2 → B1 → B2 → C1", pt_2: "Natijalar bulutda saqlanadi — istalgan qurilmada davom eting",
      pt_3: "XP, nishonlar va haftalik reyting: Oltin · Kumush · Bronza ligalari", pt_4: "Boshlovchilar uchun o‘zbekcha izohlar, ilg‘orlar uchun faqat inglizcha rejim",
      tab_login: "Kirish", tab_signup: "Ro‘yxatdan o‘tish", f_id: "Login ID", f_pw: "Parol", f_pw2: "Parolni tasdiqlang", f_name: "Ko‘rsatiladigan ism",
      f_org: "Tashkilot (ixtiyoriy)", f_pos: "Lavozim (ixtiyoriy)", f_email: "Tiklash uchun email (ixtiyoriy)", f_remember: "Bu qurilmada eslab qolish",
      btn_login: "Kirish", btn_signup: "Hisob yaratish", help_forgot: "Parolni unutdingizmi? Administrator uni admin panelidan tiklab beradi.",
      hint_id: "3–20 belgi: harflar, raqamlar, pastki chiziq. Raqam ham bo‘lishi mumkin (masalan, 20451).", hint_pw: "Kamida 8 belgi. Harf, raqam va belgilarni aralashtiring.",
      offline_msg: "Bulutli hisoblar hali sozlanmagan (config.js). Platformadan faqat shu qurilmada foydalanishingiz mumkin.",
      btn_offline: "Hisobsiz davom etish (faqat shu qurilma)", um_settings: "Sozlamalar", um_progress: "Mening natijalarim", um_signout: "Chiqish",
      e_id: "Login ID 3–20 belgidan iborat bo‘lishi kerak: harf, raqam yoki pastki chiziq.", e_name: "Ismingizni kiriting.", e_pw: "Parol kamida 8 belgidan iborat bo‘lsin.",
      e_pw2: "Parollar mos kelmadi.", e_email: "Email noto‘g‘ri ko‘rinadi.", e_taken: "Bu Login ID band — boshqasini tanlang.",
      e_cred: "Login ID yoki parol noto‘g‘ri.", e_rate: "Urinishlar ko‘p bo‘ldi. {s} soniya kutib, qayta urinib ko‘ring.", e_net: "Serverga ulanib bo‘lmadi. Internetni tekshiring.",
      e_blocked: "Bu hisob bloklangan. Administratorga murojaat qiling.", e_generic: "Xatolik yuz berdi: {m}",
      s_checking: "Tekshirilmoqda…", s_signing: "Kirilmoqda…", s_creating: "Hisob yaratilmoqda…", s_loading: "Natijalaringiz yuklanmoqda…",
      s_welcome: "Xush kelibsiz, {n}!", s_created: "Hisob yaratildi. Xush kelibsiz, {n}!", s_confirm: "Hisob yaratildi. Administrator uni faollashtirgach, kiring.",
      pw_weak: "Zaif", pw_fair: "O‘rtacha", pw_good: "Yaxshi", pw_strong: "Kuchli"
    }
  };
  var lang = "en";
  try { lang = localStorage.getItem("elh_lang") === "uz" ? "uz" : "en"; } catch (e) { }
  function t(k, vars) {
    var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.replace("{" + v + "}", vars[v]); });
    return s;
  }
  function applyLang() {
    $$("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    var b = $("#auth-lang"); if (b) b.textContent = lang === "uz" ? "🇬🇧 English" : "🇺🇿 O‘zbekcha";
    document.documentElement.lang = lang;
  }

  /* ---------- Supabase client with "remember me" aware storage ---------- */
  var configured = !!(CFG.SUPABASE_URL && /^https:\/\//.test(CFG.SUPABASE_URL) && CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.length > 20 && window.supabase);
  var client = null;
  var storage = {
    // Reads from sessionStorage first (non-remembered sessions), then localStorage.
    getItem: function (k) { try { return sessionStorage.getItem(k) != null ? sessionStorage.getItem(k) : localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { if (sessionStorage.getItem("elh_auth_mode") === "session") sessionStorage.setItem(k, v); else localStorage.setItem(k, v); } catch (e) { } },
    removeItem: function (k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) { } }
  };
  if (configured) {
    client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }

  var current = { user: null, profile: null, offline: false };
  function toEmail(id) { return id.toLowerCase() + "@" + EMAIL_DOMAIN; }

  /* ---------- UI helpers ---------- */
  function showError(id, msg) { var e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function setStatus(msg) { $("#auth-status").textContent = msg || ""; }
  function busy(btnSel, on, label) { var b = $(btnSel); b.disabled = on; b.textContent = on ? label : t(b.getAttribute("data-i18n")); }
  function strength(pw) {
    var s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }
  function friendly(err) {
    var m = (err && (err.message || err.error_description || String(err))) || "";
    var st = err && err.status;
    if (st === 429 || /rate limit|too many/i.test(m)) return t("e_rate", { s: 30 });
    if (/invalid login credentials|invalid_credentials/i.test(m)) return t("e_cred");
    if (/banned|blocked/i.test(m)) return t("e_blocked");
    if (/already registered|already been registered|duplicate|taken/i.test(m)) return t("e_taken");
    if (/failed to fetch|network|load failed/i.test(m)) return t("e_net");
    return t("e_generic", { m: m });
  }

  /* ---------- Rate limiting (client-side messaging; Supabase limits server-side too) ---------- */
  var fails = 0, lockUntil = 0, lockTimer;
  function locked() { return Date.now() < lockUntil; }
  function registerFail() {
    fails++;
    if (fails >= 3) { lockUntil = Date.now() + 30000; fails = 0; tickLock(); }
  }
  function tickLock() {
    clearInterval(lockTimer);
    lockTimer = setInterval(function () {
      var s = Math.ceil((lockUntil - Date.now()) / 1000);
      if (s <= 0) { clearInterval(lockTimer); showError("#li-error", ""); $("#li-submit").disabled = false; return; }
      showError("#li-error", t("e_rate", { s: s })); $("#li-submit").disabled = true;
    }, 250);
  }

  /* ---------- Sign in ---------- */
  function onLogin(e) {
    e.preventDefault();
    if (locked()) return;
    var id = $("#li-id").value.trim().toLowerCase(), pw = $("#li-pw").value;
    showError("#li-error", "");
    if (!ID_RE.test(id)) return showError("#li-error", t("e_id"));
    if (!pw) return showError("#li-error", t("e_pw"));
    try { sessionStorage.setItem("elh_auth_mode", $("#li-remember").checked ? "local" : "session"); } catch (x) { }
    busy("#li-submit", true, t("s_signing"));
    client.auth.signInWithPassword({ email: toEmail(id), password: pw }).then(function (res) {
      if (res.error) { registerFail(); showError("#li-error", friendly(res.error)); busy("#li-submit", false); return; }
      fails = 0;
      return enter(res.data.session, false);
    }).catch(function (err) { showError("#li-error", friendly(err)); busy("#li-submit", false); });
  }

  /* ---------- Sign up ---------- */
  function onSignup(e) {
    e.preventDefault();
    var id = $("#su-id").value.trim().toLowerCase(), name = $("#su-name").value.trim(), pw = $("#su-pw").value, pw2 = $("#su-pw2").value;
    var org = $("#su-org").value.trim(), pos = $("#su-pos").value.trim(), email = $("#su-email").value.trim();
    showError("#su-error", "");
    if (!ID_RE.test(id)) return showError("#su-error", t("e_id"));
    if (!name) return showError("#su-error", t("e_name"));
    if (pw.length < 8) return showError("#su-error", t("e_pw"));
    if (pw !== pw2) return showError("#su-error", t("e_pw2"));
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showError("#su-error", t("e_email"));
    busy("#su-submit", true, t("s_checking"));
    client.rpc("login_id_available", { p_login_id: id }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data === false) { showError("#su-error", t("e_taken")); busy("#su-submit", false); return null; }
      busy("#su-submit", true, t("s_creating"));
      try { sessionStorage.setItem("elh_auth_mode", "local"); } catch (x) { }
      return client.auth.signUp({ email: toEmail(id), password: pw, options: { data: { login_id: id, display_name: name, organisation: org, position: pos, recovery_email: email } } });
    }).then(function (res) {
      if (!res) return;
      if (res.error) { showError("#su-error", friendly(res.error)); busy("#su-submit", false); return; }
      if (!res.data.session) { setStatus(t("s_confirm")); busy("#su-submit", false); return; } // email confirmation still on
      return enter(res.data.session, true);
    }).catch(function (err) { showError("#su-error", friendly(err)); busy("#su-submit", false); });
  }

  /* ---------- After a session exists ---------- */
  function loadProfile(uid) {
    return client.from("profiles").select("*").eq("id", uid).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var entered = false;
  function enter(session, isNew) {
    if (entered || !session) return Promise.resolve();
    entered = true;
    setStatus(t("s_loading"));
    return loadProfile(session.user.id).then(function (p) {
      if (!p) { // trigger may lag a moment on brand-new accounts
        return new Promise(function (res) { setTimeout(res, 1200); }).then(function () { return loadProfile(session.user.id); });
      }
      return p;
    }).then(function (p) {
      if (!p) throw new Error("Profile not found. Run supabase/schema.sql.");
      if (p.blocked) { entered = false; return client.auth.signOut().then(function () { showError("#li-error", t("e_blocked")); busy("#li-submit", false); setStatus(""); }); }
      current.user = session.user; current.profile = p; current.offline = false;
      return window.ELH_SYNC.start(current).then(function () {
        revealApp();
        window.ELH.boot();
        window.ELH.ui.toast(isNew ? t("s_created", { n: p.display_name }) : t("s_welcome", { n: p.display_name }), "good");
        if (!p.cefr_level && window.ELH_PLACEMENT) setTimeout(function () { window.ELH_PLACEMENT.start({ kind: "placement", fromLevel: null }); }, 300);
      });
    }).catch(function (err) {
      entered = false;
      showError("#li-error", friendly(err)); busy("#li-submit", false); busy("#su-submit", false); setStatus("");
    });
  }
  function revealApp() {
    $("#auth-screen").hidden = true;
    $("#app").hidden = false;
    document.body.classList.remove("auth-pending");
  }
  function enterOffline() {
    try { localStorage.setItem("elh_offline_ok", "1"); } catch (e) { }
    current.user = null; current.profile = null; current.offline = true;
    window.ELH_SYNC.start(current).then(function () { revealApp(); window.ELH.boot(); });
  }

  function signOut() {
    var done = function () { try { sessionStorage.removeItem("elh_auth_mode"); localStorage.removeItem("elh_offline_ok"); } catch (e) { } location.hash = ""; location.reload(); };
    if (!client || current.offline) return done();
    window.ELH_SYNC.flush().then(function () { return client.auth.signOut(); }).then(done, done);
  }

  function changePassword(newPw) {
    if (!client || !current.user) return Promise.reject(new Error("offline"));
    return client.auth.updateUser({ password: newPw }).then(function (r) { if (r.error) throw r.error; return true; });
  }

  function refreshProfile() {
    if (!client || !current.user) return Promise.resolve(current.profile);
    return loadProfile(current.user.id).then(function (p) { if (p) current.profile = p; return p; });
  }

  /* ---------- Wire the screen ---------- */
  function wire() {
    applyLang();
    $("#auth-lang").onclick = function () { lang = lang === "uz" ? "en" : "uz"; try { localStorage.setItem("elh_lang", lang); } catch (e) { } applyLang(); };
    // theme: honour saved app theme before sign-in
    var th = "light"; try { var st = JSON.parse(localStorage.getItem("elh_state_v1") || "null"); th = (st && st.settings && st.settings.theme) || (localStorage.getItem("elh_theme") || "light"); } catch (e) { }
    document.documentElement.setAttribute("data-theme", th === "dark" ? "dark" : "light");
    $("#auth-theme").textContent = th === "dark" ? "☀️" : "🌙";
    $("#auth-theme").onclick = function () { var d = document.documentElement.getAttribute("data-theme") === "dark"; document.documentElement.setAttribute("data-theme", d ? "light" : "dark"); this.textContent = d ? "🌙" : "☀️"; try { localStorage.setItem("elh_theme", d ? "light" : "dark"); } catch (e) { } };
    $$(".auth-tab").forEach(function (b) {
      b.onclick = function () {
        $$(".auth-tab").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        $("#form-login").hidden = b.dataset.tab !== "login"; $("#form-signup").hidden = b.dataset.tab !== "signup";
        setStatus("");
        var f = b.dataset.tab === "login" ? $("#li-id") : $("#su-id"); if (f) f.focus();
      };
    });
    $$(".pw-eye").forEach(function (b) { b.onclick = function () { var i = $("#" + b.dataset.eye); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "👁" : "🙈"; }; });
    $("#su-pw").oninput = function () {
      var s = strength(this.value), m = $("#su-meter"); m.style.width = (s * 25) + "%"; m.className = "s" + s;
      $("#su-pw-hint").textContent = this.value ? [t("pw_weak"), t("pw_weak"), t("pw_fair"), t("pw_good"), t("pw_strong")][s] : t("hint_pw");
    };
    $("#su-id").oninput = function () { this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20); };
    $("#li-id").oninput = function () { this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20); };
    $("#form-login").onsubmit = onLogin;
    $("#form-signup").onsubmit = onSignup;
    $("#auth-offline-btn").onclick = enterOffline;

    if (!configured) {
      $("#auth-offline").hidden = false;
      $("#li-submit").disabled = true; $("#su-submit").disabled = true;
      $("#form-login").classList.add("disabled"); $("#form-signup").classList.add("disabled");
      var ok = false; try { ok = localStorage.getItem("elh_offline_ok") === "1"; } catch (e) { }
      if (ok) enterOffline();
      return;
    }
    // existing session?
    setStatus(t("s_checking"));
    client.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (s) return enter(s, false);
      setStatus("");
    }).catch(function () { setStatus(""); });
    client.auth.onAuthStateChange(function (ev) {
      if (ev === "SIGNED_OUT" && !$("#app").hidden) { location.reload(); }
    });
  }

  window.ELH_AUTH = {
    client: client, configured: configured,
    user: function () { return current.user; },
    profile: function () { return current.profile; },
    offline: function () { return current.offline; },
    isAdmin: function () { return !!(current.profile && current.profile.role === "admin"); },
    signOut: signOut, changePassword: changePassword, refreshProfile: refreshProfile,
    lang: function () { return lang; }, t: t
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
