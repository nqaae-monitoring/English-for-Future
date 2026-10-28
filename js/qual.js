/* =========================================================================
   Qualifications English — qual.js
   Add-on module that plugs the Qualifications & Recognition domain into the
   existing platform via the window.ELH extension API. Non-destructive:
   registers new views + a sidebar section; stores its state under S.qual.
   ========================================================================= */
(function () {
  "use strict";
  if (!window.ELH || !window.QUAL_DATA) { console.warn("Qualifications module: ELH or QUAL_DATA missing"); return; }
  var Q = window.QUAL_DATA;
  var U = window.ELH.ui;
  var el = U.el, esc = U.esc, toast = U.toast, modal = U.modal, closeModal = U.closeModal,
    bar = U.bar, scoreLine = U.scoreLine, field = U.field, emptyState = U.emptyState,
    speak = U.speak, shuffle = U.shuffle, clamp = U.clamp, hash = U.hash, uz = U.uz, trendArrow = U.trendArrow;
  var score = window.ELH.scoring.scoreResponse, analyse = window.ELH.scoring.analyseWriting, advice = window.ELH.scoring.nextStepAdvice;
  var todayStr = window.ELH.todayStr;

  /* ---------- state ---------- */
  function S() { return window.ELH.state(); }
  function qs() {
    var st = S();
    if (!st.qual) {
      var ind = {};
      Q.INDICATORS.forEach(function (i) { var b = 52 + Math.abs(hash(i.key)) % 16; ind[i.key] = { current: b, previous: b, target: 90 }; });
      st.qual = { ind: ind, vocab: {}, saved: [], activity: [], cases: {}, feed: null };
      window.ELH.save();
    }
    if (!st.qual.ind) { st.qual.ind = {}; Q.INDICATORS.forEach(function (i) { st.qual.ind[i.key] = { current: 55, previous: 55, target: 90 }; }); }
    return st.qual;
  }
  function proficiency() { var Qs = qs().ind, k = Object.keys(Qs), s = 0; k.forEach(function (x) { s += Qs[x].current; }); return Math.round(s / k.length); }
  function weakest(n) { return Q.INDICATORS.slice().sort(function (a, b) { return qs().ind[a.key].current - qs().ind[b.key].current; }).slice(0, n || 3); }
  function strongest(n) { return Q.INDICATORS.slice().sort(function (a, b) { return qs().ind[b.key].current - qs().ind[a.key].current; }).slice(0, n || 3); }
  function qRecord(sc, keys, note) {
    var Qq = qs();
    (keys || []).forEach(function (k) { var ind = Qq.ind[k]; if (!ind) return; ind.previous = ind.current; ind.current = clamp(Math.round(ind.current + (sc - ind.current) * 0.25), 0, 100); });
    Qq.activity.unshift({ date: todayStr(), type: note || "qualifications", score: sc });
    Qq.activity = Qq.activity.slice(0, 200);
    window.ELH.scoring.recordActivity("qualifications", sc, [], note || "");
    S().totals.timeMin += 1;
    window.ELH.save();
  }
  function masteredCount() { var v = qs().vocab; return Object.keys(v).filter(function (t) { return v[t] === "mastered"; }).length; }

  /* ---------- register navigation + views ---------- */
  window.ELH.registerNav("Qualifications English", [
    ["qdash", "Q. Dashboard", "📗", vDash],
    ["qsystem", "System Overview", "🏛️", vSystem],
    ["qterms", "Terminology Library", "📚", vTerms],
    ["qcompare", "Concept Comparison", "⚖️", vCompare],
    ["qnqf", "NQF & SQF", "🧭", vNQF],
    ["qdevelop", "Development Chain", "🔗", vDevelop],
    ["qoutcomes", "Learning Outcomes", "🎯", vOutcomes],
    ["qassess", "Assessment & Certification", "📋", vAssess],
    ["qrecog", "Recognition Process", "🔎", vRecog],
    ["qcases", "Recognition Cases", "🗂️", vCases],
    ["qrpl", "Prior Learning (RPL)", "🧩", vRPL],
    ["qmicro", "Micro-Credentials", "🏅", vMicro],
    ["qintl", "Int’l Comparability", "🌍", vIntl],
    ["qdecision", "Decision Writing", "✍️", vDecision],
    ["qneg", "Negotiations", "🤝", vNeg],
    ["qinterview", "Recognition Interviews", "💬", vInterview],
    ["qdiff", "Difficult Questions", "❓", vDiff],
    ["qphrase", "Phrase Bank", "🗣️", vPhrase],
    ["qpresent", "Presentation Studio", "🖥️", vPresent],
    ["qdaily", "Daily & Weekly", "📅", vDaily],
    ["qfeed", "Knowledge Feed", "📰", vFeed],
    ["qassessment", "Monthly Assessment", "🏆", vAssessment]
  ]);

  function go(host) { U.wireGo(host); }
  function head(title, sub, right) {
    return '<div class="section-head"><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div>' + (right || "") + '</div>';
  }

  /* ---------- Dashboard ---------- */
  function vDash(host) {
    var daily = dailyLesson();
    host.innerHTML = head("Qualifications English", "Professional English for national qualifications systems and qualifications recognition — from A2 to C1.",
      '<div class="btn-row"><button class="btn primary" data-go="qdaily">▶ Today’s lesson</button></div>') +
      '<div class="kpi-band mb">' +
      '<div class="kpi"><div class="lbl">Proficiency Index</div><div class="num">' + proficiency() + '</div></div>' +
      '<div class="kpi"><div class="lbl">Terms mastered</div><div class="num">' + masteredCount() + '/' + Q.TERMS.length + '</div></div>' +
      '<div class="kpi"><div class="lbl">Cases solved</div><div class="num">' + Object.keys(qs().cases).length + '</div></div>' +
      '<div class="kpi"><div class="lbl">Saved phrases</div><div class="num">' + qs().saved.length + '</div></div></div>' +
      '<div class="grid cols-3 mb">' +
      '<div class="card" style="grid-column:span 2"><h3>15 professional competencies</h3><div class="card-sub mb">Qualifications & Recognition English Proficiency Index</div><div id="qind"></div></div>' +
      '<div class="card"><h3>Daily qualifications lesson</h3>' +
      dl("Term of the day", daily.term.term) + dl("Phrase of the day", daily.phrase) +
      dl("Concept comparison", daily.compare.a + " vs " + daily.compare.b) + dl("Recognition case", daily.case.title) +
      '<div class="divider"></div><div class="small muted">Speaking</div><p class="small" style="font-weight:600">' + esc(daily.speaking) + '</p>' +
      '<button class="btn sm" data-go="qdaily">Open daily lesson →</button></div></div>' +
      '<div class="grid cols-3">' +
      '<div class="card"><h3>Recommended now</h3><div id="qrec"></div></div>' +
      '<div class="card"><h3>Strengths</h3>' + strongest(3).map(function (i) { return '<div class="flex between" style="padding:6px 0"><span>' + i.ico + ' ' + esc(i.name) + '</span><b class="good-word">' + qs().ind[i.key].current + '</b></div>'; }).join("") + '</div>' +
      '<div class="card"><h3>Focus areas</h3>' + weakest(3).map(function (i) { return '<div style="padding:6px 0"><div class="flex between"><span>' + i.ico + ' ' + esc(i.name) + '</span><b style="color:var(--rose)">' + qs().ind[i.key].current + '</b></div><div class="small muted">' + esc(i.tip) + '</div></div>'; }).join("") + '</div></div>';
    var li = el("div"); host.querySelector("#qind").innerHTML = "";
    Q.INDICATORS.forEach(function (i) {
      var ind = qs().ind[i.key];
      var row = el("div", { class: "indicator-row" });
      row.innerHTML = '<span class="name">' + i.ico + ' ' + esc(i.name) + '</span>' + bar(ind.current) + '<span class="val">' + ind.current + ' ' + trendArrow(ind.current, ind.previous) + '</span>';
      host.querySelector("#qind").appendChild(row);
    });
    var rec = host.querySelector("#qrec");
    weakest(4).forEach(function (i) {
      var v = qs().ind[i.key].current;
      var reason = v < 60 ? "Score " + v + " — intensive practice." : v < 75 ? "Score " + v + " — reinforcement." : v < 90 ? "Score " + v + " — advanced application." : "Score " + v + " — maintenance.";
      var d = el("div", { class: "mb" });
      d.innerHTML = '<div style="font-weight:600">' + i.ico + ' ' + esc(i.name) + '</div><div class="small muted">' + esc(reason) + '</div><button class="btn sm mt" data-go="' + i.view + '">' + esc(i.tip) + '</button>';
      rec.appendChild(d);
    });
    go(host);
  }
  function dl(l, v) { return '<div class="flex between" style="padding:5px 0;border-bottom:1px dashed var(--border)"><span class="small muted">' + esc(l) + '</span><span class="small" style="font-weight:600;text-align:right;max-width:60%">' + esc(v) + '</span></div>'; }
  function dailyLesson() {
    var d = new Date().getDate();
    return {
      term: Q.TERMS[d % Q.TERMS.length], phrase: allPhrases()[d % allPhrases().length].p,
      compare: Q.COMPARISONS[d % Q.COMPARISONS.length], case: Q.CASES[d % Q.CASES.length],
      question: Q.QUESTIONS[d % Q.QUESTIONS.length],
      speaking: "Explain why a difference in programme duration does not automatically justify refusal of recognition."
    };
  }
  function allPhrases() { var out = []; Q.PHRASE_GROUPS.forEach(function (g) { g.phrases.forEach(function (p) { out.push({ p: p.p, uz: p.uz, tag: p.tag, group: g.group }); }); }); return out; }

  /* ---------- System Overview ---------- */
  function vSystem(host) {
    host.innerHTML = head("National Qualifications System — Overview", "Learn to present the whole system: framework, register, standards, assessment, recognition and their relationships.") +
      '<div class="card mb"><h3>What is a national qualifications system?</h3><p>A national qualifications system covers all the arrangements a country uses to <b>develop</b>, <b>award</b>, <b>quality-assure</b> and <b>recognise</b> qualifications. The <b>national qualifications framework</b> is one part of it — the instrument that classifies qualifications by level.' + uz("Milliy malaka tizimi malakalarni ishlab chiqish, berish, sifatini kafolatlash va tan olishning barcha tartiblarini qamrab oladi.") + '</p>' +
      '<div class="btn-row"><button class="btn sm" id="sys-say">🔊 Read aloud</button><button class="btn sm" data-go="qterms">System vocabulary →</button></div></div>' +
      '<div class="grid cols-3">' + [
        ["🧭", "Framework (NQF/SQF)", "Classifies qualifications by level using descriptors.", "qnqf"],
        ["🗂️", "Register", "Public database of approved qualifications and metadata.", "qterms"],
        ["🛠️", "Standards", "Occupational and qualification standards define competence.", "qdevelop"],
        ["📋", "Assessment", "Competence-based assessment, verification, moderation.", "qassess"],
        ["📜", "Certification", "Awarding qualifications and units.", "qassess"],
        ["🔎", "Recognition", "Accepting national and foreign qualifications.", "qrecog"]
      ].map(function (c) { return '<div class="card"><div class="ico-badge" style="background:var(--surface-2)">' + c[0] + '</div><h3>' + c[1] + '</h3><div class="small muted">' + c[2] + '</div><button class="btn sm mt" data-go="' + c[3] + '">Open →</button></div>'; }).join("") + '</div>' +
      '<div class="card mt"><h3>Speaking task</h3><p class="small">Explain the national qualifications system to an international delegation in 60 seconds. Mention the framework, standards, assessment and recognition.</p><button class="btn primary" data-go="qpresent">Prepare a presentation →</button></div>';
    host.querySelector("#sys-say").onclick = function () { speak("A national qualifications system covers all the arrangements a country uses to develop, award, quality-assure and recognise qualifications."); };
    go(host);
  }

  /* ---------- Terminology Library ---------- */
  var tFilter = "All", tIdx = 0, tMode = "flash";
  function vTerms(host) {
    host.innerHTML = head("Terminology Library", Q.TERMS.length + " qualifications & recognition terms across " + Q.TOPICS.length + " areas. Flashcards, quiz, and mastery tracking.",
      '<div class="btn-row"><button class="btn ' + (tMode === "flash" ? "primary" : "") + '" data-tm="flash">Flashcards</button><button class="btn ' + (tMode === "quiz" ? "primary" : "") + '" data-tm="quiz">Quiz</button></div>') +
      '<div class="chip-row mb" id="tf"><button class="chip ' + (tFilter === "All" ? "on" : "") + '" data-f="All">All</button>' +
      Q.TOPICS.map(function (t) { return '<button class="chip ' + (tFilter === t ? "on" : "") + '" data-f="' + esc(t) + '">' + esc(t) + '</button>'; }).join("") + '</div><div id="tbody"></div>';
    host.querySelectorAll("#tf .chip").forEach(function (c) { c.onclick = function () { tFilter = c.dataset.f; tIdx = 0; window.ELH.nav("qterms"); }; });
    host.querySelectorAll("[data-tm]").forEach(function (b) { b.onclick = function () { tMode = b.dataset.tm; tIdx = 0; window.ELH.nav("qterms"); }; });
    var items = tFilter === "All" ? Q.TERMS : Q.TERMS.filter(function (t) { return t.topic === tFilter; });
    if (!items.length) { host.querySelector("#tbody").innerHTML = emptyState("No terms in this filter."); return; }
    tMode === "quiz" ? tQuiz(host.querySelector("#tbody"), items) : tFlash(host.querySelector("#tbody"), items);
  }
  function tFlash(host, items) {
    tIdx = clamp(tIdx, 0, items.length - 1); var v = items[tIdx]; var m = qs().vocab[v.term] || "new";
    host.innerHTML = '<div class="flashcard" id="tc"><div class="flashcard-inner">' +
      '<div class="flash-face front"><div class="pos">' + esc(v.pos) + ' · ' + esc(v.topic) + '</div><div class="term">' + esc(v.term) + '</div><div class="pron">' + esc(v.pron) + '</div>' +
      '<div class="mt"><button class="btn sm" id="tsay">🔊 Pronounce</button></div><div class="faint small mt2">Tap to reveal →</div><div style="margin-top:auto"><span class="tag">' + esc(m) + '</span></div></div>' +
      '<div class="flash-face back"><div><b>Definition.</b> ' + esc(v.def) + uz(v.uz) + (v.ru ? ' <span class="faint small">🇷🇺 ' + esc(v.ru) + '</span>' : '') + '</div>' +
      (v.example ? '<div class="small mt"><b>Example.</b> <i>' + esc(v.example) + '</i></div>' : '') +
      (v.coll && v.coll.length ? '<div class="small mt"><b>Collocations.</b> ' + v.coll.map(esc).join(", ") + '</div>' : '') +
      (v.related && v.related.length ? '<div class="small"><b>Related.</b> ' + v.related.map(esc).join(", ") + '</div>' : '') +
      (v.contrast ? '<div class="small mt" style="color:var(--rose)"><b>Watch out.</b> ' + esc(v.contrast) + '</div>' : '') + '</div></div></div>' +
      '<div class="flex between mt2"><button class="btn" id="tprev">← Prev</button><div class="btn-row"><button class="btn danger" data-q="hard">Hard</button><button class="btn" data-q="learning">Good</button><button class="btn primary" data-q="mastered">Easy</button></div><button class="btn" id="tnext">Next →</button></div>' +
      '<div class="center small muted mt">' + (tIdx + 1) + ' / ' + items.length + '</div>';
    var tc = host.querySelector("#tc");
    tc.onclick = function (e) { if (e.target.id === "tsay") return; tc.classList.toggle("flipped"); };
    host.querySelector("#tsay").onclick = function (e) { e.stopPropagation(); speak(v.term + ". " + v.example, 0.95); };
    host.querySelector("#tprev").onclick = function () { tIdx = (tIdx - 1 + items.length) % items.length; tFlash(host, items); };
    host.querySelector("#tnext").onclick = function () { tIdx = (tIdx + 1) % items.length; tFlash(host, items); };
    host.querySelectorAll("[data-q]").forEach(function (b) {
      b.onclick = function () {
        qs().vocab[v.term] = b.dataset.q;
        var sc = b.dataset.q === "mastered" ? 90 : b.dataset.q === "learning" ? 72 : 55;
        qRecord(sc, ["q_system_vocab", "q_recognition"], v.term);
        toast(v.term + " → " + b.dataset.q, "good");
        tIdx = (tIdx + 1) % items.length; tFlash(host, items);
      };
    });
  }
  function tQuiz(host, items) {
    var v = items[Math.abs(hash(todayStr() + tIdx + tFilter)) % items.length];
    var opts = shuffle([v].concat(shuffle(Q.TERMS.filter(function (x) { return x.term !== v.term; })).slice(0, 3))).map(function (x) { return x.def; });
    host.innerHTML = '<div class="card"><div class="pos" style="color:var(--accent)">Choose the correct definition</div><h2>' + esc(v.term) + '</h2><div id="qc" class="mt"></div><div id="qfb" class="mt"></div><button class="btn mt2" id="qn" style="display:none">Next →</button></div>';
    opts.forEach(function (o) {
      var b = el("button", { class: "btn block mb", style: "text-align:left" }, esc(o));
      b.onclick = function () {
        host.querySelectorAll("#qc .btn").forEach(function (x) { x.disabled = true; });
        var ok = o === v.def; b.classList.add(ok ? "primary" : "danger");
        host.querySelector("#qfb").innerHTML = ok ? '<span class="good-word">✓ Correct.</span>' : '<span class="err-word">✗</span> ' + esc(v.def);
        qRecord(ok ? 90 : 50, ["q_recognition", "q_system_vocab"], v.term);
        if (ok) qs().vocab[v.term] = "mastered";
        host.querySelector("#qn").style.display = "";
      };
      host.querySelector("#qc").appendChild(b);
    });
    host.querySelector("#qn").onclick = function () { tIdx++; tQuiz(host, items); };
  }

  /* ---------- Concept Comparison ---------- */
  var cmpIdx = 0;
  function vCompare(host) {
    host.innerHTML = head("Concept Comparison Laboratory", Q.COMPARISONS.length + " pairs professionals routinely confuse. Learn to explain the difference precisely.") +
      '<div class="grid cols-3"><div class="card"><h3>Pairs</h3><div id="cl"></div></div><div class="card" style="grid-column:span 2"><div id="cd"></div></div></div>';
    var l = host.querySelector("#cl");
    Q.COMPARISONS.forEach(function (c, i) {
      var b = el("button", { class: "btn block mb " + (i === cmpIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:9px" }, esc(c.a) + " vs " + esc(c.b));
      b.onclick = function () { cmpIdx = i; window.ELH.nav("qcompare"); }; l.appendChild(b);
    });
    cmpDetail(host.querySelector("#cd"), Q.COMPARISONS[cmpIdx]);
  }
  function cmpDetail(host, c) {
    host.innerHTML = '<h2>' + esc(c.a) + ' <span class="muted">vs</span> ' + esc(c.b) + '</h2>' +
      '<div class="small"><b>Simple:</b> ' + esc(c.simple) + '</div><div class="small mt"><b>Professional:</b> ' + esc(c.pro) + '</div>' +
      '<table class="data mt"><thead><tr><th></th><th>' + esc(c.a) + '</th><th>' + esc(c.b) + '</th></tr></thead><tbody>' +
      c.diff.map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join("") + '</tbody></table>' +
      '<div class="small mt"><b>Education example:</b> ' + esc(c.eduEg) + '</div><div class="small"><b>Labour-market example:</b> ' + esc(c.lmEg) + '</div>' +
      '<div class="small mt" style="color:var(--rose)"><b>Common mistake:</b> ' + esc(c.mistake) + '</div>' +
      '<div class="divider"></div><div class="small"><b>Difficult follow-up:</b> ' + esc(c.question) + '</div>' +
      '<label class="field mt"><span>Your answer</span><textarea id="ca"></textarea></label><div class="btn-row"><button class="btn primary" id="ce">Evaluate</button><button class="btn" id="cm">Model answer</button></div><div id="cfb" class="mt"></div>';
    host.querySelector("#cm").onclick = function () { host.querySelector("#cfb").innerHTML = '<div class="card" style="background:var(--surface-2)"><b>Model</b><div class="small mt">' + esc(c.model) + '</div></div>'; speak(c.model, 0.99); };
    host.querySelector("#ce").onclick = function () {
      var t = host.querySelector("#ca").value.trim(); if (t.split(/\s+/).length < 12) { toast("Give a fuller answer.", "warn"); return; }
      var s = score(t, { expected: [c.a.toLowerCase(), c.b.toLowerCase()], targetWords: 70 });
      host.querySelector("#cfb").innerHTML = fbCard(s, "Follow the difference precisely: name what each term means and give one example.");
      qRecord(s.overall, ["q_comparison", "q_qa"], c.a + " vs " + c.b);
    };
  }
  function fbCard(s, tip) {
    return '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Overall ' + s.overall + '/100</div>' +
      scoreLine("Fluency/length", s.fluency) + scoreLine("Terminology", s.terminology) + scoreLine("Structure", s.structure) +
      (s.missed && s.missed.length ? '<div class="small mt"><b>Try to include:</b> ' + s.missed.map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join(" ") + '</div>' : '') +
      '<div class="small mt"><b>Advice:</b> ' + esc(tip || advice(s)) + '</div></div>';
  }

  /* ---------- NQF & SQF ---------- */
  function vNQF(host) {
    var sectors = ["Education", "Information technology", "Construction", "Healthcare", "Tourism & hospitality", "Agriculture", "Engineering", "Finance", "Transport", "Energy"];
    host.innerHTML = head("National & Sectoral Qualifications Frameworks", "Explain the framework at three levels of difficulty, then practise the key tasks.") +
      '<div class="card mb"><h3>Explain the framework — choose a register</h3><div class="chip-row" id="nlvl">' +
      ["Beginner", "Upper-intermediate", "Advanced"].map(function (l, i) { return '<button class="chip ' + (i === 0 ? "on" : "") + '" data-l="' + l + '">' + l + '</button>'; }).join("") + '</div><div id="nexp" class="mt"></div><button class="btn sm mt" id="nsay">🔊 Read aloud</button></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Practice tasks</h3><div class="small">' +
      ["Explain an eight-level framework.", "Compare two adjacent levels.", "Describe how a qualification is assigned to a level.", "Present the benefits of an NQF.", "Answer criticism about the value of an NQF.", "Explain how the NQF supports lifelong learning.", "Explain how employers use qualification levels.", "Describe how the NQF supports international mobility."].map(function (t, i) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span>' + (i + 1) + '. ' + esc(t) + '</span><button class="btn sm nprac" data-t="' + esc(t) + '">🎙️</button></div>'; }).join("") + '</div></div>' +
      '<div class="card"><h3>Sectoral framework (SQF)</h3><p class="small muted">A sectoral framework details qualifications within one sector, referenced to the NQF. Pick a sector to frame your example:</p><div class="chip-row">' +
      sectors.map(function (s) { return '<button class="chip nsec">' + esc(s) + '</button>'; }).join("") + '</div><div id="nsecout" class="small mt muted">Select a sector.</div></div></div>';
    var exps = {
      Beginner: "Our national qualifications framework is a ladder with eight levels. Each level shows how difficult the learning is. A qualification is placed on a level by looking at what the learner knows and can do. This helps students, employers and other countries understand our qualifications.",
      "Upper-intermediate": "The national qualifications framework classifies all qualifications across eight levels, each defined by descriptors of knowledge, skills and autonomy. Qualifications are assigned to a level by comparing their learning outcomes with the descriptors. The framework improves transparency, supports progression and lifelong learning, and enables international comparability.",
      Advanced: "The framework functions as a common reference architecture: eight levels, each articulated through descriptors of knowledge, skills and autonomy, against which qualifications are referenced by learning outcomes rather than duration. Underpinned by quality assurance and stakeholder validation, and referenced internationally, it renders qualifications transparent, portable and comparable, while remaining an instrument of classification rather than of award."
    };
    function setExp(l) { host.querySelector("#nexp").innerHTML = '<div style="background:var(--surface-2);padding:12px;border-radius:10px">' + esc(exps[l]) + '</div>'; host.querySelector("#nexp").dataset.cur = l; }
    setExp("Beginner");
    host.querySelectorAll("#nlvl .chip").forEach(function (c) { c.onclick = function () { host.querySelectorAll("#nlvl .chip").forEach(function (x) { x.classList.remove("on"); }); c.classList.add("on"); setExp(c.dataset.l); }; });
    host.querySelector("#nsay").onclick = function () { speak(exps[host.querySelector("#nexp").dataset.cur || "Beginner"]); };
    host.querySelectorAll(".nprac").forEach(function (b) { b.onclick = function () { practiceTask(b.dataset.t, ["national qualifications framework", "level descriptor", "learning outcome", "progression pathway"], ["q_framework", "q_presentation"]); }; });
    host.querySelectorAll(".nsec").forEach(function (b) { b.onclick = function () { host.querySelector("#nsecout").innerHTML = 'For <b>' + esc(b.textContent) + '</b>: describe the sector boundaries, the occupational groups, the level descriptors adapted to the sector, employer validation, and progression routes. Try: “Within the ' + esc(b.textContent.toLowerCase()) + ' sector, qualifications are mapped from level three to level six, validated with employers.”'; }; });
    go(host);
  }
  function practiceTask(prompt, expected, keys) {
    modal('<h3>Speaking / writing task</h3><p style="font-weight:600">' + esc(prompt) + '</p><p class="small muted">Type or dictate your answer, then evaluate. Aim to use: ' + expected.slice(0, 4).map(function (e) { return '<span class="tag">' + esc(e) + '</span>'; }).join(" ") + '</p>' +
      '<textarea id="pt-a" placeholder="Your answer..."></textarea><div class="btn-row mt"><button class="btn" id="pt-mic">🎙️</button><button class="btn primary" id="pt-eval">Evaluate</button><button class="btn" id="pt-close">Close</button></div><div id="pt-fb" class="mt"></div>');
    document.getElementById("pt-close").onclick = closeModal;
    document.getElementById("pt-mic").onclick = function () {
      var r = window.ELH.makeRecognizer(function (f, i) { document.getElementById("pt-a").value = f + i; }, function (f) { document.getElementById("pt-a").value = f; });
      if (!r) { toast("Speech recognition unavailable — please type.", "warn"); return; }
      r.start(); toast("Listening…", ""); setTimeout(function () { r.stop(); }, 30000);
    };
    document.getElementById("pt-eval").onclick = function () {
      var t = document.getElementById("pt-a").value.trim(); if (t.split(/\s+/).length < 10) { toast("Give a fuller answer.", "warn"); return; }
      var s = score(t, { expected: expected, targetWords: 90 });
      document.getElementById("pt-fb").innerHTML = fbCard(s);
      qRecord(s.overall, keys, prompt.slice(0, 40));
    };
  }

  /* ---------- Development Chain ---------- */
  function vDevelop(host) {
    host.innerHTML = head("Qualification Development Chain", "From labour-market intelligence to labour-market feedback — explain the full cycle in professional English.") +
      '<div class="card mb"><div class="stage-track">' + Q.DEV_CHAIN.map(function (s, i) { return '<div class="stage-node ' + (i === 0 ? "current" : "") + '" data-i="' + i + '"><div class="dot">' + (i + 1) + '</div><small>' + esc(s.stage.split(" ")[0]) + '</small></div>'; }).join("") + '</div>' +
      '<div id="dcd" class="mt2"></div></div>' +
      '<div class="card"><h3>Explain the whole chain</h3><p class="small muted">Practise at different lengths and registers.</p><div class="chip-row">' +
      ["60 seconds", "3 minutes", "5 minutes", "Conference register", "Simple public", "Investor-oriented", "Employer-oriented"].map(function (m) { return '<button class="chip dcm">' + esc(m) + '</button>'; }).join("") + '</div><div id="dcm-out" class="small muted mt">Choose a mode to get guidance, then use the Speaking Studio or a practice task.</div>' +
      '<button class="btn primary mt" id="dc-prac">Practise the chain →</button></div>';
    function showStage(i) {
      var s = Q.DEV_CHAIN[i];
      host.querySelector("#dcd").innerHTML = '<h3>' + (i + 1) + '. ' + esc(s.stage) + '</h3>' +
        '<div class="grid cols-2"><div class="small"><b>Responsible:</b> ' + esc(s.org) + '<br><b>Inputs:</b> ' + esc(s.input) + '<br><b>Outputs:</b> ' + esc(s.output) + '</div>' +
        '<div class="small"><b>Key terms:</b> ' + s.term.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '<br><b>Phrase:</b> “' + esc(s.phrase) + '”<br><b style="color:var(--rose)">Risk:</b> ' + esc(s.risk) + '</div></div>';
      host.querySelectorAll(".stage-node").forEach(function (n) { n.classList.toggle("current", +n.dataset.i === i); });
    }
    showStage(0);
    host.querySelectorAll(".stage-node").forEach(function (n) { n.onclick = function () { showStage(+n.dataset.i); }; });
    host.querySelectorAll(".dcm").forEach(function (b) { b.onclick = function () { host.querySelector("#dcm-out").innerHTML = guideFor(b.textContent); }; });
    host.querySelector("#dc-prac").onclick = function () { practiceTask("Explain the qualification development chain from labour-market intelligence to certification and feedback.", ["occupational standard", "qualification standard", "learning outcome", "assessment", "labour-market relevance"], ["q_presentation", "q_case"]); };
    go(host);
  }
  function guideFor(mode) {
    var m = {
      "60 seconds": "Name the chain end to end in one breath: labour-market needs → framework → standards → curriculum → delivery → assessment → certification → feedback.",
      "3 minutes": "Give one sentence per stage, naming the responsible body and the output.",
      "5 minutes": "Add a risk and a safeguard for each stage, with one concrete example.",
      "Conference register": "Frame it as a coherent, evidence-based system; use hedging and formal linkers.",
      "Simple public": "Use plain words: ‘We ask employers what skills are needed, then build qualifications to match, then check people really have those skills.’",
      "Investor-oriented": "Stress relevance, quality assurance and outcomes — the return on a trustworthy system.",
      "Employer-oriented": "Stress that standards come from employers and that assessment proves real competence."
    };
    return m[mode] || "";
  }

  /* ---------- Learning Outcomes ---------- */
  function vOutcomes(host) {
    host.innerHTML = head("Learning Outcomes Language Laboratory", "Write measurable, level-appropriate learning outcomes and improve weak ones.") +
      '<div class="grid cols-2"><div class="card"><h3>Action verbs by cognitive level</h3>' +
      Object.keys(Q.LO_VERBS).map(function (k) { return '<div class="small" style="padding:4px 0"><b>' + esc(k) + ':</b> ' + Q.LO_VERBS[k].map(esc).join(", ") + '</div>'; }).join("") +
      '<div class="small muted mt">Avoid vague verbs like “understand” or “know” — they cannot be observed or assessed.</div></div>' +
      '<div class="card"><h3>Improve a weak outcome</h3><div id="lo-ex"></div></div></div>' +
      '<div class="card mt"><h3>Learning-outcome checker</h3><p class="small muted">Paste a learning outcome; the tool checks whether it is measurable, observable and assessable.</p>' +
      '<textarea id="lo-in" placeholder="e.g. Evaluate institutional quality assurance arrangements against national standards..."></textarea><div class="btn-row mt"><button class="btn primary" id="lo-check">Check outcome</button></div><div id="lo-out" class="mt"></div></div>';
    var ex = host.querySelector("#lo-ex");
    Q.LO_EXAMPLES.forEach(function (e) {
      var d = el("div", { class: "mb" });
      d.innerHTML = '<div class="small err-word">✗ ' + esc(e.weak) + '</div><details><summary class="small muted" style="cursor:pointer">Show improved version</summary><div class="small good-word mt">✓ ' + esc(e.strong) + '</div></details>';
      ex.appendChild(d);
    });
    host.querySelector("#lo-check").onclick = function () {
      var t = host.querySelector("#lo-in").value.trim(); if (!t) { toast("Enter an outcome.", "warn"); return; }
      var r = checkOutcome(t);
      host.querySelector("#lo-out").innerHTML = '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Quality ' + r.score + '/100</div>' +
        r.checks.map(function (c) { return '<div class="small" style="padding:3px 0">' + (c.ok ? '<span class="good-word">✓</span>' : '<span class="err-word">✗</span>') + ' ' + esc(c.label) + '</div>'; }).join("") +
        (r.tips.length ? '<div class="small mt"><b>Suggestions:</b> ' + r.tips.map(esc).join(" ") + '</div>' : '<div class="good-word small mt">Well-formed outcome.</div>') + '</div>';
      qRecord(r.score, ["q_outcomes"], "learning outcome");
    };
  }
  function checkOutcome(t) {
    var lower = t.toLowerCase(), checks = [], tips = [];
    var strong = /\b(evaluate|assess|analyse|analyze|design|develop|formulate|apply|demonstrate|compare|justify|recommend|produce|construct|interpret|examine|appraise|critique|implement)\b/.test(lower);
    var vague = /\b(understand|know|be aware|learn about|appreciate|be familiar)\b/.test(lower);
    checks.push({ label: "Uses a measurable action verb", ok: strong && !vague });
    checks.push({ label: "Observable / assessable performance", ok: strong && t.split(/\s+/).length > 6 });
    checks.push({ label: "Specifies the object of learning", ok: t.split(/\s+/).length > 8 });
    checks.push({ label: "Condition or standard included", ok: /\b(against|in accordance|to the standard|using|based on|in line with)\b/.test(lower) });
    checks.push({ label: "Not vague ('understand'/'know')", ok: !vague });
    if (vague) tips.push("Replace ‘understand/know’ with an observable verb (evaluate, analyse, apply).");
    if (!/\b(against|using|in accordance)\b/.test(lower)) tips.push("Add a condition or standard (e.g. ‘against national standards’).");
    if (t.split(/\s+/).length < 8) tips.push("Be more specific about what and how.");
    var okc = checks.filter(function (c) { return c.ok; }).length;
    return { score: Math.round(okc / checks.length * 100), checks: checks, tips: tips };
  }

  /* ---------- Assessment & Certification ---------- */
  function vAssess(host) {
    var terms = Q.TERMS.filter(function (t) { return t.topic === "Assessment"; });
    host.innerHTML = head("Assessment & Certification", "The language of assessment strategy, verification, moderation, reliability, validity and certification.") +
      '<div class="card mb"><h3>Key terminology</h3><div class="grid auto">' + terms.map(function (t) { return '<div style="padding:6px 0"><b>' + esc(t.term) + '</b><div class="small muted">' + esc(t.def) + '</div></div>'; }).join("") + '</div><button class="btn sm mt" data-go="qterms">Study as flashcards →</button></div>' +
      '<div class="card"><h3>Speaking tasks</h3><div class="small">' +
      ["Explain the difference between reliability and validity.", "Describe how moderation protects fairness.", "Explain internal vs external verification.", "Describe competence-based assessment to an employer."].map(function (t) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span>' + esc(t) + '</span><button class="btn sm ap" data-t="' + esc(t) + '">🎙️</button></div>'; }).join("") + '</div></div>';
    host.querySelectorAll(".ap").forEach(function (b) { b.onclick = function () { practiceTask(b.dataset.t, ["reliability", "validity", "moderation", "verification", "certification"], ["q_assessment", "q_certification"]); }; });
    go(host);
  }

  /* ---------- Recognition Process ---------- */
  function vRecog(host) {
    host.innerHTML = head("Recognition of Qualifications — Process", "The full recognition procedure in twelve steps, plus academic vs professional recognition.") +
      '<div class="card mb"><div class="flex between"><h3>Academic vs professional recognition</h3><button class="btn sm" data-go="qcompare">Compare →</button></div>' +
      '<p class="small"><b>Academic recognition</b> is for further study; <b>professional recognition</b> is for the right to practise, often in a regulated profession with extra conditions.</p></div>' +
      '<div class="card"><h3>The twelve steps</h3><div id="rp"></div></div>';
    var rp = host.querySelector("#rp");
    Q.RECOG_PROCESS.forEach(function (s, i) {
      var d = el("div", { style: "padding:9px 0;border-bottom:1px solid var(--border)" });
      d.innerHTML = '<div class="flex between"><b>' + (i + 1) + '. ' + esc(s.step) + '</b><span>' + s.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</span></div>' +
        '<div class="small mt"><b>Phrase:</b> “' + esc(s.phrase) + '” <span class="err-word" style="margin-left:8px">Avoid:</span> ' + esc(s.mistake) + '</div>';
      rp.appendChild(d);
    });
    var b = el("button", { class: "btn primary mt2" }, "Practise explaining the process");
    b.onclick = function () { practiceTask("Walk an applicant through the recognition procedure from submission to appeal.", ["verification of authenticity", "comparability", "substantial difference", "recognition decision", "appeal procedure"], ["q_recognition", "q_academic"]); };
    host.querySelector(".card:last-child").appendChild(b);
    go(host);
  }

  /* ---------- Recognition Cases ---------- */
  var caseIdx = null;
  function vCases(host) {
    if (caseIdx != null) return caseRun(host, Q.CASES[caseIdx]);
    host.innerHTML = head("Recognition Case Simulator", Q.CASES.length + " realistic cases. Analyse the issues, decide the outcome, and compare with a model analysis.") +
      '<div class="grid auto" id="cl"></div>';
    var l = host.querySelector("#cl");
    Q.CASES.forEach(function (c, i) {
      var done = qs().cases[c.id];
      var d = el("div", { class: "card" });
      d.innerHTML = '<div class="flex between"><span class="tag">Case ' + c.id + '</span>' + (done ? '<span class="good-word small">✓ ' + done + '</span>' : '') + '</div><h3 style="margin-top:6px">' + esc(c.title) + '</h3><div class="small muted">' + esc(c.profile) + '</div><button class="btn primary mt block">Analyse case</button>';
      d.querySelector("button").onclick = function () { caseIdx = i; window.ELH.nav("qcases"); };
      l.appendChild(d);
    });
  }
  function caseRun(host, c) {
    host.innerHTML = '<div class="section-head"><div><h1>Case ' + c.id + ': ' + esc(c.title) + '</h1><p>Analyse and decide, then compare with the model.</p></div><button class="btn ghost" id="cx">← All cases</button></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Brief</h3>' +
      '<div class="small"><b>Applicant.</b> ' + esc(c.profile) + '</div><div class="small mt"><b>Context.</b> ' + esc(c.ctx) + '</div><div class="small mt"><b>Purpose.</b> ' + esc(c.purpose) + '</div>' +
      '<div class="small mt"><b>Issues.</b><ul style="margin:4px 0 0 18px">' + c.issues.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>Useful terms.</b> ' + c.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div></div>' +
      '<div class="card"><h3>Your analysis & decision</h3><label class="field"><span>Recommended outcome</span><select id="c-out">' +
      ["Full recognition", "Partial recognition", "Conditional recognition", "Request additional evidence", "Alternative recognition", "Refusal with justification"].map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select></label>' +
      '<label class="field"><span>Justification (position, evidence, proportionality, recommendation)</span><textarea id="c-just" style="min-height:130px"></textarea></label>' +
      '<div class="btn-row"><button class="btn" id="c-mic">🎙️ Dictate</button><button class="btn primary" id="c-eval">Evaluate</button><button class="btn" id="c-model">Model analysis</button></div><div id="c-fb" class="mt"></div></div></div>';
    host.querySelector("#cx").onclick = function () { caseIdx = null; window.ELH.nav("qcases"); };
    host.querySelector("#c-model").onclick = function () { host.querySelector("#c-fb").innerHTML = '<div class="card" style="background:var(--surface-2)"><b>Model analysis</b><div class="small mt">' + esc(c.model) + '</div><div class="small mt"><b>Likely outcome:</b> ' + esc(c.outcome) + '</div></div>'; };
    host.querySelector("#c-mic").onclick = function () { var r = window.ELH.makeRecognizer(function (f, i) { host.querySelector("#c-just").value = f + i; }, function (f) { host.querySelector("#c-just").value = f; }); if (!r) { toast("Speech recognition unavailable — please type.", "warn"); return; } r.start(); toast("Listening…", ""); setTimeout(function () { r.stop(); }, 40000); };
    host.querySelector("#c-eval").onclick = function () {
      var t = host.querySelector("#c-just").value.trim(); if (t.split(/\s+/).length < 15) { toast("Give a fuller justification.", "warn"); return; }
      var s = score(t, { expected: c.vocab, targetWords: 110 });
      var chosen = host.querySelector("#c-out").value;
      var aligned = c.outcome.toLowerCase().indexOf(chosen.toLowerCase().split(" ")[0]) >= 0;
      host.querySelector("#c-fb").innerHTML = '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Analysis ' + s.overall + '/100</div>' +
        scoreLine("Reasoning/length", s.fluency) + scoreLine("Terminology", s.terminology) + scoreLine("Structure", s.structure) +
        '<div class="small mt"><b>Your outcome:</b> ' + esc(chosen) + ' — ' + (aligned ? '<span class="good-word">consistent with the model</span>' : '<span class="err-word">differs from the model (' + esc(c.outcome) + ')</span>') + '</div>' +
        '<div class="small mt"><b>Advice:</b> Ensure you weigh proportionality and cite evidence. See the model analysis.</div></div>';
      qs().cases[c.id] = chosen.split(" ")[0]; qRecord(s.overall, ["q_case", "q_decision", "q_recognition"], "case " + c.id);
    };
  }

  /* ---------- RPL ---------- */
  function vRPL(host) {
    host.innerHTML = head("Recognition of Prior Learning (RPL)", "Explain and defend RPL: purpose, evidence, portfolio, competence interview, safeguards.") +
      '<div class="card mb"><h3>What RPL is</h3><p class="small">RPL awards credit or a qualification for learning gained through experience — formal, non-formal or informal. It maps evidence to learning outcomes and assesses it with the same rigour as any assessment.' + uz("RPL — tajriba orqali olingan bilimni tan olish; dalillar o‘quv natijalariga moslashtiriladi.") + '</p></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Practice activities</h3><div class="small">' +
      ["Explain RPL to an employer.", "Explain RPL to an adult learner.", "Defend the reliability of RPL.", "Compare RPL with traditional education.", "Explain how you check evidence authenticity."].map(function (t) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span>' + esc(t) + '</span><button class="btn sm rp" data-t="' + esc(t) + '">🎙️</button></div>'; }).join("") + '</div></div>' +
      '<div class="card"><h3>Mini portfolio check</h3><p class="small muted">List evidence a candidate offers; the tool flags likely gaps against outcomes.</p><textarea id="rpl-in" placeholder="e.g. 5 years as a network technician, employer reference, project reports..."></textarea><button class="btn primary mt" id="rpl-go">Map evidence</button><div id="rpl-out" class="small mt"></div></div></div>';
    host.querySelectorAll(".rp").forEach(function (b) { b.onclick = function () { practiceTask(b.dataset.t, ["recognition of prior learning", "portfolio assessment", "authenticity", "competence-based assessment", "learning outcome"], ["q_professional", "q_qa"]); }; });
    host.querySelector("#rpl-go").onclick = function () {
      var t = host.querySelector("#rpl-in").value.trim(); if (!t) { toast("List some evidence.", "warn"); return; }
      var hasExp = /year|experience|worked|technician|manager/i.test(t), hasDoc = /reference|report|certificate|portfolio|letter/i.test(t);
      host.querySelector("#rpl-out").innerHTML = '<div class="card" style="background:var(--surface-2)">' +
        '<div>' + (hasExp ? '<span class="good-word">✓</span> Experience evidence present' : '<span class="err-word">✗</span> Add evidence of experience') + '</div>' +
        '<div>' + (hasDoc ? '<span class="good-word">✓</span> Documentary evidence present' : '<span class="err-word">✗</span> Add documentary evidence (references, reports)') + '</div>' +
        '<div class="small mt"><b>Next:</b> map each item to specific learning outcomes, then plan a competence interview or practical demonstration for any gaps.</div></div>';
      qRecord(hasExp && hasDoc ? 82 : 66, ["q_professional", "q_case"], "RPL mapping");
    };
    go(host);
  }

  /* ---------- Micro-credentials ---------- */
  function vMicro(host) {
    host.innerHTML = head("Micro-Credentials", "Discuss definition, quality, level, recognition, stacking and digital verification — and debate the open questions.") +
      '<div class="card mb"><h3>Key questions to debate</h3><div class="chip-row">' +
      ["Should every micro-credential be credit-bearing?", "Who should regulate micro-credentials?", "Can they form part of a full qualification?", "How should quality be assured?", "How can employers verify them?", "When should universities recognise them?"].map(function (qq) { return '<button class="chip mq" data-q="' + esc(qq) + '">' + esc(qq) + '</button>'; }).join("") + '</div><div id="mq-out" class="small muted mt">Pick a question to practise a 60-second argument.</div></div>' +
      '<div class="grid cols-2"><div class="card"><h3>Design a micro-credential</h3>' +
      field("Title", '<input id="mc-t" type="text" placeholder="e.g. Recognising Foreign Qualifications">') +
      field("Learning outcome", '<input id="mc-o" type="text" placeholder="Evaluate a foreign qualification against the framework">') +
      field("Workload (hours)", '<input id="mc-w" type="number" value="25">') +
      field("Level", '<select id="mc-l">' + [4, 5, 6, 7, 8].map(function (n) { return '<option>' + n + '</option>'; }).join("") + '</select>') +
      '<label class="switch" style="margin:6px 0"><input type="checkbox" id="mc-c" checked><span class="track"></span><span class="small">Credit-bearing</span></label>' +
      '<button class="btn primary" id="mc-go">Check design</button></div>' +
      '<div class="card"><h3>Design feedback</h3><div id="mc-fb">' + emptyState("Complete the design to see whether it is recognisable and stackable.") + '</div></div></div>';
    host.querySelectorAll(".mq").forEach(function (b) { b.onclick = function () { host.querySelector("#mq-out").innerHTML = 'Argue in 60 seconds: <b>' + esc(b.dataset.q) + '</b> Use terms like metadata, quality assurance, level, stackable. '; practiceTask(b.dataset.q, ["micro-credential", "metadata", "quality assurance mechanism", "stackable credential", "level"], ["q_qa", "q_diplomacy"]); }; });
    host.querySelector("#mc-go").onclick = function () {
      var t = host.querySelector("#mc-t").value.trim(), o = host.querySelector("#mc-o").value.trim(), w = +host.querySelector("#mc-w").value, cb = host.querySelector("#mc-c").checked;
      var strong = /\b(evaluate|analyse|apply|design|assess|demonstrate)\b/i.test(o);
      host.querySelector("#mc-fb").innerHTML = '<div>' + (t ? '<span class="good-word">✓</span> Title set' : '<span class="err-word">✗</span> Add a title') + '</div>' +
        '<div>' + (strong ? '<span class="good-word">✓</span> Measurable learning outcome' : '<span class="err-word">✗</span> Use a measurable verb in the outcome') + '</div>' +
        '<div>' + (w >= 5 && w <= 150 ? '<span class="good-word">✓</span> Reasonable workload' : '<span class="err-word">✗</span> Micro-credential workload is usually small') + '</div>' +
        '<div>' + (cb ? '<span class="good-word">✓</span> Credit-bearing — can stack towards a qualification' : '<span class="tag">Non-credit — informative only</span>') + '</div>' +
        '<div class="small mt"><b>For recognisability, add:</b> metadata (issuer, assessment), a level, and a quality-assurance statement.</div>';
      qRecord(strong && t ? 84 : 68, ["q_qa", "q_system_vocab"], "micro-credential design");
    };
    go(host);
  }

  /* ---------- International comparability ---------- */
  function vIntl(host) {
    host.innerHTML = head("International Comparability", "Communicate about referencing, comparison, recognition conventions and transparency tools.") +
      '<div class="card mb"><h3>Essential phrases</h3><div class="small">' +
      ["The framework is referenced against the regional descriptors.", "The qualification broadly corresponds to level six.", "Direct equivalence should not be assumed.", "The comparison is based on learning outcomes rather than duration alone.", "Recognition decisions remain the responsibility of the competent authority.", "The proposed arrangement would facilitate, rather than guarantee, recognition."].map(function (p) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span>“' + esc(p) + '”</span><button class="btn sm" onclick="window.speechSynthesis && window.speechSynthesis.speak(new SpeechSynthesisUtterance(this.previousSibling.textContent))">🔊</button></div>'; }).join("") + '</div></div>' +
      '<div class="card"><h3>Compare two systems</h3><p class="small muted">Practise a careful comparison that avoids overclaiming equivalence.</p><button class="btn primary" id="ic-prac">Practise a comparison</button></div>';
    host.querySelector("#ic-prac").onclick = function () { practiceTask("Compare your national qualifications with a foreign system, focusing on level and learning outcomes rather than duration.", ["comparability", "equivalence", "learning outcome", "referencing", "competent authority"], ["q_comparison", "q_diplomacy"]); };
    go(host);
  }

  /* ---------- Decision Writing ---------- */
  var decIdx = 0;
  function vDecision(host) {
    host.innerHTML = head("Recognition Decision Writing Studio", Q.DECISIONS.length + " templates. Study the formulations, draft your own, and get a neutrality/clarity check.") +
      '<div class="grid cols-3"><div class="card"><h3>Templates</h3><div id="dl"></div></div><div class="card" style="grid-column:span 2"><div id="dd"></div></div></div>';
    var l = host.querySelector("#dl");
    Q.DECISIONS.forEach(function (d, i) { var b = el("button", { class: "btn block mb " + (i === decIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:9px" }, esc(d.type)); b.onclick = function () { decIdx = i; window.ELH.nav("qdecision"); }; l.appendChild(b); });
    decDetail(host.querySelector("#dd"), Q.DECISIONS[decIdx]);
  }
  function decDetail(host, d) {
    host.innerHTML = '<h2>' + esc(d.type) + '</h2><div class="small"><b>Key formulations</b><ul style="margin:4px 0 0 18px">' + d.formulations.map(function (f) { return '<li>“' + esc(f) + '”</li>'; }).join("") + '</ul></div>' +
      '<details class="mt"><summary class="small muted" style="cursor:pointer">Show model letter</summary><pre style="white-space:pre-wrap;font-family:inherit;background:var(--surface-2);padding:10px;border-radius:8px;font-size:.84rem">' + esc(d.model) + '</pre></details>' +
      '<label class="field mt"><span>Draft your own version</span><textarea id="d-ta" style="min-height:150px"></textarea></label>' +
      '<div class="btn-row"><button class="btn primary" id="d-eval">Check writing</button><button class="btn" id="d-use">Load model as start</button><button class="btn" id="d-print">🖨 Export</button></div><div id="d-fb" class="mt"></div>';
    host.querySelector("#d-use").onclick = function () { host.querySelector("#d-ta").value = d.model; };
    host.querySelector("#d-print").onclick = function () { var t = host.querySelector("#d-ta").value.trim() || d.model; window.ELH.exportPrint(d.type, t); };
    host.querySelector("#d-eval").onclick = function () {
      var t = host.querySelector("#d-ta").value.trim(); if (t.split(/\s+/).length < 15) { toast("Write a fuller draft.", "warn"); return; }
      var a = analyse(t), lower = t.toLowerCase(), notes = [];
      if (/\b(obviously|clearly wrong|refuse because they|foreign people)\b/.test(lower)) notes.push("Remove any language that could seem judgemental or discriminatory.");
      if (!/\b(comparable|substantial difference|recognition|evidence|level|outcome)\b/.test(lower)) notes.push("Use precise recognition terminology (comparable, substantial difference, level, evidence).");
      if (!/\b(appeal)\b/.test(lower) && /refus|condition|partial/.test(d.type.toLowerCase())) notes.push("State the applicant's right to appeal.");
      host.querySelector("#d-fb").innerHTML = '<div class="card" style="background:var(--surface-2)"><div class="badge-score">Writing ' + a.score + '/100</div>' +
        scoreLine("Clarity", a.clarity) + scoreLine("Professional tone", a.tone) + scoreLine("Terminology", a.vocab) +
        (notes.length ? '<div class="small mt"><b>Neutrality & completeness:</b><ul style="margin:4px 0 0 18px">' + notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + '</ul></div>' : '<div class="good-word small mt">Neutral, evidence-based tone — good.</div>') + '</div>';
      qRecord(a.score, ["q_decision", "q_academic"], d.type);
    };
  }

  /* ---------- Negotiations ---------- */
  var negActive = null;
  function vNeg(host) {
    if (negActive) return negRun(host, negActive);
    host.innerHTML = head("Qualifications Negotiation Simulator", Q.NEGOTIATIONS.length + " role-plays on mutual recognition, information exchange, referencing, mobility and digital credentials.") + '<div class="grid auto" id="nl"></div>';
    var l = host.querySelector("#nl");
    Q.NEGOTIATIONS.forEach(function (n) {
      var d = el("div", { class: "card" });
      d.innerHTML = '<div class="tag">' + esc(n.counterpart) + '</div><h3 style="margin-top:6px">' + esc(n.title) + '</h3><div class="small muted">' + esc(n.situation) + '</div><div class="small mt"><b>Objectives:</b> ' + n.objectives.map(esc).join("; ") + '.</div><button class="btn primary mt block">Start</button>';
      d.querySelector("button").onclick = function () { negActive = { n: n, stage: 0, log: [], scores: [] }; window.ELH.nav("qneg"); };
      l.appendChild(d);
    });
  }
  function negRun(host, ses) {
    var n = ses.n;
    host.innerHTML = '<div class="section-head"><div><h1>' + esc(n.title) + '</h1><p>Stage ' + (ses.stage + 1) + ' of ' + n.stages.length + ' · ' + esc(n.stages[ses.stage]) + '</p></div><button class="btn ghost" id="nx">End & report</button></div>' +
      '<div class="stage-track mb">' + n.stages.map(function (st, i) { return '<div class="stage-node ' + (i < ses.stage ? "done" : (i === ses.stage ? "current" : "")) + '"><div class="dot">' + (i + 1) + '</div><small>' + esc(st) + '</small></div>'; }).join("") + '</div>' +
      '<div class="grid cols-3"><div class="card" style="grid-column:span 2"><div class="chat" id="nc"></div><div class="mt"><textarea id="ni" placeholder="Type your response as the national authority..."></textarea><div class="btn-row mt"><button class="btn primary" id="ns">Send</button><button class="btn" id="nh">💡 Phrases</button></div></div></div>' +
      '<div class="card"><h3>Your brief</h3><div class="small"><b>Role.</b> ' + esc(n.role) + '</div><div class="small mt"><b>Objectives.</b><ul style="margin:4px 0 0 18px">' + n.objectives.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + '</ul></div><div class="small mt"><b>Confidential.</b> ' + n.priorities.map(esc).join(" ") + '</div><div class="small mt"><b>Likely objections.</b> ' + n.objections.map(function (o) { return '“' + esc(o) + '”'; }).join(" ") + '</div></div></div>';
    var chat = host.querySelector("#nc");
    if (!ses.log.length) push(chat, ses, "them", n.counterpart, n.openings[0]);
    else ses.log.forEach(function (m) { push(chat, ses, m.side, m.who, m.text, true); });
    host.querySelector("#nx").onclick = function () { negReport(ses); };
    host.querySelector("#nh").onclick = function () { modal('<h3>Useful phrases</h3>' + n.phrases.map(function (p) { return '<p>“' + esc(p) + '”</p>'; }).join("") + '<div class="center"><button class="btn" onclick="document.getElementById(\'modal-backdrop\').classList.remove(\'open\')">Close</button></div>'); };
    host.querySelector("#ns").onclick = function () {
      var t = host.querySelector("#ni").value.trim(); if (t.split(/\s+/).length < 4) { toast("Give a fuller response.", "warn"); return; }
      push(chat, ses, "me", "You", t);
      ses.scores.push(evalTurn(t));
      host.querySelector("#ni").value = "";
      setTimeout(function () {
        var i = ses.scores.length - 1;
        var reply = i < n.objections.length ? ((ses.scores[i].dip > 75 ? "That's reasonable. " : "I hear you, but ") + '“' + n.objections[i] + '” How do you respond?') : "You've addressed my concerns. Let's move toward agreed conclusions.";
        push(chat, ses, "them", n.counterpart, reply);
        ses.stage = Math.min(n.stages.length - 1, ses.stage + 1);
        negRun(host, ses);
      }, 500);
    };
  }
  function push(chat, ses, side, who, text, silent) { var b = el("div", { class: "bubble " + side }); b.innerHTML = '<span class="who">' + esc(who) + '</span>' + esc(text); chat.appendChild(b); chat.scrollTop = chat.scrollHeight; if (!silent) ses.log.push({ side: side, who: who, text: text }); }
  function evalTurn(t) {
    var l = t.toLowerCase();
    return {
      dip: /\b(understand|appreciate|however|perhaps|would|could|respect|concern|proportionate)\b/.test(l) ? 82 : 60,
      ev: /\b(evidence|because|outcomes|quality|framework|referenc|data)\b/.test(l) ? 84 : 58,
      prop: /\b(propose|suggest|initially|pilot|mechanism|in return|we could|reciproc)\b/.test(l) ? 85 : 60,
      legal: /\b(competent authority|legislation|cannot guarantee|responsibility|subject to)\b/.test(l) ? 88 : 62
    };
  }
  function negReport(ses) {
    var n = ses.n, sc = ses.scores, avg = function (k) { return sc.length ? Math.round(sc.reduce(function (a, s) { return a + s[k]; }, 0) / sc.length) : 62; };
    var r = { clarity: clamp(avg("ev") - 4, 40, 100), persuasiveness: avg("prop"), diplomacy: avg("dip"), evidence: avg("ev"), legal: avg("legal") };
    var overall = Math.round((r.clarity + r.persuasiveness + r.diplomacy + r.evidence + r.legal) / 5);
    qRecord(overall, ["q_negotiation", "q_diplomacy"], n.title); negActive = null;
    modal('<h2>Negotiation Report — ' + esc(n.title) + '</h2><div class="badge-score mb">Overall ' + overall + '/100</div>' +
      scoreLine("Clarity", r.clarity) + scoreLine("Persuasiveness", r.persuasiveness) + scoreLine("Diplomacy", r.diplomacy) + scoreLine("Use of evidence", r.evidence) + scoreLine("Managing legal limits", r.legal) +
      '<div class="divider"></div><div class="small"><b>What you did well.</b> ' + (r.diplomacy > 75 ? "Diplomatic framing. " : "") + (r.legal > 75 ? "You respected legal limits. " : "") + (r.evidence > 75 ? "You used evidence. " : "You kept momentum.") + '</div>' +
      '<div class="small mt"><b>Missed opportunities.</b> ' + (r.legal < 75 ? "Reaffirm that final decisions remain with the competent authority. " : "") + (r.prop < 75 ? "Make explicit, staged proposals. " : "") + (r.evidence < 75 ? "Cite outcomes and quality assurance. " : "Fine-tune tone.") + '</div>' +
      '<div class="small mt"><b>Stronger alternative.</b> “' + esc(n.phrases[0]) + '”</div>' +
      '<div class="btn-row mt2"><button class="btn primary" id="nr-c">Done</button></div>');
    document.getElementById("nr-c").onclick = function () { closeModal(); window.ELH.nav("qneg"); };
  }

  /* ---------- Recognition interviews ---------- */
  var INTERVIEWS = [
    { who: "Applicant", task: "Explain why additional documents are required, without discouraging the applicant.", vocab: ["documentary evidence", "verification of authenticity", "recognition procedure"] },
    { who: "University admissions officer", task: "Explain a partial recognition decision and its implications for admission.", vocab: ["partial recognition", "credit award", "access qualification"] },
    { who: "Employer", task: "Explain what professional recognition does and does not guarantee.", vocab: ["professional recognition", "regulated profession", "competence"] },
    { who: "Foreign recognition authority", task: "Request verification of a qualification's authenticity, diplomatically.", vocab: ["verification of authenticity", "issuing authority", "reciprocity"] },
    { who: "Professional regulator", task: "Discuss a compensation measure for a safety-critical competence gap.", vocab: ["compensation measure", "substantial difference", "regulated profession"] },
    { who: "Appeals commission", task: "Defend a recognition decision on the basis of evidence and proportionality.", vocab: ["appeal procedure", "substantial difference", "proportionality"] },
    { who: "Applicant (refusal)", task: "Communicate a refusal diplomatically and explain the appeal route.", vocab: ["refusal of recognition", "appeal procedure", "substantial difference"] },
    { who: "Ministry representative", task: "Explain the recognition methodology in plain, confident terms.", vocab: ["comparability", "learning outcome", "competent authority"] }
  ];
  function vInterview(host) {
    host.innerHTML = head("Recognition Interview Simulator", "Communicate difficult recognition messages to different audiences — clearly, diplomatically and correctly.") + '<div class="grid auto" id="il"></div>';
    var l = host.querySelector("#il");
    INTERVIEWS.forEach(function (it) {
      var d = el("div", { class: "card" });
      d.innerHTML = '<div class="tag">' + esc(it.who) + '</div><p class="mt" style="font-weight:600">' + esc(it.task) + '</p><div class="small muted">Use: ' + it.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div><button class="btn primary mt block">Practise</button>';
      d.querySelector("button").onclick = function () { practiceTask(it.task, it.vocab, ["q_diplomacy", "q_professional", "q_qa"]); };
      l.appendChild(d);
    });
  }

  /* ---------- Difficult Questions ---------- */
  var qdIdx = 0;
  function vDiff(host) {
    host.innerHTML = head("Difficult Questions — Qualifications & Recognition", Q.QUESTIONS.length + " challenging questions with structures, key terms and model answers.") +
      '<div class="grid cols-3"><div class="card"><h3>Questions</h3><div id="ql"></div></div><div class="card" style="grid-column:span 2"><div id="qd"></div></div></div>';
    var l = host.querySelector("#ql");
    Q.QUESTIONS.forEach(function (qq, i) { var b = el("button", { class: "btn block mb " + (i === qdIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:10px" }, esc(qq.q)); b.onclick = function () { qdIdx = i; window.ELH.nav("qdiff"); }; l.appendChild(b); });
    qdDetail(host.querySelector("#qd"), Q.QUESTIONS[qdIdx]);
  }
  function qdDetail(host, qq) {
    host.innerHTML = '<div class="pos" style="color:var(--accent)">Structure: ' + esc(qq.s) + '</div><h2>' + esc(qq.q) + '</h2>' +
      '<div class="btn-row mt"><button class="btn" id="qt">⏱ 20s</button><button class="btn" id="qm">🔊 Model</button></div>' +
      '<div class="small mt"><b>Key vocabulary:</b> ' + qq.vocab.map(function (v) { return '<span class="tag">' + esc(v) + '</span>'; }).join(" ") + '</div>' +
      '<label class="field mt"><span>Your answer</span><textarea id="qa"></textarea></label><div class="btn-row"><button class="btn" id="qmic">🎙️</button><button class="btn primary" id="qe">Evaluate</button></div><div id="qfb" class="mt"></div>' +
      '<details class="mt"><summary class="small muted" style="cursor:pointer">Reveal model answer</summary><div class="small mt" style="background:var(--surface-2);padding:10px;border-radius:8px">' + esc(qq.model) + '</div></details>';
    var timer;
    host.querySelector("#qt").onclick = function () { var s = 20, b = host.querySelector("#qt"); clearInterval(timer); timer = setInterval(function () { s--; b.textContent = "⏱ " + s + "s"; if (s <= 0) { clearInterval(timer); b.textContent = "⏱ Go!"; speak("Your time starts now."); } }, 1000); };
    host.querySelector("#qm").onclick = function () { speak(qq.model, 0.99); };
    host.querySelector("#qmic").onclick = function () { var r = window.ELH.makeRecognizer(function (f, i) { host.querySelector("#qa").value = f + i; }, function (f) { host.querySelector("#qa").value = f; }); if (!r) { toast("Speech recognition unavailable — type instead.", "warn"); return; } r.start(); toast("Listening…", ""); setTimeout(function () { r.stop(); }, 30000); };
    host.querySelector("#qe").onclick = function () {
      var t = host.querySelector("#qa").value.trim(); if (t.split(/\s+/).length < 10) { toast("Give a fuller answer.", "warn"); return; }
      var s = score(t, { expected: qq.vocab, targetWords: 110 });
      host.querySelector("#qfb").innerHTML = fbCard(s, "Follow " + qq.s + " and weave in the key terms.");
      qRecord(s.overall, ["q_qa", "q_diplomacy"], qq.q.slice(0, 40));
    };
  }

  /* ---------- Phrase Bank ---------- */
  var pGroup = "All";
  function vPhrase(host) {
    host.innerHTML = head("Qualifications Phrase Bank", allPhrases().length + " professional phrases for explaining systems, comparing, deciding, disagreeing diplomatically and negotiating.") +
      '<div class="chip-row mb" id="pf"><button class="chip ' + (pGroup === "All" ? "on" : "") + '" data-g="All">All</button>' + Q.PHRASE_GROUPS.map(function (g) { return '<button class="chip ' + (pGroup === g.group ? "on" : "") + '" data-g="' + esc(g.group) + '">' + esc(g.group) + '</button>'; }).join("") + '</div><div class="grid auto" id="pl"></div>';
    host.querySelectorAll("#pf .chip").forEach(function (c) { c.onclick = function () { pGroup = c.dataset.g; window.ELH.nav("qphrase"); }; });
    var list = allPhrases().filter(function (p) { return pGroup === "All" || p.group === pGroup; });
    var l = host.querySelector("#pl");
    list.forEach(function (p) {
      var saved = qs().saved.indexOf(p.p) >= 0;
      var d = el("div", { class: "card" });
      d.innerHTML = '<div class="flex between"><span class="tag ' + (p.tag === "diplomatic" ? "diplomatic" : "formal") + '">' + esc(p.group) + '</span><button class="icon-btn sv" style="width:30px;height:30px">' + (saved ? "★" : "☆") + '</button></div><p style="font-weight:600;margin-top:8px">“' + esc(p.p) + '”' + uz(p.uz) + '</p><div class="btn-row"><button class="btn sm say">🔊</button><button class="btn sm pr">🎙️ Practise</button></div>';
      d.querySelector(".say").onclick = function () { speak(p.p); };
      d.querySelector(".pr").onclick = function () { practiceTask("Say this phrase naturally and in context: “" + p.p + "”", p.p.toLowerCase().split(" ").filter(function (w) { return w.length > 5; }), ["q_diplomacy"]); };
      d.querySelector(".sv").onclick = function () { var i = qs().saved.indexOf(p.p); if (i >= 0) { qs().saved.splice(i, 1); d.querySelector(".sv").textContent = "☆"; } else { qs().saved.push(p.p); d.querySelector(".sv").textContent = "★"; toast("Saved.", "good"); } window.ELH.save(); };
      l.appendChild(d);
    });
  }

  /* ---------- Presentation Studio ---------- */
  var presIdx = 0;
  function vPresent(host) {
    host.innerHTML = head("Qualifications Presentation Studio", "Ten policy presentations with structure, slide titles, speaker notes and expected questions.") +
      '<div class="grid cols-3"><div class="card"><h3>Presentations</h3><div id="pl"></div></div><div class="card" style="grid-column:span 2"><div id="pd"></div></div></div>';
    var l = host.querySelector("#pl");
    Q.PRESENTATIONS.forEach(function (p, i) { var b = el("button", { class: "btn block mb " + (i === presIdx ? "primary" : ""), style: "text-align:left;height:auto;white-space:normal;padding:9px" }, esc(p.title)); b.onclick = function () { presIdx = i; window.ELH.nav("qpresent"); }; l.appendChild(b); });
    presDetail(host.querySelector("#pd"), Q.PRESENTATIONS[presIdx]);
  }
  function presDetail(host, p) {
    var deck = buildDeck(p);
    host.innerHTML = '<div class="flex between"><h2>' + esc(p.title) + '</h2><div class="btn-row"><span class="chip" id="pv-len" data-len="5">5-min</span><button class="btn sm" id="pv-print">🖨 Export</button></div></div>' +
      '<div id="pv-body"></div>';
    function render(len) {
      var slides = len === 5 ? deck.filter(function (_, i) { return [0, 1, 2, 4, 9].indexOf(i) >= 0; }) : deck;
      host.querySelector("#pv-body").innerHTML = slides.map(function (s) { return '<div class="mb"><div class="pos" style="color:var(--accent)">' + esc(s.title) + '</div><div class="small">' + esc(s.notes) + '</div></div>'; }).join("") +
        '<div class="small mt"><b>Expected questions:</b> ' + expectedQs(p).map(esc).join(" · ") + '</div>' +
        '<div class="btn-row mt"><button class="btn sm" id="pv-say">🔊 Read notes</button><button class="btn sm" id="pv-prac">🎙️ Rehearse opening</button></div>';
      host.querySelector("#pv-say").onclick = function () { speak(slides.map(function (s) { return s.notes; }).join(" ")); };
      host.querySelector("#pv-prac").onclick = function () { practiceTask("Deliver the opening two minutes of: " + p.title, ["qualifications", "framework", "recognition", "quality assurance", "learning outcome"], ["q_presentation", "q_case"]); };
    }
    var len = 5;
    host.querySelector("#pv-len").onclick = function () { len = len === 5 ? 15 : 5; this.textContent = len + "-min"; render(len); };
    host.querySelector("#pv-print").onclick = function () { window.ELH.exportPrint(p.title, deck.map(function (s) { return s.title.toUpperCase() + "\n" + s.notes; }).join("\n\n")); };
    render(5);
    qs(); // ensure state
  }
  function buildDeck(p) {
    var notes = {
      "Title & purpose": "Good morning. Today I will present " + p.title.toLowerCase() + ", and why it matters for learners, employers and our international partners.",
      "Context & rationale": "We act because qualifications must be trusted, comparable and relevant. That trust is earned through transparent, quality-assured arrangements.",
      "Structure / how it works": "Let me set out how it works, step by step, in plain terms.",
      "Key features": "The key features are clear levels, employer-validated standards, rigorous assessment and transparent recognition.",
      "Evidence & examples": "Consider the evidence: employer validation, tracer data and international benchmarking all point the same way.",
      "Benefits for stakeholders": "For learners, clearer pathways; for employers, trusted qualifications; for partners, comparability.",
      "Challenges & safeguards": "The honest challenges are capacity and sustainability; our safeguards are quality assurance and a regular review cycle.",
      "International alignment": "Our framework is referenced internationally and supported by transparency tools such as the diploma supplement.",
      "Recommendations": "I recommend three things: measure what matters, publish it, and act on it.",
      "Questions & close": "The measure of our system is what a learner can do, and become, because of it. Thank you — I welcome your questions."
    };
    return p.slides.map(function (s) { return { title: s, notes: notes[s] || "" }; });
  }
  function expectedQs(p) { return ["What is the practical value of this?", "How is quality assured?", "How does it compare internationally?", "What are the risks?"]; }

  /* ---------- Daily & Weekly ---------- */
  function vDaily(host) {
    var d = dailyLesson();
    host.innerHTML = head("Daily & Weekly Learning", "A daily qualifications lesson and a themed seven-day cycle.") +
      '<div class="card mb"><h3>Today’s qualifications lesson</h3>' +
      '<div class="grid cols-2"><div>' +
      '<div class="small"><b>Term of the day:</b> ' + esc(d.term.term) + ' <span class="muted">— ' + esc(d.term.def) + '</span></div>' +
      '<div class="small mt"><b>Phrase of the day:</b> “' + esc(d.phrase) + '”</div>' +
      '<div class="small mt"><b>Concept comparison:</b> ' + esc(d.compare.a) + ' vs ' + esc(d.compare.b) + '</div>' +
      '<div class="small mt"><b>Recognition case:</b> ' + esc(d.case.title) + '</div></div>' +
      '<div><div class="small"><b>Speaking task:</b> ' + esc(d.speaking) + '</div>' +
      '<div class="small mt"><b>Writing task:</b> Draft a short request for additional qualification documents.</div>' +
      '<div class="small mt"><b>Difficult question:</b> ' + esc(d.question.q) + '</div>' +
      '<div class="small mt"><b>Reflection:</b> What did you find hardest to express in English today?</div></div></div>' +
      '<div class="btn-row mt"><button class="btn primary sp">🎙️ Do the speaking task</button><button class="btn wr">✍️ Do the writing task</button></div></div>' +
      '<div class="card"><h3>Weekly cycle</h3><div id="wk"></div></div>';
    host.querySelector(".sp").onclick = function () { practiceTask(d.speaking, ["substantial difference", "proportionality", "learning outcome", "duration"], ["q_qa", "q_recognition"]); };
    host.querySelector(".wr").onclick = function () { window.ELH.nav("qdecision"); toast("Use the 'Request for additional documents' template.", ""); };
    var todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
    var wk = host.querySelector("#wk");
    Q.WEEK.forEach(function (w) {
      var r = el("div", { class: "flex between", style: "padding:8px 0;border-bottom:1px dashed var(--border)" });
      r.innerHTML = '<span><b' + (w.day === todayName ? ' style="color:var(--navy-500)"' : '') + '>' + esc(w.day) + '</b> — ' + esc(w.theme) + '<div class="small muted">' + esc(w.focus) + '</div></span><button class="btn sm" data-go="' + w.view + '">Open</button>';
      wk.appendChild(r);
    });
    go(host);
  }

  /* ---------- Knowledge Feed ---------- */
  function vFeed(host) {
    var Qq = qs(); if (!Qq.feed) Qq.feed = { items: Q.FEED_SAMPLES.slice(), fetched: todayStr() };
    host.innerHTML = head("Qualifications Knowledge Feed", "Reputable recognition & qualifications updates turned into micro-lessons.",
      '<button class="btn primary" id="qf-refresh">🔄 Refresh</button>') +
      '<div class="card mb"><div class="small muted">Cached sample content (fetched ' + esc(Qq.feed.fetched) + '). Add live RSS/API sources in the main Settings page; see README for the CORS proxy. Prioritise UNESCO, ENIC-NARIC, the European Commission and OECD.</div></div>' +
      '<div class="grid auto" id="qfl"></div>';
    host.querySelector("#qf-refresh").onclick = function () { Qq.feed.items = shuffle(Q.FEED_SAMPLES.slice()); Qq.feed.fetched = todayStr(); window.ELH.save(); window.ELH.nav("qfeed"); toast("Feed refreshed (cached).", ""); };
    var l = host.querySelector("#qfl");
    Qq.feed.items.forEach(function (it) {
      var d = el("div", { class: "card" });
      d.innerHTML = '<div class="flex between"><span class="tag new">' + esc(it.source) + '</span><span class="small faint">' + esc(it.date) + '</span></div><h3 style="margin-top:8px">' + esc(it.title) + '</h3><div class="small muted">' + esc(it.summary) + '</div><div class="small mt"><b>Terms:</b> ' + it.terms.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</div><div class="btn-row mt"><button class="btn sm ml">📖 Micro-lesson</button><a class="btn sm" href="' + esc(it.link) + '" target="_blank" rel="noopener">Source ↗</a></div>';
      d.querySelector(".ml").onclick = function () { feedLesson(it); };
      l.appendChild(d);
    });
  }
  function feedLesson(it) {
    modal('<div class="tag new">' + esc(it.source) + '</div><h2>' + esc(it.title) + '</h2>' +
      '<div class="small"><b>Professional summary.</b> ' + esc(it.summary) + '</div>' +
      '<div class="small mt"><b>Five key terms.</b> ' + it.terms.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</div>' +
      '<div class="small mt"><b>Three phrases.</b><ul style="margin:4px 0 0 18px">' + it.phrases.map(function (p) { return "<li>“" + esc(p) + "”</li>"; }).join("") + '</ul></div>' +
      '<div class="small mt"><b>Policy question.</b> ' + esc(it.question) + '</div>' +
      '<div class="small mt"><b>Compare with your context.</b> How does this compare with your national system?</div>' +
      '<div class="small mt"><b>60-second speaking challenge.</b> ' + esc(it.task) + '</div>' +
      '<div class="btn-row mt2"><button class="btn primary" id="fl-sp">🎙️ Do the challenge</button><button class="btn" id="fl-c">Close</button></div>');
    document.getElementById("fl-c").onclick = closeModal;
    document.getElementById("fl-sp").onclick = function () { closeModal(); practiceTask(it.task, it.terms, ["q_qa", "q_system_vocab"]); };
    qRecord(75, ["q_system_vocab", "q_recognition"], it.title);
  }

  /* ---------- Monthly Assessment ---------- */
  function vAssessment(host) {
    host.innerHTML = head("Monthly Qualifications Assessment", "Eight components across terminology, comparison, framework, cases, decisions, negotiation, presentation and difficult questions.") +
      '<div class="card mb"><h3>Components</h3><div class="small">' +
      [["Terminology test", "qterms"], ["Concept comparison", "qcompare"], ["NQF explanation", "qnqf"], ["Recognition case analysis", "qcases"], ["Recognition decision writing", "qdecision"], ["Negotiation simulation", "qneg"], ["Five-minute presentation", "qpresent"], ["Difficult-question response", "qdiff"]].map(function (r, i) { return '<div class="flex between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span>' + (i + 1) + '. ' + esc(r[0]) + '</span><button class="btn sm" data-go="' + r[1] + '">Open</button></div>'; }).join("") + '</div>' +
      '<button class="btn primary block mt" id="ma-run">Generate assessment report</button></div>' +
      '<div class="card"><h3>How scoring works</h3><p class="small muted">Your report aggregates your qualifications competencies into a professional profile: strongest and weakest areas, recurring gaps, mastered terms and a targeted 30-day plan.</p></div>';
    go(host);
    host.querySelector("#ma-run").onclick = function () {
      var ind = qs().ind, prof = proficiency();
      modal('<h2>Monthly Report — ' + todayStr() + '</h2><div class="badge-score mb">Proficiency Index ' + prof + '/100</div>' +
        Q.INDICATORS.map(function (i) { return '<div class="indicator-row"><span class="name">' + esc(i.name) + '</span>' + bar(ind[i.key].current) + '<span class="val">' + ind[i.key].current + '</span></div>'; }).join("") +
        '<div class="divider"></div><div class="small"><b>Strongest:</b> ' + esc(strongest(1)[0].name) + '</div><div class="small"><b>Weakest:</b> ' + esc(weakest(1)[0].name) + '</div>' +
        '<div class="small mt"><b>Mastered terms:</b> ' + masteredCount() + ' / ' + Q.TERMS.length + '</div>' +
        '<div class="small mt"><b>Targeted 30-day plan:</b> Prioritise ' + weakest(3).map(function (x) { return esc(x.name); }).join(", ") + '. Do one recognition case and one decision letter per week; review 10 terms daily.</div>' +
        '<div class="btn-row mt2"><button class="btn primary" id="ma-print">🖨 Export report</button><button class="btn" id="ma-c">Close</button></div>');
      document.getElementById("ma-c").onclick = closeModal;
      document.getElementById("ma-print").onclick = function () {
        window.ELH.exportPrint("Qualifications English — Monthly Report " + todayStr(),
          "Proficiency Index: " + prof + "/100\n\n" + Q.INDICATORS.map(function (i) { return "  " + i.name + ": " + ind[i.key].current; }).join("\n") +
          "\n\nStrongest: " + strongest(1)[0].name + "\nWeakest: " + weakest(1)[0].name + "\nMastered terms: " + masteredCount() + "/" + Q.TERMS.length);
      };
      qRecord(prof, ["q_qa"], "monthly assessment");
    };
  }

})();

