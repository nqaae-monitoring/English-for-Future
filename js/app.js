/* =========================================================================
   Education Leadership English Hub — app.js
   Vanilla JS single-page application logic.
   Sections: state/storage, adaptive engine, scoring, speech, router, views.
   Works fully offline in demo mode. Optional AI hooks are clearly marked.
   ========================================================================= */
(function () {
  "use strict";
  var D = window.HUB_DATA;
  var C = window.HUB_CONTENT || { LEVELS: ["A2", "B1", "B2", "C1"], tags: {}, A2: {}, B1: {} };
  var LEVELS = ["A2", "B1", "B2", "C1"];
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var el = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") e.className = attrs[k]; else if (k === "html") e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var todayStr = function () { return new Date().toISOString().slice(0, 10); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };

  /* ---------------------------------------------------------------------
     STATE & STORAGE
     Primary store: localStorage (key below). Large records could be moved
     to IndexedDB; a minimal IndexedDB backup helper is included at the end.
  --------------------------------------------------------------------- */
  var STORE_KEY = "elh_state_v1";

  function defaultState() {
    var indicators = {};
    // Indicators start at 0; the placement test seeds them from real results.
    D.INDICATORS.forEach(function (i) { indicators[i.key] = { current: 0, previous: 0, target: 90 }; });
    return {
      profile: { name: "Education Leader", level: null, target: "C1" },
      indicators: indicators,
      streak: { count: 0, last: null },
      totals: { timeMin: 0, lessons: 0, words: 0, phrases: 0, speaking: 0, negotiations: 0, speeches: 0 },
      vocab: {},          // term -> {mastery, ease, interval, due, reps}
      savedPhrases: [],   // phrase strings / custom items
      goals: [],
      weekly: [],         // weekly reports
      imported: [],
      activity: [],       // {date, type, score, note}
      todayDonePlan: {},  // date -> [stepIndex...]
      settings: {
        theme: "light", uz: false, reduceMotion: false, dailyLength: 30,
        refreshTime: "07:00",
        sources: [
          { name: "ENQA news (RSS)", url: "https://www.enqa.eu/feed/", active: true },
          { name: "EQAR news (RSS)", url: "https://www.eqar.eu/feed/", active: true },
          { name: "University World News (RSS)", url: "https://www.universityworldnews.com/rss/", active: true }
        ],
        aiKeyConfigured: false,
        showOnLeaderboard: true, uzChosen: false
      },
      feed: null,
      xp: { total: 0, today: 0, day: null, bySkill: {}, seen: {}, queue: [], history: {} },
      badges: [],
      cefr: { placementAt: null, tests: [], lastLevelUpAt: null, levelSetXp: 0 },
      installedDay: todayStr()
    };
  }

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  var S;
  function load() {
    var st = null;
    try { st = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { st = null; }
    setState(st);
  }
  // Install a state object (from localStorage or the cloud) and forward-fill new keys.
  function setState(obj) {
    S = (obj && typeof obj === "object") ? obj : defaultState();
    var d = defaultState();
    for (var k in d) if (!(k in S)) S[k] = d[k];
    if (!S.settings) S.settings = d.settings;
    for (var sk in d.settings) if (!(sk in S.settings)) S.settings[sk] = d.settings[sk];
    if (!S.xp) S.xp = d.xp;
    ["bySkill", "seen", "history"].forEach(function (k) { if (!S.xp[k]) S.xp[k] = {}; });
    if (!S.xp.queue) S.xp.queue = [];
    if (!S.cefr) S.cefr = d.cefr;
    if (!S.badges) S.badges = [];
    if (!S.profile) S.profile = d.profile;
    S.profile.target = "C1";
    if (S.profile.level === "C2") S.profile.level = "C1";
    if (S.profile.level === "A1") S.profile.level = "A2";
    if (!S.indicators) S.indicators = d.indicators;
    D.INDICATORS.forEach(function (i) { if (!S.indicators[i.key]) S.indicators[i.key] = { current: 0, previous: 0, target: 90 }; });
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
      catch (e) { toast("Storage full — export a backup to be safe.", "warn"); }
      if (window.ELH_SYNC) window.ELH_SYNC.save(S);
    }, 120);
  }

  /* ---------------------------------------------------------------------
     ADAPTIVE ENGINE & SCORING
  --------------------------------------------------------------------- */
  // Record an activity result and nudge related indicators.
  function recordActivity(type, score, indicatorKeys, note) {
    S.activity.unshift({ date: todayStr(), ts: Date.now(), type: type, score: score, note: note || "" });
    S.activity = S.activity.slice(0, 400);
    (indicatorKeys || []).forEach(function (key) {
      var ind = S.indicators[key];
      if (!ind) return;
      ind.previous = ind.current;
      // move current 25% toward the new score
      ind.current = clamp(Math.round(ind.current + (score - ind.current) * 0.25), 0, 100);
    });
    bumpStreak();
    save();
    awardForActivity(type, score, note);
  }

  function bumpStreak() {
    var t = todayStr();
    if (S.streak.last === t) return;
    var yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    S.streak.count = (S.streak.last === yest) ? S.streak.count + 1 : 1;
    S.streak.last = t;
  }

  function overallScore() {
    var keys = Object.keys(S.indicators), sum = 0;
    keys.forEach(function (k) { sum += S.indicators[k].current; });
    return Math.round(sum / keys.length);
  }
  function growthScore() {
    // professional growth = overall + streak + mastery bonuses
    var base = overallScore();
    var bonus = Math.min(8, S.streak.count) + Math.min(6, Math.floor(S.totals.words / 20)) + Math.min(6, S.totals.speaking);
    return clamp(base + bonus - 5, 0, 100);
  }
  function weakestIndicators(n) {
    return D.INDICATORS.slice().sort(function (a, b) { return S.indicators[a.key].current - S.indicators[b.key].current; }).slice(0, n || 3);
  }
  function strongestIndicators(n) {
    return D.INDICATORS.slice().sort(function (a, b) { return S.indicators[b.key].current - S.indicators[a.key].current; }).slice(0, n || 3);
  }
  function recommendationReason(ind) {
    var v = S.indicators[ind.key].current;
    if (v < 60) return "Score " + v + " — below 60, so intensive practice is recommended.";
    if (v < 75) return "Score " + v + " — regular reinforcement will consolidate this.";
    if (v < 90) return "Score " + v + " — advanced application to push toward C1.";
    return "Score " + v + " — strong; maintenance and challenge tasks.";
  }

  // Rule-based speaking/writing scorer (used when no AI configured)
  function scoreResponse(text, opts) {
    opts = opts || {};
    var words = (text.trim().match(/\b[\w'-]+\b/g) || []);
    var wc = words.length;
    var lower = text.toLowerCase();
    var fillers = (lower.match(/\b(um|uh|erm|like|you know|basically|actually|sort of|kind of)\b/g) || []);
    var expected = opts.expected || [];
    var hits = expected.filter(function (t) { return lower.indexOf(t.toLowerCase()) >= 0; });
    var sentences = (text.match(/[.!?]+/g) || []).length || 1;
    var avgSent = wc / sentences;
    // repeated words (content words repeated a lot)
    var freq = {}; words.forEach(function (w) { w = w.toLowerCase(); if (w.length > 4) freq[w] = (freq[w] || 0) + 1; });
    var repeated = Object.keys(freq).filter(function (w) { return freq[w] >= 4; });

    var lengthScore = clamp((wc / (opts.targetWords || 90)) * 100, 0, 100);
    var termScore = expected.length ? Math.round((hits.length / expected.length) * 100) : clamp(wc, 0, 100);
    var fillerPenalty = Math.min(30, fillers.length * 6);
    var structureScore = clamp(100 - Math.abs(avgSent - 16) * 3, 40, 100);
    var fluency = clamp(Math.round(lengthScore * 0.6 + structureScore * 0.4 - fillerPenalty), 0, 100);
    var overall = clamp(Math.round(fluency * 0.4 + termScore * 0.4 + structureScore * 0.2), 0, 100);

    return {
      wc: wc, fillers: fillers, fillerCount: fillers.length, hits: hits, missed: expected.filter(function (t) { return hits.indexOf(t) < 0; }),
      repeated: repeated, avgSent: Math.round(avgSent), fluency: fluency, terminology: termScore,
      structure: Math.round(structureScore), overall: overall,
      wpm: opts.seconds ? Math.round(wc / (opts.seconds / 60)) : null
    };
  }

  /* ---------------------------------------------------------------------
     SPACED REPETITION (SM-2 lite)
  --------------------------------------------------------------------- */
  function vocabState(term) {
    if (!S.vocab[term]) S.vocab[term] = { mastery: "new", ease: 2.5, interval: 0, due: todayStr(), reps: 0 };
    return S.vocab[term];
  }
  function reviewVocab(term, quality) { // quality 0..5
    var v = vocabState(term);
    if (quality < 3) { v.reps = 0; v.interval = 1; }
    else {
      v.reps += 1;
      if (v.reps === 1) v.interval = 1; else if (v.reps === 2) v.interval = 6;
      else v.interval = Math.round(v.interval * v.ease);
      v.ease = clamp(v.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), 1.3, 3.0);
    }
    v.due = new Date(Date.now() + v.interval * 864e5).toISOString().slice(0, 10);
    var was = v.mastery;
    v.mastery = v.reps >= 4 && quality >= 4 ? "mastered" : (quality >= 3 ? "learning" : "difficult");
    if (v.mastery === "mastered") { S.totals.words = countMastered(); if (was !== "mastered") awardXp("word_mastered", { note: term }); }
    save();
  }
  function countMastered() { return Object.keys(S.vocab).filter(function (t) { return S.vocab[t].mastery === "mastered"; }).length; }
  function dueVocab() {
    var t = todayStr();
    return D.VOCABULARY.filter(function (v) { var st = S.vocab[v.term]; return !st || st.due <= t; });
  }

  /* ---------------------------------------------------------------------
     UI HELPERS: toast, modal, tts, timer
  --------------------------------------------------------------------- */
  function toast(msg, kind) {
    var wrap = $("#toasts");
    var t = el("div", { class: "toast " + (kind || "") }, esc(msg));
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  function modal(html) {
    var b = $("#modal-backdrop");
    $("#modal-body").innerHTML = html;
    b.classList.add("open");
  }
  function closeModal() { $("#modal-backdrop").classList.remove("open"); }

  var synth = window.speechSynthesis;
  function speak(text, rate) {
    if (!synth) { toast("Text-to-speech not supported in this browser.", "warn"); return; }
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.rate = rate || 1; u.lang = "en-GB";
    synth.speak(u);
  }

  // Speech recognition (where available)
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function makeRecognizer(onResult, onEnd) {
    if (!SR) return null;
    var r = new SR();
    r.lang = "en-GB"; r.interimResults = true; r.continuous = true;
    var finalText = "";
    r.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      onResult(finalText, interim);
    };
    r.onend = function () { onEnd && onEnd(finalText); };
    r._final = function () { return finalText; };
    return r;
  }

  /* ---------------------------------------------------------------------
     ROUTER
  --------------------------------------------------------------------- */
  var VIEWS = {}; // name -> render(container)
  var currentView = "dashboard";
  function navigate(name) {
    if (!VIEWS[name]) name = "dashboard";
    currentView = name;
    $$(".nav-item").forEach(function (b) { b.classList.toggle("active", b.dataset.view === name); });
    var host = $("#view-host");
    host.innerHTML = "";
    var wrap = el("div", { class: "view active" });
    host.appendChild(wrap);
    if (isLocked(name)) renderLocked(wrap, name); else VIEWS[name](wrap);
    $("#page-title").textContent = NAV_LABEL[name] || "Dashboard";
    document.body.classList.remove("nav-open");
    window.scrollTo(0, 0);
    location.hash = name;
    syncBottom();
  }

  /* ---------- Mobile bottom navigation ---------- */
  var BOTTOM_NAV = [
    ["dashboard", "Home", "🏠"], ["today", "Plan", "📅"], ["leaderboard", "Ranks", "🏆"],
    ["progress", "Progress", "📈"], ["__menu__", "Menu", "☰"]
  ];
  function buildBottomNav() {
    var bn = $("#bottom-nav"); if (!bn) return;
    bn.innerHTML = "";
    BOTTOM_NAV.forEach(function (it) {
      var b = el("button", { "data-bn": it[0], "aria-label": it[1] });
      b.innerHTML = '<span class="bi">' + it[2] + '</span><span>' + it[1] + '</span>';
      b.onclick = function () {
        if (it[0] === "__menu__") { document.body.classList.toggle("nav-open"); }
        else { document.body.classList.remove("nav-open"); navigate(it[0]); }
        syncBottom();
      };
      bn.appendChild(b);
    });
    syncBottom();
  }
  function syncBottom() {
    $$("#bottom-nav [data-bn]").forEach(function (b) {
      var v = b.dataset.bn;
      var on = v === "__menu__" ? document.body.classList.contains("nav-open") : (v === currentView);
      b.classList.toggle("active", on);
    });
  }

  var NAV = [
    ["dashboard", "Dashboard", "📊"], ["today", "Today’s Plan", "📅"], ["vocab", "Vocabulary", "📚"],
    ["phrases", "Phrase Bank", "💬"], ["speaking", "Speaking Studio", "🎙️"], ["negotiation", "Negotiation", "🤝"],
    ["speeches", "Conference Speeches", "🎤"], ["difficult", "Difficult Questions", "❓"], ["listening", "Listening", "🎧"],
    ["grammar", "Grammar", "✍️"], ["writing", "Writing", "📝"], ["feed", "Knowledge Feed", "📰"],
    ["import", "Content Importer", "📥"], ["assess", "Assessments", "🏅"], ["progress", "Progress", "📈"],
    ["goals", "Goals", "🎯"], ["settings", "Settings", "⚙️"],
    ["leaderboard", "Leaderboard", "🏆"], ["admin", "Admin", "🛡️"], ["placement", "Level test", "🎯"],
    ["topics", "Topics", "📖"], ["topic", "Topic", "📖"]
  ];
  var NAV_LABEL = {}; NAV.forEach(function (n) { NAV_LABEL[n[0]] = n[1]; });

  // Extension registry — lets add-on modules (e.g. qual.js) register views and
  // a sidebar section without modifying this file's internals.
  var EXTRA_SECTIONS = [];
  function registerView(name, fn) { VIEWS[name] = fn; }
  function registerNav(title, items) {
    // items: [ [name, label, icon, renderFn], ... ]
    items.forEach(function (it) {
      NAV.push([it[0], it[1], it[2]]);
      NAV_LABEL[it[0]] = it[1];
      if (it[3]) VIEWS[it[0]] = it[3];
    });
    EXTRA_SECTIONS.push({ title: title, views: items.map(function (it) { return it[0]; }) });
    if (document.getElementById("nav") && document.getElementById("nav").children.length) buildShell();
  }

  /* ---------------------------------------------------------------------
     COMPONENT BUILDERS
  --------------------------------------------------------------------- */
  function ring(pct, label, val) {
    return '<div class="ring" style="--p:' + pct + '"><div class="inner"><div><b>' + (val != null ? val : pct) + '</b><small>' + label + '</small></div></div></div>';
  }
  function bar(pct, color) {
    return '<div class="bar"><span style="width:' + clamp(pct, 0, 100) + '%' + (color ? ';background:' + color : '') + '"></span></div>';
  }
  function trendArrow(cur, prev) {
    if (cur > prev) return '<span class="trend-up">▲ ' + (cur - prev) + '</span>';
    if (cur < prev) return '<span class="trend-down">▼ ' + (prev - cur) + '</span>';
    return '<span class="trend-flat">▬</span>';
  }
  function levelPct(level) { return { A1: 12, A2: 25, B1: 42, B2: 60, C1: 82, C2: 96 }[level] || 50; }

  function uz(text) { return S.settings.uz && text ? ' <span class="faint small">🇺🇿 ' + esc(text) + '</span>' : ""; }
  // Interface translation: Uzbek when the learner turned it on (default at A2).
  function tr(en, uzs) { return (S && S.settings && S.settings.uz && uzs) ? uzs : en; }
  function online() { return !!(window.ELH_AUTH && window.ELH_AUTH.client && window.ELH_AUTH.user()); }
  function cefr() { return S.profile.level || null; }

  /* ---------------------------------------------------------------------
     CEFR CONTENT TAGGING & LEVEL FILTER
  --------------------------------------------------------------------- */
  var levelFilter = null; // null = my level (+ a little above); "All" or a specific level
  function levelOf(kind, item) {
    if (!item) return "B2";
    if (item.level && LEVELS.indexOf(item.level) >= 0) return item.level;
    var tg = (C.tags || {})[kind] || {};
    var key = kind === "vocabulary" ? item.term : kind === "phrases" ? item.phrase : kind === "difficult" ? String(D.DIFFICULT.indexOf(item)) : kind === "speeches" ? (item.type || item) : item.id;
    return tg[key] || "B2";
  }
  function merged(kind) {
    var base = { vocabulary: D.VOCABULARY, phrases: D.PHRASES, grammar: D.GRAMMAR, listening: D.LISTENING, writing: D.WRITING, negotiations: D.NEGOTIATIONS, difficult: D.DIFFICULT, speaking: SPEAK_TASKS }[kind] || [];
    var a2 = (C.A2 || {})[kind] || [], b1 = (C.B1 || {})[kind] || [], b2 = (C.B2 || {})[kind] || [], c1 = (C.C1 || {})[kind] || [];
    return a2.concat(b1, base, b2, c1);
  }
  // Items for the learner: own level plus a small i+1 sample; explicit chip filters override.
  function forLevel(kind, items) {
    var sel = levelFilter;
    if (sel === "All") return items;
    var lv = sel || cefr();
    if (!lv) return items;
    var mine = items.filter(function (i) { return levelOf(kind, i) === lv; });
    if (sel) return mine;
    var next = LEVELS[LEVELS.indexOf(lv) + 1];
    var up = next ? items.filter(function (i) { return levelOf(kind, i) === next; }) : [];
    var sample = up.filter(function (x, i) { return i % 4 === 0; }).slice(0, Math.max(3, Math.round(mine.length * 0.2)));
    return mine.length ? mine.concat(sample) : items;
  }
  function content(kind) { return forLevel(kind, merged(kind)); }
  function levelChipsHtml() {
    var lv = cefr();
    return '<div class="chip-row mb level-chips" role="group" aria-label="CEFR level filter">' +
      '<button class="chip ' + (levelFilter === null ? "on" : "") + '" data-lv="">' + (lv ? tr("My level", "Mening darajam") + ' (' + lv + ')' : tr("Recommended", "Tavsiya")) + '</button>' +
      LEVELS.map(function (l) { return '<button class="chip ' + (levelFilter === l ? "on" : "") + '" data-lv="' + l + '">' + l + '</button>'; }).join("") +
      '<button class="chip ' + (levelFilter === "All" ? "on" : "") + '" data-lv="All">' + tr("All levels", "Barcha darajalar") + '</button></div>';
  }
  function addLevelChips(host, onChange) {
    var sh = $(".section-head", host); if (!sh) return;
    sh.insertAdjacentHTML("afterend", levelChipsHtml());
    $$("[data-lv]", host).forEach(function (b) { b.onclick = function () { levelFilter = b.dataset.lv === "" ? null : b.dataset.lv; if (onChange) onChange(); navigate(currentView); }; });
  }
  function levelTag(kind, item) { var l = levelOf(kind, item); return '<span class="tag lvl lvl-' + l + '">' + l + '</span>'; }

  // Open a module positioned on a specific item (topic pages link here).
  function openItem(kind, sel) {
    sel = sel || {};
    if (sel.level) levelFilter = sel.level;
    if (kind === "vocab") { levelFilter = "All"; vocabFilter = sel.topic || "All"; vocabIdx = 0; vocabMode = sel.mode || "flash"; navigate("vocab"); return; }
    if (kind === "phrases") { phraseCat = sel.cat || "All"; navigate("phrases"); return; }
    var lists = { grammar: ["grammar", function (i) { grammarIdx = i; }], listening: ["listening", function (i) { listenIdx = i; }], writing: ["writing", function (i) { writeIdx = i; }], speaking: ["speaking", function (i) { speakTaskIdx = i; }] };
    var L = lists[kind]; if (!L) { navigate(kind); return; }
    var items = content(L[0]);
    var idx = -1;
    items.forEach(function (it, i) { if (idx < 0 && ((sel.id && it.id === sel.id) || (sel.title && it.title === sel.title))) idx = i; });
    if (idx < 0) { levelFilter = "All"; items = content(L[0]); items.forEach(function (it, i) { if (idx < 0 && ((sel.id && it.id === sel.id) || (sel.title && it.title === sel.title))) idx = i; }); }
    L[1](Math.max(0, idx));
    navigate(L[0]);
  }

  /* ---------------------------------------------------------------------
     XP, PLATFORM LEVELS, BADGES (server-authoritative; local optimistic copy)
  --------------------------------------------------------------------- */
  var XP_TABLE = { plan_step: 10, word_mastered: 2, phrase_saved: 1, grammar: 5, listening: 8, speaking: 15, writing: 20, negotiation: 25 };
  var XP_SKILL = { plan_step: "assessment", word_mastered: "vocab", phrase_saved: "vocab", grammar: "grammar", listening: "listening", speaking: "speaking", writing: "writing", negotiation: "negotiation", assessment: "assessment", streak_bonus: "assessment" };
  var XP_DAILY_CAP = 300;
  var BADGES = {
    first_lesson: ["🎒", "First lesson", "Birinchi dars"], streak_7: ["🔥", "7-day streak", "7 kunlik seriya"], streak_30: ["🌋", "30-day streak", "30 kunlik seriya"],
    words_100: ["📚", "100 words mastered", "100 ta so‘z o‘zlashtirildi"], words_500: ["🏛️", "500 words mastered", "500 ta so‘z o‘zlashtirildi"],
    first_negotiation: ["🤝", "First negotiation", "Birinchi muzokara"], first_speech: ["🎤", "First speech", "Birinchi nutq"],
    b1_reached: ["🥉", "B1 reached", "B1 darajaga yetildi"], b2_reached: ["🥈", "B2 reached", "B2 darajaga yetildi"], c1_reached: ["🥇", "C1 reached", "C1 darajaga yetildi"],
    weekly_1: ["🏆", "Weekly #1", "Haftalik 1-o‘rin"],
    first_introduction: ["🤝", "First Introduction", "Birinchi tanishuv"]
  };
  function xpFor(type, score) { return type === "assessment" ? Math.round((score || 0) / 2) : (XP_TABLE[type] || 0); }
  function xpLevel(total) {
    total = Math.max(0, total || 0);
    var lv = Math.min(30, Math.floor(Math.sqrt(total / 50)) + 1);
    var cur = 50 * (lv - 1) * (lv - 1), next = lv >= 30 ? cur : 50 * lv * lv;
    return { level: lv, current: cur, nextAt: next, pct: lv >= 30 ? 100 : clamp(Math.round((total - cur) / (next - cur) * 100), 0, 100) };
  }
  function rollXpDay() { var t0 = todayStr(); if (S.xp.day !== t0) { S.xp.day = t0; S.xp.today = 0; S.xp.seen = {}; } }
  function awardXp(type, opts) {
    opts = opts || {};
    rollXpDay();
    var key = type + ":" + (opts.note || "");
    var repeatable = type === "word_mastered" || type === "phrase_saved";
    if (!repeatable && S.xp.seen[key]) return Promise.resolve({ awarded: 0, total: S.xp.total });
    var amount = Math.min(xpFor(type, opts.score), Math.max(0, XP_DAILY_CAP - S.xp.today));
    if (amount <= 0) return Promise.resolve({ awarded: 0, total: S.xp.total, capped: true }); // cap reached: do not consume the dedup key
    S.xp.seen[key] = 1;
    var skill = XP_SKILL[type] || "assessment";
    S.xp.total += amount; S.xp.today += amount;
    S.xp.bySkill[skill] = (S.xp.bySkill[skill] || 0) + amount;
    S.xp.history[todayStr()] = (S.xp.history[todayStr()] || 0) + amount;
    checkLocalBadges(type, opts);
    if (amount > 0) toast("+" + amount + " XP", "xp");
    refreshChrome(); save();
    var payload = { p_type: type, p_score: opts.score == null ? null : Math.round(opts.score), p_meta: Object.assign({ note: opts.note || "", cefr: cefr() }, opts.meta || {}) };
    if (!online()) return Promise.resolve({ awarded: amount, total: S.xp.total });
    return sendXp(payload).then(function (d) { applyXpResponse(d); return { awarded: d.awarded, total: d.total_xp }; })
      .catch(function () { S.xp.queue.push(payload); save(); return { awarded: amount, total: S.xp.total }; });
  }
  function sendXp(payload) { return window.ELH_AUTH.client.rpc("award_xp", payload).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function applyXpResponse(d) {
    if (!d) return;
    if (d.total_xp != null) S.xp.total = d.total_xp;
    if (d.today_xp != null) S.xp.today = d.today_xp;
    if (d.streak != null) S.streak.count = d.streak;
    (d.new_badges || []).forEach(grantBadge);
    refreshChrome(); save();
  }
  function flushXpQueue() {
    if (!online() || !S.xp.queue.length) return;
    var q = S.xp.queue.slice(); S.xp.queue = [];
    (function next() {
      if (!q.length) { save(); return; }
      var p = q.shift();
      sendXp(p).then(function (d) { applyXpResponse(d); next(); }).catch(function () { S.xp.queue.push(p); save(); });
    })();
  }
  function grantBadge(code) {
    if (!BADGES[code] || S.badges.some(function (b) { return b.code === code; })) return;
    S.badges.push({ code: code, earned_at: new Date().toISOString() });
    var m = BADGES[code]; toast(m[0] + " " + tr("Badge earned: ", "Nishon olindi: ") + tr(m[1], m[2]), "good");
  }
  function checkLocalBadges(type, opts) {
    if (online()) return; // the server evaluates badges when signed in
    if (type === "plan_step") grantBadge("first_lesson");
    if (type === "negotiation") grantBadge("first_negotiation");
    if (type === "speaking" && opts.meta && opts.meta.kind === "speech") grantBadge("first_speech");
    if (S.streak.count >= 7) grantBadge("streak_7");
    if (S.streak.count >= 30) grantBadge("streak_30");
    var m = countMastered(); if (m >= 100) grantBadge("words_100"); if (m >= 500) grantBadge("words_500");
  }
  // Map legacy activity types (recordActivity) to XP types.
  function awardForActivity(type, score, note) {
    var map = { grammar: ["grammar"], listening: ["listening"], speaking: ["speaking"], conference: ["speaking", { kind: "speech" }], difficult: ["speaking", { kind: "difficult" }],
      phrases: ["speaking", { kind: "phrase" }], negotiation: ["negotiation"], writing: ["writing"], feed: ["plan_step"], import: ["plan_step"], qualifications: ["plan_step"],
      phrase_saved: ["phrase_saved"], assessment: ["assessment"] };
    var m = map[type]; if (!m) return;
    awardXp(m[0], { score: score, note: note, meta: m[1] || {} });
  }
  // Pull authoritative totals from the server (signed-in only).
  var statsCache = null;
  function refreshStats() {
    if (!online()) return Promise.resolve(null);
    return window.ELH_AUTH.client.rpc("get_my_stats").then(function (r) {
      if (r.error) throw r.error;
      var d = r.data; if (!d) return null;
      statsCache = d;
      S.xp.total = d.total_xp || 0; S.xp.bySkill = d.by_skill || {};
      if (d.streak != null) S.streak.count = d.streak;
      if (d.badges && d.badges.length) S.badges = d.badges.map(function (b) { return { code: b.code, earned_at: b.earned_at }; });
      if (d.cefr_level) S.profile.level = d.cefr_level;
      refreshChrome(); save();
      return d;
    }).catch(function (e) { console.warn("get_my_stats", e); return null; });
  }

  /* ---------------------------------------------------------------------
     CEFR LEVELS: placement & level-up tests (server-validated when online)
  --------------------------------------------------------------------- */
  var LOCKED_BELOW = { negotiation: "B1", difficult: "B1", speeches: "B1" };
  function isLocked(view) { var need = LOCKED_BELOW[view]; if (!need) return false; var lv = cefr(); if (!lv) return false; return LEVELS.indexOf(lv) < LEVELS.indexOf(need); }
  function renderLocked(host, view) {
    host.innerHTML = '<div class="section-head"><div><h1>🔒 ' + esc(NAV_LABEL[view] || view) + '</h1><p>' +
      tr("This module unlocks at " + LOCKED_BELOW[view] + ". Build your foundations first — vocabulary, phrases, grammar and listening at your level — then pass the " + LOCKED_BELOW[view] + " level test.",
         "Bu bo‘lim " + LOCKED_BELOW[view] + " darajada ochiladi. Avval o‘z darajangizda lug‘at, iboralar, grammatika va tinglashni mustahkamlang, so‘ng " + LOCKED_BELOW[view] + " daraja testini topshiring.") + '</p></div></div>' +
      cefrPathCard() + '<div class="btn-row"><button class="btn primary" data-go="today">📅 ' + tr("Go to today’s plan", "Bugungi rejaga o‘tish") + '</button><button class="btn" data-go="vocab">📚 ' + tr("Vocabulary", "Lug‘at") + '</button></div>';
    wireCefr(host); wireGo(host);
  }
  function setCefr(level, source) {
    if (LEVELS.indexOf(level) < 0) return;
    var prev = S.profile.level;
    S.profile.level = level;
    if (prev !== level) S.cefr.levelSetXp = S.xp.total;
    if (level === "A2" && !S.settings.uzChosen) S.settings.uz = true;
    refreshChrome(); buildShell(); save();
    if (prev && prev !== level && LEVELS.indexOf(level) > LEVELS.indexOf(prev)) toast("🎉 " + tr("Level up! You are now " + level + ".", "Tabriklaymiz! Endi sizning darajangiz " + level + "."), "good");
  }
  function seedIndicators(details, score) {
    var sec = (details && details.sections) || {};
    var pct = function (s) { return s && s.total ? Math.round(s.correct / s.total * 100) : Math.round(score || 0); };
    var vocabP = pct(sec.vocabulary), gramP = pct(sec.grammar), listP = pct(sec.listening);
    var map = { vocabulary: vocabP, terminology: vocabP, grammar: gramP, listening: listP, pronunciation: listP };
    D.INDICATORS.forEach(function (i) { var v = map[i.key] != null ? map[i.key] : Math.round((score || 0) * 0.8); S.indicators[i.key] = { current: clamp(v, 0, 100), previous: clamp(v, 0, 100), target: 90 }; });
  }
  function recordTest(kind, from, result, score, details) {
    score = Math.round(score || 0);
    S.cefr.tests.push({ kind: kind, from: from, result: result, score: score, date: todayStr(), details: details || {} });
    if (kind === "placement") { S.cefr.placementAt = new Date().toISOString(); seedIndicators(details, score); }
    else S.cefr.lastLevelUpAt = new Date().toISOString();
    var passed = kind === "placement" || score >= 75;
    if (!online()) { if (passed) setCefr(result, kind); else toast(tr("Not passed yet (" + score + "%). You need 75% — keep practising.", "Hali o‘tilmadi (" + score + "%). 75% kerak — mashq qilishda davom eting."), "warn"); save(); return Promise.resolve({ ok: true, cefr_level: cefr() }); }
    return window.ELH_AUTH.client.rpc("record_level_test", { p_kind: kind, p_from: from, p_result: result, p_score: score, p_details: details || {} }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      if (d.ok === false && d.error === "too_soon") { toast(tr("The placement test can be retaken after 30 days.", "Darajani aniqlash testini 30 kundan keyin qayta topshirish mumkin."), "warn"); }
      else if (d.cefr_level) { setCefr(d.cefr_level, kind); if (kind === "level_up" && d.cefr_level === from) toast(tr("Not passed yet (" + score + "%). You need 75% — keep practising.", "Hali o‘tilmadi (" + score + "%). 75% kerak — mashq qilishda davom eting."), "warn"); }
      (d.new_badges || []).forEach(grantBadge);
      window.ELH_AUTH.refreshProfile();
      save();
      return d;
    });
  }
  function canRetakePlacement() {
    var p = window.ELH_AUTH && window.ELH_AUTH.profile();
    var at = (p && p.placement_taken_at) || S.cefr.placementAt;
    if (!at) return true;
    return Date.now() - new Date(at).getTime() > 30 * 864e5;
  }
  var LEVEL_NAMES = { A2: ["Elementary", "Boshlang‘ich"], B1: ["Intermediate", "O‘rta"], B2: ["Upper-intermediate", "Yuqori o‘rta"], C1: ["Advanced", "Ilg‘or"] };
  function cefrPathCard() {
    var lv = cefr(), idx = LEVELS.indexOf(lv), next = LEVELS[idx + 1];
    var since = Math.max(0, S.xp.total - (S.cefr.levelSetXp || 0)), need = 300;
    var pct = next ? clamp(Math.round(since / need * 100), 0, 100) : 100;
    var cooldown = S.cefr.lastLevelUpAt && (Date.now() - new Date(S.cefr.lastLevelUpAt).getTime() < 7 * 864e5);
    var nodes = LEVELS.map(function (l, i) { return '<div class="cefr-node ' + (lv ? (i < idx ? "done" : i === idx ? "current" : "") : "") + '"><div class="dot">' + l + '</div><small>' + tr(LEVEL_NAMES[l][0], LEVEL_NAMES[l][1]) + '</small></div>'; }).join("");
    var body;
    if (!lv) body = '<p class="small muted mt">' + tr("Take the placement test (about 15 minutes) to set your starting level.", "Boshlang‘ich darajangizni aniqlash uchun testni topshiring (taxminan 15 daqiqa).") + '</p><button class="btn primary" id="cefr-place">🎯 ' + tr("Start placement test", "Darajani aniqlash testini boshlash") + '</button>';
    else if (!next) body = '<div class="small mt good-word">🏅 ' + tr("You have reached C1 — the top of the path. Keep your streak alive!", "Siz C1 ga yetdingiz — yo‘lning cho‘qqisi. Seriyani davom ettiring!") + '</div>';
    else body = '<div class="flex between small muted mt"><span>' + tr("Preparation for the " + next + " level test", next + " daraja testiga tayyorgarlik") + '</span><span>' + since + ' / ' + need + ' XP</span></div>' + bar(pct) +
      '<div class="btn-row mt"><button class="btn ' + (pct >= 100 ? "primary" : "") + '" id="cefr-test"' + (cooldown ? " disabled" : "") + '>🧪 ' + tr("Take the " + next + " level test", next + " daraja testini topshirish") + '</button>' +
      (cooldown ? '<span class="small muted">' + tr("Next attempt in 7 days", "Keyingi urinish 7 kundan keyin") + '</span>' : '<span class="small muted">' + tr("Pass with 75 % to move up", "O‘tish uchun 75 % kerak") + '</span>') + '</div>';
    return '<div class="card mb cefr-card"><div class="flex between wrap"><h3>🧭 ' + tr("Your CEFR path", "CEFR yo‘lingiz") + '</h3>' + (lv ? '<span class="pill level">' + lv + ' → C1</span>' : '') + '</div><div class="cefr-track mt">' + nodes + '</div>' + body + '</div>';
  }
  function wireCefr(host) {
    var b = $("#cefr-test", host);
    if (b) b.onclick = function () { var lv = cefr(), next = LEVELS[LEVELS.indexOf(lv) + 1]; if (!window.ELH_PLACEMENT) { toast("Placement module missing.", "warn"); return; } window.ELH_PLACEMENT.start({ kind: "level_up", fromLevel: lv, targetLevel: next }); };
    var p = $("#cefr-place", host);
    if (p) p.onclick = function () { if (!window.ELH_PLACEMENT) { toast("Placement module missing.", "warn"); return; } window.ELH_PLACEMENT.start({ kind: "placement", fromLevel: cefr() }); };
  }
  function xpCard() {
    var L = xpLevel(S.xp.total);
    return '<div class="card mb xp-card"><div class="flex between wrap"><h3>⚡ ' + tr("Platform level", "Platforma darajasi") + ' ' + L.level + '</h3><span class="small muted">' + S.xp.total + ' XP · ' + tr("today", "bugun") + ' ' + S.xp.today + '/' + XP_DAILY_CAP + '</span></div>' + bar(L.pct) +
      '<div class="small muted mt">' + (L.level >= 30 ? tr("Maximum level reached.", "Maksimal darajaga yetildi.") : (L.nextAt - S.xp.total) + ' XP ' + tr("to level", "— keyingi daraja:") + ' ' + (L.level + 1)) + '</div>' +
      '<div class="badge-row mt">' + Object.keys(BADGES).map(function (c) { var has = S.badges.some(function (b) { return b.code === c; }); return '<span class="badge-chip ' + (has ? "on" : "") + '" title="' + esc(tr(BADGES[c][1], BADGES[c][2])) + '" aria-label="' + esc(tr(BADGES[c][1], BADGES[c][2])) + (has ? "" : " (locked)") + '">' + BADGES[c][0] + '</span>'; }).join("") + '</div></div>';
  }

  /* ---------------------------------------------------------------------
     VIEW: DASHBOARD
  --------------------------------------------------------------------- */
  VIEWS.dashboard = function (host) {
    var plan = D.DAILY_PLANS[(new Date().getDay()) % D.DAILY_PLANS.length];
    var tot = S.totals;
    var weak = weakestIndicators(3), strong = strongestIndicators(3);
    var q = D.DIFFICULT[plan.question];
    var lv = cefr(), L = xpLevel(S.xp.total);

    host.innerHTML =
      '<div class="section-head"><div><h1>' + tr("Good day", "Xayrli kun") + ', ' + esc(S.profile.name) + '</h1>' +
      '<p>' + (lv ? tr("Your daily environment for advancing from " + lv + " to C1 — professional English for education leadership.", lv + " dan C1 gacha — ta’lim rahbarlari uchun professional ingliz tili muhiti.")
                  : tr("Take the placement test to unlock a personal path from A2 to C1.", "A2 dan C1 gacha shaxsiy yo‘lni ochish uchun darajani aniqlash testini topshiring.")) + '</p></div>' +
      '<div class="btn-row"><button class="btn primary" id="dash-start">▶ ' + tr("Start today’s plan", "Bugungi rejani boshlash") + '</button>' + (VIEWS.leaderboard ? '<button class="btn" data-go="leaderboard">🏆 ' + tr("Leaderboard", "Reyting") + '</button>' : '') + '</div></div>' +

      '<div class="kpi-band mb">' +
      kpi(tr("CEFR level", "CEFR daraja"), lv || "—", "🎓") + kpi(tr("Platform level", "Platforma darajasi"), "Lv " + L.level, "⚡") +
      kpi("XP", S.xp.total, "✨") + kpi(tr("Day streak", "Kunlik seriya"), S.streak.count + "🔥", "🔥") +
      '</div>' +

      '<div class="grid cols-2 mb">' + cefrPathCard() + xpCard() + '</div>' +

      '<div class="grid cols-4 mb">' +
      miniStat(tr("Learning time", "O‘qish vaqti"), (tot.timeMin) + " min", "⏱️") + miniStat(tr("Lessons", "Darslar"), tot.lessons, "✅") +
      miniStat(tr("Words mastered", "O‘zlashtirilgan so‘zlar"), countMastered(), "📚") + miniStat(tr("Phrases saved", "Saqlangan iboralar"), S.savedPhrases.length, "💬") +
      miniStat(tr("Speaking sessions", "Nutq mashqlari"), tot.speaking, "🎙️") + miniStat(tr("Negotiations", "Muzokaralar"), tot.negotiations, "🤝") +
      miniStat(tr("Speeches prepared", "Tayyorlangan nutqlar"), tot.speeches, "🎤") + miniStat(tr("Overall", "Umumiy"), overallScore(), "🧭") +
      '</div>' +

      '<div class="grid cols-3 mb">' +
      '<div class="card" style="grid-column: span 2"><h3>' + tr("Professional competencies", "Professional kompetensiyalar") + '</h3><div class="card-sub mb">' + tr("Twelve core indicators — current vs previous vs target (90).", "12 ta asosiy ko‘rsatkich — joriy, avvalgi va maqsad (90).") + '</div><div id="ind-list"></div></div>' +
      '<div class="card"><h3>' + tr("Today at a glance", "Bugun qisqacha") + '</h3>' +
      dashLine(tr("Topic", "Mavzu"), plan.topic) + dashLine(tr("Vocabulary target", "Lug‘at maqsadi"), "10 " + plan.vocab + " terms") +
      dashLine(tr("Speaking challenge", "Nutq topshirig‘i"), plan.speaking) + dashLine(tr("Negotiation", "Muzokara"), negTitle(plan.negotiation)) +
      '<div class="divider"></div><div class="small muted">' + tr("Difficult question of the day", "Kunning qiyin savoli") + '</div><p style="font-weight:600">' + esc(q.q) + '</p>' +
      '<button class="btn sm" data-go="difficult">' + (isLocked("difficult") ? "🔒 " : "") + tr("Practise it →", "Mashq qilish →") + '</button></div>' +
      '</div>' +

      '<div class="grid cols-3">' +
      '<div class="card"><h3>' + tr("Recommended today", "Bugungi tavsiyalar") + '</h3><div id="recs"></div></div>' +
      '<div class="card"><h3>' + tr("Strengths", "Kuchli tomonlar") + '</h3>' + strong.map(function (i) { return '<div class="flex between" style="padding:6px 0"><span>' + i.ico + ' ' + i.name + '</span><b class="good-word">' + S.indicators[i.key].current + '</b></div>'; }).join("") + '</div>' +
      '<div class="card"><h3>' + tr("Focus areas", "Diqqat markazida") + '</h3>' + weak.map(function (i) { return '<div style="padding:6px 0"><div class="flex between"><span>' + i.ico + ' ' + i.name + '</span><b style="color:var(--rose)">' + S.indicators[i.key].current + '</b></div><div class="small muted">' + esc(i.tip) + '</div></div>'; }).join("") + '</div>' +
      '</div>';

    // indicator list
    var list = $("#ind-list", host);
    D.INDICATORS.forEach(function (i) {
      var ind = S.indicators[i.key];
      var row = el("div", { class: "indicator-row" });
      row.innerHTML = '<span class="name">' + i.ico + ' ' + i.name + '</span>' + bar(ind.current) +
        '<span class="val">' + ind.current + ' ' + trendArrow(ind.current, ind.previous) + '</span>';
      list.appendChild(row);
    });

    // recommendations from weakest
    var recs = $("#recs", host);
    weakestIndicators(4).forEach(function (i) {
      var r = el("div", { class: "mb" });
      r.innerHTML = '<div style="font-weight:600">' + i.ico + ' ' + i.name + '</div><div class="small muted">' + esc(recommendationReason(i)) + '</div>' +
        '<button class="btn sm mt" data-go="' + i.activity + '">' + (isLocked(i.activity) ? "🔒 " : "") + esc(i.tip) + '</button>';
      recs.appendChild(r);
    });

    $("#dash-start", host).onclick = function () { navigate("today"); };
    wireCefr(host);
    wireGo(host);
    if (online() && !statsCache) refreshStats().then(function (d) { if (d && currentView === "dashboard") navigate("dashboard"); });
  };
  function kpi(l, v, ico) { return '<div class="kpi"><div class="lbl">' + esc(l) + '</div><div class="num">' + esc(v) + '</div></div>'; }
  function miniStat(l, v, ico) { return '<div class="card stat"><div class="ico-badge" style="background:var(--surface-2)">' + ico + '</div><span class="num">' + esc(v) + '</span><span class="lbl">' + esc(l) + '</span></div>'; }
  function dashLine(l, v) { return '<div class="flex between" style="padding:5px 0;border-bottom:1px dashed var(--border)"><span class="small muted">' + esc(l) + '</span><span class="small" style="font-weight:600;text-align:right;max-width:60%">' + esc(v) + '</span></div>'; }
  function negTitle(id) { var n = D.NEGOTIATIONS.filter(function (x) { return x.id === id; })[0]; return n ? n.title : id; }
  function wireGo(host) { $$("[data-go]", host).forEach(function (b) { b.onclick = function () { navigate(b.dataset.go); }; }); }

  /* ---------------------------------------------------------------------
     VIEW: TODAY'S PLAN
  --------------------------------------------------------------------- */
  var LENGTHS = { 15: "Quick", 30: "Standard", 45: "Professional", 60: "Intensive" };
  VIEWS.today = function (host) {
    var plan = D.DAILY_PLANS[(new Date().getDay()) % D.DAILY_PLANS.length];
    var len = S.settings.dailyLength;
    var done = S.todayDonePlan[todayStr()] || [];
    var steps = buildPlanSteps(plan, len);

    host.innerHTML =
      '<div class="section-head"><div><h1>' + tr("Today’s Plan", "Bugungi reja") + ' — ' + esc(plan.topic) + '</h1><p>' + tr("An adaptive " + len + "-minute programme at your level (" + (cefr() || "—") + "). Mark each step done to earn 10 XP. Future activities shift toward your weaker skills automatically.", "Darajangizga mos (" + (cefr() || "—") + ") " + len + " daqiqalik moslashuvchan dastur. Har bir bosqichni bajarib 10 XP oling.") + '</p></div></div>' +
      '<div class="card mb"><div class="flex wrap between"><div><b>Session length</b><div class="small muted">Choose how long you have today.</div></div>' +
      '<div class="chip-row" id="len-row">' + Object.keys(LENGTHS).map(function (k) { return '<button class="chip ' + (+k === len ? "on" : "") + '" data-len="' + k + '">' + k + ' min · ' + LENGTHS[k] + '</button>'; }).join("") + '</div></div></div>' +
      '<div class="card"><div class="flex between mb"><h3>Programme</h3><span class="small muted">' + done.length + '/' + steps.length + ' complete</span></div><div id="steps"></div></div>' +
      '<div class="card mt"><h3>Why this order?</h3><p class="small muted">The plan front-loads your weakest competencies. Right now those are: ' +
      weakestIndicators(3).map(function (i) { return "<b>" + i.name + "</b>"; }).join(", ") + '. Complete activities to update your scores and re-balance tomorrow’s plan.</p></div>';

    var stepsHost = $("#steps", host);
    steps.forEach(function (st, idx) {
      var isDone = done.indexOf(idx) >= 0;
      var row = el("div", { class: "flex between", style: "padding:12px 0;border-bottom:1px solid var(--border)" });
      row.innerHTML = '<div class="flex"><div class="ico-badge" style="background:var(--surface-2);width:34px;height:34px">' + st.ico + '</div>' +
        '<div><div style="font-weight:600">' + esc(st.title) + (isDone ? ' <span class="good-word">✓</span>' : '') + '</div><div class="small muted">' + st.min + ' min · ' + esc(st.desc) + '</div></div></div>' +
        '<div class="btn-row"><button class="btn sm ' + (isDone ? '' : 'primary') + '" data-go="' + st.view + '">' + (isDone ? tr('Review', 'Takrorlash') : tr('Begin', 'Boshlash')) + '</button>' +
        (isDone ? '' : '<button class="btn sm ghost" data-done="' + idx + '" title="+10 XP">✓ ' + tr('Done', 'Bajarildi') + '</button>') + '</div>';
      stepsHost.appendChild(row);
    });
    $$("[data-done]", host).forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.done, d = S.todayDonePlan[todayStr()] || (S.todayDonePlan[todayStr()] = []);
        if (d.indexOf(i) < 0) { d.push(i); S.totals.lessons += 1; S.totals.timeMin += steps[i].min; bumpStreak(); awardXp("plan_step", { note: todayStr() + "#" + i }); }
        save(); navigate("today");
      };
    });

    $$("#len-row .chip", host).forEach(function (c) { c.onclick = function () { S.settings.dailyLength = +c.dataset.len; save(); navigate("today"); }; });
    wireGo(host);
    // mark this plan visit as an activity
  };
  function buildPlanSteps(plan, len) {
    var base = [
      { title: "Professional vocabulary", ico: "📚", desc: plan.vocab + " terms with spaced repetition", view: "vocab", min: 5 },
      { title: "Modern phrases & collocations", ico: "💬", desc: "High-level meeting language", view: "phrases", min: 5 },
      { title: "Listening / shadowing", ico: "🎧", desc: "Conference & meeting extracts", view: "listening", min: len >= 30 ? 8 : 5 },
      { title: "Speaking practice", ico: "🎙️", desc: plan.speaking, view: "speaking", min: 10 },
      { title: "Professional scenario", ico: "🤝", desc: negTitle(plan.negotiation), view: "negotiation", min: len >= 30 ? 8 : 5 },
      { title: "Reflection & review", ico: "🧭", desc: "Difficult question + progress check", view: "difficult", min: 5 }
    ];
    if (len <= 15) return [base[0], base[3], base[5]];
    if (len <= 30) return base.slice();
    if (len <= 45) { base.splice(4, 0, { title: "Conference speech drill", ico: "🎤", desc: "Rehearse opening remarks", view: "speeches", min: 7 }); return base; }
    base.splice(4, 0, { title: "Conference speech drill", ico: "🎤", desc: "Rehearse opening remarks", view: "speeches", min: 7 });
    base.splice(5, 0, { title: "Writing improvement", ico: "📝", desc: "Draft an official statement", view: "writing", min: 8 });
    return base;
  }

  /* ---------------------------------------------------------------------
     VIEW: VOCABULARY LAB
  --------------------------------------------------------------------- */
  var vocabFilter = "All", vocabIdx = 0, vocabMode = "flash";
  VIEWS.vocab = function (host) {
    var due = dueVocab().length;
    host.innerHTML =
      '<div class="section-head"><div><h1>' + tr("Professional Vocabulary Laboratory", "Professional lug‘at laboratoriyasi") + '</h1><p>' + merged("vocabulary").length + ' ' + tr("curated terms across", "ta atama,") + ' ' + D.VOCAB_TOPICS.length + ' ' + tr("education-leadership domains.", "ta soha.") + ' ' + due + ' ' + tr("due for review today.", "tasi bugun takrorlanadi.") + '</p></div>' +
      '<div class="btn-row"><button class="btn ' + (vocabMode === "flash" ? "primary" : "") + '" data-mode="flash">Flashcards</button><button class="btn ' + (vocabMode === "quiz" ? "primary" : "") + '" data-mode="quiz">Quiz</button><button class="btn ' + (vocabMode === "match" ? "primary" : "") + '" data-mode="match">Match</button></div></div>' +
      '<div class="chip-row mb" id="vf"><button class="chip ' + (vocabFilter === "All" ? "on" : "") + '" data-f="All">All</button>' +
      D.VOCAB_TOPICS.map(function (t) { return '<button class="chip ' + (vocabFilter === t ? "on" : "") + '" data-f="' + esc(t) + '">' + esc(t) + '</button>'; }).join("") + '</div>' +
      '<div id="vbody"></div>';

    addLevelChips(host, function () { vocabIdx = 0; });
    $$("#vf .chip", host).forEach(function (c) { c.onclick = function () { vocabFilter = c.dataset.f; vocabIdx = 0; navigate("vocab"); }; });
    $$("[data-mode]", host).forEach(function (b) { b.onclick = function () { vocabMode = b.dataset.mode; vocabIdx = 0; navigate("vocab"); }; });

    var items = vocabItems();
    if (!items.length) { $("#vbody", host).innerHTML = emptyState("No terms in this filter."); return; }
    if (vocabMode === "flash") renderFlash($("#vbody", host), items);
    else if (vocabMode === "quiz") renderQuiz($("#vbody", host), items);
    else renderMatch($("#vbody", host), items);
  };
  function vocabItems() { var all = content("vocabulary"); return vocabFilter === "All" ? all : all.filter(function (v) { return v.topic === vocabFilter; }); }

  function renderFlash(host, items) {
    vocabIdx = clamp(vocabIdx, 0, items.length - 1);
    var v = items[vocabIdx];
    var st = vocabState(v.term);
    host.innerHTML =
      '<div class="flashcard" id="fc"><div class="flashcard-inner">' +
      '<div class="flash-face front"><div class="pos">' + esc(v.pos) + ' · ' + esc(v.topic) + '</div><div class="term">' + esc(v.term) + '</div><div class="pron">' + esc(v.pron) + '</div>' +
      '<div class="mt"><button class="btn sm" id="say">🔊 Pronounce</button></div><div class="faint small mt2">Tap card to reveal →</div>' +
      '<div class="mt" style="margin-top:auto"><span class="tag">' + esc(st.mastery) + '</span></div></div>' +
      '<div class="flash-face back"><div><b>Definition.</b> ' + esc(v.def) + uz(v.uz) + '</div>' +
      '<div class="mt small"><b>Example.</b> <i>' + esc(v.example) + '</i></div>' +
      (v.collocations.length ? '<div class="mt small"><b>Collocations.</b> ' + v.collocations.map(esc).join(", ") + '</div>' : '') +
      (v.synonyms.length ? '<div class="small"><b>Synonyms.</b> ' + v.synonyms.map(esc).join(", ") + '</div>' : '') +
      (v.meeting ? '<div class="small mt"><b>In a meeting:</b> ' + esc(v.meeting) + '</div>' : '') +
      (v.speech ? '<div class="small"><b>In a speech:</b> ' + esc(v.speech) + '</div>' : '') +
      (v.mistakes ? '<div class="small mt" style="color:var(--rose)"><b>Watch out:</b> ' + esc(v.mistakes) + '</div>' : '') +
      '</div></div></div>' +
      '<div class="flex between mt2"><button class="btn" id="prev">← Prev</button>' +
      '<div class="btn-row"><button class="btn danger" data-q="1">Hard</button><button class="btn" data-q="3">Good</button><button class="btn primary" data-q="5">Easy</button></div>' +
      '<button class="btn" id="next">Next →</button></div>' +
      '<div class="center small muted mt">' + (vocabIdx + 1) + ' / ' + items.length + '</div>';

    var fc = $("#fc", host);
    fc.onclick = function (e) { if (e.target.id === "say") return; fc.classList.toggle("flipped"); };
    $("#say", host).onclick = function (e) { e.stopPropagation(); speak(v.term + ". " + v.example, 0.95); };
    $("#prev", host).onclick = function () { vocabIdx = (vocabIdx - 1 + items.length) % items.length; renderFlash(host, items); };
    $("#next", host).onclick = function () { vocabIdx = (vocabIdx + 1) % items.length; renderFlash(host, items); };
    $$("[data-q]", host).forEach(function (b) {
      b.onclick = function () {
        reviewVocab(v.term, +b.dataset.q);
        toast(v.term + " → " + vocabState(v.term).mastery + " (next review " + vocabState(v.term).due + ")", "good");
        recordActivity("vocabulary", +b.dataset.q >= 4 ? 88 : (+b.dataset.q >= 3 ? 72 : 55), ["vocabulary", "terminology"], v.term);
        S.totals.timeMin += 1; save();
        vocabIdx = (vocabIdx + 1) % items.length; renderFlash(host, items);
      };
    });
  }

  function renderQuiz(host, items) {
    var pool = items.slice();
    var v = pool[Math.floor(Math.abs(hash(todayStr() + vocabIdx + vocabFilter)) % pool.length)];
    var choices = shuffle([v].concat(pickOthers(v, 3))).map(function (x) { return x.def; });
    host.innerHTML = '<div class="card"><div class="pos" style="color:var(--accent)">Choose the correct definition</div><h2>' + esc(v.term) + '</h2><div id="qc" class="mt"></div><div id="qfb" class="mt"></div>' +
      '<button class="btn mt2" id="qnext" style="display:none">Next term →</button></div>';
    var qc = $("#qc", host);
    choices.forEach(function (c) {
      var b = el("button", { class: "btn block mb", style: "text-align:left" }, esc(c));
      b.onclick = function () {
        $$("#qc .btn", host).forEach(function (x) { x.disabled = true; });
        var correct = c === v.def;
        b.classList.add(correct ? "primary" : "danger");
        $("#qfb", host).innerHTML = correct ? '<div class="good-word">✓ Correct.</div>' : '<div class="err-word">✗ Correct answer:</div> ' + esc(v.def);
        recordActivity("vocabulary", correct ? 90 : 50, ["terminology", "vocabulary"], v.term);
        if (correct) reviewVocab(v.term, 4);
        S.totals.timeMin += 1; save();
        $("#qnext", host).style.display = "";
      };
      qc.appendChild(b);
    });
    $("#qnext", host).onclick = function () { vocabIdx++; renderQuiz(host, items); };
  }

  function renderMatch(host, items) {
    var set = shuffle(items.slice()).slice(0, Math.min(5, items.length));
    var terms = shuffle(set.slice()), defs = shuffle(set.slice());
    var selectedTerm = null, matched = 0;
    host.innerHTML = '<div class="card"><h3>Match term to definition</h3><div class="grid cols-2 mt"><div id="mt-terms"></div><div id="mt-defs"></div></div><div id="mt-fb" class="mt small muted"></div></div>';
    var tHost = $("#mt-terms", host), dHost = $("#mt-defs", host);
    terms.forEach(function (x) { var b = el("button", { class: "btn block mb", "data-term": x.term }, esc(x.term)); b.onclick = function () { selectedTerm = x.term; $$("#mt-terms .btn", host).forEach(function (y) { y.classList.remove("primary"); }); b.classList.add("primary"); }; tHost.appendChild(b); });
    defs.forEach(function (x) {
      var b = el("button", { class: "btn block mb", style: "text-align:left" }, esc(x.def));
      b.onclick = function () {
        if (!selectedTerm) { toast("Pick a term first.", "warn"); return; }
        if (selectedTerm === x.term) {
          b.classList.add("primary"); b.disabled = true;
          $$('#mt-terms [data-term="' + cssq(selectedTerm) + '"]', host).forEach(function (y) { y.disabled = true; y.classList.remove("primary"); y.classList.add("good-word"); });
          matched++; selectedTerm = null;
          if (matched === set.length) { $("#mt-fb", host).innerHTML = '<span class="good-word">All matched! Well done.</span>'; recordActivity("assessment", 85, ["terminology", "vocabulary"], "vocabulary match"); S.totals.timeMin += 2; save(); }
        } else { b.classList.add("danger"); setTimeout(function () { b.classList.remove("danger"); }, 500); }
      };
      dHost.appendChild(b);
    });
  }
  function cssq(s) { return s.replace(/"/g, '\\"'); }
  function pickOthers(v, n) { var pool = content("vocabulary"); if (pool.length < n + 1) pool = merged("vocabulary"); return shuffle(pool.filter(function (x) { return x.term !== v.term; })).slice(0, n); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.abs(hash(todayStr() + i + a.length)) % (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------------------------------------------------------------------
     VIEW: PHRASE BANK
  --------------------------------------------------------------------- */
  var phraseCat = "All";
  VIEWS.phrases = function (host) {
    host.innerHTML =
      '<div class="section-head"><div><h1>' + tr("Professional Phrase Bank", "Professional iboralar banki") + '</h1><p>' + merged("phrases").length + ' ' + tr("meeting, negotiation, diplomacy and conference phrases at every level. Save favourites and practise aloud.", "ta yig‘ilish, muzokara, diplomatiya va konferensiya iboralari. Sevimlilarni saqlang va ovoz chiqarib mashq qiling.") + '</p></div></div>' +
      '<div class="chip-row mb" id="pf"><button class="chip ' + (phraseCat === "All" ? "on" : "") + '" data-c="All">All</button>' +
      D.PHRASE_CATS.map(function (c) { return '<button class="chip ' + (phraseCat === c ? "on" : "") + '" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join("") + '</div>' +
      '<div class="grid auto" id="plist"></div>';
    addLevelChips(host);
    $$("#pf .chip", host).forEach(function (c) { c.onclick = function () { phraseCat = c.dataset.c; navigate("phrases"); }; });
    var allP = content("phrases");
    var list = phraseCat === "All" ? allP : allP.filter(function (p) { return p.category === phraseCat; });
    if (!list.length) { $("#plist", host).innerHTML = emptyState(tr("No phrases in this category at the selected level.", "Tanlangan darajada bu toifada iboralar yo‘q.")); return; }
    var plist = $("#plist", host);
    list.forEach(function (p) {
      var saved = S.savedPhrases.indexOf(p.phrase) >= 0;
      var c = el("div", { class: "card" });
      c.innerHTML = '<div class="flex between"><span class="tag ' + (p.tag === "diplomatic" ? "diplomatic" : "formal") + '">' + esc(p.formality) + (p.tag ? " · " + esc(p.tag) : "") + '</span>' +
        '<button class="icon-btn save" title="Save" style="width:30px;height:30px">' + (saved ? "★" : "☆") + '</button></div>' +
        '<p style="font-weight:600;margin-top:8px">“' + esc(p.phrase) + '”' + uz(p.uz) + '</p>' +
        '<div class="small muted">' + esc(p.situation) + '</div>' +
        (p.dialogue ? '<div class="small mt" style="background:var(--surface-2);padding:8px;border-radius:8px">' + esc(p.dialogue) + '</div>' : '') +
        (p.alternatives && p.alternatives.length ? '<div class="small mt"><b>Alternatives:</b> ' + p.alternatives.map(function (a) { return "“" + esc(a) + "”"; }).join(" · ") + '</div>' : '') +
        '<div class="btn-row mt"><button class="btn sm say">🔊 Say it</button><button class="btn sm prac">🎙️ Practise</button></div>';
      $(".say", c).onclick = function () { speak(p.phrase); };
      $(".prac", c).onclick = function () { practisePhrase(p); };
      $(".save", c).onclick = function () {
        var i = S.savedPhrases.indexOf(p.phrase);
        if (i >= 0) { S.savedPhrases.splice(i, 1); $(".save", c).textContent = "☆"; }
        else { S.savedPhrases.push(p.phrase); $(".save", c).textContent = "★"; S.totals.phrases = S.savedPhrases.length; recordActivity("phrase_saved", 80, ["diplomacy"], p.phrase); toast("Saved to phrasebook.", "good"); }
        save();
      };
      plist.appendChild(c);
    });
  };
  function practisePhrase(p) {
    modal('<h2>Practise the phrase</h2><p style="font-weight:600">“' + esc(p.phrase) + '”</p><p class="small muted">Say it aloud naturally, then compare. Focus on stress and a confident, unhurried pace.</p>' +
      '<div class="btn-row"><button class="btn primary" id="pm-say">🔊 Model</button><button class="btn" id="pm-rec">🎙️ Record me</button></div><div id="pm-out" class="mt small"></div><div class="mt2 center"><button class="btn" id="pm-close">Close</button></div>');
    $("#pm-say").onclick = function () { speak(p.phrase); };
    $("#pm-close").onclick = closeModal;
    var rec = null, running = false;
    $("#pm-rec").onclick = function () {
      if (!SR) { $("#pm-out").innerHTML = '<span class="muted">Speech recognition not available here. Read it aloud twice, comparing with the model.</span>'; return; }
      if (running) { rec && rec.stop(); return; }
      rec = makeRecognizer(function (f, i) { $("#pm-out").innerHTML = '<b>You:</b> ' + esc(f) + ' <span class="faint">' + esc(i) + '</span>'; }, function (f) {
        running = false; $("#pm-rec").textContent = "🎙️ Record me";
        var s = scoreResponse(f, { expected: p.phrase.toLowerCase().split(" ").filter(function (w) { return w.length > 4; }), targetWords: p.phrase.split(" ").length });
        $("#pm-out").innerHTML += '<div class="mt">Match & fluency: <b>' + s.overall + '</b>/100</div>';
        recordActivity("phrases", s.overall, ["diplomacy", "pronunciation"], p.phrase);
      });
      rec.start(); running = true; $("#pm-rec").textContent = "⏹ Stop";
    };
  }

  /* ---------------------------------------------------------------------
     VIEW: SPEAKING STUDIO
  --------------------------------------------------------------------- */
  var SPEAK_TASKS = [
    { title: "Read aloud", prompt: "Read this aloud clearly: “Accreditation is not a bureaucratic formality; it is a public promise of quality.”", seconds: 30, expected: ["accreditation", "quality", "promise"], keys: ["pronunciation", "fluency"] },
    { title: "One-minute speaking", prompt: "Speak for one minute: Why does quality assurance matter in higher education?", seconds: 60, expected: ["quality assurance", "trust", "students", "improvement", "accountability"], keys: ["fluency", "confidence"] },
    { title: "Two-minute policy explanation", prompt: "Explain the purpose of institutional accreditation to foreign university leaders.", seconds: 120, expected: ["public trust", "accountability", "continuous improvement", "transparency", "international comparability", "institutional autonomy", "evidence"], keys: ["fluency", "terminology", "conference"] },
    { title: "Impromptu response", prompt: "Impromptu (30s thinking): “Should universities be free to set their own standards?”", seconds: 90, expected: ["autonomy", "accountability", "standards", "balance"], keys: ["impromptu", "confidence"] },
    { title: "Describe a chart", prompt: "Describe this trend aloud: graduate employability rose from 62% to 78% over four years, then levelled off.", seconds: 60, expected: ["rose", "employability", "levelled off", "trend", "gradually"], keys: ["fluency", "grammar"] },
    { title: "Defend an opinion", prompt: "Defend: “Autonomy and accountability are partners, not opposites.” Use PREP.", seconds: 120, expected: ["autonomy", "accountability", "evidence", "example", "outcomes"], keys: ["qa", "diplomacy", "fluency"] },
    { title: "Explain a reform", prompt: "Explain a national qualifications framework to a sceptical audience.", seconds: 120, expected: ["qualifications framework", "levels", "recognition", "mobility", "consultation"], keys: ["conference", "terminology"] },
    { title: "Answer an interviewer", prompt: "An interviewer asks: “Isn’t accreditation just paperwork?” Respond persuasively.", seconds: 90, expected: ["trust", "quality", "improvement", "students", "evidence"], keys: ["qa", "diplomacy"] },
    { title: "Deliver a conference opening", prompt: "Deliver 45 seconds of conference opening remarks on the future of quality.", seconds: 60, expected: ["welcome", "colleagues", "quality", "trust", "future"], keys: ["conference", "confidence"] },
    { title: "Respond to an investor", prompt: "An investor asks why they should fund your education sector. Persuade them.", seconds: 90, expected: ["return", "reform agenda", "demand", "due diligence", "partnership"], keys: ["negotiation", "fluency"] }
  ];
  var speakTaskIdx = 1;
  VIEWS.speaking = function (host) {
    var tasks = content("speaking");
    speakTaskIdx = clamp(speakTaskIdx, 0, Math.max(0, tasks.length - 1));
    host.innerHTML =
      '<div class="section-head"><div><h1>Speaking Studio</h1><p>Prompt, timer, transcription and rule-based feedback. Uses your browser’s speech recognition where available; otherwise type your transcript.</p></div></div>' +
      '<div class="card mb"><label class="field"><span>Choose an activity</span><select id="stask">' +
      tasks.map(function (t, i) { return '<option value="' + i + '"' + (i === speakTaskIdx ? " selected" : "") + '>' + (t.level ? "[" + t.level + "] " : "") + esc(t.title) + '</option>'; }).join("") + '</select></label>' +
      '<div id="sprompt"></div></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Your response</h3>' +
      '<div class="flex between mb"><div id="timer" class="badge-score">00:00</div><div class="btn-row">' +
      '<button class="btn primary" id="rec-btn">🎙️ Start</button><button class="btn" id="model-btn">🔊 Model answer</button></div></div>' +
      '<textarea id="transcript" placeholder="Your speech is transcribed here. If speech recognition is unavailable, type your transcript, then click Evaluate."></textarea>' +
      '<div class="btn-row mt"><button class="btn primary" id="eval-btn">Evaluate</button><button class="btn ghost" id="clear-btn">Clear</button></div></div>' +
      '<div class="card"><h3>Feedback</h3><div id="feedback">' + emptyState("Record or type, then Evaluate to see fluency, terminology, filler words and a model answer.") + '</div></div></div>';

    addLevelChips(host, function () { speakTaskIdx = 0; });
    var task = tasks[speakTaskIdx];
    renderSpeakPrompt(host, task);
    $("#stask", host).onchange = function () { speakTaskIdx = +this.value; navigate("speaking"); };

    var seconds = 0, timerInt = null, rec = null, running = false;
    var timerEl = $("#timer", host), ta = $("#transcript", host);
    function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
    function startTimer() { timerInt = setInterval(function () { seconds++; timerEl.textContent = fmt(seconds); if (seconds >= task.seconds) timerEl.style.color = "var(--rose)"; }, 1000); }
    function stopTimer() { clearInterval(timerInt); }

    $("#model-btn", host).onclick = function () { var m = modelAnswerFor(task); speak(m, 0.98); toast("Playing a model answer.", ""); };
    $("#clear-btn", host).onclick = function () { ta.value = ""; seconds = 0; timerEl.textContent = "00:00"; timerEl.style.color = ""; $("#feedback", host).innerHTML = emptyState("Cleared. Ready when you are."); };

    $("#rec-btn", host).onclick = function () {
      if (running) { rec && rec.stop(); stopTimer(); running = false; $("#rec-btn", host).textContent = "🎙️ Start"; return; }
      if (!SR) { toast("Speech recognition unavailable — please type your transcript.", "warn"); ta.focus(); return; }
      ta.value = ""; seconds = 0; timerEl.textContent = "00:00"; timerEl.style.color = "";
      rec = makeRecognizer(function (f, i) { ta.value = f + i; }, function (f) { running = false; $("#rec-btn", host).textContent = "🎙️ Start"; stopTimer(); ta.value = f; });
      rec.start(); running = true; startTimer(); $("#rec-btn", host).textContent = "⏹ Stop";
    };

    $("#eval-btn", host).onclick = function () {
      var text = ta.value.trim();
      if (text.split(/\s+/).length < 8) { toast("Say or type a little more first.", "warn"); return; }
      var s = scoreResponse(text, { expected: task.expected, seconds: seconds || task.seconds, targetWords: Math.round(task.seconds * 2.2) });
      renderFeedback($("#feedback", host), s, task);
      S.totals.speaking += 1; S.totals.timeMin += Math.max(1, Math.round((seconds || task.seconds) / 60));
      recordActivity("speaking", s.overall, task.keys, task.title);
      toast("Evaluated: overall " + s.overall + "/100", s.overall >= 75 ? "good" : "");
    };
  };
  function renderSpeakPrompt(host, task) {
    $("#sprompt", host).innerHTML = '<div class="mt" style="background:var(--surface-2);padding:12px 14px;border-radius:10px"><b>Prompt.</b> ' + esc(task.prompt) +
      '<div class="small muted mt">Target: ~' + task.seconds + 's · Try to use: ' + task.expected.slice(0, 5).map(function (e) { return '<span class="tag">' + esc(e) + '</span>'; }).join(" ") + '</div></div>';
  }
  function modelAnswerFor(task) {
    if (task.model) return task.model;
    // Reuse difficult-question models where relevant; otherwise a generic strong model built from expected terms.
    if (task.title.indexOf("accreditation") >= 0 || task.title === "Two-minute policy explanation")
      return "Accreditation exists to protect public trust. It holds institutions accountable, drives continuous improvement, and gives students and employers confidence that a qualification means what it claims. Through transparent, evidence-based evaluation we make our standards internationally comparable, while respecting institutional autonomy. In short, accreditation is a public promise of quality — and our task is to make that promise deserved.";
    return "Let me answer with structure. My position is clear, and I'll support it with evidence. " +
      task.expected.slice(0, 4).map(function (t) { return "Consider " + t + ": it is central here."; }).join(" ") +
      " To conclude, the essential point is that quality and trust must go together, and everything I've described serves that end.";
  }
  function renderFeedback(host, s, task) {
    var fillerHtml = s.fillers.length ? s.fillers.slice(0, 8).map(function (f) { return '<span class="err-word">' + esc(f) + '</span>'; }).join(", ") : '<span class="good-word">none detected</span>';
    host.innerHTML =
      '<div class="flex between mb"><div class="badge-score">Overall ' + s.overall + '/100</div>' + (s.wpm ? '<span class="small muted">~' + s.wpm + ' wpm · ' + s.wc + ' words</span>' : '<span class="small muted">' + s.wc + ' words</span>') + '</div>' +
      scoreLine("Fluency", s.fluency) + scoreLine("Terminology", s.terminology) + scoreLine("Structure", s.structure) +
      '<div class="divider"></div>' +
      '<div class="small"><b>Filler words:</b> ' + fillerHtml + (s.fillerCount ? ' <span class="muted">(' + s.fillerCount + ')</span>' : '') + '</div>' +
      (s.repeated.length ? '<div class="small mt"><b>Repeated words:</b> ' + s.repeated.map(esc).join(", ") + ' — vary your vocabulary.</div>' : '') +
      '<div class="small mt"><b>Terms used:</b> ' + (s.hits.length ? s.hits.map(function (h) { return '<span class="good-word">' + esc(h) + '</span>'; }).join(", ") : '<span class="muted">none of the target terms</span>') + '</div>' +
      (s.missed.length ? '<div class="small mt"><b>Try to include:</b> ' + s.missed.map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join(" ") + '</div>' : '') +
      '<div class="divider"></div><div class="small"><b>Stronger model answer</b><div class="mt" style="background:var(--surface-2);padding:10px;border-radius:8px">' + esc(modelAnswerFor(task)) + '</div></div>' +
      '<div class="small mt"><b>Next step:</b> ' + esc(nextStepAdvice(s)) + '</div>';
  }
  function scoreLine(l, v) { return '<div class="indicator-row"><span class="name">' + l + '</span>' + bar(v) + '<span class="val">' + v + '</span></div>'; }
  function nextStepAdvice(s) {
    if (s.fillerCount > 3) return "Reduce filler words — pause silently instead of saying ‘um’. Try a shadowing exercise.";
    if (s.terminology < 60) return "Weave in more professional terminology from the vocabulary lab.";
    if (s.fluency < 65) return "Work on flow with a timed one-minute speaking drill.";
    if (s.structure < 65) return "Use a clear structure such as PREP (Point–Reason–Example–Point).";
    return "Strong. Try the same prompt at a faster pace, or move to a harder speaking task.";
  }

  /* ---------------------------------------------------------------------
     VIEW: NEGOTIATION SIMULATOR
  --------------------------------------------------------------------- */
  var negActive = null;
  VIEWS.negotiation = function (host) {
    if (negActive) return renderNegRun(host, negActive);
    host.innerHTML = '<div class="section-head"><div><h1>Negotiation Simulator</h1><p>' + merged("negotiations").length + ' interactive role-plays. You lead; the counterpart raises realistic objections. A performance report follows.</p></div></div><div class="grid auto" id="nlist"></div>';
    addLevelChips(host);
    var list = $("#nlist", host);
    content("negotiations").forEach(function (n) {
      var c = el("div", { class: "card" });
      c.innerHTML = levelTag("negotiations", n) + ' <div class="tag">' + esc(n.counterpart) + '</div><h3 style="margin-top:6px">' + esc(n.title) + '</h3><div class="small muted">' + esc(n.situation) + '</div>' +
        '<div class="small mt"><b>Your objectives:</b> ' + n.objectives.map(esc).join("; ") + '.</div>' +
        '<button class="btn primary mt block" >Start simulation</button>';
      $(".btn", c).onclick = function () { negActive = { n: n, stage: 0, log: [], scores: [] }; navigate("negotiation"); };
      list.appendChild(c);
    });
  };
  function renderNegRun(host, ses) {
    var n = ses.n;
    host.innerHTML =
      '<div class="section-head"><div><h1>' + esc(n.title) + '</h1><p>Stage ' + (ses.stage + 1) + ' of ' + n.stages.length + ' · ' + esc(n.stages[ses.stage]) + '</p></div><button class="btn ghost" id="neg-exit">Exit</button></div>' +
      '<div class="stage-track mb">' + n.stages.map(function (st, i) { return '<div class="stage-node ' + (i < ses.stage ? "done" : (i === ses.stage ? "current" : "")) + '"><div class="dot">' + (i + 1) + '</div><small>' + esc(st) + '</small></div>'; }).join("") + '</div>' +
      '<div class="grid cols-3"><div class="card" style="grid-column:span 2"><div class="chat" id="neg-chat"></div>' +
      '<div class="mt"><textarea id="neg-input" placeholder="Type your response as the education leader..."></textarea>' +
      '<div class="btn-row mt"><button class="btn primary" id="neg-send">Send</button><button class="btn" id="neg-mic">🎙️</button><button class="btn" id="neg-hint">💡 Useful phrases</button></div></div></div>' +
      '<div class="card"><h3>Your brief</h3><div class="small"><b>Role.</b> ' + esc(n.role) + '</div>' +
      '<div class="small mt"><b>Objectives.</b><ul style="margin:4px 0 0 18px">' + n.objectives.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>Confidential priorities.</b> ' + n.priorities.map(esc).join(" ") + '</div>' +
      '<div class="small mt"><b>Likely objections.</b> ' + n.objections.map(function (o) { return '“' + esc(o) + '”'; }).join(" ") + '</div></div></div>';

    var chat = $("#neg-chat", host);
    if (!ses.log.length) pushBubble(chat, ses, "them", n.counterpart, n.openings[0]);
    else ses.log.forEach(function (m) { pushBubble(chat, ses, m.side, m.who, m.text, true); });

    $("#neg-exit", host).onclick = function () { finishNegotiation(ses); };
    $("#neg-hint", host).onclick = function () { modal('<h3>Useful phrases</h3>' + n.phrases.map(function (p) { return '<p>“' + esc(p) + '”</p>'; }).join("") + '<div class="center"><button class="btn" onclick="document.getElementById(\'modal-backdrop\').classList.remove(\'open\')">Close</button></div>'); };
    var input = $("#neg-input", host);
    $("#neg-mic", host).onclick = function () {
      if (!SR) { toast("Speech recognition unavailable — please type.", "warn"); return; }
      var r = makeRecognizer(function (f, i) { input.value = f + i; }, function (f) { input.value = f; });
      r.start(); toast("Listening… click Send when done.", "");
      setTimeout(function () { r.stop(); }, 12000);
    };
    $("#neg-send", host).onclick = function () {
      var text = input.value.trim();
      if (text.split(/\s+/).length < 4) { toast("Give a fuller response.", "warn"); return; }
      pushBubble(chat, ses, "me", "You", text);
      var s = scoreResponse(text, { expected: n.phrases.join(" ").toLowerCase().match(/\b[a-z]{5,}\b/g) || [], targetWords: 40 });
      ses.scores.push(evaluateNegTurn(text, n));
      input.value = "";
      // counterpart reply
      setTimeout(function () {
        var reply = negReply(n, ses);
        pushBubble(chat, ses, "them", n.counterpart, reply);
        ses.stage = Math.min(n.stages.length - 1, ses.stage + 1);
        if (ses.stage >= n.stages.length - 1 && ses.scores.length >= n.stages.length - 1) {
          setTimeout(function () { pushBubble(chat, ses, "them", n.counterpart, "I think we have the basis for an agreement. Shall we close and capture next steps?"); }, 300);
        }
        navigateSoft(host, ses);
      }, 500);
    };
    $("#neg-send", host).nextResult = null;
    // Add a finish button when near the end
    if (ses.stage >= n.stages.length - 1) {
      var fin = el("button", { class: "btn gold mt2 block" }, "Conclude & see performance report");
      fin.onclick = function () { finishNegotiation(ses); };
      host.querySelector(".card").appendChild(fin);
    }
  }
  function navigateSoft(host, ses) { // re-render stage track & finish button without losing chat scroll
    renderNegRun(host.parentElement ? host : host, ses);
  }
  function pushBubble(chat, ses, side, who, text, silent) {
    var b = el("div", { class: "bubble " + side });
    b.innerHTML = '<span class="who">' + esc(who) + '</span>' + esc(text);
    chat.appendChild(b); chat.scrollTop = chat.scrollHeight;
    if (!silent) ses.log.push({ side: side, who: who, text: text });
  }
  function evaluateNegTurn(text, n) {
    var lower = text.toLowerCase();
    var diplomacy = /\b(understand|appreciate|however|perhaps|would|could|respect|fair point|concern)\b/.test(lower) ? 82 : 60;
    var evidence = /\b(evidence|data|because|for example|shows|track|measure)\b/.test(lower) ? 84 : 58;
    var proposal = /\b(propose|suggest|offer|if you|in return|we could|pilot|first step)\b/.test(lower) ? 85 : 60;
    var terms = n.phrases.join(" ").toLowerCase();
    var vocab = (lower.match(/\b(quality|accreditation|partnership|investment|standards|autonomy|sustainability|recognition)\b/g) || []).length;
    return { diplomacy: diplomacy, evidence: evidence, proposal: proposal, clarity: clamp(60 + Math.min(30, text.length / 8), 0, 100), vocab: clamp(55 + vocab * 8, 0, 100) };
  }
  function negReply(n, ses) {
    // Cycle through objections, then move toward agreement
    var i = ses.scores.length - 1;
    if (i < n.objections.length) {
      var pre = ses.scores[i] && ses.scores[i].diplomacy > 75 ? "That’s reasonable. " : "I hear you, but ";
      return pre + '“' + n.objections[i] + '” How would you address that?';
    }
    return "You’ve addressed my main concerns well. Let’s move toward agreement.";
  }
  function finishNegotiation(ses) {
    var n = ses.n, sc = ses.scores;
    var avg = function (k) { return sc.length ? Math.round(sc.reduce(function (a, s) { return a + s[k]; }, 0) / sc.length) : 60; };
    var report = { clarity: avg("clarity"), persuasiveness: avg("proposal"), diplomacy: avg("diplomacy"), evidence: avg("evidence"), vocab: avg("vocab") };
    var overall = Math.round((report.clarity + report.persuasiveness + report.diplomacy + report.evidence + report.vocab) / 5);
    S.totals.negotiations += 1; S.totals.timeMin += 6;
    recordActivity("negotiation", overall, ["negotiation", "diplomacy", "fluency"], n.title);
    negActive = null;
    modal(
      '<h2>Negotiation Report — ' + esc(n.title) + '</h2><div class="badge-score mb">Overall ' + overall + '/100</div>' +
      scoreLine("Clarity", report.clarity) + scoreLine("Persuasiveness", report.persuasiveness) + scoreLine("Diplomacy", report.diplomacy) + scoreLine("Use of evidence", report.evidence) + scoreLine("Professional vocabulary", report.vocab) +
      '<div class="divider"></div>' +
      '<div class="small"><b>What you did well.</b> ' + (report.diplomacy > 75 ? "You framed disagreement diplomatically. " : "") + (report.evidence > 75 ? "You backed points with evidence. " : "You kept the conversation moving.") + '</div>' +
      '<div class="small mt"><b>Missed opportunities.</b> ' + (report.evidence < 75 ? "Cite concrete evidence and examples. " : "") + (report.persuasiveness < 75 ? "Make more explicit proposals (‘If you…, we could…’). " : "") + (report.vocab < 75 ? "Use more sector-specific vocabulary. " : "Fine-tune tone under pressure.") + '</div>' +
      '<div class="small mt"><b>Stronger alternative.</b> “' + esc(n.phrases[0]) + '”</div>' +
      '<div class="small mt"><b>Vocabulary to review.</b> quality assurance, return on investment, mutual recognition, sustainability.</div>' +
      '<div class="small mt"><b>Recommended next.</b> ' + esc(D.NEGOTIATIONS[(D.NEGOTIATIONS.indexOf(n) + 1) % D.NEGOTIATIONS.length].title) + '</div>' +
      '<div class="btn-row mt2"><button class="btn primary" id="rep-close">Done</button></div>');
    $("#rep-close").onclick = function () { closeModal(); navigate("negotiation"); };
  }

  /* ---------------------------------------------------------------------
     VIEW: CONFERENCE SPEECHES
  --------------------------------------------------------------------- */
  VIEWS.speeches = function (host) {
    host.innerHTML =
      '<div class="section-head"><div><h1>Conference Speech Studio</h1><p>Generate a structured speech, then rehearse it in teleprompter mode with emphasis and pause markers.</p></div></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Build your speech</h3>' +
      field("Speech type", '<select id="sp-type">' + D.SPEECH_TYPES.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join("") + '</select>') +
      field("Event name", '<input id="sp-event" type="text" value="International Forum on Quality Assurance">') +
      field("Audience", '<input id="sp-aud" type="text" value="ministers, rectors and international experts">') +
      field("Duration (minutes)", '<input id="sp-dur" type="number" value="5" min="1" max="30">') +
      field("Purpose", '<input id="sp-purpose" type="text" value="to build support for evidence-based quality assurance">') +
      field("Main message", '<input id="sp-msg" type="text" value="Quality assurance is a public promise of trust that we must make deserved">') +
      field("Key facts (comma-separated)", '<input id="sp-facts" type="text" value="employability rose to 78%, 8-level qualifications framework, independent peer review">') +
      field("Tone", '<select id="sp-tone"><option>inspiring</option><option>authoritative</option><option>diplomatic</option><option>warm</option></select>') +
      field("Call to action", '<input id="sp-cta" type="text" value="commit to publishing your results and learning from them">') +
      '<button class="btn primary block" id="sp-gen">Generate speech</button></div>' +
      '<div class="card"><div class="flex between"><h3>Speech</h3><div class="btn-row"><button class="btn sm" id="sp-tele">🖥 Teleprompter</button><button class="btn sm" id="sp-print">🖨 Export</button></div></div>' +
      '<div id="sp-out">' + emptyState("Fill in the details and generate a structured speech.") + '</div></div></div>';

    $("#sp-gen", host).onclick = function () {
      var data = {
        type: $("#sp-type", host).value, event: $("#sp-event", host).value, aud: $("#sp-aud", host).value,
        dur: +$("#sp-dur", host).value, purpose: $("#sp-purpose", host).value, msg: $("#sp-msg", host).value,
        facts: $("#sp-facts", host).value.split(",").map(function (s) { return s.trim(); }).filter(Boolean), tone: $("#sp-tone", host).value, cta: $("#sp-cta", host).value
      };
      var speech = generateSpeech(data);
      window._lastSpeech = speech;
      renderSpeech($("#sp-out", host), speech, data);
      S.totals.speeches += 1; recordActivity("conference", 78, ["conference", "confidence"], data.type); save();
      toast("Speech generated. Estimated " + speech.estMin + " min.", "good");
    };
    $("#sp-tele", host).onclick = function () { if (!window._lastSpeech) { toast("Generate a speech first.", "warn"); return; } teleprompter(window._lastSpeech); };
    $("#sp-print", host).onclick = function () { if (!window._lastSpeech) { toast("Generate a speech first.", "warn"); return; } exportPrint("Speech — " + window._lastSpeech.title, window._lastSpeech.plain); };
  };
  function field(label, inner) { return '<label class="field"><span>' + esc(label) + '</span>' + inner + '</label>'; }
  function generateSpeech(d) {
    var greet = { inspiring: "Distinguished guests, colleagues and friends —", authoritative: "Excellencies, ladies and gentlemen,", diplomatic: "Honoured guests and dear colleagues,", warm: "Dear friends and colleagues," }[d.tone];
    var parts = [];
    parts.push({ h: "Greeting", t: greet + " welcome." });
    parts.push({ h: "Audience recognition", t: "It is a privilege to address " + d.aud + " here at " + d.event + "." });
    parts.push({ h: "Context", t: "We meet at a moment of real consequence for education. The choices we make about quality will shape the trust our systems can command for a generation." });
    parts.push({ h: "Main message", t: "My message today is simple: " + d.msg + "." });
    parts.push({ h: "Supporting evidence", t: d.facts.length ? "Consider the evidence: " + d.facts.join("; ") + "." : "The evidence points clearly in one direction." });
    parts.push({ h: "Examples", t: "In practice, this means a graduate whose diploma is trusted at home and abroad, and an institution confident enough to be examined openly." });
    parts.push({ h: "Recommendations", t: "I would recommend three things: measure what matters, publish what you measure, and act on what you find." });
    parts.push({ h: "Call to action", t: "So let me leave you with a request: " + d.cta + "." });
    parts.push({ h: "Closing statement", t: "The quality of a system is measured in one place only — in what a young person can do, and become, because of it. Let us hold ourselves to that standard. Thank you." });
    var plain = parts.map(function (p) { return p.t; }).join("\n\n");
    var words = plain.split(/\s+/).length;
    return { title: d.type + " — " + d.event, parts: parts, plain: plain, words: words, estMin: Math.max(1, Math.round(words / 130)) };
  }
  function renderSpeech(host, speech, d) {
    host.innerHTML = '<div class="small muted mb">Estimated ' + speech.estMin + ' min · ' + speech.words + ' words · target ' + d.dur + ' min</div>' +
      speech.parts.map(function (p) { return '<div class="mb"><div class="pos" style="color:var(--accent)">' + esc(p.h) + '</div><div>' + esc(p.t) + '</div></div>'; }).join("") +
      '<div class="btn-row mt"><button class="btn sm" id="sp-say">🔊 Read aloud</button></div>';
    $("#sp-say", host).onclick = function () { speak(speech.plain, 0.98); };
  }
  function teleprompter(speech) {
    modal('<div class="flex between mb"><h3>Teleprompter</h3><div class="btn-row"><button class="btn sm" id="tp-play">▶ Scroll</button><button class="btn sm" id="tp-a-">A-</button><button class="btn sm" id="tp-a+">A+</button></div></div>' +
      '<div class="teleprompter" id="tp"><div class="scroll" id="tp-scroll">' + speech.plain.split("\n\n").map(function (para) { return '<p>' + emphasize(para) + '</p>'; }).join("") + '</div></div>' +
      '<div class="flex between mt"><span class="small muted">⏱ Rehearsal timer: <b id="tp-timer">00:00</b></span><button class="btn" id="tp-close">Close</button></div>');
    var scroll = $("#tp-scroll"), tp = $("#tp"), y = 0, playing = false, raf, size = 2, t0 = null, tick;
    function frame() { if (!playing) return; y += 0.5; scroll.style.transform = "translateY(" + (-y) + "px)"; if (y < scroll.scrollHeight) raf = requestAnimationFrame(frame); }
    $("#tp-play").onclick = function () { playing = !playing; this.textContent = playing ? "⏸ Pause" : "▶ Scroll"; if (playing) { frame(); if (!t0) { t0 = Date.now(); tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); $("#tp-timer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 500); } } };
    $("#tp-a+").onclick = function () { size = Math.min(3.4, size + 0.2); tp.style.fontSize = size + "rem"; };
    $("#tp-a-").onclick = function () { size = Math.max(1.2, size - 0.2); tp.style.fontSize = size + "rem"; };
    $("#tp-close").onclick = function () { playing = false; cancelAnimationFrame(raf); clearInterval(tick); closeModal(); };
  }
  function emphasize(text) {
    // Mark the last clause and key words as emphasis, add a pause marker after long sentences.
    return esc(text).replace(/\b(quality|trust|accountability|autonomy|deserved|standard|evidence)\b/gi, '<span class="emph">$1</span>').replace(/\. /g, '. <span class="pause">/ </span>');
  }

  /* ---------------------------------------------------------------------
     VIEW: DIFFICULT QUESTIONS
  --------------------------------------------------------------------- */
  var diffIdx = 0;
  VIEWS.difficult = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Difficult Questions Laboratory</h1><p>' + merged("difficult").length + ' challenging questions from real conferences and ministerial meetings. Think, structure, answer, evaluate.</p></div></div>' +
      '<div class="grid cols-3"><div class="card"><h3>Questions</h3><div id="dq-list"></div></div>' +
      '<div class="card" style="grid-column:span 2"><div id="dq-detail"></div></div></div>';
    addLevelChips(host, function () { diffIdx = 0; });
    var list = $("#dq-list", host), dl = content("difficult");
    if (!dl.length) { list.innerHTML = emptyState("No questions at this level."); return; }
    diffIdx = clamp(diffIdx, 0, dl.length - 1);
    dl.forEach(function (q, i) {
      var b = el("button", { class: "btn block mb " + (i === diffIdx ? "primary" : ""), style: "text-align:left;white-space:normal;height:auto;padding:10px" }, levelTag("difficult", q) + ' ' + esc(q.q));
      b.onclick = function () { diffIdx = i; navigate("difficult"); };
      list.appendChild(b);
    });
    renderDifficult($("#dq-detail", host), dl[diffIdx]);
  };
  function renderDifficult(host, q) {
    host.innerHTML = '<div class="pos" style="color:var(--accent)">Structure: ' + esc(q.structure) + '</div><h2>' + esc(q.q) + '</h2>' +
      '<div class="btn-row mt"><button class="btn" id="dq-think">⏱ 20s thinking time</button><button class="btn" id="dq-model">🔊 Model answer</button></div>' +
      '<div class="small mt"><b>Useful phrases:</b> ' + q.phrases.map(function (p) { return '“' + esc(p) + '”'; }).join(" · ") + '</div>' +
      '<div class="small mt"><b>Key vocabulary:</b> ' + q.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div>' +
      '<div class="mt2"><label class="field"><span>Your answer (type or 🎙️ dictate)</span><textarea id="dq-ans" placeholder="Structure your answer using ' + esc(q.structure) + '..."></textarea></label>' +
      '<div class="btn-row"><button class="btn" id="dq-mic">🎙️ Dictate</button><button class="btn primary" id="dq-eval">Evaluate</button></div></div>' +
      '<div id="dq-fb" class="mt"></div>' +
      '<details class="mt"><summary class="small muted" style="cursor:pointer">Reveal model answer</summary><div class="small mt" style="background:var(--surface-2);padding:10px;border-radius:8px">' + esc(q.model) + '</div></details>';
    var think = null;
    $("#dq-think", host).onclick = function () {
      var s = 20, b = $("#dq-think", host); clearInterval(think);
      think = setInterval(function () { s--; b.textContent = "⏱ " + s + "s"; if (s <= 0) { clearInterval(think); b.textContent = "⏱ Go!"; speak("Your time starts now."); } }, 1000);
    };
    $("#dq-model", host).onclick = function () { speak(q.model, 0.98); };
    var ta = $("#dq-ans", host);
    $("#dq-mic", host).onclick = function () {
      if (!SR) { toast("Speech recognition unavailable — please type.", "warn"); return; }
      var r = makeRecognizer(function (f, i) { ta.value = f + i; }, function (f) { ta.value = f; });
      r.start(); toast("Listening…", ""); setTimeout(function () { r.stop(); }, 30000);
    };
    $("#dq-eval", host).onclick = function () {
      if (ta.value.trim().split(/\s+/).length < 10) { toast("Give a fuller answer.", "warn"); return; }
      var s = scoreResponse(ta.value, { expected: q.vocab, targetWords: 110 });
      $("#dq-fb", host).innerHTML = '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Overall ' + s.overall + '/100</div>' +
        scoreLine("Fluency/length", s.fluency) + scoreLine("Terminology", s.terminology) + scoreLine("Structure", s.structure) +
        '<div class="small mt"><b>Terms used:</b> ' + (s.hits.length ? s.hits.map(esc).join(", ") : "none") + '</div>' +
        (s.missed.length ? '<div class="small"><b>Include:</b> ' + s.missed.map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join(" ") + '</div>' : '') +
        '<div class="small mt"><b>Advice:</b> ' + esc(nextStepAdvice(s)) + ' Follow the ' + esc(q.structure) + ' structure.</div></div>';
      recordActivity("difficult", s.overall, ["qa", "fluency", "diplomacy"], q.q); S.totals.timeMin += 2; save();
    };
  }

  /* ---------------------------------------------------------------------
     VIEW: LISTENING & SHADOWING
  --------------------------------------------------------------------- */
  var listenIdx = 0;
  VIEWS.listening = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Listening & Shadowing Centre</h1><p>' + merged("listening").length + ' professional scripts — conference extracts, meetings, negotiations and policy explanations, with comprehension and dictation.</p></div></div>' +
      '<div class="grid cols-3"><div class="card"><h3>Scripts</h3><div id="ls-list"></div></div><div class="card" style="grid-column:span 2"><div id="ls-detail"></div></div></div>';
    addLevelChips(host, function () { listenIdx = 0; });
    var list = $("#ls-list", host), ll = content("listening");
    if (!ll.length) { list.innerHTML = emptyState("No scripts at this level."); return; }
    listenIdx = clamp(listenIdx, 0, ll.length - 1);
    ll.forEach(function (s, i) {
      var b = el("button", { class: "btn block mb " + (i === listenIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:9px" }, '<b>' + esc(s.title) + '</b><br><span class="small faint">' + esc(s.type) + ' · ' + esc(s.accent) + ' · ' + esc(s.level) + '</span>');
      b.onclick = function () { listenIdx = i; navigate("listening"); };
      list.appendChild(b);
    });
    renderListen($("#ls-detail", host), ll[listenIdx]);
  };
  function renderListen(host, s) {
    var showT = true;
    host.innerHTML = '<h2>' + esc(s.title) + '</h2><div class="small muted mb">' + esc(s.type) + ' · ' + esc(s.accent) + ' accent · ' + esc(s.level) + '</div>' +
      '<div class="btn-row mb"><button class="btn primary" id="ls-play">🔊 Normal</button><button class="btn" id="ls-slow">🐢 Slow</button><button class="btn" id="ls-shadow">🎙️ Shadow</button><button class="btn" id="ls-toggle">👁 Hide text</button></div>' +
      '<div id="ls-text" class="mt" style="background:var(--surface-2);padding:14px;border-radius:10px;line-height:1.7">' + highlightVocab(s.text, s.vocab) + '</div>' +
      '<div class="small mt"><b>Key vocabulary:</b> ' + s.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div>' +
      '<div class="divider"></div><h3>Comprehension</h3><div id="ls-q"></div>' +
      '<div class="divider"></div><h3>Dictation</h3><p class="small muted">Play a sentence, type what you hear, then check.</p>' +
      '<textarea id="ls-dict" placeholder="Type the dictation here..."></textarea><div class="btn-row mt"><button class="btn" id="ls-dplay">🔊 Play first sentence</button><button class="btn primary" id="ls-dcheck">Check</button></div><div id="ls-dfb" class="mt small"></div>';
    $("#ls-play", host).onclick = function () { speak(s.text, 1); };
    $("#ls-slow", host).onclick = function () { speak(s.text, 0.7); };
    $("#ls-shadow", host).onclick = function () { speak(s.text, 0.9); toast("Speak along about half a second behind.", ""); recordActivity("listening", 78, ["pronunciation", "listening"], s.title); S.totals.timeMin += 2; save(); };
    $("#ls-toggle", host).onclick = function () { showT = !showT; $("#ls-text", host).style.filter = showT ? "none" : "blur(6px)"; this.textContent = showT ? "👁 Hide text" : "👁 Show text"; };
    var qHost = $("#ls-q", host);
    s.questions.forEach(function (q, i) {
      var wrap = el("div", { class: "mb" });
      wrap.innerHTML = '<div class="small" style="font-weight:600">' + (i + 1) + '. ' + esc(q.q) + '</div><input type="text" placeholder="Your answer" style="margin-top:4px"><button class="btn sm mt">Check</button><span class="fb small"></span>';
      var inp = $("input", wrap), fb = $(".fb", wrap);
      $("button", wrap).onclick = function () {
        var ok = inp.value.toLowerCase().indexOf(q.a.toLowerCase().split(" ")[0]) >= 0 || q.a.toLowerCase().indexOf(inp.value.toLowerCase().trim()) >= 0 && inp.value.trim().length > 2;
        fb.innerHTML = ok ? ' <span class="good-word">✓</span>' : ' <span class="err-word">✗ ' + esc(q.a) + '</span>';
        if (ok) recordActivity("listening", 84, ["listening"], s.title);
      };
      qHost.appendChild(wrap);
    });
    var firstSentence = s.text.split(/(?<=[.!?])\s/)[0];
    $("#ls-dplay", host).onclick = function () { speak(firstSentence, 0.85); };
    $("#ls-dcheck", host).onclick = function () {
      var typed = $("#ls-dict", host).value.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
      var target = firstSentence.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      var tw = target.split(" "), yw = typed.split(" "), correct = 0;
      tw.forEach(function (w, i) { if (yw[i] === w) correct++; });
      var pct = Math.round(correct / tw.length * 100);
      $("#ls-dfb", host).innerHTML = 'Accuracy: <b>' + pct + '%</b>. ' + (pct >= 80 ? '<span class="good-word">Excellent listening.</span>' : 'Target: <i>' + esc(firstSentence) + '</i>');
      recordActivity("listening", pct, ["listening", "grammar"], "dictation"); S.totals.timeMin += 2; save();
    };
  }
  function highlightVocab(text, vocab) {
    var out = esc(text);
    vocab.forEach(function (v) { out = out.replace(new RegExp("\\b(" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i"), '<span class="hl">$1</span>'); });
    return out;
  }

  /* ---------------------------------------------------------------------
     VIEW: GRAMMAR
  --------------------------------------------------------------------- */
  var grammarIdx = 0;
  VIEWS.grammar = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Grammar for Leaders</h1><p>Not a school course — grammar for diplomacy, negotiation and formal reporting, with education-sector examples.</p></div></div>' +
      '<div class="grid cols-3"><div class="card"><h3>Lessons</h3><div id="gr-list"></div></div><div class="card" style="grid-column:span 2"><div id="gr-detail"></div></div></div>';
    addLevelChips(host, function () { grammarIdx = 0; });
    var list = $("#gr-list", host), gl = content("grammar");
    if (!gl.length) { list.innerHTML = emptyState("No lessons at this level."); return; }
    grammarIdx = clamp(grammarIdx, 0, gl.length - 1);
    gl.forEach(function (g, i) {
      var b = el("button", { class: "btn block mb " + (i === grammarIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal" }, levelTag("grammar", g) + ' ' + esc(g.title));
      b.onclick = function () { grammarIdx = i; navigate("grammar"); };
      list.appendChild(b);
    });
    renderGrammar($("#gr-detail", host), gl[grammarIdx]);
  };
  function renderGrammar(host, g) {
    host.innerHTML = '<div class="pos" style="color:var(--accent)">' + esc(g.focus) + '</div><h2>' + esc(g.title) + '</h2>' +
      '<p>' + esc(g.explain) + uz(g.uz) + '</p>' +
      '<div class="small"><b>Examples</b><ul style="margin:6px 0 0 18px">' + g.examples.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="divider"></div><h3>Practice</h3><div id="gr-ex"></div>';
    var exHost = $("#gr-ex", host);
    g.exercise.forEach(function (ex, i) {
      var wrap = el("div", { class: "mb" });
      wrap.innerHTML = '<div class="small" style="font-weight:600">' + (i + 1) + '. ' + esc(ex.q) + '</div><textarea placeholder="Your answer"></textarea><button class="btn sm mt">Reveal model</button><div class="fb small mt"></div>';
      $("button", wrap).onclick = function () { $(".fb", wrap).innerHTML = '<b>Model:</b> ' + esc(ex.a); recordActivity("grammar", 80, ["grammar"], g.title); S.totals.timeMin += 1; save(); };
      exHost.appendChild(wrap);
    });
  }

  /* ---------------------------------------------------------------------
     VIEW: WRITING
  --------------------------------------------------------------------- */
  var writeIdx = 0;
  VIEWS.writing = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Writing Improvement</h1><p>Professional emails, statements, summaries and proposals. Write, get rule-based feedback, and compare with a model.</p></div></div>' +
      '<div class="grid cols-3"><div class="card"><h3>Tasks</h3><div id="wr-list"></div></div><div class="card" style="grid-column:span 2"><div id="wr-detail"></div></div></div>';
    addLevelChips(host, function () { writeIdx = 0; });
    var list = $("#wr-list", host), wl = content("writing");
    if (!wl.length) { list.innerHTML = emptyState("No tasks at this level."); return; }
    writeIdx = clamp(writeIdx, 0, wl.length - 1);
    wl.forEach(function (w, i) {
      var b = el("button", { class: "btn block mb " + (i === writeIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:9px" }, levelTag("writing", w) + ' <b>' + esc(w.type) + '</b>');
      b.onclick = function () { writeIdx = i; navigate("writing"); };
      list.appendChild(b);
    });
    renderWriting($("#wr-detail", host), wl[writeIdx]);
  };
  function renderWriting(host, w) {
    host.innerHTML = '<div class="pos" style="color:var(--accent)">' + esc(w.type) + '</div><h2>Task</h2><p>' + esc(w.prompt) + '</p>' +
      '<div class="small muted"><b>Tips:</b> ' + w.tips.map(esc).join(" · ") + '</div>' +
      '<label class="field mt"><span>Your draft</span><textarea id="wr-ta" style="min-height:160px" placeholder="Write your draft here..."></textarea></label>' +
      '<div class="btn-row"><button class="btn primary" id="wr-eval">Analyse writing</button><button class="btn" id="wr-model">Show model</button><button class="btn" id="wr-save">Save version</button></div>' +
      '<div id="wr-fb" class="mt"></div>';
    $("#wr-model", host).onclick = function () { $("#wr-fb", host).innerHTML = '<div class="card" style="background:var(--surface-2)"><b>Model answer</b><pre style="white-space:pre-wrap;font-family:inherit;margin:8px 0 0">' + esc(w.model) + '</pre></div>'; };
    $("#wr-save", host).onclick = function () { var t = $("#wr-ta", host).value.trim(); if (!t) return; S.imported.push({ type: "Writing: " + w.type, text: t, date: todayStr() }); save(); toast("Draft saved.", "good"); };
    $("#wr-eval", host).onclick = function () {
      var t = $("#wr-ta", host).value.trim();
      if (t.split(/\s+/).length < 15) { toast("Write a little more first.", "warn"); return; }
      var a = analyseWriting(t);
      $("#wr-fb", host).innerHTML = '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Writing score ' + a.score + '/100</div>' +
        scoreLine("Clarity", a.clarity) + scoreLine("Professional tone", a.tone) + scoreLine("Vocabulary", a.vocab) +
        (a.issues.length ? '<div class="small mt"><b>Suggestions:</b><ul style="margin:4px 0 0 18px">' + a.issues.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>' : '<div class="good-word small mt">No major issues detected.</div>') +
        '<div class="small mt"><b>Compare with the model:</b> click “Show model”.</div></div>';
      recordActivity("writing", a.score, ["grammar", "vocabulary"], w.type); S.totals.timeMin += 3; save();
    };
  }
  function analyseWriting(t) {
    var issues = [], lower = t.toLowerCase();
    var words = t.split(/\s+/).length;
    var sentences = (t.match(/[.!?]+/g) || []).length || 1;
    var avg = words / sentences;
    if (avg > 26) issues.push("Some sentences are long — consider splitting for clarity.");
    if (/\bvery |\breally |\ba lot\b/.test(lower)) issues.push("Replace informal intensifiers (‘very’, ‘really’, ‘a lot’) with precise words.");
    if (/!{1,}/.test(t)) issues.push("Avoid exclamation marks in formal writing.");
    if (/\bi think\b/.test(lower)) issues.push("‘I think’ can be softened to ‘In our assessment’ or ‘It appears that’.");
    if (!/\b(recommend|propose|suggest|would|could)\b/.test(lower)) issues.push("Add advisory language (recommend, propose, would) for a professional tone.");
    var proWords = (lower.match(/\b(quality|accreditation|stakeholder|accountability|transparency|framework|outcomes|evidence|sustainability|partnership)\b/g) || []).length;
    var clarity = clamp(100 - Math.abs(avg - 18) * 3, 40, 100);
    var tone = clamp(70 + (/\b(would|recommend|propose|kind regards|dear|thank you)\b/.test(lower) ? 20 : 0) - (/!{1,}|\bi think\b/.test(lower) ? 15 : 0), 0, 100);
    var vocab = clamp(55 + proWords * 7, 0, 100);
    return { score: Math.round((clarity + tone + vocab) / 3), clarity: Math.round(clarity), tone: tone, vocab: vocab, issues: issues };
  }

  /* ---------------------------------------------------------------------
     VIEW: KNOWLEDGE FEED
  --------------------------------------------------------------------- */
  VIEWS.feed = function (host) {
    if (!S.feed) S.feed = { items: D.FEED_SAMPLES.slice(), fetched: todayStr(), live: false };
    host.innerHTML = '<div class="section-head"><div><h1>' + tr("Modern Education Terminology Feed", "Zamonaviy ta’lim terminologiyasi lentasi") + '</h1><p>Turns reputable education updates into micro-lessons: 5 terms, 3 phrases, a summary task, a discussion question and a 60-second speaking challenge.</p></div>' +
      '<div class="btn-row"><button class="btn primary" id="feed-refresh">🔄 Refresh today’s content</button><button class="btn" data-go="settings">Manage sources</button></div></div>' +
      '<div class="card mb"><div class="small muted">' + (S.feed.live ? '<span class="tag new">LIVE</span> ' + tr("Live RSS content", "Jonli RSS kontent") : '<span class="tag">📦 ' + tr("CACHED SAMPLE", "KESH NAMUNA") + '</span> ' + tr("Built-in sample content, not live news", "O‘rnatilgan namuna kontent, jonli yangiliklar emas")) + ' · ' + tr("fetched", "olingan") + ' ' + esc(S.feed.fetched) + '. ' + tr("Direct browser fetches of RSS are often blocked by CORS; the live attempt uses a public RSS-to-JSON reader.", "RSS ni brauzerdan to‘g‘ridan-to‘g‘ri olish ko‘pincha CORS tufayli bloklanadi.") + ' ' + tr("Configured sources", "Manbalar") + ': ' + S.settings.sources.filter(function (s) { return s.active; }).map(function (s) { return esc(s.name); }).join(", ") + '.</div></div>' +
      '<div class="grid auto" id="feed-list"></div>';
    wireGo(host);
    $("#feed-refresh", host).onclick = function () { refreshFeed(host); };
    renderFeedList($("#feed-list", host));
  };
  function renderFeedList(host) {
    host.innerHTML = "";
    S.feed.items.forEach(function (it, idx) {
      var saved = (it.saved);
      var c = el("div", { class: "card" });
      c.innerHTML = '<div class="flex between"><span class="tag new">' + esc(it.source) + '</span><span class="small faint">' + esc(it.date) + '</span></div>' +
        '<h3 style="margin-top:8px">' + esc(it.title) + '</h3><div class="small muted">' + esc(it.summary) + '</div>' +
        '<div class="small mt"><b>Terms:</b> ' + it.terms.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</div>' +
        '<div class="btn-row mt"><button class="btn sm micro">📖 Micro-lesson</button><button class="btn sm save">' + (saved ? "★ Saved" : "☆ Save") + '</button><a class="btn sm" href="' + esc(it.link) + '" target="_blank" rel="noopener">Source ↗</a></div>';
      $(".micro", c).onclick = function () { microLesson(it); };
      $(".save", c).onclick = function () { it.saved = !it.saved; $(".save", c).textContent = it.saved ? "★ Saved" : "☆ Save"; save(); };
      host.appendChild(c);
    });
  }
  function microLesson(it) {
    modal('<div class="tag new">' + esc(it.source) + '</div><h2>' + esc(it.title) + '</h2>' +
      '<div class="small"><b>1 · Five important terms</b><div class="mt">' + it.terms.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</div></div>' +
      '<div class="small mt"><b>2 · Three professional phrases</b><ul style="margin:4px 0 0 18px">' + it.phrases.map(function (p) { return "<li>“" + esc(p) + "”</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>3 · Summary task.</b> Summarise this update in two sentences.</div>' +
      '<div class="small mt"><b>4 · Discussion question.</b> ' + esc(it.question) + '</div>' +
      '<div class="small mt"><b>5 · 60-second speaking challenge.</b> ' + esc(it.task) + '</div>' +
      '<div class="btn-row mt2"><button class="btn primary" id="ml-speak">🎙️ Do the speaking challenge</button><button class="btn" id="ml-close">Close</button></div>');
    $("#ml-close").onclick = closeModal;
    $("#ml-speak").onclick = function () { closeModal(); speakTaskIdx = 1; navigate("speaking"); toast("Use the speaking studio for your 60-second challenge.", ""); };
    recordActivity("feed", 75, ["terminology", "vocabulary"], it.title); S.totals.timeMin += 2; save();
  }
  function refreshFeed(host) {
    var btn = $("#feed-refresh", host); btn.innerHTML = '<span class="loader"></span> Fetching…'; btn.disabled = true;
    // Attempt live fetch of configured RSS via a public CORS-friendly reader; gracefully fall back.
    var active = S.settings.sources.filter(function (s) { return s.active && s.url; });
    var done = function (msg, kind) { S.feed.fetched = todayStr(); save(); btn.innerHTML = "🔄 Refresh today’s content"; btn.disabled = false; renderFeedList($("#feed-list", host)); toast(msg, kind); };
    // Shuffle cached samples as the offline-safe default (always works).
    S.feed.items = shuffle(D.FEED_SAMPLES.slice()).map(function (x) { return Object.assign({}, x); });
    S.feed.live = false;
    // Optional live attempt (best-effort; gated so failures never break the app):
    tryLiveFeed(active).then(function (items) {
      if (items && items.length) { S.feed.items = items.concat(S.feed.items).slice(0, 8); S.feed.live = true; done("Live content loaded.", "good"); }
      else done("Showing refreshed cached content (live fetch blocked or unavailable).", "");
    }).catch(function () { done("Showing refreshed cached content (offline mode).", ""); });
  }
  function tryLiveFeed(sources) {
    // Best-effort only. Uses a public reader that returns JSON; if it fails we fall back.
    if (!sources.length || !window.fetch) return Promise.resolve(null);
    var s = sources[0];
    var api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(s.url);
    return fetch(api).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.items) return null;
      return j.items.slice(0, 4).map(function (it) {
        var terms = extractTerms(it.title + " " + (it.description || ""));
        return {
          title: it.title, source: (j.feed && j.feed.title) || s.name, date: (it.pubDate || "").slice(0, 10),
          summary: stripTags(it.description || "").slice(0, 200) + "…", terms: terms,
          phrases: ["Let me set out the evidence.", "This has real implications for our sector."],
          question: "How does this affect your context?", task: "Summarise this update in 60 seconds.", link: it.link, saved: false
        };
      });
    }).catch(function () { return null; });
  }
  function stripTags(h) { var d = document.createElement("div"); d.innerHTML = h; return d.textContent || ""; }
  function extractTerms(text) {
    var known = D.VOCABULARY.map(function (v) { return v.term; });
    var found = known.filter(function (t) { return text.toLowerCase().indexOf(t) >= 0; }).slice(0, 5);
    while (found.length < 5) { var r = D.VOCABULARY[Math.abs(hash(text + found.length)) % D.VOCABULARY.length].term; if (found.indexOf(r) < 0) found.push(r); else break; }
    return found.slice(0, 5);
  }

  /* ---------------------------------------------------------------------
     VIEW: CONTENT IMPORTER
  --------------------------------------------------------------------- */
  VIEWS.import = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Personal Content Importer</h1><p>Paste a speech, article, report or transcript. The platform converts it into vocabulary, phrases, questions, speaking prompts and a quiz.</p></div></div>' +
      '<div class="grid cols-2"><div class="card"><label class="field"><span>Tag / topic</span><input id="imp-tag" type="text" placeholder="e.g. Accreditation reform"></label>' +
      '<label class="field"><span>Paste your text</span><textarea id="imp-text" style="min-height:220px" placeholder="Paste content here..."></textarea></label>' +
      '<button class="btn primary block" id="imp-go">Convert to lesson</button></div>' +
      '<div class="card"><h3>Generated lesson</h3><div id="imp-out">' + emptyState("Paste text and convert to see extracted vocabulary, questions and prompts.") + '</div></div></div>' +
      (S.imported.length ? '<div class="card mt"><h3>Saved imports (' + S.imported.length + ')</h3><div id="imp-saved"></div></div>' : '');
    $("#imp-go", host).onclick = function () {
      var text = $("#imp-text", host).value.trim();
      if (text.split(/\s+/).length < 20) { toast("Paste at least a paragraph.", "warn"); return; }
      var lesson = buildLessonFromText(text, $("#imp-tag", host).value.trim());
      renderImportLesson($("#imp-out", host), lesson);
      S.imported.push({ type: "Import", tag: lesson.tag, text: text.slice(0, 4000), date: todayStr() });
      save(); recordActivity("import", 76, ["vocabulary", "terminology"], lesson.tag || "import");
    };
    if (S.imported.length) {
      var sv = $("#imp-saved", host);
      S.imported.slice(-6).reverse().forEach(function (im) {
        var r = el("div", { class: "flex between", style: "padding:6px 0;border-bottom:1px dashed var(--border)" });
        r.innerHTML = '<span class="small"><b>' + esc(im.tag || im.type) + '</b> <span class="faint">' + esc(im.date) + '</span></span><span class="small faint">' + esc((im.text || "").slice(0, 40)) + '…</span>';
        sv.appendChild(r);
      });
    }
  };
  function buildLessonFromText(text, tag) {
    var sentences = text.split(/(?<=[.!?])\s+/).filter(function (s) { return s.split(/\s+/).length > 4; });
    var terms = extractTerms(text);
    // Extract longer words as candidate vocabulary
    var big = {}; (text.match(/\b[a-zA-Z]{7,}\b/g) || []).forEach(function (w) { w = w.toLowerCase(); big[w] = (big[w] || 0) + 1; });
    var candidates = Object.keys(big).sort(function (a, b) { return big[b] - big[a]; }).slice(0, 8);
    var flashcards = candidates.map(function (w) { return { term: w, hint: "Appears " + big[w] + "×. Define and use it in a sentence." }; });
    var questions = sentences.slice(0, 3).map(function (s) { return "Comprehension: What is the main point of — “" + s.slice(0, 80) + "…”?"; });
    var prompts = ["Summarise this text in 60 seconds.", "Explain the key idea to a foreign delegate.", "What would you ask the author?"];
    var negQ = ["If challenged on this, how would you respond diplomatically?", "What objection might an investor raise, and how would you answer?"];
    var quiz = candidates.slice(0, 4).map(function (w) { return { q: "Use the word ‘" + w + "’ correctly in a professional sentence.", a: "(Open answer — model shows the word in context.)" }; });
    return { tag: tag || "Imported content", terms: terms, flashcards: flashcards, questions: questions, prompts: prompts, negQ: negQ, quiz: quiz, summaryTask: "Write a two-sentence summary." };
  }
  function renderImportLesson(host, l) {
    host.innerHTML =
      '<div class="small"><b>Detected professional terms:</b> ' + l.terms.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</div>' +
      '<div class="small mt"><b>Vocabulary flashcards:</b><ul style="margin:4px 0 0 18px">' + l.flashcards.map(function (f) { return "<li><b>" + esc(f.term) + "</b> — " + esc(f.hint) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>Comprehension questions:</b><ul style="margin:4px 0 0 18px">' + l.questions.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>Speaking prompts:</b> ' + l.prompts.map(esc).join(" · ") + '</div>' +
      '<div class="small mt"><b>Negotiation questions:</b> ' + l.negQ.map(esc).join(" · ") + '</div>' +
      '<div class="small mt"><b>Summary exercise:</b> ' + esc(l.summaryTask) + '</div>' +
      '<div class="small mt"><b>Quick quiz:</b><ul style="margin:4px 0 0 18px">' + l.quiz.map(function (q) { return "<li>" + esc(q.q) + "</li>"; }).join("") + '</ul></div>';
  }

  /* ---------------------------------------------------------------------
     VIEW: ASSESSMENTS
  --------------------------------------------------------------------- */
  VIEWS.assess = function (host) {
    var wa = D.WEEKLY_ASSESSMENT, mc = D.MONTHLY_CHALLENGE;
    host.innerHTML = '<div class="section-head"><div><h1>Assessments</h1><p>Weekly skills check and a monthly leadership challenge that combines everything.</p></div></div>' +
      '<div class="grid cols-2"><div class="card"><h3>' + esc(wa.title) + '</h3><p class="small muted">Seven short tasks across your core skills. Each links to the relevant module; scores feed your progress report.</p>' +
      '<div id="wa-list"></div><button class="btn primary block mt" id="wa-start">Begin weekly assessment</button>' +
      (S.weekly.length ? '<div class="small mt">Last report: ' + esc(S.weekly[S.weekly.length - 1].date) + ' · overall ' + S.weekly[S.weekly.length - 1].overall + '/100</div>' : '') + '</div>' +
      '<div class="card"><h3>' + esc(mc.title) + '</h3><p class="small muted">One larger task this month. Choose your challenge:</p>' +
      '<div id="mc-list"></div></div></div>';
    var wl = $("#wa-list", host);
    wa.sections.forEach(function (s) {
      var r = el("div", { class: "flex between", style: "padding:7px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<span class="small"><b>' + esc(s.title) + '</b> — ' + esc(s.desc) + '</span><button class="btn sm" data-go="' + assessRoute(s.type) + '">Open</button>';
      wl.appendChild(r);
    });
    wireGo(host);
    $("#wa-start", host).onclick = function () { runWeeklyAssessment(); };
    var ml = $("#mc-list", host);
    mc.options.forEach(function (o, i) {
      var r = el("div", { class: "flex between", style: "padding:7px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<span class="small">' + esc(o) + '</span><button class="btn sm">Choose</button>';
      $("button", r).onclick = function () { chooseMonthly(o); };
      ml.appendChild(r);
    });
  };
  function assessRoute(type) { return { vocabulary: "vocab", grammar: "grammar", listening: "listening", speaking: "speaking", negotiation: "negotiation", writing: "writing", difficult: "difficult" }[type] || "dashboard"; }
  function runWeeklyAssessment() {
    // Build a report from recent activity by skill.
    var byKey = {};
    D.INDICATORS.forEach(function (i) { byKey[i.key] = S.indicators[i.key].current; });
    var overall = overallScore();
    var prev = S.weekly.length ? S.weekly[S.weekly.length - 1].overall : overall - 3;
    var most = strongestIndicators(1)[0], weak = weakestIndicators(1)[0];
    var recurring = {}; S.activity.slice(0, 40).forEach(function (a) { if (a.score < 65) recurring[a.type] = (recurring[a.type] || 0) + 1; });
    var report = { date: todayStr(), overall: overall, byKey: byKey, most: most.name, weak: weak.name };
    S.weekly.push(report); save();
    modal('<h2>Weekly Report — ' + report.date + '</h2><div class="badge-score mb">Overall ' + overall + '/100 ' + trendArrow(overall, prev) + '</div>' +
      '<div class="small"><b>By skill</b></div>' + D.INDICATORS.map(function (i) { return '<div class="indicator-row"><span class="name">' + i.name + '</span>' + bar(byKey[i.key]) + '<span class="val">' + byKey[i.key] + '</span></div>'; }).join("") +
      '<div class="divider"></div><div class="small"><b>Most improved / strongest:</b> ' + esc(most.name) + '</div>' +
      '<div class="small"><b>Weakest skill:</b> ' + esc(weak.name) + ' — ' + esc(weak.tip) + '</div>' +
      '<div class="small mt"><b>Recommended priorities next week:</b> ' + weakestIndicators(3).map(function (x) { return esc(x.name); }).join(", ") + '.</div>' +
      '<div class="btn-row mt2"><button class="btn primary" id="wa-print">🖨 Export report</button><button class="btn" id="wa-close">Close</button></div>');
    $("#wa-close").onclick = closeModal;
    $("#wa-print").onclick = function () { exportPrint("Weekly Report — " + report.date, weeklyReportText(report)); };
  }
  function weeklyReportText(r) {
    return "WEEKLY LEADERSHIP ASSESSMENT — " + r.date + "\n\nOverall: " + r.overall + "/100\n\nBy skill:\n" +
      D.INDICATORS.map(function (i) { return "  " + i.name + ": " + r.byKey[i.key]; }).join("\n") +
      "\n\nStrongest: " + r.most + "\nWeakest: " + r.weak;
  }
  function chooseMonthly(o) {
    var g = { title: "Monthly Challenge: " + o, indicator: "conference", deadline: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), progress: 0, milestones: ["Prepare", "Practise", "Perform", "Reflect"], done: [], monthly: true };
    S.goals.push(g); save(); toast("Monthly challenge added to your Goals.", "good"); navigate("goals");
  }

  /* ---------------------------------------------------------------------
     VIEW: PROGRESS
  --------------------------------------------------------------------- */
  VIEWS.progress = function (host) {
    var stage = currentStage();
    host.innerHTML = '<div class="section-head"><div><h1>' + tr("Progress & Development", "Natijalar va rivojlanish") + '</h1><p>' + tr("Your pathway from A2 to C1, XP, badges, competency trends and a personal development plan.", "A2 dan C1 gacha yo‘lingiz, XP, nishonlar, kompetensiya dinamikasi va shaxsiy rivojlanish rejasi.") + '</p></div>' +
      '<div class="btn-row"><button class="btn" id="pr-export">🖨 ' + tr("Export progress report", "Hisobotni eksport qilish") + '</button></div></div>' +
      '<div class="grid cols-2 mb">' + cefrPathCard() + xpCard() + '</div>' +
      '<div class="grid cols-2 mb"><div class="card"><h3>' + tr("XP over time (30 days)", "XP dinamikasi (30 kun)") + '</h3><canvas id="xp-chart" width="560" height="220" style="width:100%"></canvas></div>' +
      '<div class="card"><h3>' + tr("Activity calendar (12 weeks)", "Faollik taqvimi (12 hafta)") + '</h3><div class="heatmap" id="heatmap" aria-label="Activity heatmap"></div><div class="small muted mt">' + tr("Darker = more activities that day.", "To‘qroq rang = o‘sha kuni ko‘proq faoliyat.") + '</div></div></div>' +
      '<div class="card mb"><h3>' + tr("Development pathway", "Rivojlanish yo‘li") + '</h3><div class="stage-track mt">' +
      D.STAGES.map(function (s) { return '<div class="stage-node ' + (s.n < stage.n ? "done" : (s.n === stage.n ? "current" : "")) + '"><div class="dot">' + s.n + '</div><small>' + esc(s.title) + '</small></div>'; }).join("") + '</div>' +
      '<div class="small mt2"><b>' + tr("You are in Stage", "Siz bosqichdasiz:") + ' ' + stage.n + ': ' + esc(stage.title) + '.</b> ' + tr("Focus", "Diqqat") + ': ' + stage.focus.map(esc).join(", ") + '.</div>' +
      '<div class="small mt"><b>' + tr("To reach Stage", "Keyingi bosqich") + ' ' + Math.min(4, stage.n + 1) + ':</b> ' + tr("raise your overall competency to", "umumiy kompetensiyani quyidagiga yetkazing:") + ' ' + (D.STAGES[Math.min(3, stage.n)] ? D.STAGES[Math.min(3, stage.n)].threshold : 92) + '. ' + tr("Current", "Joriy") + ': ' + overallScore() + '.</div></div>' +
      '<div class="grid cols-2 mb"><div class="card"><h3>' + tr("Competency radar", "Kompetensiya radari") + '</h3><canvas id="radar" width="360" height="360" style="max-width:100%"></canvas></div>' +
      '<div class="card"><h3>' + tr("Recent activity", "So‘nggi faoliyat") + '</h3><div id="act-log"></div></div></div>' +
      '<div class="grid cols-2"><div class="card"><h3>' + tr("Level tests", "Daraja testlari") + '</h3><div id="test-log"></div>' +
      '<div class="btn-row mt"><button class="btn sm" id="pr-retake"' + (canRetakePlacement() ? "" : " disabled") + '>🎯 ' + tr("Retake placement test", "Darajani aniqlash testini qayta topshirish") + '</button>' + (canRetakePlacement() ? "" : '<span class="small muted">' + tr("Available 30 days after the last placement", "Oxirgi testdan 30 kun o‘tgach") + '</span>') + '</div></div>' +
      '<div class="card"><h3>' + tr("Rank history", "Reyting tarixi") + '</h3><div id="rank-log">' + (online() ? '<span class="loader"></span>' : emptyState(tr("Sign in to see your weekly ranks.", "Haftalik o‘rinlarni ko‘rish uchun tizimga kiring."))) + '</div></div></div>';
    drawRadar($("#radar", host));
    drawXpChart($("#xp-chart", host));
    drawHeatmap($("#heatmap", host));
    var log = $("#act-log", host);
    if (!S.activity.length) log.innerHTML = emptyState(tr("No activity yet — complete a lesson to see it here.", "Hali faoliyat yo‘q — darsni bajaring."));
    else S.activity.slice(0, 14).forEach(function (a) {
      var r = el("div", { class: "flex between", style: "padding:6px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<span class="small"><b>' + esc(a.type) + '</b> <span class="faint">' + esc(a.note || "") + '</span></span><span class="small" style="color:' + (a.score >= 75 ? "var(--green)" : a.score >= 60 ? "var(--amber)" : "var(--rose)") + ';font-weight:700">' + a.score + '</span>';
      log.appendChild(r);
    });
    var tl = $("#test-log", host);
    if (!S.cefr.tests.length) tl.innerHTML = emptyState(tr("No level tests yet.", "Hali daraja testlari yo‘q."));
    else S.cefr.tests.slice().reverse().slice(0, 8).forEach(function (x) {
      var r = el("div", { class: "flex between", style: "padding:6px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<span class="small"><b>' + (x.kind === "placement" ? tr("Placement", "Darajani aniqlash") : tr("Level test", "Daraja testi") + " " + esc(x.from || "") + " → " + esc(x.result || "")) + '</b> <span class="faint">' + esc(x.date) + '</span></span><span class="small" style="font-weight:700">' + esc(x.result) + ' · ' + x.score + '%</span>';
      tl.appendChild(r);
    });
    $("#pr-retake", host).onclick = function () { if (window.ELH_PLACEMENT) window.ELH_PLACEMENT.start({ kind: "placement", fromLevel: cefr() }); };
    wireCefr(host);
    $("#pr-export", host).onclick = function () { exportPrint("Progress Report", progressReportText()); };
    if (online()) refreshStats().then(function (d) {
      var rl = $("#rank-log", host); if (!rl) return;
      var hist = (d && d.rank_history) || [];
      if (!hist.length) { rl.innerHTML = emptyState(tr("No ranked weeks yet — earn XP this week!", "Hali reytingli hafta yo‘q — bu hafta XP yig‘ing!")); return; }
      rl.innerHTML = hist.slice(0, 10).map(function (h) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span class="small">' + tr("Week of", "Hafta") + ' ' + esc(h.week_start) + '</span><span class="small"><b>#' + esc(h.rank == null ? "—" : h.rank) + '</b> · ' + leagueBadge(h.league) + '</span></div>'; }).join("");
    });
  };
  function leagueBadge(l) { var m = { Gold: "🥇", Silver: "🥈", Bronze: "🥉", Rising: "🌱" }; return '<span class="league league-' + esc(l || "Rising") + '">' + (m[l] || "🌱") + ' ' + esc(l || "Rising") + '</span>'; }
  function drawXpChart(cv) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d"), W = cv.width, H = cv.height, pad = 28;
    ctx.clearRect(0, 0, W, H);
    var days = [], max = 10;
    for (var i = 29; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); var v = S.xp.history[d] || 0; days.push([d, v]); if (v > max) max = v; }
    var css = getComputedStyle(document.body), grid = css.getPropertyValue("--border") || "#ccc", txt = css.getPropertyValue("--text-soft") || "#666";
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = txt; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    for (var g = 0; g <= 4; g++) { var y = pad + (H - 2 * pad) * (1 - g / 4); ctx.beginPath(); ctx.moveTo(pad + 10, y); ctx.lineTo(W - 8, y); ctx.globalAlpha = .6; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(Math.round(max * g / 4), pad + 6, y + 3); }
    var bw = (W - pad - 18) / 30;
    days.forEach(function (dv, i) {
      var h = (H - 2 * pad) * dv[1] / max, x = pad + 12 + i * bw, y = H - pad - h;
      ctx.fillStyle = dv[1] ? "#2a5ca8" : "rgba(128,128,128,.15)"; ctx.fillRect(x + 1, y, Math.max(2, bw - 3), Math.max(1, h));
      if (i % 7 === 0 || i === 29) { ctx.fillStyle = txt; ctx.textAlign = "center"; ctx.fillText(dv[0].slice(5), x + bw / 2, H - 8); }
    });
  }
  function drawHeatmap(host) {
    if (!host) return;
    var counts = {}; S.activity.forEach(function (a) { counts[a.date] = (counts[a.date] || 0) + 1; });
    Object.keys(S.xp.history).forEach(function (d) { if (S.xp.history[d] && !counts[d]) counts[d] = 1; });
    var today = new Date(); var dow = (today.getDay() + 6) % 7; // Monday = 0
    var start = new Date(today.getTime() - (83 + dow) * 864e5);
    var html = "";
    for (var w = 0; w < 12; w++) {
      html += '<div class="hm-col">';
      for (var d = 0; d < 7; d++) {
        var dt = new Date(start.getTime() + (w * 7 + d) * 864e5); if (dt > today) { html += '<span class="hm-cell empty"></span>'; continue; }
        var key = dt.toISOString().slice(0, 10), c = counts[key] || 0, lvl = c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4;
        html += '<span class="hm-cell l' + lvl + '" title="' + key + ': ' + c + '"></span>';
      }
      html += '</div>';
    }
    host.innerHTML = html;
  }
  function currentStage() {
    var o = overallScore(), st = D.STAGES[0];
    D.STAGES.forEach(function (s) { if (o >= s.threshold) st = s; });
    // stage is the highest whose threshold you EXCEED, capped; but show as current the next to work on
    var idx = 0; for (var i = 0; i < D.STAGES.length; i++) { if (o >= D.STAGES[i].threshold) idx = i; }
    return D.STAGES[Math.min(idx, 3)];
  }
  function drawRadar(cv) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d"), n = D.INDICATORS.length, cx = 180, cy = 180, R = 130;
    ctx.clearRect(0, 0, 360, 360);
    var css = getComputedStyle(document.body);
    var line = css.getPropertyValue("--border") || "#ccc";
    var accent = "#2a5ca8";
    // grid
    for (var g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (var i = 0; i <= n; i++) { var a = (i / n) * Math.PI * 2 - Math.PI / 2; var r = R * g / 4; var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = line; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // data
    ctx.beginPath();
    D.INDICATORS.forEach(function (ind, i) {
      var v = S.indicators[ind.key].current / 100; var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var x = cx + R * v * Math.cos(a), y = cy + R * v * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fillStyle = "rgba(42,92,168,.25)"; ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    // labels
    ctx.fillStyle = css.getPropertyValue("--text-soft") || "#666"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
    D.INDICATORS.forEach(function (ind, i) { var a = (i / n) * Math.PI * 2 - Math.PI / 2; var x = cx + (R + 14) * Math.cos(a), y = cy + (R + 14) * Math.sin(a); ctx.fillText(ind.name.split(" ")[0], x, y); });
  }
  function progressReportText() {
    return "EDUCATION LEADERSHIP ENGLISH HUB — PROGRESS REPORT\nDate: " + todayStr() + "\nName: " + S.profile.name +
      "\nLevel: " + S.profile.level + " → target " + S.profile.target + "\nOverall competency: " + overallScore() + "/100\nGrowth score: " + growthScore() +
      "\nStreak: " + S.streak.count + " days\nWords mastered: " + countMastered() + "\nSpeaking sessions: " + S.totals.speaking + "\nNegotiations: " + S.totals.negotiations +
      "\n\nCompetencies:\n" + D.INDICATORS.map(function (i) { return "  " + i.name + ": " + S.indicators[i.key].current + " (target " + S.indicators[i.key].target + ")"; }).join("\n");
  }

  /* ---------------------------------------------------------------------
     VIEW: GOALS
  --------------------------------------------------------------------- */
  VIEWS.goals = function (host) {
    host.innerHTML = '<div class="section-head"><div><h1>Goals</h1><p>Set targets, track milestones and watch progress. Choose a template or create your own.</p></div>' +
      '<button class="btn primary" id="goal-add">+ New goal</button></div>' +
      '<div class="card mb"><h3>Suggested goals</h3><div class="chip-row">' + D.GOAL_TEMPLATES.map(function (g, i) { return '<button class="chip" data-tpl="' + i + '">' + esc(g.title) + '</button>'; }).join("") + '</div></div>' +
      '<div class="grid auto" id="goal-list"></div>';
    $$("[data-tpl]", host).forEach(function (b) { b.onclick = function () { addGoalFromTemplate(D.GOAL_TEMPLATES[+b.dataset.tpl]); }; });
    $("#goal-add", host).onclick = function () { goalForm(); };
    var list = $("#goal-list", host);
    if (!S.goals.length) { list.innerHTML = emptyState("No goals yet. Pick a suggested goal above to begin."); return; }
    S.goals.forEach(function (g, gi) {
      var pct = g.milestones.length ? Math.round((g.done || []).length / g.milestones.length * 100) : g.progress || 0;
      var c = el("div", { class: "card" });
      c.innerHTML = '<div class="flex between"><h3>' + esc(g.title) + '</h3><button class="icon-btn del" style="width:30px;height:30px" title="Delete">🗑</button></div>' +
        (g.deadline ? '<div class="small faint">Deadline: ' + esc(g.deadline) + (g.monthly ? " · monthly challenge" : "") + '</div>' : '') +
        '<div class="mt">' + bar(pct) + '<div class="small muted mt">' + pct + '% · ' + (g.done || []).length + '/' + g.milestones.length + ' milestones</div></div>' +
        '<div class="mt">' + g.milestones.map(function (m, mi) { var d = (g.done || []).indexOf(mi) >= 0; return '<label class="switch" style="display:flex;margin:4px 0"><input type="checkbox" data-g="' + gi + '" data-m="' + mi + '"' + (d ? " checked" : "") + '><span class="track"></span><span class="small">' + esc(m) + '</span></label>'; }).join("") + '</div>';
      $(".del", c).onclick = function () { if (confirm("Delete this goal?")) { S.goals.splice(gi, 1); save(); navigate("goals"); } };
      $$("input[type=checkbox]", c).forEach(function (cb) {
        cb.onchange = function () {
          g.done = g.done || [];
          var mi = +cb.dataset.m, idx = g.done.indexOf(mi);
          if (cb.checked && idx < 0) g.done.push(mi); else if (!cb.checked && idx >= 0) g.done.splice(idx, 1);
          if (g.done.length === g.milestones.length) toast("Goal complete — excellent work! 🎉", "good");
          save(); navigate("goals");
        };
      });
      list.appendChild(c);
    });
  };
  function addGoalFromTemplate(t) {
    S.goals.push({ title: t.title, indicator: t.indicator, deadline: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10), milestones: t.milestones.slice(), done: [], progress: 0 });
    save(); toast("Goal added.", "good"); navigate("goals");
  }
  function goalForm() {
    modal('<h2>New goal</h2>' + field("Title", '<input id="g-title" type="text" placeholder="e.g. Deliver a keynote in English">') +
      field("Deadline", '<input id="g-deadline" type="text" value="' + new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10) + '">') +
      field("Milestones (one per line)", '<textarea id="g-miles" placeholder="Draft\nRehearse\nRecord\nReview"></textarea>') +
      '<div class="btn-row"><button class="btn primary" id="g-save">Create</button><button class="btn" id="g-cancel">Cancel</button></div>');
    $("#g-cancel").onclick = closeModal;
    $("#g-save").onclick = function () {
      var title = $("#g-title").value.trim(); if (!title) { toast("Add a title.", "warn"); return; }
      var miles = $("#g-miles").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!miles.length) miles = ["Start", "Progress", "Complete"];
      S.goals.push({ title: title, deadline: $("#g-deadline").value.trim(), milestones: miles, done: [], progress: 0 });
      save(); closeModal(); navigate("goals");
    };
  }

  /* ---------------------------------------------------------------------
     VIEW: SETTINGS
  --------------------------------------------------------------------- */
  VIEWS.settings = function (host) {
    var st = S.settings, P = (window.ELH_AUTH && window.ELH_AUTH.profile()) || null, isOn = online();
    host.innerHTML = '<div class="section-head"><div><h1>' + tr("Settings", "Sozlamalar") + '</h1><p>' + tr("Account, profile, language support, privacy, sources and data.", "Hisob, profil, til, maxfiylik, manbalar va ma’lumotlar.") + '</p></div></div>' +
      '<div class="grid cols-2">' +
      '<div class="card"><h3>👤 ' + tr("Account", "Hisob") + '</h3>' +
      (isOn ? '<div class="small muted mb">' + tr("Login ID", "Login ID") + ': <b>' + esc(P ? P.login_id : "") + '</b> · ' + tr("Role", "Rol") + ': ' + esc(P ? P.role : "learner") + '</div>' : '<div class="small muted mb">' + tr("Local-only mode: progress stays in this browser. Set up Supabase (see SETUP.md) to enable accounts and sync.", "Faqat shu qurilma rejimi: natijalar faqat shu brauzerda. Hisob va sinxronizatsiya uchun Supabase ni sozlang (SETUP.md).") + '</div>') +
      field(tr("Display name", "Ko‘rsatiladigan ism"), '<input id="set-name" type="text" value="' + esc(S.profile.name) + '">') +
      field(tr("Organisation", "Tashkilot"), '<input id="set-org" type="text" value="' + esc(S.profile.organisation || (P && P.organisation) || "") + '">') +
      field(tr("Position", "Lavozim"), '<input id="set-pos" type="text" value="' + esc(S.profile.position || (P && P.position) || "") + '">') +
      '<div class="small muted mb">' + tr("CEFR level", "CEFR daraja") + ': <b>' + (cefr() || "—") + '</b> → C1 · ' + tr("set by the placement and level tests, not editable by hand.", "darajani aniqlash va daraja testlari orqali belgilanadi.") + '</div>' +
      '<div class="btn-row"><button class="btn primary" id="set-save-profile">' + tr("Save profile", "Profilni saqlash") + '</button>' + (isOn ? '<button class="btn" id="set-pw">🔑 ' + tr("Change password", "Parolni o‘zgartirish") + '</button><button class="btn danger" id="set-signout">🚪 ' + tr("Sign out", "Chiqish") + '</button>' : '') + '</div></div>' +

      '<div class="card"><h3>🎛 ' + tr("Experience", "Tajriba") + '</h3>' +
      toggle(tr("Dark mode", "Tungi rejim"), "set-theme", st.theme === "dark") +
      toggle(tr("Uzbek support (interface, translations & hints)", "O‘zbekcha qo‘llab-quvvatlash (interfeys, tarjimalar va izohlar)"), "set-uz", st.uz) +
      toggle(tr("Reduce motion", "Animatsiyani kamaytirish"), "set-motion", st.reduceMotion) +
      field(tr("Default daily length", "Kunlik mashg‘ulot davomiyligi"), '<select id="set-len">' + [15, 30, 45, 60].map(function (l) { return '<option value="' + l + '"' + (l === st.dailyLength ? " selected" : "") + '>' + l + ' min</option>'; }).join("") + '</select>') +
      field(tr("Daily refresh time", "Kunlik yangilanish vaqti"), '<input id="set-refresh" type="time" value="' + esc(st.refreshTime) + '">') + '</div>' +

      '<div class="card"><h3>🔒 ' + tr("Privacy & leaderboard", "Maxfiylik va reyting") + '</h3>' +
      toggle(tr("Show me on the leaderboard", "Meni reytingda ko‘rsatish"), "set-lb", st.showOnLeaderboard !== false) +
      '<p class="small muted">' + tr("When hidden, your name and XP are not visible to other learners; you can still see your own rank.", "Yashirilganda ismingiz va XP boshqa o‘quvchilarga ko‘rinmaydi; o‘z o‘rningizni ko‘ra olasiz.") + '</p></div>' +

      '<div class="card"><h3>📰 ' + tr("Knowledge feed sources", "Bilim lentasi manbalari") + '</h3><p class="small muted">' + tr("RSS feeds. Direct browser fetches can be blocked by CORS; cached sample content is shown when live fetch fails.", "RSS lentalar. Brauzer so‘rovlari CORS tufayli bloklanishi mumkin; u holda keshdagi namuna ko‘rsatiladi.") + '</p>' +
      '<div id="src-list"></div>' + field(tr("Add source name", "Manba nomi"), '<input id="src-name" type="text" placeholder="e.g. EQAR">') + field(tr("Add source URL (RSS)", "Manba URL (RSS)"), '<input id="src-url" type="url" placeholder="https://…/feed/">') +
      '<button class="btn" id="src-add">' + tr("Add source", "Manba qo‘shish") + '</button></div>' +

      '<div class="card"><h3>🤖 ' + tr("AI integration (optional)", "AI integratsiyasi (ixtiyoriy)") + '</h3><p class="small muted">The platform works fully without AI. To enable richer feedback, provide a proxy endpoint. <b>Never hard-code private keys in shared HTML.</b></p>' +
      field("AI proxy endpoint (optional)", '<input id="ai-url" type="url" placeholder="https://your-proxy.example.com/api" value="' + esc(st.aiUrl || "") + '">') +
      '<label class="switch" style="margin:6px 0"><input type="checkbox" id="ai-on"' + (st.aiKeyConfigured ? " checked" : "") + '><span class="track"></span><span class="small">Use AI when available</span></label>' +
      '<button class="btn" id="ai-save">Save AI settings</button></div>' +

      '<div class="card"><h3>💾 ' + tr("Data", "Ma’lumotlar") + '</h3><p class="small muted">' + (isOn ? tr("Progress is synced to your account and cached in this browser. Backups are still useful.", "Natijalar hisobingizga sinxronlanadi va brauzerda keshlanadi. Zaxira nusxa baribir foydali.") : tr("Everything is stored locally in your browser. Back up regularly.", "Hammasi shu brauzerda saqlanadi. Muntazam zaxira nusxa oling.")) + '</p>' +
      '<div class="btn-row"><button class="btn" id="data-export">⬇ ' + tr("Export backup", "Zaxira nusxa") + '</button><button class="btn" id="data-import">⬆ ' + tr("Import backup", "Zaxirani yuklash") + '</button>' + (isOn ? '' : '<button class="btn" id="data-demo">✨ Load demo progress</button>') + '<button class="btn danger" id="data-reset">🗑 ' + tr("Reset all data", "Barcha ma’lumotlarni o‘chirish") + '</button></div>' +
      '<input type="file" id="data-file" accept="application/json" style="display:none"></div>' +

      '<div class="card"><h3>♿ ' + tr("Accessibility", "Qulayliklar") + '</h3><p class="small muted">' + tr("Keyboard navigation (Tab), Focus Mode, screen-reader landmarks, adjustable motion and high-contrast dark mode. Confirmation is required before deleting progress.", "Klaviatura navigatsiyasi (Tab), Fokus rejimi, ekran o‘quvchi uchun belgilar, animatsiya sozlamasi va yuqori kontrastli tungi rejim.") + '</p></div>' +
      '</div>';

    // profile
    $("#set-save-profile", host).onclick = function () {
      S.profile.name = $("#set-name", host).value.trim() || "Education Leader";
      S.profile.organisation = $("#set-org", host).value.trim(); S.profile.position = $("#set-pos", host).value.trim();
      save(); refreshChrome(); toast(tr("Profile saved.", "Profil saqlandi."), "good");
      if (isOn) window.ELH_AUTH.client.rpc("update_my_profile", { p_patch: { display_name: S.profile.name, organisation: S.profile.organisation, position: S.profile.position } }).then(function (r) { if (r.error) toast(r.error.message, "warn"); else window.ELH_AUTH.refreshProfile(); });
    };
    if (isOn) {
      $("#set-signout", host).onclick = function () { window.ELH_AUTH.signOut(); };
      $("#set-pw", host).onclick = function () {
        modal('<h2>🔑 ' + tr("Change password", "Parolni o‘zgartirish") + '</h2>' + field(tr("New password (min 8 characters)", "Yangi parol (kamida 8 belgi)"), '<input id="pw-new" type="password" autocomplete="new-password">') + field(tr("Confirm new password", "Yangi parolni tasdiqlang"), '<input id="pw-new2" type="password" autocomplete="new-password">') +
          '<div class="small err-word" id="pw-err"></div><div class="btn-row mt2"><button class="btn primary" id="pw-save">' + tr("Update password", "Parolni yangilash") + '</button><button class="btn" id="pw-cancel">' + tr("Cancel", "Bekor qilish") + '</button></div>');
        $("#pw-cancel").onclick = closeModal;
        $("#pw-save").onclick = function () {
          var a = $("#pw-new").value, b = $("#pw-new2").value;
          if (a.length < 8) { $("#pw-err").textContent = tr("At least 8 characters.", "Kamida 8 belgi."); return; }
          if (a !== b) { $("#pw-err").textContent = tr("Passwords do not match.", "Parollar mos kelmadi."); return; }
          $("#pw-save").disabled = true;
          window.ELH_AUTH.changePassword(a).then(function () { closeModal(); toast(tr("Password updated.", "Parol yangilandi."), "good"); }).catch(function (e) { $("#pw-err").textContent = e.message || String(e); $("#pw-save").disabled = false; });
        };
      };
    }
    // experience
    $("#set-theme", host).onchange = function () { st.theme = this.checked ? "dark" : "light"; applyTheme(); save(); };
    $("#set-uz", host).onchange = function () { st.uz = this.checked; st.uzChosen = true; save(); toast(st.uz ? "O‘zbekcha qo‘llab-quvvatlash yoqildi." : "Uzbek support off.", ""); buildShell(); navigate("settings"); };
    $("#set-motion", host).onchange = function () { st.reduceMotion = this.checked; applyTheme(); save(); };
    $("#set-len", host).onchange = function () { st.dailyLength = +this.value; save(); };
    $("#set-refresh", host).onchange = function () { st.refreshTime = this.value; save(); };
    // privacy
    $("#set-lb", host).onchange = function () {
      st.showOnLeaderboard = this.checked; save();
      if (isOn) window.ELH_AUTH.client.rpc("update_my_profile", { p_patch: { show_on_leaderboard: st.showOnLeaderboard } }).then(function (r) { if (r.error) toast(r.error.message, "warn"); else { window.ELH_AUTH.refreshProfile(); toast(st.showOnLeaderboard ? tr("You are visible on the leaderboard.", "Siz reytingda ko‘rinasiz.") : tr("You are hidden from the leaderboard.", "Siz reytingdan yashirildingiz."), "good"); } });
    };
    // sources
    renderSources($("#src-list", host));
    $("#src-add", host).onclick = function () { var n = $("#src-name", host).value.trim(), u = $("#src-url", host).value.trim(); if (!n || !u) { toast("Name and URL required.", "warn"); return; } st.sources.push({ name: n, url: u, active: true }); save(); navigate("settings"); };
    // AI
    $("#ai-save", host).onclick = function () { st.aiUrl = $("#ai-url", host).value.trim(); st.aiKeyConfigured = $("#ai-on", host).checked && !!st.aiUrl; save(); toast(st.aiKeyConfigured ? "AI enabled (proxy)." : "Running in demo mode.", "good"); };
    // data
    $("#data-export", host).onclick = exportBackup;
    $("#data-import", host).onclick = function () { $("#data-file", host).click(); };
    $("#data-file", host).onchange = function (e) { importBackup(e.target.files[0]); };
    var demo = $("#data-demo", host); if (demo) demo.onclick = function () { loadDemo(); toast("Demo progress loaded.", "good"); navigate("dashboard"); };
    $("#data-reset", host).onclick = function () {
      if (!confirm(tr("This will permanently erase all your progress. Continue?", "Bu barcha natijalaringizni butunlay o‘chiradi. Davom etasizmi?"))) return;
      var keepLevel = cefr(), keepName = S.profile.name;
      localStorage.removeItem(STORE_KEY); setState(null); S.profile.level = keepLevel; S.profile.name = keepName;
      applyTheme(); refreshChrome(); buildShell(); save(); navigate("dashboard"); toast(tr("All data reset.", "Ma’lumotlar o‘chirildi."), "");
    };
  };
  function toggle(label, id, on) { return '<label class="switch" style="display:flex;margin:8px 0"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + '><span class="track"></span><span class="small">' + esc(label) + '</span></label>'; }
  function renderSources(host) {
    host.innerHTML = "";
    S.settings.sources.forEach(function (s, i) {
      var r = el("div", { class: "flex between", style: "padding:6px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<label class="switch"><input type="checkbox"' + (s.active ? " checked" : "") + '><span class="track"></span><span class="small"><b>' + esc(s.name) + '</b><br><span class="faint">' + esc(s.url) + '</span></span></label><button class="btn sm danger">Remove</button>';
      $("input", r).onchange = function () { s.active = this.checked; save(); };
      $("button", r).onclick = function () { S.settings.sources.splice(i, 1); save(); renderSources(host); };
      host.appendChild(r);
    });
  }

  /* ---------------------------------------------------------------------
     DATA: export / import / demo / backup
  --------------------------------------------------------------------- */
  function exportBackup() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    downloadBlob(blob, "elh-backup-" + todayStr() + ".json");
    toast("Backup exported.", "good");
  }
  function importBackup(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () { try { S = JSON.parse(r.result); save(); applyTheme(); refreshChrome(); navigate("dashboard"); toast("Backup imported.", "good"); } catch (e) { toast("Invalid backup file.", "bad"); } };
    r.readAsText(file);
  }
  function loadDemo() {
    D.INDICATORS.forEach(function (i, idx) { var base = [78, 71, 74, 82, 80, 69, 76, 66, 63, 72, 68, 61][idx] || 70; S.indicators[i.key] = { current: base, previous: base - 4, target: 90 }; });
    S.streak = { count: 12, last: todayStr() };
    S.totals = { timeMin: 640, lessons: 34, words: 42, phrases: 18, speaking: 22, negotiations: 6, speeches: 4 };
    D.VOCABULARY.slice(0, 42).forEach(function (v) { S.vocab[v.term] = { mastery: "mastered", ease: 2.6, interval: 12, due: new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10), reps: 5 }; });
    S.savedPhrases = D.PHRASES.slice(0, 18).map(function (p) { return p.phrase; });
    S.activity = [["speaking", 82, "Two-minute policy explanation"], ["negotiation", 77, "Attracting Education Investment"], ["vocabulary", 90, "accreditation"], ["difficult", 74, "How do you ensure independence?"], ["writing", 80, "Official statement"], ["listening", 86, "Dictation"]].map(function (a) { return { date: todayStr(), ts: Date.now(), type: a[0], score: a[1], note: a[2] }; });
    save();
  }
  function downloadBlob(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }

  function exportPrint(title, text) {
    var w = window.open("", "_blank");
    if (!w) { toast("Allow pop-ups to export/print.", "warn"); return; }
    w.document.write('<html><head><title>' + esc(title) + '</title><style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#12233d;line-height:1.6}h1{color:#102a52;border-bottom:2px solid #c9a227;padding-bottom:8px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}.foot{margin-top:40px;color:#888;font-size:12px;border-top:1px solid #ccc;padding-top:8px}</style></head><body><h1>' + esc(title) + '</h1><pre>' + esc(text) + '</pre><div class="foot">Education Leadership English Hub · ' + todayStr() + '</div><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  /* ---------------------------------------------------------------------
     THEME, CHROME, FOCUS MODE
  --------------------------------------------------------------------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", S.settings.theme === "dark" ? "dark" : "light");
    document.documentElement.setAttribute("data-reduce-motion", S.settings.reduceMotion ? "true" : "false");
    var tb = $("#theme-toggle"); if (tb) tb.textContent = S.settings.theme === "dark" ? "☀️" : "🌙";
  }
  function refreshChrome() {
    var lv = cefr();
    $("#pill-level").textContent = (lv || "—") + " → C1";
    $("#pill-streak").innerHTML = "🔥 " + S.streak.count;
    var px = $("#pill-xp"); if (px) { var L = xpLevel(S.xp.total); px.textContent = "Lv " + L.level + " · " + S.xp.total + " XP"; px.title = (L.nextAt - S.xp.total) + " XP to level " + (L.level + 1); }
    var ab = $("#user-menu-btn"); if (ab) ab.textContent = (S.profile.name || "EL").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
    var un = $("#um-name"); if (un) un.textContent = S.profile.name || "";
    var ui = $("#um-id"); if (ui) { var P = window.ELH_AUTH && window.ELH_AUTH.profile(); ui.textContent = P ? ("ID: " + P.login_id + (P.role === "admin" ? " · admin" : "")) : tr("Local-only mode", "Faqat shu qurilma"); }
  }

  /* ---------------------------------------------------------------------
     BUILD SHELL & BOOT
  --------------------------------------------------------------------- */
  function emptyState(msg) { return '<div class="empty"><div class="big">🗂️</div>' + esc(msg) + '</div>'; }

  // Render one collapsible sidebar section (header toggles the group below).
  function addNavSection(nav, title, views, defaultCollapsed) {
    var stored = S.settings.navCollapsed[title];
    var collapsed = stored === undefined ? !!defaultCollapsed : !!stored;
    var hdr = el("button", { class: "nav-section nav-toggle" + (collapsed ? " collapsed" : ""), "aria-expanded": collapsed ? "false" : "true" });
    hdr.innerHTML = '<span>' + esc(title) + '</span><span class="caret">▾</span>';
    var group = el("div", { class: "nav-group" + (collapsed ? " collapsed" : "") });
    views.forEach(function (v) {
      var meta = NAV.filter(function (x) { return x[0] === v; })[0];
      if (!meta) return;
      var b = el("button", { class: "nav-item", "data-view": v });
      b.innerHTML = '<span class="ico">' + meta[2] + '</span> ' + meta[1] + (isLocked(v) ? ' <span class="lock" title="Unlocks at ' + LOCKED_BELOW[v] + '">🔒</span>' : '');
      b.onclick = function () { navigate(v); };
      group.appendChild(b);
    });
    hdr.onclick = function () {
      var isC = group.classList.toggle("collapsed");
      hdr.classList.toggle("collapsed", isC);
      hdr.setAttribute("aria-expanded", isC ? "false" : "true");
      S.settings.navCollapsed[title] = isC;
      save();
    };
    nav.appendChild(hdr);
    nav.appendChild(group);
  }

  function buildShell() {
    var nav = $("#nav");
    nav.innerHTML = "";
    if (!S.settings.navCollapsed) S.settings.navCollapsed = {};
    var sections = { Learn: ["dashboard", "today", "topics", "leaderboard"], Practice: ["vocab", "phrases", "speaking", "listening", "grammar", "writing"], Simulate: ["negotiation", "speeches", "difficult"], Grow: ["feed", "import", "assess", "progress", "goals", "settings"] };
    // Built-in sections default to expanded; add-on sections default to collapsed.
    Object.keys(sections).forEach(function (sec) { addNavSection(nav, sec, sections[sec], false); });
    if (window.ELH_AUTH && window.ELH_AUTH.isAdmin() && VIEWS.admin) addNavSection(nav, "Admin", ["admin"], false);
    EXTRA_SECTIONS.forEach(function (sec) { addNavSection(nav, sec.title, sec.views, true); });
    $$(".nav-item").forEach(function (bb) { bb.classList.toggle("active", bb.dataset.view === currentView); });
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (!S) load();
    // When signed in, the server profile is authoritative for level and name.
    var P = window.ELH_AUTH && window.ELH_AUTH.profile();
    if (P) {
      S.profile.level = P.cefr_level || null; S.profile.name = P.display_name || S.profile.name; S.profile.loginId = P.login_id;
      S.profile.organisation = P.organisation || S.profile.organisation || ""; S.profile.position = P.position || S.profile.position || "";
      S.settings.showOnLeaderboard = P.show_on_leaderboard !== false;
      if (P.streak_count != null) S.streak.count = P.streak_count;
    }
    if (!S.settings.uzChosen) { try { S.settings.uz = localStorage.getItem("elh_lang") === "uz" || S.profile.level === "A2"; } catch (e) { } }
    rollXpDay();
    applyTheme();
    buildShell();
    refreshChrome();
    // account menu
    var umb = $("#user-menu-btn"), um = $("#user-menu");
    if (umb && um) {
      umb.onclick = function (e) { e.stopPropagation(); um.hidden = !um.hidden; umb.setAttribute("aria-expanded", um.hidden ? "false" : "true"); };
      document.addEventListener("click", function () { um.hidden = true; umb.setAttribute("aria-expanded", "false"); });
      $$("[data-go]", um).forEach(function (b) { b.onclick = function () { um.hidden = true; navigate(b.dataset.go); }; });
      var so = $("#um-signout"); if (so) so.onclick = function () { if (window.ELH_AUTH) window.ELH_AUTH.signOut(); };
      if (!online()) { var sx = $("#um-signout"); if (sx) sx.innerHTML = "🔄 " + tr("Switch account", "Hisobni almashtirish"); }
    }
    window.addEventListener("online", flushXpQueue);
    flushXpQueue();
    if (online()) refreshStats();
    // top bar wiring
    $("#theme-toggle").onclick = function () { S.settings.theme = S.settings.theme === "dark" ? "light" : "dark"; applyTheme(); save(); };
    $("#focus-toggle").onclick = function () { document.body.classList.toggle("focus-mode"); toast(document.body.classList.contains("focus-mode") ? "Focus mode on." : "Focus mode off.", ""); };
    $("#menu-toggle").onclick = function () { document.body.classList.toggle("nav-open"); syncBottom(); };
    buildBottomNav();
    var nb = $("#nav-backdrop"); if (nb) nb.onclick = function () { document.body.classList.remove("nav-open"); syncBottom(); };
    // PWA service worker (only over http/https; harmless no-op on file://)
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    }
    $("#modal-backdrop").onclick = function (e) { if (e.target.id === "modal-backdrop") closeModal(); };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    // route
    var start = (location.hash || "").replace("#", "");
    navigate(VIEWS[start] ? start : "dashboard");
    // first-run welcome (local-only mode)
    if (!online() && !localStorage.getItem("elh_seen")) {
      localStorage.setItem("elh_seen", "1");
      setTimeout(function () { toast(tr("Welcome! Start with the placement test, or open Today’s Plan.", "Xush kelibsiz! Darajani aniqlash testidan boshlang yoki Bugungi rejani oching."), ""); }, 800);
    }
  }
  // Booting is triggered by auth.js once a session (or local-only mode) is established.

  // Public API: debugging/tests + extension points for add-on modules.
  window.ELH = {
    state: function () { return S; },
    setState: setState,
    save: save,
    reset: function () { localStorage.removeItem(STORE_KEY); load(); },
    nav: navigate,
    rerender: function () { navigate(currentView); },
    currentView: function () { return currentView; },
    boot: boot,
    registerView: registerView,
    registerNav: registerNav,
    data: D,
    content: C,
    LEVELS: LEVELS,
    cefr: cefr,
    levelIndex: function (l) { return LEVELS.indexOf(l); },
    setCefr: setCefr,
    t: tr,
    uzHints: function () { return !!S.settings.uz; },
    user: function () { var P = window.ELH_AUTH && window.ELH_AUTH.profile(); return P ? { id: P.id, loginId: P.login_id, displayName: P.display_name, role: P.role, organisation: P.organisation } : null; },
    isAdmin: function () { return !!(window.ELH_AUTH && window.ELH_AUTH.isAdmin()); },
    online: online,
    get sb() { return window.ELH_AUTH ? window.ELH_AUTH.client : null; },
    levelOf: levelOf,
    forLevel: forLevel,
    xp: { award: awardXp, level: xpLevel, total: function () { return S.xp.total; }, table: XP_TABLE, cap: XP_DAILY_CAP, skills: XP_SKILL },
    levels: { recordTest: recordTest, canRetakePlacement: canRetakePlacement, isLocked: isLocked },
    badges: function () { return S.badges; },
    badgeMeta: BADGES,
    grantBadge: grantBadge,
    openItem: openItem,
    activity: function () { return S.activity; },
    leagueBadge: leagueBadge,
    refreshChrome: refreshChrome,
    refreshStats: refreshStats,
    stats: function () { return statsCache; },
    todayStr: todayStr,
    makeRecognizer: makeRecognizer,
    hasSR: !!SR,
    exportPrint: exportPrint,
    ui: {
      el: el, esc: esc, toast: toast, modal: modal, closeModal: closeModal, speak: speak,
      bar: bar, ring: ring, scoreLine: scoreLine, field: field, emptyState: emptyState,
      trendArrow: trendArrow, wireGo: wireGo, shuffle: shuffle, clamp: clamp, hash: hash, uz: uz
    },
    scoring: { scoreResponse: scoreResponse, recordActivity: recordActivity, analyseWriting: analyseWriting, nextStepAdvice: nextStepAdvice }
  };
})();

