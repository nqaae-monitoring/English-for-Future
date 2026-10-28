/* =========================================================================
   English for Future — topics.js
   Topic pages: group module materials (vocabulary, phrases, grammar,
   listening, speaking, writing) under one topic id and host the topic-only
   activities (intro, reading, dialogue, extra exercises, role-play, final
   quiz, review cards, homework). Data comes from window.HUB_TOPICS (one file
   per topic under js/topics/). Progress lives in S.topics[topicId].
   Uses only existing platform components: ELH.ui, ELH.xp.award (existing XP
   rules), ELH.grantBadge, ELH.openItem, speechSynthesis via ELH.ui.speak.
   ========================================================================= */
(function () {
  "use strict";
  if (!window.ELH) return;
  var E = window.ELH, U = E.ui, el = U.el, esc = U.esc, toast = U.toast, t = E.t;
  var TOPICS = function () { return window.HUB_TOPICS || {}; };
  var cur = { id: null, sec: null };
  var FORMATIVE = ["reading", "listening", "matching", "gapfill", "order", "errors", "situations"];

  /* ---------------- state ---------------- */
  function S() { return E.state(); }
  function st(id) {
    var s = S(); if (!s.topics) s.topics = {};
    if (!s.topics[id]) s.topics[id] = { viewed: {}, scores: {}, quiz: { attempts: [], best: null }, xp: {}, drafts: {}, checks: {}, speakingDone: false, complete: false };
    var x = s.topics[id];
    ["viewed", "scores", "xp", "drafts", "checks"].forEach(function (k) { if (!x[k]) x[k] = {}; });
    if (!x.quiz) x.quiz = { attempts: [], best: null };
    return x;
  }
  function save() { E.save(); }
  function uzOn() { return E.uzHints(); }
  function uz(txt) { return uzOn() && txt ? '<div class="tp-uz">🇺🇿 ' + esc(txt) + '</div>' : ""; }
  function norm(s) { return String(s || "").trim().toLowerCase().replace(/[’‘ʼ`´]/g, "'").replace(/\s+/g, " "); }
  function normSentence(s) { return norm(s).replace(/[.!?]+$/, "").trim(); }
  function shuffle(arr, seed) {
    var a = arr.slice(), h = Math.abs(U.hash(String(seed))) || 1;
    for (var i = a.length - 1; i > 0; i--) { h = (h * 9301 + 49297) % 233280; var j = Math.floor(h / 233280 * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a;
  }
  function wordCount(s) { return (String(s || "").trim().match(/\S+/g) || []).length; }

  /* ---------------- module lookups ---------------- */
  function findVocab(term) { var C = E.content; return (C.A2.vocabulary || []).concat(C.B1.vocabulary || [], E.data.VOCABULARY).filter(function (v) { return v.term === term; })[0]; }
  function findPhrase(p) { var C = E.content; return (C.A2.phrases || []).concat(C.B1.phrases || [], E.data.PHRASES).filter(function (x) { return x.phrase === p; })[0]; }
  function findById(kind, id) { var C = E.content; return (C.A2[kind] || []).concat(C.B1[kind] || [], E.data[kind.toUpperCase()] || []).filter(function (x) { return x.id === id; })[0]; }
  function writingSubmitted(topic) { var w = findById("writing", topic.links.writing); if (!w) return null; var hits = (S().imported || []).filter(function (x) { return x.type === "Writing: " + w.type; }); return hits.length ? hits[hits.length - 1] : null; }
  function speakingRecorded(topic) { return (E.activity() || []).filter(function (a) { return a.type === "speaking" && a.note === topic.links.speaking; })[0] || null; }

  /* ---------------- completion & XP milestones (existing XP rules, each once) ---------------- */
  function formativeState(topic) {
    var x = st(topic.id), got = 0, max = 0, done = 0, n = 0;
    topic.sections.forEach(function (sec) { if (FORMATIVE.indexOf(sec.type) < 0) return; n++; max += sec.points || 0; var sc = x.scores[sec.id]; if (sc && sc.done) { done++; got += sc.correct; } });
    return { got: got, max: max, done: done, n: n, allDone: n > 0 && done === n };
  }
  function awardOnce(topic, key, type, opts) {
    var x = st(topic.id); if (x.xp[key]) return;
    x.xp[key] = new Date().toISOString(); save();
    E.xp.award(type, Object.assign({ note: topic.id + ":" + key }, opts || {}));
  }
  function checkMilestones(topic) {
    var x = st(topic.id), f = formativeState(topic);
    if (f.allDone) awardOnce(topic, "formative", "assessment", { score: Math.round(f.got / f.max * 100) });
    if (x.quiz.best != null && x.quiz.best >= (quizSection(topic).pass || 80)) awardOnce(topic, "quiz", "assessment", { score: x.quiz.best });
    var allViewed = topic.sections.every(function (s) { return x.viewed[s.id]; });
    var complete = allViewed && f.allDone && !!writingSubmitted(topic) && x.speakingDone && x.quiz.best != null && x.quiz.best >= (quizSection(topic).pass || 80);
    if (complete && !x.complete) {
      x.complete = true; x.completedAt = new Date().toISOString(); save();
      if (topic.badge && E.badgeMeta[topic.badge.code]) E.grantBadge(topic.badge.code);
      toast("🎉 " + t("Topic completed: " + topic.title_en, "Mavzu yakunlandi: " + topic.title_uz), "good");
    }
    return complete;
  }
  function quizSection(topic) { return topic.sections.filter(function (s) { return s.type === "quiz"; })[0] || {}; }
  function markViewed(topic, sec) { var x = st(topic.id); if (!x.viewed[sec.id]) { x.viewed[sec.id] = new Date().toISOString(); save(); } checkMilestones(topic); }
  function progressPct(topic) { var x = st(topic.id), n = topic.sections.length, v = topic.sections.filter(function (s) { return x.viewed[s.id]; }).length; return Math.round(v / n * 100); }

  /* ---------------- views ---------------- */
  function renderList(host) {
    var all = Object.keys(TOPICS()).map(function (k) { return TOPICS()[k]; }).sort(function (a, b) { return E.levelIndex(a.level) - E.levelIndex(b.level) || a.order - b.order; });
    host.innerHTML = '<div class="section-head"><div><h1>📖 ' + t("Topics", "Mavzular") + '</h1><p>' + t("Structured lessons that group vocabulary, phrases, grammar, listening, speaking and writing around one professional situation, with extra exercises and a final quiz.", "Bitta kasbiy vaziyat atrofida lug‘at, iboralar, grammatika, tinglash, nutq va yozuvni birlashtirgan tuzilmali darslar, qo‘shimcha mashqlar va yakuniy test bilan.") + '</p></div></div>';
    E.LEVELS.forEach(function (lv) {
      var items = all.filter(function (x) { return x.level === lv; }); if (!items.length) return;
      var wrap = el("div", { class: "mb" });
      wrap.innerHTML = '<h3>' + lv + ' · ' + esc(t({ A2: "Elementary", B1: "Intermediate", B2: "Upper-intermediate", C1: "Advanced" }[lv], { A2: "Boshlang‘ich", B1: "O‘rta", B2: "Yuqori o‘rta", C1: "Ilg‘or" }[lv])) + '</h3><div class="grid auto" id="tl-' + lv + '"></div>';
      host.appendChild(wrap);
      var grid = wrap.querySelector("#tl-" + lv);
      items.forEach(function (tp) {
        var x = st(tp.id), pct = progressPct(tp), q = x.quiz.best;
        var c = el("div", { class: "card" });
        c.innerHTML = '<div class="flex between"><span class="tag lvl lvl-' + tp.level + '">' + tp.level + ' · ' + tp.order + '</span>' + (x.complete ? '<span class="tp-status ok">✓ ' + t("Completed", "Yakunlangan") + '</span>' : (pct ? '<span class="tp-status pend">' + pct + '%</span>' : '')) + '</div>' +
          '<h3 style="margin-top:8px">' + esc(tp.title_en) + '</h3>' + (uzOn() ? '<div class="small muted">' + esc(tp.title_uz) + '</div>' : '') +
          '<p class="small muted">' + esc(uzOn() ? tp.desc_uz : tp.desc_en) + '</p>' +
          '<div class="small muted">⏱ ' + esc(tp.time) + ' · ' + esc(tp.skills.join(", ")) + (q != null ? ' · ' + t("Quiz best", "Test") + ' ' + q + '%' : '') + '</div>' + U.bar(pct) +
          '<button class="btn primary mt block">' + (pct ? t("Continue", "Davom etish") : t("Start topic", "Mavzuni boshlash")) + '</button>';
        c.querySelector("button").onclick = function () { open(tp.id); };
        grid.appendChild(c);
      });
    });
  }

  function open(id, secId) {
    var tp = TOPICS()[id]; if (!tp) { toast("Topic not found.", "warn"); return; }
    cur.id = id; cur.sec = secId || cur.sec || tp.sections[0].id;
    if (!tp.sections.some(function (s) { return s.id === cur.sec; })) cur.sec = tp.sections[0].id;
    E.nav("topic");
  }

  function renderTopic(host) {
    var tp = TOPICS()[cur.id];
    if (!tp) { var first = Object.keys(TOPICS())[0]; if (!first) { host.innerHTML = U.emptyState("No topics yet."); return; } cur.id = first; tp = TOPICS()[first]; cur.sec = tp.sections[0].id; }
    var x = st(tp.id), sec = tp.sections.filter(function (s) { return s.id === cur.sec; })[0] || tp.sections[0];
    host.innerHTML = '<div class="section-head"><div><div class="small muted">' + tp.level + ' · ' + t("Topic", "Mavzu") + ' ' + tp.order + ' · ' + esc(tp.category) + '</div><h1>' + esc(tp.title_en) + '</h1>' + (uzOn() ? '<p>' + esc(tp.title_uz) + '</p>' : '<p>' + esc(tp.desc_en) + '</p>') + '</div>' +
      '<div class="btn-row"><button class="btn" id="tp-back">← ' + t("All topics", "Barcha mavzular") + '</button><button class="btn" id="tp-progress">📊 ' + t("Results", "Natijalar") + '</button></div></div>' +
      '<div class="tp-layout"><div class="tp-side"><div class="card"><div class="small muted mb">' + t("Lesson steps", "Dars bosqichlari") + ' · ' + progressPct(tp) + '%</div>' + U.bar(progressPct(tp)) + '<div class="tp-steps mt" id="tp-steps"></div></div></div>' +
      '<div id="tp-main"></div></div>';
    host.querySelector("#tp-back").onclick = function () { E.nav("topics"); };
    host.querySelector("#tp-progress").onclick = function () { showResults(tp); };
    var steps = host.querySelector("#tp-steps");
    tp.sections.forEach(function (s, i) {
      var b = el("button", { class: "tp-step " + (s.id === sec.id ? "on " : "") + (x.viewed[s.id] ? "done" : ""), "aria-current": s.id === sec.id ? "step" : "false" });
      b.innerHTML = '<span class="n">' + (x.viewed[s.id] ? "✓" : (i + 1)) + '</span><span>' + esc(uzOn() ? s.title_uz : s.title_en) + '</span>';
      b.onclick = function () { cur.sec = s.id; E.nav("topic"); };
      steps.appendChild(b);
    });
    var main = host.querySelector("#tp-main");
    var card = el("div", { class: "card" });
    card.innerHTML = '<div class="flex between wrap"><div><div class="small muted">' + t("Step", "Bosqich") + ' ' + sec.order + '/' + tp.sections.length + '</div><h2 style="margin:0">' + esc(sec.title_en) + '</h2>' + (uzOn() ? '<div class="small muted">' + esc(sec.title_uz) + '</div>' : '') + '</div>' + (x.viewed[sec.id] ? '<span class="tp-status ok">✓ ' + t("Reviewed", "Ko‘rib chiqildi") + '</span>' : '') + '</div><div class="divider"></div><div id="tp-body"></div>';
    main.appendChild(card);
    var body = card.querySelector("#tp-body");
    (RENDER[sec.type] || renderUnknown)(body, tp, sec);
    // navigation footer
    var idx = tp.sections.indexOf(sec), prev = tp.sections[idx - 1], next = tp.sections[idx + 1];
    var foot = el("div", { class: "btn-row mt2" });
    foot.innerHTML = (prev ? '<button class="btn" id="tp-prev">← ' + esc(uzOn() ? prev.title_uz : prev.title_en) + '</button>' : '') + '<span class="spacer" style="flex:1"></span>' +
      (next ? '<button class="btn primary" id="tp-next">' + t("Done — next step", "Bajarildi — keyingi") + ' →</button>' : '<button class="btn primary" id="tp-next">✓ ' + t("Done — finish topic", "Bajarildi — mavzuni yakunlash") + '</button>');
    card.appendChild(foot);
    var pb = card.querySelector("#tp-prev"); if (pb) pb.onclick = function () { cur.sec = prev.id; E.nav("topic"); };
    card.querySelector("#tp-next").onclick = function () { onDone(tp, sec); if (next) { cur.sec = next.id; E.nav("topic"); } else showResults(tp); };
  }
  function onDone(tp, sec) {
    markViewed(tp, sec);
    if (sec.type === "vocabulary") awardOnce(tp, "vocab", "plan_step");
  }
  function renderUnknown(body, tp, sec) { body.innerHTML = U.emptyState("Unknown section type " + sec.type); }

  /* ---------------- results panel ---------------- */
  function showResults(tp) {
    var x = st(tp.id), f = formativeState(tp), q = quizSection(tp), w = writingSubmitted(tp), sp = speakingRecorded(tp);
    var rows = tp.sections.filter(function (s) { return FORMATIVE.indexOf(s.type) >= 0; }).map(function (s) { var sc = x.scores[s.id]; return '<div class="box"><span class="small muted">' + esc(uzOn() ? s.title_uz : s.title_en) + '</span><b>' + (sc && sc.done ? sc.correct + ' / ' + s.points : '— / ' + s.points) + '</b></div>'; }).join("");
    U.modal('<h2>📊 ' + t("Results", "Natijalar") + ' — ' + esc(tp.title_en) + '</h2><p class="small muted">' + t("Each skill is shown separately. Writing and speaking are not auto-scored.", "Har bir ko‘nikma alohida ko‘rsatiladi. Yozish va gapirish avtomatik baholanmaydi.") + '</p>' +
      '<div class="tp-score">' + rows +
      '<div class="box"><span class="small muted">' + t("Formative total", "Formativ jami") + '</span><b>' + f.got + ' / ' + f.max + '</b></div>' +
      '<div class="box"><span class="small muted">' + t("Final quiz (best)", "Yakuniy test (eng yaxshi)") + '</span><b>' + (x.quiz.best != null ? Math.round(x.quiz.best / 10) + ' / 10 · ' + x.quiz.best + '%' : '—') + '</b> <span class="small muted">' + t("pass", "o‘tish") + ' ' + (q.pass || 80) + '%</span></div>' +
      '<div class="box"><span class="small muted">' + t("Writing (20)", "Yozish (20)") + '</span><b>' + (w ? t("Submitted · self-assessed", "Yuborildi · o‘z-o‘zini baholash") : t("Not submitted", "Yuborilmagan")) + '</b></div>' +
      '<div class="box"><span class="small muted">' + t("Speaking (20)", "Gapirish (20)") + '</span><b>' + (x.speakingDone ? t("Done · self-assessed", "Bajarildi · o‘z-o‘zini baholash") : t("Not done", "Bajarilmagan")) + (sp ? ' <span class="small muted">(' + t("Studio rule-based score", "Studio avtomatik bali") + ' ' + sp.score + '/100 — ' + t("content & vocabulary only", "faqat mazmun va lug‘at") + ')</span>' : '') + '</b></div></div>' +
      '<div class="small mt2"><b>' + t("Completion", "Yakunlash") + ':</b> ' + (x.complete ? '✓ ' + t("Topic completed", "Mavzu yakunlangan") + (tp.badge ? ' · ' + tp.badge.icon + ' ' + esc(t(tp.badge.en, tp.badge.uz)) : '') : t("All steps reviewed, all exercises done, writing submitted, speaking done and quiz ≥ " + (q.pass || 80) + "%.", "Barcha bosqichlar ko‘rib chiqilgan, barcha mashqlar bajarilgan, yozish yuborilgan, gapirish bajarilgan va test ≥ " + (q.pass || 80) + "%.")) + '</div>' +
      '<div class="btn-row mt2"><button class="btn" id="tp-rc">' + t("Close", "Yopish") + '</button></div>');
    document.getElementById("tp-rc").onclick = U.closeModal;
  }

  /* ---------------- shared renderers ---------------- */
  // Multiple choice block with a single Check button; stores {correct,total,done}
  function mcBlock(body, tp, sec, questions, opts) {
    opts = opts || {};
    var x = st(tp.id), prev = x.scores[sec.id], picks = {};
    var qs = opts.shuffle ? questions.map(function (q) { return Object.assign({}, q, { options: shuffle(q.options, q.id + ":" + (opts.seed || "")) }); }) : questions;
    var wrap = el("div");
    qs.forEach(function (q, i) {
      var d = el("div", { class: "tp-q", "data-q": q.id });
      d.innerHTML = '<div class="stem">' + (i + 1) + '. ' + esc(q.q) + '</div>' + q.options.map(function (o, j) { return '<button type="button" class="tp-opt" data-o="' + esc(o.id) + '" role="radio" aria-checked="false"><b>' + "ABCD"[j] + '.</b> ' + esc(o.text) + '</button>'; }).join("") + '<div class="tp-fb" aria-live="polite"></div>';
      d.querySelectorAll(".tp-opt").forEach(function (b) { b.onclick = function () { if (d.dataset.locked) return; picks[q.id] = b.dataset.o; d.querySelectorAll(".tp-opt").forEach(function (z) { z.classList.toggle("on", z === b); z.setAttribute("aria-checked", z === b ? "true" : "false"); }); }; });
      wrap.appendChild(d);
    });
    var bar = el("div", { class: "btn-row mt" });
    bar.innerHTML = '<button class="btn primary" id="mc-check">' + t("Check answers", "Javoblarni tekshirish") + '</button>' + (prev && prev.done ? '<span class="tp-status ok">' + t("Last result", "Oxirgi natija") + ': ' + prev.correct + '/' + prev.total + '</span>' : '');
    body.appendChild(wrap); body.appendChild(bar);
    bar.querySelector("#mc-check").onclick = function () {
      var answered = qs.filter(function (q) { return picks[q.id]; }).length;
      if (answered < qs.length) { toast(t("Answer all " + qs.length + " questions first (" + answered + " done).", "Avval barcha " + qs.length + " savolga javob bering (" + answered + " ta bajarildi)."), "warn"); return; }
      var correct = 0;
      qs.forEach(function (q) {
        var d = wrap.querySelector('[data-q="' + q.id + '"]'), ok = picks[q.id] === q.answer; if (ok) correct++;
        d.dataset.locked = "1";
        d.querySelectorAll(".tp-opt").forEach(function (b) { b.disabled = true; if (b.dataset.o === q.answer) b.classList.add("ok"); else if (b.dataset.o === picks[q.id]) b.classList.add("bad"); });
        var right = q.options.filter(function (o) { return o.id === q.answer; })[0];
        d.querySelector(".tp-fb").innerHTML = (ok ? '<span class="ok">✓ ' + t("Correct", "To‘g‘ri") + '</span>' : '<span class="bad">✗ ' + t("Incorrect", "Noto‘g‘ri") + '</span> — ' + t("correct answer", "to‘g‘ri javob") + ': <b>' + esc(right.text) + '</b>') + (q.explain_en ? '<div class="small muted">' + esc(uzOn() && q.explain_uz ? q.explain_uz : q.explain_en) + '</div>' : '');
      });
      bar.querySelector("#mc-check").disabled = true;
      if (opts.onResult) opts.onResult(correct, qs.length); else { x.scores[sec.id] = { correct: correct, total: qs.length, done: true, at: new Date().toISOString() }; save(); toast(t("Score", "Natija") + ": " + correct + "/" + qs.length, correct === qs.length ? "good" : ""); checkMilestones(tp); }
      var again = el("button", { class: "btn" }, "↻ " + t("Try again", "Qayta urinish")); again.onclick = function () { E.nav("topic"); }; bar.appendChild(again);
    };
  }
  function linkBtn(label, kind, sel) { var b = el("button", { class: "btn" }, label); b.onclick = function () { E.openItem(kind, sel); }; return b; }

  /* ---------------- section renderers ---------------- */
  var RENDER = {};

  RENDER.intro = function (body, tp, sec) {
    var x = st(tp.id);
    body.innerHTML = '<div class="tp-card"><b>' + t("Situation", "Vaziyat") + '.</b> ' + esc(sec.situation_en) + uz(sec.situation_uz) + '</div>' +
      '<div class="mt"><b>' + t("Starter questions", "Boshlang‘ich savollar") + '</b><ol style="margin:6px 0 0 20px">' + sec.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join("") + '</ol></div>' +
      '<div class="small mt"><b>💡</b> ' + esc(sec.tip_en) + uz(sec.tip_uz) + '</div>' +
      '<div class="mt"><b>' + t("Outcome", "Natija") + '.</b> <span class="small">' + esc(tp.outcome_en) + '</span>' + (uzOn() ? '<ul class="small" style="margin:6px 0 0 18px">' + tp.outcomes_uz.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join("") + '</ul>' : '') + '</div>' +
      '<label class="field mt"><span>' + esc(sec.task_en) + (uzOn() ? ' · ' + esc(sec.task_uz) : '') + '</span><textarea id="tp-intro" rows="2" placeholder="' + esc(sec.sample) + '">' + esc(x.drafts.intro || "") + '</textarea></label>' +
      '<div class="small muted">' + t("Example", "Namuna") + ': ' + esc(sec.sample) + ' · ' + t("This is a diagnostic task: it is saved but not scored.", sec.note_uz) + '</div>';
    body.querySelector("#tp-intro").oninput = function () { x.drafts.intro = this.value; save(); };
  };

  RENDER.vocabulary = function (body, tp, sec) {
    var terms = tp.links.vocabulary.map(findVocab).filter(Boolean);
    body.innerHTML = '<p class="small muted">' + terms.length + ' ' + t("words. Tap 🔊 to hear a word. Full spaced-repetition practice is in the Vocabulary Lab.", "ta so‘z. 🔊 — eshitish. To‘liq takrorlash mashqi Vocabulary Lab bo‘limida.") + '</p><div class="tp-vocab" id="tp-vc"></div>' +
      '<div class="small mt tp-card">' + esc(sec.note_en) + uz(sec.note_uz) + '</div>';
    var grid = body.querySelector("#tp-vc");
    terms.forEach(function (v, i) {
      var c = el("div", { class: "tp-card" });
      var m = (S().vocab || {})[v.term];
      c.innerHTML = '<div class="flex between"><span class="term">' + (i + 1) + '. ' + esc(v.term) + '</span><button class="btn sm" aria-label="Listen to ' + esc(v.term) + '">🔊</button></div>' +
        (uzOn() ? '<div class="small" style="color:var(--accent)">' + esc(v.uz) + '</div>' : '') + '<div class="small muted">' + esc(v.def) + '</div><div class="small mt"><i>' + esc(v.example) + '</i></div>' +
        (m && m.mastery !== "new" ? '<span class="tag mt">' + esc(m.mastery) + '</span>' : '');
      c.querySelector("button").onclick = function () { U.speak(v.term + ". " + v.example, 0.9); };
      grid.appendChild(c);
    });
    var row = el("div", { class: "btn-row mt" });
    row.appendChild(linkBtn("📚 " + t("Practise in Vocabulary Lab", "Vocabulary Lab’da mashq qilish"), "vocab", { topic: tp.links.vocabTopic }));
    row.appendChild(linkBtn("❓ " + t("Quiz these words", "Shu so‘zlardan test"), "vocab", { topic: tp.links.vocabTopic, mode: "quiz" }));
    body.appendChild(row);
    if (!st(tp.id).xp.vocab) body.appendChild(el("div", { class: "small muted mt" }, t("Press “Done” below when you have reviewed the words (+10 XP, once).", "So‘zlarni ko‘rib chiqqach pastdagi “Bajarildi” ni bosing (+10 XP, bir marta).")));
  };

  RENDER.phrases = function (body, tp, sec) {
    var ps = tp.links.phrases.map(findPhrase).filter(Boolean), saved = S().savedPhrases || [];
    body.innerHTML = '<div id="tp-ph"></div><div class="tp-card mt"><b>' + t("Usage notes", "Qo‘llanish izohi") + '</b><ul class="small" style="margin:6px 0 0 18px">' + (uzOn() ? sec.usage_uz : sec.usage_en).map(function (u) { return '<li>' + esc(u) + '</li>'; }).join("") + '</ul></div>';
    var list = body.querySelector("#tp-ph");
    ps.forEach(function (p, i) {
      var d = el("div", { class: "tp-q" });
      d.innerHTML = '<div class="flex between wrap"><div><b>' + (i + 1) + '. ' + esc(p.phrase) + '</b>' + (uzOn() ? '<div class="small" style="color:var(--accent)">' + esc(p.uz) + '</div>' : '') + '<div class="small muted">' + esc(p.situation) + (p.alternatives.length ? ' · ' + t("Also", "Shuningdek") + ': ' + p.alternatives.map(esc).join(" / ") : '') + '</div></div>' +
        '<div class="btn-row"><button class="btn sm say" aria-label="Listen">🔊</button><button class="btn sm sv" aria-label="Save phrase">' + (saved.indexOf(p.phrase) >= 0 ? "★" : "☆") + '</button></div></div>';
      d.querySelector(".say").onclick = function () { U.speak(p.phrase); };
      d.querySelector(".sv").onclick = function () { var s = S().savedPhrases, k = s.indexOf(p.phrase); if (k >= 0) { s.splice(k, 1); this.textContent = "☆"; } else { s.push(p.phrase); this.textContent = "★"; S().totals.phrases = s.length; E.scoring.recordActivity("phrase_saved", 80, ["diplomacy"], p.phrase); toast(t("Saved to phrasebook.", "Iboralar daftariga saqlandi."), "good"); } save(); };
      list.appendChild(d);
    });
    var row = el("div", { class: "btn-row mt" }); row.appendChild(linkBtn("💬 " + t("Practise aloud in Phrase Bank", "Phrase Bank’da ovoz chiqarib mashq qilish"), "phrases", { cat: tp.links.phraseCat, level: "A2" })); body.appendChild(row);
  };

  RENDER.grammar = function (body, tp, sec) {
    body.innerHTML = sec.blocks.map(function (b) {
      return '<div class="mb"><h3>' + esc(b.title) + '</h3><ul style="margin:4px 0 0 18px">' + b.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join("") + '</ul>' +
        (b.sub ? b.sub.map(function (s) { return '<div class="small mt"><b>' + esc(s[0]) + ':</b> ' + s[1].map(esc).join(" · ") + '</div>'; }).join("") : '') +
        (b.note_en ? '<div class="small mt tp-card">' + esc(b.note_en) + uz(b.note_uz) + '</div>' : '') + '</div>';
    }).join("");
    var row = el("div", { class: "btn-row mt" }); row.appendChild(linkBtn("✍️ " + t("Do the exercises in Grammar", "Grammar bo‘limida mashqlarni bajarish"), "grammar", { id: tp.links.grammar, level: "A2" })); body.appendChild(row);
  };

  RENDER.reading = function (body, tp, sec) {
    body.innerHTML = '<div class="tp-card" style="line-height:1.7"><button class="btn sm" style="float:right" id="rd-say" aria-label="Listen to the text">🔊</button>' + esc(sec.text_en) + '</div>' +
      (uzOn() ? '<details class="mt"><summary class="small">🇺🇿 ' + t("Uzbek translation", "O‘zbekcha tarjima") + '</summary><div class="tp-uz">' + esc(sec.text_uz) + '</div></details>' : '') +
      '<h3 class="mt2">' + t("Comprehension", "Tushunish") + ' · ' + sec.points + ' ' + t("points", "ball") + '</h3>';
    body.querySelector("#rd-say").onclick = function () { U.speak(sec.text_en, 0.95); };
    mcBlock(body, tp, sec, sec.questions);
  };

  RENDER.dialogue = function (body, tp, sec) {
    var x = st(tp.id);
    body.innerHTML = '<div class="tp-dialog">' + sec.lines.map(function (l) { return '<div class="line"><span class="who">' + esc(l[0]) + ':</span><span>' + esc(l[1]) + '</span></div>'; }).join("") + '</div>' +
      '<div class="btn-row mt"><button class="btn sm" id="dg-say">🔊 ' + t("Listen to the dialogue", "Dialogni eshitish") + '</button></div>' +
      '<div class="small mt tp-card"><b>' + t("Notes", "Izohlar") + ':</b> ' + sec.notes.map(function (n) { return esc(uzOn() ? n[1] : n[0]); }).join(" · ") + '</div>' +
      '<h3 class="mt2">' + t("Your turn", "Sizning navbatingiz") + '</h3><p class="small">' + esc(sec.task_en) + uz(sec.task_uz) + '</p><div class="small muted">' + t("Replace", "Almashtiring") + ': ' + sec.placeholders.map(function (p) { return '<span class="tag">' + esc(p) + '</span>'; }).join(" ") + '</div>' +
      '<label class="field mt"><span>' + t("Your version of Aziz’s lines", "Aziz gaplarining sizning variantingiz") + '</span><textarea id="dg-ta" rows="6">' + esc(x.drafts.dialogue || sec.template) + '</textarea></label>' +
      '<div class="btn-row"><button class="btn" id="dg-reset">↺ ' + t("Reset template", "Shablonni qaytarish") + '</button><button class="btn" id="dg-prac">🔊 ' + t("Hear my version", "Mening variantimni eshitish") + '</button></div>';
    body.querySelector("#dg-say").onclick = function () { U.speak(sec.lines.map(function (l) { return l[1]; }).join(" "), 0.92); };
    body.querySelector("#dg-ta").oninput = function () { x.drafts.dialogue = this.value; save(); };
    body.querySelector("#dg-reset").onclick = function () { x.drafts.dialogue = sec.template; save(); E.nav("topic"); };
    body.querySelector("#dg-prac").onclick = function () { U.speak(body.querySelector("#dg-ta").value, 0.92); };
  };

  RENDER.listening = function (body, tp, sec) {
    var item = findById("listening", sec.listeningId), tts = !!window.speechSynthesis;
    var plays = 0;
    body.innerHTML = (tts ? '<div class="tp-card"><div class="flex between wrap"><div><b>🎧 ' + esc(item.title) + '</b> <span class="small muted">· ' + esc(item.accent) + ' · ' + t("browser text-to-speech", "brauzer ovoz sintezi") + '</span></div><div class="btn-row"><button class="btn primary sm" id="ls-play">▶ ' + t("Play", "Eshitish") + '</button><button class="btn sm" id="ls-stop">■</button></div></div>' +
      '<details class="mt"><summary class="small">📄 ' + t("Show transcript", "Matnni ko‘rsatish") + '</summary><div class="small mt" style="line-height:1.7">' + esc(item.text) + '</div></details></div>'
      : '<div class="tp-card"><span class="tp-status pend">' + t("Audio unavailable", "Audio mavjud emas") + '</span> <span class="small muted">' + t("Your browser has no text-to-speech, so this is a transcript-comprehension task: read the text and answer.", "Brauzeringizda ovoz sintezi yo‘q, shuning uchun bu matnni o‘qib tushunish topshirig‘i.") + '</span><div class="mt" style="line-height:1.7">' + esc(item.text) + '</div></div>') +
      (uzOn() ? '<div class="tp-uz">' + esc(item.uz) + '</div>' : '') +
      '<div class="small muted mt">' + t("Key words", "Asosiy so‘zlar") + ': ' + item.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div>' +
      '<h3 class="mt2">' + t("Questions", "Savollar") + ' · ' + sec.points + ' ' + t("points", "ball") + '</h3>';
    if (tts) {
      body.querySelector("#ls-play").onclick = function () { plays++; U.speak(item.text, 0.88); this.textContent = "▶ " + t("Play again", "Qayta eshitish"); };
      body.querySelector("#ls-stop").onclick = function () { window.speechSynthesis.cancel(); };
    }
    mcBlock(body, tp, sec, sec.questions);
    var row = el("div", { class: "btn-row mt" }); row.appendChild(linkBtn("🎧 " + t("Dictation & shadowing in Listening", "Listening bo‘limida diktant va shadowing"), "listening", { id: sec.listeningId, level: "A2" })); body.appendChild(row);
  };

  RENDER.matching = function (body, tp, sec) {
    var x = st(tp.id), prev = x.scores[sec.id], pairs = {}, sel = null;
    var rights = shuffle(sec.pairs.map(function (p) { return { id: p[0], text: p[2] }; }), sec.id + Date.now());
    body.innerHTML = '<p class="small">' + esc(sec.instructions_en) + uz(sec.instructions_uz) + ' <span class="muted">' + t("Click a word, then its meaning.", "So‘zni, keyin ma’nosini bosing.") + '</span></p><div class="tp-match"><div id="mt-l"></div><div id="mt-r"></div></div><div class="btn-row mt"><button class="btn primary" id="mt-check">' + t("Check", "Tekshirish") + '</button><button class="btn" id="mt-clear">' + t("Clear", "Tozalash") + '</button>' + (prev && prev.done ? '<span class="tp-status ok">' + t("Last result", "Oxirgi natija") + ': ' + prev.correct + '/' + prev.total + '</span>' : '') + '</div><div id="mt-fb" class="mt"></div>';
    var L = body.querySelector("#mt-l"), R = body.querySelector("#mt-r");
    function paint() {
      L.querySelectorAll(".tp-opt").forEach(function (b) { b.classList.toggle("on", sel === b.dataset.id); b.classList.toggle("paired", !!pairs[b.dataset.id]); var p = pairs[b.dataset.id]; b.querySelector(".pr").textContent = p ? " → " + rights.filter(function (r) { return r.id === p; })[0].text : ""; });
      R.querySelectorAll(".tp-opt").forEach(function (b) { b.classList.toggle("paired", Object.keys(pairs).some(function (k) { return pairs[k] === b.dataset.id; })); });
    }
    sec.pairs.forEach(function (p) { var b = el("button", { class: "tp-opt", "data-id": p[0] }); b.innerHTML = '<b>' + esc(p[1]) + '</b><span class="pr small muted"></span>'; b.onclick = function () { if (b.disabled) return; sel = p[0]; paint(); }; L.appendChild(b); });
    rights.forEach(function (r) { var b = el("button", { class: "tp-opt", "data-id": r.id }, esc(r.text)); b.onclick = function () { if (b.disabled || !sel) { if (!sel) toast(t("Choose a word first.", "Avval so‘zni tanlang."), ""); return; } Object.keys(pairs).forEach(function (k) { if (pairs[k] === r.id) delete pairs[k]; }); pairs[sel] = r.id; sel = null; paint(); }; R.appendChild(b); });
    body.querySelector("#mt-clear").onclick = function () { pairs = {}; sel = null; paint(); };
    body.querySelector("#mt-check").onclick = function () {
      if (Object.keys(pairs).length < sec.pairs.length) { toast(t("Match all " + sec.pairs.length + " words first.", "Avval barcha " + sec.pairs.length + " so‘zni moslashtiring."), "warn"); return; }
      var correct = 0, fb = [];
      sec.pairs.forEach(function (p) { var ok = pairs[p[0]] === p[0]; if (ok) correct++; fb.push('<div class="tp-fb ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓" : "✗") + ' ' + esc(p[1]) + ' → ' + esc(p[2]) + (ok ? '' : ' <span class="muted">(' + t("correct meaning", "to‘g‘ri ma’no") + ')</span>') + '</div>'); });
      body.querySelectorAll(".tp-opt").forEach(function (b) { b.disabled = true; }); this.disabled = true;
      body.querySelector("#mt-fb").innerHTML = fb.join("") + '<div class="mt"><b>' + t("Score", "Natija") + ': ' + correct + '/' + sec.pairs.length + '</b> <button class="btn sm" id="mt-again">↻ ' + t("Try again", "Qayta") + '</button></div>';
      body.querySelector("#mt-again").onclick = function () { E.nav("topic"); };
      x.scores[sec.id] = { correct: correct, total: sec.pairs.length, done: true, at: new Date().toISOString() }; save(); checkMilestones(tp);
    };
  };

  function textExercise(body, tp, sec, items, renderItem, checkItem) {
    var x = st(tp.id), prev = x.scores[sec.id];
    body.innerHTML = '<div id="tx-list"></div><div class="btn-row mt"><button class="btn primary" id="tx-check">' + t("Check", "Tekshirish") + '</button>' + (prev && prev.done ? '<span class="tp-status ok">' + t("Last result", "Oxirgi natija") + ': ' + prev.correct + '/' + prev.total + '</span>' : '') + '</div>';
    var list = body.querySelector("#tx-list");
    items.forEach(function (it, i) { var d = el("div", { class: "tp-q", "data-i": it.id }); d.innerHTML = renderItem(it, i) + '<div class="tp-fb" aria-live="polite"></div>'; list.appendChild(d); });
    list.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); body.querySelector("#tx-check").click(); } });
    body.querySelector("#tx-check").onclick = function () {
      var correct = 0, blank = 0;
      items.forEach(function (it) { var d = list.querySelector('[data-i="' + it.id + '"]'); var r = checkItem(it, d); if (r === null) { blank++; return; } if (r) correct++; });
      if (blank) { toast(t("Fill in all " + items.length + " items first.", "Avval barcha " + items.length + " topshiriqni to‘ldiring."), "warn"); return; }
      this.disabled = true; list.querySelectorAll("input,button.tp-chip").forEach(function (i) { i.disabled = true; });
      var again = el("button", { class: "btn" }, "↻ " + t("Try again", "Qayta")); again.onclick = function () { E.nav("topic"); }; this.parentNode.appendChild(again);
      toast(t("Score", "Natija") + ": " + correct + "/" + items.length, correct === items.length ? "good" : "");
      x.scores[sec.id] = { correct: correct, total: items.length, done: true, at: new Date().toISOString() }; save(); checkMilestones(tp);
    };
  }
  function fb(d, ok, right, explainEn, explainUz) { d.querySelector(".tp-fb").innerHTML = (ok ? '<span class="ok">✓ ' + t("Correct", "To‘g‘ri") + '</span>' : '<span class="bad">✗ ' + t("Incorrect", "Noto‘g‘ri") + '</span> — ' + t("correct answer", "to‘g‘ri javob") + ': <b>' + esc(right) + '</b>') + (explainEn ? '<div class="small muted">' + esc(uzOn() && explainUz ? explainUz : explainEn) + '</div>' : ''); }

  RENDER.gapfill = function (body, tp, sec) {
    textExercise(body, tp, sec, sec.items,
      function (it, i) { var parts = it.text.split("___"); return '<div class="tp-gap"><b>' + (i + 1) + '.</b> ' + esc(parts[0]) + '<input type="text" autocomplete="off" aria-label="Gap ' + (i + 1) + '">' + esc(parts[1] || "") + '</div>'; },
      function (it, d) { var v = norm(d.querySelector("input").value); if (!v) return null; var ok = it.answers.some(function (a) { return norm(a) === v; }); fb(d, ok, it.answers[0], it.explain_en, it.explain_uz); return ok; });
  };

  RENDER.order = function (body, tp, sec) {
    var built = {};
    textExercise(body, tp, sec, sec.items,
      function (it, i) { built[it.id] = []; return '<div><b>' + (i + 1) + '.</b> <span class="small muted">' + t("Click the words in order.", "So‘zlarni tartib bilan bosing.") + '</span></div><div class="tp-built" data-b="' + it.id + '" aria-live="polite">&nbsp;</div><div data-w="' + it.id + '">' + it.words.map(function (w, j) { return '<button type="button" class="tp-chip" data-j="' + j + '">' + esc(w) + '</button>'; }).join("") + '<button type="button" class="tp-chip" data-undo="1">⌫ ' + t("Undo", "Orqaga") + '</button></div>'; },
      function (it, d) { var v = normSentence(built[it.id].join(" ")); if (!built[it.id].length) return null; var ok = v === normSentence(it.answer); fb(d, ok, it.answer); return ok; });
    body.querySelectorAll("[data-w]").forEach(function (box) {
      var id = box.dataset.w, out = body.querySelector('[data-b="' + id + '"]'), item = sec.items.filter(function (x) { return x.id === id; })[0];
      box.querySelectorAll(".tp-chip").forEach(function (ch) {
        ch.onclick = function () {
          if (ch.dataset.undo) { built[id].pop(); } else { built[id].push(item.words[+ch.dataset.j]); ch.disabled = true; }
          var used = built[id].slice(); box.querySelectorAll(".tp-chip[data-j]").forEach(function (c) { var w = item.words[+c.dataset.j], k = used.indexOf(w); if (k >= 0) { used.splice(k, 1); c.disabled = true; } else c.disabled = false; });
          out.textContent = built[id].join(" ") || " ";
        };
      });
    });
  };

  RENDER.errors = function (body, tp, sec) {
    textExercise(body, tp, sec, sec.items,
      function (it, i) { return '<div><b>' + (i + 1) + '.</b> <span class="err-word">' + esc(it.wrong) + '</span></div><input type="text" style="margin-top:4px" autocomplete="off" placeholder="' + t("Write the correct sentence", "To‘g‘ri gapni yozing") + '" aria-label="Correction ' + (i + 1) + '">'; },
      function (it, d) { var v = normSentence(d.querySelector("input").value); if (!v) return null; var ok = it.answers.some(function (a) { return normSentence(a) === v; }); fb(d, ok, it.answers[0], it.explain_en, it.explain_uz); return ok; });
  };

  RENDER.situations = function (body, tp, sec) { body.innerHTML = '<p class="small muted">' + t("Choose the best response for each situation.", "Har bir vaziyat uchun eng mos javobni tanlang.") + '</p>'; mcBlock(body, tp, sec, sec.questions); };

  RENDER.writing = function (body, tp, sec) {
    var w = findById("writing", sec.writingId), x = st(tp.id), sub = writingSubmitted(tp);
    body.innerHTML = '<div class="tp-card"><b>' + t("Task", "Topshiriq") + '.</b> ' + esc(w.prompt) + uz(w.uz) + '</div>' +
      '<div class="small mt"><b>' + t("Template", "Shablon") + ':</b> ' + esc(w.tips[0].replace("Template: ", "")) + '</div>' +
      '<div class="small mt"><b>' + t("Model answer (open after writing)", "Namunaviy javob (yozganingizdan keyin oching)") + ':</b> <details><summary class="small">' + t("Show", "Ko‘rsatish") + '</summary><div class="tp-card mt">' + esc(w.model) + '</div></details></div>' +
      '<div class="mt"><b>' + t("Assessment rubric · 20 points", "Baholash mezoni · 20 ball") + '</b>' + w.rubric.map(function (r) { return '<div class="small" style="padding:4px 0;border-bottom:1px dashed var(--border)"><b>' + esc(t(r.name, r.uz)) + ' (0–' + r.max + ')</b> — ' + esc(r.desc) + '</div>'; }).join("") + '</div>' +
      '<div class="mt flex between wrap"><span>' + (sub ? '<span class="tp-status ok">✓ ' + t("Submitted", "Yuborildi") + ' · ' + esc(sub.date) + ' · ' + wordCount(sub.text) + ' ' + t("words", "so‘z") + '</span>' : '<span class="tp-status pend">' + t("Not submitted yet", "Hali yuborilmagan") + '</span>') + '</span></div>' +
      '<p class="small muted mt">' + t("Write and save your text in the Writing module (“Save version”). “Analyse writing” gives rule-based feedback on clarity, tone and vocabulary — it is not an AI grade, so the 20-point score is self-assessed with the checklist below.", "Matnni Writing bo‘limida yozib, “Save version” bilan saqlang. “Analyse writing” qoidalar asosida fikr beradi — bu AI bahosi emas, shuning uchun 20 ballik natija quyidagi ro‘yxat bilan o‘z-o‘zini baholashdir.") + '</p>' +
      '<div id="wr-check"></div>';
    var row = el("div", { class: "btn-row mt" }); row.appendChild(linkBtn("📝 " + t("Open the Writing module", "Writing bo‘limini ochish"), "writing", { id: sec.writingId, level: "A2" })); body.appendChild(row);
    checklist(body.querySelector("#wr-check"), tp, sec, uzOn() ? sec.checklist_uz : sec.checklist_en, "writing");
  };

  function checklist(host, tp, sec, items, key) {
    var x = st(tp.id); x.checks[key] = x.checks[key] || {};
    host.innerHTML = '<div class="mt"><b>' + t("Self-assessment", "O‘z-o‘zini baholash") + '</b>' + items.map(function (c, i) { return '<label class="check" style="margin:4px 0"><input type="checkbox" data-c="' + i + '"' + (x.checks[key][i] ? " checked" : "") + '><span>' + esc(c) + '</span></label>'; }).join("") + '</div>';
    host.querySelectorAll("input").forEach(function (cb) { cb.onchange = function () { x.checks[key][cb.dataset.c] = cb.checked; save(); }; });
  }

  RENDER.speaking = function (body, tp, sec) {
    var x = st(tp.id), task = (E.content.A2.speaking || []).filter(function (s) { return s.title === sec.speakingTitle; })[0] || {}, rec = speakingRecorded(tp);
    body.innerHTML = '<div class="tp-card"><b>' + t("Task", "Topshiriq") + '.</b> ' + esc(task.prompt || "") + uz(task.uz) + '</div>' +
      '<div class="small mt"><b>' + t("Plan", "Reja") + ':</b> ' + sec.plan.map(esc).join(" → ") + ' · ' + t("Preparation", "Tayyorlanish") + ': ' + sec.prep + ' s</div>' +
      '<div class="mt"><b>' + t("Assessment · 20 points (0–5 each)", "Baholash · 20 ball (har biri 0–5)") + ':</b> ' + sec.rubric.map(function (r) { return esc(t(r[0], r[1])); }).join(" · ") + '<div class="small muted">' + t("Pronunciation is judged by intelligibility, not by native-like accent. Without audio, intelligibility and fluency are not auto-scored.", "Talaffuz tushunarlilik bo‘yicha baholanadi, ona tili aksentiga o‘xshashlik bo‘yicha emas. Audio bo‘lmasa tushunarlilik va ravonlikka avtomatik ball qo‘yilmaydi.") + '</div></div>' +
      '<details class="mt"><summary class="small">' + t("Model speech (open after practising)", "Namunaviy nutq (mashqdan keyin oching)") + '</summary><div class="tp-card mt">' + esc(task.model || "") + '</div></details>' +
      '<div class="mt flex wrap" style="gap:10px;align-items:center"><div class="badge-score" id="sp-timer">01:00</div><button class="btn" id="sp-prep">⏱ ' + t("Start 60 s preparation", "60 s tayyorlanishni boshlash") + '</button><button class="btn" id="sp-aloud">🗣 ' + t("Practise aloud (45 s)", "Ovoz chiqarib mashq (45 s)") + '</button></div>' +
      '<label class="field mt"><span>' + t("My speech plan / notes (saved)", "Nutq rejam / qaydlar (saqlanadi)") + '</span><textarea id="sp-notes" rows="4">' + esc(x.drafts.speaking || "") + '</textarea></label>' +
      '<div class="small">' + (E.hasSR ? t("Recording with speech recognition is available in the Speaking Studio — it starts only when you press its microphone button. The Studio score is rule-based (content & vocabulary), not a full pronunciation grade.", "Nutqni yozib olish Speaking Studio’da mavjud — faqat mikrofon tugmasini bosganingizda boshlanadi. Studio bali qoidalar asosida (mazmun va lug‘at), to‘liq talaffuz bahosi emas.") : t("Speech recognition is not available in this browser: use “Practise aloud” with the timer, or type a transcript in the Speaking Studio.", "Bu brauzerda nutqni aniqlash yo‘q: taymer bilan “Ovoz chiqarib mashq” qiling yoki Speaking Studio’da matn kiriting.")) + (rec ? ' <span class="tp-status ok">Studio: ' + rec.score + '/100</span>' : '') + '</div>' +
      '<div id="sp-check"></div><div class="mt">' + (x.speakingDone ? '<span class="tp-status ok">✓ ' + t("Speaking practice done · self-assessed", "Gapirish mashqi bajarildi · o‘z-o‘zini baholash") + '</span>' : '<button class="btn primary" id="sp-done">✓ ' + t("I practised my introduction", "Tanishtiruvni mashq qildim") + '</button>') + '</div>';
    var timer = null, timerEl = body.querySelector("#sp-timer");
    function run(sec0, label) { clearInterval(timer); var left = sec0; var tick = function () { timerEl.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0"); if (left <= 0) { clearInterval(timer); toast(label, "good"); } left--; }; tick(); timer = setInterval(tick, 1000); }
    body.querySelector("#sp-prep").onclick = function () { run(sec.prep, t("Preparation time is over — speak!", "Tayyorlanish tugadi — gapiring!")); };
    body.querySelector("#sp-aloud").onclick = function () { run(45, t("Time! Tick the checklist.", "Vaqt tugadi! Ro‘yxatni belgilang.")); };
    body.querySelector("#sp-notes").oninput = function () { x.drafts.speaking = this.value; save(); };
    var sd = body.querySelector("#sp-done"); if (sd) sd.onclick = function () { x.speakingDone = true; save(); E.xp.award("speaking", { note: tp.id + ":speaking", meta: { kind: "topic" } }); checkMilestones(tp); E.nav("topic"); };
    var row = el("div", { class: "btn-row mt" }); row.appendChild(linkBtn("🎙️ " + t("Record in Speaking Studio", "Speaking Studio’da yozib olish"), "speaking", { title: sec.speakingTitle, level: "A2" })); body.appendChild(row);
    checklist(body.querySelector("#sp-check"), tp, sec, uzOn() ? sec.checklist_uz : sec.checklist_en, "speaking");
  };

  RENDER.roleplay = function (body, tp, sec) {
    var x = st(tp.id); x.drafts.roleplay = x.drafts.roleplay || [];
    var step = x.drafts.roleplay.length;
    body.innerHTML = '<div class="tp-card"><b>Alex</b> — ' + esc(sec.role_en) + uz(sec.role_uz) + '</div><p class="small muted">' + t("Card-based self-practice (no AI partner in this build): reply to each card in writing or aloud, then continue.", "Kartochkali mustaqil mashq (bu versiyada AI suhbatdosh yo‘q): har bir kartochkaga yozma yoki og‘zaki javob bering, so‘ng davom eting.") + '</p><div id="rp-log"></div>';
    var log = body.querySelector("#rp-log");
    sec.turns.forEach(function (turn, i) {
      if (i > step) return;
      var d = el("div", { class: "tp-q" });
      d.innerHTML = '<div><b style="color:var(--navy-500)">Alex:</b> ' + esc(turn) + ' <button class="btn sm" data-say="' + i + '" aria-label="Listen">🔊</button></div>' +
        (i < step ? '<div class="small mt"><b>' + t("You", "Siz") + ':</b> ' + esc(x.drafts.roleplay[i]) + '</div>' : '<div class="small muted mt">💡 ' + esc(sec.hints[i]) + '</div><textarea id="rp-in" rows="2" class="mt" placeholder="' + t("Your reply…", "Javobingiz…") + '"></textarea><div class="btn-row mt"><button class="btn primary" id="rp-next">' + t("Continue", "Davom etish") + '</button></div>');
      log.appendChild(d);
    });
    log.querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { U.speak(sec.turns[+b.dataset.say]); }; });
    var nx = log.querySelector("#rp-next");
    if (nx) nx.onclick = function () { var v = log.querySelector("#rp-in").value.trim(); if (!v) { toast(t("Write a short reply first.", "Avval qisqa javob yozing."), "warn"); return; } x.drafts.roleplay.push(v); save(); E.nav("topic"); };
    if (step >= sec.turns.length) {
      var end = el("div", { class: "tp-card mt" });
      var qs = x.drafts.roleplay.slice(sec.turns.length - 1 + 1).length;
      end.innerHTML = '<b>Alex:</b> ' + esc(sec.closing_en) + uz(sec.closing_uz) + '<div class="small mt">' + t("Your replies", "Javoblaringiz") + ': ' + x.drafts.roleplay.length + ' · ' + t("Did you ask Alex at least two questions? Tick the checklist in the Speaking step.", "Alexga kamida ikkita savol berdingizmi? Speaking bosqichidagi ro‘yxatni belgilang.") + '</div><div class="btn-row mt"><button class="btn" id="rp-reset">↺ ' + t("Start again", "Qaytadan") + '</button></div>';
      body.appendChild(end);
      end.querySelector("#rp-reset").onclick = function () { x.drafts.roleplay = []; save(); E.nav("topic"); };
    }
  };

  RENDER.quiz = function (body, tp, sec) {
    var x = st(tp.id), q = x.quiz, attempt = q.attempts.length + 1;
    body.innerHTML = '<p class="small">' + esc(sec.instructions_en) + uz(sec.instructions_uz) + '</p><div class="small muted mb">' + t("Pass mark", "O‘tish chegarasi") + ': ' + sec.pass + '% (' + Math.ceil(sec.questions.length * sec.pass / 100) + '/' + sec.questions.length + ') · ' + t("Attempt", "Urinish") + ' ' + attempt + (q.best != null ? ' · ' + t("Best", "Eng yaxshi") + ': <b>' + q.best + '%</b>' : '') + ' · ' + t("Retakes allowed; XP is given once.", "Qayta topshirish mumkin; XP bir marta beriladi.") + '</div>';
    mcBlock(body, tp, sec, sec.questions, { shuffle: true, seed: attempt, onResult: function (correct, total) {
      var pct = Math.round(correct / total * 100), passed = pct >= sec.pass;
      q.attempts.push({ date: E.todayStr(), correct: correct, total: total, pct: pct, passed: passed });
      q.best = q.best == null ? pct : Math.max(q.best, pct); save();
      var f = sec.feedback.filter(function (fx) { return pct >= fx.min; })[0];
      var res = el("div", { class: "tp-card mt2" });
      res.innerHTML = '<h3>' + (passed ? "🎉 " : "") + t("Result", "Natija") + ': ' + correct + '/' + total + ' (' + pct + '%) — ' + (passed ? '<span class="good-word">' + t("Passed", "O‘tdi") + '</span>' : '<span class="err-word">' + t("Not passed", "O‘tmadi") + '</span>') + '</h3><div>' + esc(f.en) + uz(f.uz) + '</div>' +
        (q.attempts.length > 1 ? '<div class="small muted mt">' + t("Attempts", "Urinishlar") + ': ' + q.attempts.map(function (a) { return a.correct + "/" + a.total; }).join(", ") + ' · ' + t("Best", "Eng yaxshi") + ' ' + q.best + '%</div>' : '');
      body.appendChild(res);
      // Log the attempt for the activity history WITHOUT awarding XP per attempt (type "topic_quiz" has no XP rule);
      // the quiz XP milestone is granted once by checkMilestones when the pass mark is first reached.
      E.scoring.recordActivity("topic_quiz", pct, ["grammar", "vocabulary"], tp.id + ":quiz:attempt" + attempt);
      checkMilestones(tp);
    } });
  };

  RENDER.review = function (body, tp, sec) {
    var i = 0, flipped = false;
    body.innerHTML = '<p class="small muted">' + t("Tap the card to flip. Front: the task; back: the phrase.", "Kartani bosing. Old tomoni: topshiriq; orqa tomoni: ibora.") + '</p><div class="tp-flash" id="rv-card" role="button" tabindex="0" aria-live="polite"></div><div class="flex between mt"><button class="btn" id="rv-prev">←</button><span class="small muted" id="rv-n"></span><button class="btn" id="rv-next">→</button></div>';
    var card = body.querySelector("#rv-card");
    function draw() { var c = sec.cards[i]; card.innerHTML = flipped ? '<div>' + esc(c[1]) + '</div>' : '<div><div class="small" style="opacity:.8">' + esc(sec.fronts_en[i]) + '</div>' + (uzOn() ? '<div class="mt">' + esc(c[0]) + '</div>' : '') + '</div>'; body.querySelector("#rv-n").textContent = (i + 1) + " / " + sec.cards.length; }
    card.onclick = function () { flipped = !flipped; draw(); if (flipped) U.speak(sec.cards[i][1]); };
    card.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); } };
    body.querySelector("#rv-prev").onclick = function () { i = (i - 1 + sec.cards.length) % sec.cards.length; flipped = false; draw(); };
    body.querySelector("#rv-next").onclick = function () { i = (i + 1) % sec.cards.length; flipped = false; draw(); };
    draw();
  };

  RENDER.homework = function (body, tp, sec) {
    body.innerHTML = '<ol style="margin:0 0 0 20px">' + (uzOn() ? sec.steps_uz : sec.steps_en).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ol><div class="small mt"><b>' + t("Question examples", "Savol namunalari") + ':</b> ' + sec.samples.map(esc).join(" · ") + '</div><div class="small muted mt">' + esc(uzOn() ? sec.note_uz : sec.note_en) + '</div><div id="hw-check"></div>';
    checklist(body.querySelector("#hw-check"), tp, sec, uzOn() ? sec.steps_uz : sec.steps_en, "homework");
  };

  /* ---------------- register ---------------- */
  E.registerView("topics", renderList);
  E.registerView("topic", renderTopic);
  window.ELH_TOPICS = { open: open, state: st, formative: formativeState, check: checkMilestones, list: TOPICS };
})();
