/* =========================================================================
   Education Leadership English Hub — placement.js
   Adaptive CEFR placement test (A2–C1) and level-up test.
   Plain browser script (no modules, no build). Depends on window.ELH
   (js/app.js). Exposes window.ELH_PLACEMENT = { start(opts), ready }.
   See docs/CONTRACTS.md → "window.ELH_PLACEMENT".
   ========================================================================= */
(function () {
  "use strict";

  var LEVELS = ["A2", "B1", "B2", "C1"];
  var SECTIONS = ["vocabulary", "grammar", "reading", "listening"];
  var SECTION_LABEL = {
    vocabulary: ["Vocabulary", "Lug'at"],
    grammar: ["Grammar", "Grammatika"],
    reading: ["Reading", "O'qish"],
    listening: ["Listening", "Tinglash"]
  };
  var SECTION_HINT = {
    vocabulary: "Gapga eng mos so'zni tanlang.",
    grammar: "Grammatik jihatdan to'g'ri variantni tanlang.",
    reading: "Matnni o'qib, savolga javob bering.",
    listening: "Matnni tinglang (ko'pi bilan 2 marta) va savolga javob bering."
  };
  var BLOCK = 5;                 // questions per adaptive block
  var BLOCKS_PER_SECTION = 2;    // 2 blocks x 5 = 10 per section, 40 total
  var LEVEL_UP_MIX = { vocabulary: 8, grammar: 8, reading: 7, listening: 7 }; // = 30
  var PASS_PCT = 75;
  var MAX_PLAYS = 2;
  var START_LEVEL = "B1";

  /* ---------------------------------------------------------------------
     Lazy accessors to window.ELH (app.js may define parts of it later)
  --------------------------------------------------------------------- */
  function E() { return window.ELH || {}; }
  function UI() { return E().ui || {}; }
  function esc(s) {
    if (UI().esc) return UI().esc(s);
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function uzOn() { try { return !!E().state().settings.uz; } catch (x) { return false; } }
  function t(en, uz) {
    var e = E();
    if (typeof e.t === "function") return e.t(en, uz);
    return uzOn() && uz ? uz : en;
  }
  function toast(msg, kind) { if (UI().toast) UI().toast(msg, kind); }
  function bar(pct, color) {
    if (UI().bar) return UI().bar(pct, color);
    return '<div class="bar"><span style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></div>';
  }
  function speak(text, rate) { if (UI().speak) UI().speak(text, rate); }
  function nav(name) { if (E().nav) E().nav(name); }
  function currentLevel() {
    var e = E();
    try {
      if (typeof e.cefr === "function") { var l = e.cefr(); if (LEVELS.indexOf(l) >= 0) return l; }
      var s = e.state(); if (s && s.profile && LEVELS.indexOf(s.profile.level) >= 0) return s.profile.level;
    } catch (x) { /* ignore */ }
    return START_LEVEL;
  }
  function li(level) { return LEVELS.indexOf(level); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a;
  }
  function pct(c, n) { return n ? Math.round(c / n * 100) : 0; }

  /* ---------------------------------------------------------------------
     QUESTION BANK
     V/G: single questions  { level, section, q, options[4], answer, uz }
     R/L: passages          { level, section, text, questions:[{q, options, answer}] }
     Gap-fill items contain "____" in q; the answer index points into options.
  --------------------------------------------------------------------- */
  function V(level, q, options, answer, uz) { return { level: level, section: "vocabulary", q: q, options: options, answer: answer, uz: uz }; }
  function G(level, q, options, answer, uz) { return { level: level, section: "grammar", q: q, options: options, answer: answer, uz: uz }; }
  function Q(q, options, answer) { return { q: q, options: options, answer: answer }; }
  function R(level, text, questions) { return { level: level, section: "reading", text: text, questions: questions }; }
  function L(level, text, questions) { return { level: level, section: "listening", text: text, questions: questions }; }

  var VOCAB = [
    /* ---------------- A2 ---------------- */
    V("A2", "The ____ is the person who leads the school.", ["head teacher", "student", "cleaner", "parent"], 0, "Maktabni boshqaradigan kishi."),
    V("A2", "We have a staff ____ every Monday at 9 a.m.", ["meeting", "lunch", "holiday", "lesson"], 0, "Har dushanba xodimlar yig'iladi."),
    V("A2", "Please send me the ____ before Friday.", ["report", "window", "chair", "bus"], 0, "Yozma hujjat haqida gap ketyapti."),
    V("A2", "The school ____ shows when each lesson starts.", ["timetable", "kitchen", "garden", "uniform"], 0, "Darslar vaqti ko'rsatilgan jadval."),
    V("A2", "A ____ is the money a school can spend in one year.", ["budget", "library", "holiday", "corridor"], 0, "Bir yillik pul mablag'i."),
    V("A2", "An inspector will ____ our school next month.", ["visit", "cook", "paint", "sell"], 0, "Inspektor maktabga keladi."),
    V("A2", "The ____ is the list of topics for a meeting.", ["agenda", "invoice", "diary", "poster"], 0, "Yig'ilishda muhokama qilinadigan masalalar ro'yxati."),
    V("A2", "Twenty new ____ started work at our school in September.", ["teachers", "desks", "buses", "books"], 0, "Ishga kelgan odamlar."),
    V("A2", "Our school has 600 ____ aged 7 to 11.", ["pupils", "rooms", "teachers", "parents"], 0, "7–11 yoshdagi bolalar."),
    V("A2", "The ____ for the report is 15 May. Please finish before that day.", ["deadline", "weekend", "lesson", "break"], 0, "Oxirgi topshirish muddati."),
    V("A2", "Parents can ____ the meeting on Thursday evening.", ["attend", "build", "drive", "cook"], 0, "Yig'ilishda qatnashish."),
    V("A2", "The school ____ cleans the classrooms every evening.", ["caretaker", "inspector", "director", "accountant"], 0, "Maktab binosiga qaraydigan xodim."),
    V("A2", "We need a new ____ for the computer room.", ["projector", "tractor", "kettle", "suitcase"], 0, "Kompyuter xonasi uchun texnika."),
    V("A2", "The teacher training ____ lasts two days.", ["course", "cup", "coat", "car"], 0, "Ikki kunlik o'quv."),
    V("A2", "Please write your name and ____ on the form.", ["signature", "furniture", "weather", "window"], 0, "Shaklga yoziladigan narsa."),
    V("A2", "The ____ pays the teachers' salaries every month.", ["accountant", "pupil", "cleaner", "driver"], 0, "Pul bilan ishlaydigan xodim."),

    /* ---------------- B1 ---------------- */
    V("B1", "The school received a positive ____ after the inspection.", ["evaluation", "invitation", "decoration", "vacation"], 0, "Tekshiruv natijasi."),
    V("B1", "Please ____ the agenda to all heads of department before the meeting.", ["circulate", "celebrate", "calculate", "cancel"], 0, "Hammaga tarqatish."),
    V("B1", "The ministry has ____ new standards for teacher qualifications.", ["introduced", "invented", "interrupted", "imagined"], 0, "Yangi standartlar joriy etildi."),
    V("B1", "Our main ____ this year is to improve reading results in primary classes.", ["priority", "salary", "library", "ceremony"], 0, "Eng muhim vazifa."),
    V("B1", "The ____ of the meeting were sent to all participants.", ["minutes", "seconds", "hours", "moments"], 0, "Yig'ilish bayonnomasi."),
    V("B1", "We need more ____ for the new science laboratory.", ["funding", "running", "painting", "meaning"], 0, "Mablag' kerak."),
    V("B1", "Each teacher must complete 40 hours of professional ____ a year.", ["development", "department", "document", "disappointment"], 0, "Malaka oshirish."),
    V("B1", "The ____ of the project is to reduce the number of pupils who leave school early.", ["aim", "arm", "art", "aid"], 0, "Loyihaning maqsadi."),
    V("B1", "Please ____ your travel expenses with receipts.", ["submit", "permit", "admit", "commit"], 0, "Hujjatlarni topshirish."),
    V("B1", "The deputy head is ____ for the timetable and exam arrangements.", ["responsible", "reasonable", "remarkable", "respectable"], 0, "Javobgar shaxs."),
    V("B1", "Our partner school in Germany sent a formal ____ to visit in May.", ["invitation", "inspection", "investigation", "instruction"], 0, "Rasmiy taklif."),
    V("B1", "The ____ rate in the region's secondary schools has fallen to 2 %.", ["dropout", "takeover", "breakdown", "setback"], 0, "Maktabni tashlab ketish."),
    V("B1", "Teachers were asked to give ____ on the new textbook.", ["feedback", "background", "breakthrough", "outlook"], 0, "Fikr-mulohaza."),
    V("B1", "The school must ____ with national safety regulations.", ["comply", "supply", "apply", "reply"], 0, "Qoidalarga rioya qilish."),
    V("B1", "We held a ____ for parents to explain the new assessment system.", ["briefing", "brief", "breathing", "belief"], 0, "Qisqa tushuntirish yig'ilishi."),
    V("B1", "Rising ____ costs have put pressure on the school budget.", ["maintenance", "attendance", "entrance", "appearance"], 0, "Binoni saqlash xarajatlari."),

    /* ---------------- B2 ---------------- */
    V("B2", "The accreditation panel found that the school's self-assessment was thorough and ____ by evidence.", ["substantiated", "substituted", "subscribed", "subordinated"], 0),
    V("B2", "The ministry will ____ the new curriculum across all regions in September.", ["roll out", "run out", "rule out", "wear out"], 0),
    V("B2", "The audit ____ several weaknesses in the school's financial controls.", ["highlighted", "hesitated", "hibernated", "hindered"], 0),
    V("B2", "We should ____ the scheme in three schools before extending it nationally.", ["pilot", "pivot", "plot", "pile"], 0),
    V("B2", "The report sets out clear ____ for improving teaching quality.", ["recommendations", "reconciliations", "recreations", "recollections"], 0),
    V("B2", "Teacher ____ remains a problem in rural areas, where many leave within three years.", ["retention", "retirement", "retreat", "retaliation"], 0),
    V("B2", "External ____ confirmed that the school's grading was consistent with national standards.", ["moderation", "meditation", "motivation", "modification"], 0),
    V("B2", "A ____ approach involves teachers, parents and local employers in planning.", ["stakeholder", "shareholder", "placeholder", "householder"], 0),
    V("B2", "The new funding formula is designed to ____ resources towards schools in disadvantaged areas.", ["channel", "chase", "chant", "charm"], 0),
    V("B2", "The ____ of the accreditation report will be published in June.", ["findings", "feelings", "fittings", "fillings"], 0),
    V("B2", "Schools are ____ to the regional authority for their examination results.", ["accountable", "affordable", "acceptable", "accessible"], 0),
    V("B2", "The school's ____ plan outlines targets for the next three years.", ["strategic", "static", "sympathetic", "synthetic"], 0),
    V("B2", "Attendance figures showed a ____ improvement after the new policy was introduced.", ["marked", "market", "marking", "marker"], 0),
    V("B2", "The two universities signed a ____ of understanding on joint teacher training.", ["memorandum", "momentum", "medium", "maximum"], 0),
    V("B2", "The committee ____ the decision until more data on learning outcomes is available.", ["deferred", "differed", "deterred", "delivered"], 0),
    V("B2", "Peer ____ allows teachers to watch each other's lessons and share good practice.", ["observation", "obligation", "occupation", "operation"], 0),

    /* ---------------- C1 ---------------- */
    V("C1", "The review found that the quality assurance framework was robust but ____ applied across faculties.", ["inconsistently", "inconsequentially", "incontestably", "inconsiderately"], 0),
    V("C1", "The minister sought to ____ concerns that the reform would widen regional inequalities.", ["allay", "alloy", "ally", "allot"], 0),
    V("C1", "Several accreditation criteria were deemed ____, as they duplicated existing legal requirements.", ["redundant", "reluctant", "resilient", "resonant"], 0),
    V("C1", "The agency is ____ to publishing all inspection reports in full.", ["committed", "consigned", "confined", "condoned"], 0),
    V("C1", "The committee called for a more ____ approach to data collection, rather than piecemeal surveys.", ["systematic", "sporadic", "superficial", "spontaneous"], 0),
    V("C1", "The funding model was criticised for ____ schools that already perform well.", ["favouring", "flavouring", "fathoming", "faltering"], 0),
    V("C1", "The ____ between policy intentions and classroom practice remains the central challenge of reform.", ["disparity", "disposal", "display", "dispatch"], 0),
    V("C1", "The university has ____ its position as a leading provider of teacher education.", ["consolidated", "condensed", "consoled", "contested"], 0),
    V("C1", "The data should be treated with caution, as the sample was not ____ of rural schools.", ["representative", "repetitive", "reputable", "repressive"], 0),
    V("C1", "The inspectorate adopted a ____ approach, focusing resources on schools at greatest risk.", ["proportionate", "proprietary", "provisional", "prolific"], 0),
    V("C1", "The reform's success will ____ on the capacity of school leaders to manage change.", ["hinge", "hint", "hike", "hinder"], 0),
    V("C1", "The board ____ the recommendation in principle, while noting that the costs had been underestimated.", ["endorsed", "enlisted", "enforced", "engraved"], 0),
    V("C1", "Stakeholders expressed ____ about the pace of change, fearing that teachers would be overwhelmed.", ["misgivings", "misprints", "mishaps", "misdeeds"], 0),
    V("C1", "The accreditation standards are ____ in international good practice.", ["grounded", "grinded", "grounding", "grouted"], 0),
    V("C1", "The evaluation offers a ____ account of why the mentoring scheme failed to take root.", ["nuanced", "nourished", "numbed", "numbered"], 0),
    V("C1", "Participation in the scheme is voluntary, but uptake has been ____ in several regions.", ["negligible", "negotiable", "negligent", "neglected"], 0)
  ];

  var GRAMMAR = [
    /* ---------------- A2 ---------------- */
    G("A2", "The head teacher ____ every classroom on Mondays.", ["visits", "visit", "visiting", "is visit"], 0, "Hozirgi zamon, 3-shaxs birlik."),
    G("A2", "Yesterday we ____ a meeting with the parents.", ["had", "have", "has", "having"], 0, "O'tgan zamon."),
    G("A2", "____ there a library in your school?", ["Is", "Are", "Do", "Does"], 0, "Bitta kutubxona haqida savol."),
    G("A2", "Teachers ____ wear a badge in the building.", ["must", "musts", "must to", "are must"], 0, "Majburiyat bildiruvchi modal fe'l."),
    G("A2", "The inspection ____ on 3 March last year.", ["was", "is", "were", "be"], 0, "O'tgan yil – o'tgan zamon."),
    G("A2", "There ____ twenty teachers in our school.", ["are", "is", "be", "has"], 0, "Ko'plik: there are."),
    G("A2", "____ you send the report yesterday?", ["Did", "Do", "Does", "Are"], 0, "O'tgan zamon savoli."),
    G("A2", "The new building is ____ than the old one.", ["bigger", "more big", "biggest", "big"], 0, "Qiyosiy daraja."),
    G("A2", "The meeting starts ____ 9 o'clock.", ["at", "in", "on", "to"], 0, "Soat bilan ishlatiladigan predlog."),
    G("A2", "She ____ speak English and Russian.", ["can", "cans", "can to", "is can"], 0, "Qobiliyat bildiruvchi modal fe'l."),
    G("A2", "We ____ have a meeting tomorrow; it is cancelled.", ["don't", "doesn't", "aren't", "not"], 0, "Inkor shakli (we)."),
    G("A2", "I ____ working at this school in 2019.", ["started", "start", "starting", "starts"], 0, "2019 – o'tgan zamon."),
    G("A2", "Please ____ the door quietly when you leave.", ["close", "closes", "closing", "closed"], 0, "Buyruq gap."),
    G("A2", "The pupils ____ reading in the library now.", ["are", "is", "am", "be"], 0, "Hozir bo'layotgan ish-harakat."),
    G("A2", "How ____ pupils are there in Year 5?", ["many", "much", "lot", "more"], 0, "Sanaladigan ot bilan."),
    G("A2", "Our school ____ a new sports hall next year.", ["will have", "has had", "have", "having"], 0, "Kelasi zamon."),

    /* ---------------- B1 ---------------- */
    G("B1", "We ____ three new teachers since September.", ["have recruited", "recruited", "are recruiting", "recruit"], 0, "'Since' bilan Present Perfect."),
    G("B1", "If the budget ____ approved, we will buy new computers.", ["is", "will be", "was", "be"], 0, "Birinchi tur shart gap."),
    G("B1", "The report ____ by the quality assurance team last week.", ["was written", "wrote", "has written", "is writing"], 0, "Majhul nisbat, o'tgan zamon."),
    G("B1", "This is the teacher ____ organised the science fair.", ["who", "which", "whose", "what"], 0, "Odam uchun nisbiy olmosh."),
    G("B1", "You ____ send the form today; the deadline is tomorrow morning.", ["should", "would", "might", "shall"], 0, "Maslahat bildiruvchi modal."),
    G("B1", "When the inspector arrived, the pupils ____ an exam.", ["were taking", "took", "are taking", "take"], 0, "Davom etayotgan o'tgan harakat."),
    G("B1", "Our school is ____ school in the district.", ["the largest", "the larger", "largest", "more large"], 0, "Orttirma daraja."),
    G("B1", "The director said that she ____ the proposal.", ["would support", "will support", "supports", "is supporting"], 0, "Ko'chirma gap – zamon o'zgaradi."),
    G("B1", "We ____ hold the meeting online next week.", ["are going to", "going to", "will going to", "are go to"], 0, "Reja: be going to."),
    G("B1", "The school ____ have a swimming pool, but it closed in 2015.", ["used to", "use to", "was used to", "is used"], 0, "Avval bo'lgan, hozir yo'q."),
    G("B1", "Teachers ____ to attend the training; it is optional.", ["don't have", "mustn't", "haven't", "don't"], 0, "Majburiy emas."),
    G("B1", "How long ____ as a head teacher?", ["have you worked", "do you work", "are you working", "did you work"], 0, "Hozirgacha davom etayotgan tajriba."),
    G("B1", "The exam results ____ published next Monday.", ["will be", "will", "are be", "is"], 0, "Kelasi zamon, majhul nisbat."),
    G("B1", "I ____ to the parents' meeting if I finish the report in time.", ["will come", "come", "came", "would come"], 0, "Birinchi tur shart gap – bosh gap."),
    G("B1", "She asked me ____ the attendance figures to the ministry.", ["to send", "send", "sending", "that send"], 0, "ask somebody to do."),
    G("B1", "There isn't ____ money left in the budget for new furniture.", ["enough", "many", "few", "plenty"], 0, "Sanalmaydigan ot bilan."),

    /* ---------------- B2 ---------------- */
    G("B2", "If the ministry had consulted teachers earlier, the reform ____ more smoothly.", ["would have gone", "would go", "had gone", "will go"], 0),
    G("B2", "The accreditation report ____ to the board before it is published.", ["must be submitted", "must submit", "must to be submitted", "must submitting"], 0),
    G("B2", "By the time the inspectors arrived, the school ____ its self-evaluation.", ["had completed", "completed", "has completed", "was completing"], 0),
    G("B2", "The director, ____ office is on the second floor, will chair the meeting.", ["whose", "who's", "which", "whom"], 0),
    G("B2", "____ the budget cuts, the school managed to keep all its teaching staff.", ["Despite", "Although", "However", "Even"], 0),
    G("B2", "The teachers suggested ____ the exam timetable to avoid clashes.", ["changing", "to change", "change", "changed"], 0),
    G("B2", "We ____ the accreditation if we had submitted the evidence on time.", ["might have passed", "might pass", "might passed", "might have pass"], 0),
    G("B2", "The head teacher said that the results ____ the following week.", ["would be announced", "will be announced", "are announced", "announced"], 0),
    G("B2", "I wish we ____ more time to prepare the documents.", ["had", "have", "would have", "has"], 0),
    G("B2", "Not only ____ the targets, but it also reduced its costs.", ["did the school meet", "the school met", "the school did meet", "met the school"], 0),
    G("B2", "Unless more funding ____, the project will have to be scaled back.", ["is secured", "will be secured", "secures", "secured"], 0),
    G("B2", "The teachers ____ working late to finish the reports, so they are tired.", ["have been", "are been", "have being", "were be"], 0),
    G("B2", "____ by the results, the board decided to extend the pilot.", ["Encouraged", "Encouraging", "Encourage", "To encourage"], 0),
    G("B2", "The school ____ to have improved significantly since the last inspection.", ["appears", "appear", "is appear", "appearing"], 0),
    G("B2", "We would rather ____ the meeting than cancel it.", ["postpone", "to postpone", "postponing", "postponed"], 0),
    G("B2", "The policy ____ reviewed every two years by an independent panel.", ["is", "has", "being", "be"], 0),

    /* ---------------- C1 ---------------- */
    G("C1", "____ the additional funding, the programme would have been discontinued.", ["Were it not for", "If it was not", "Unless", "Without being"], 0),
    G("C1", "Only after the full report had been published ____ the extent of the problem.", ["did the public understand", "the public understood", "the public did understand", "understood the public"], 0),
    G("C1", "____ you require further clarification, please do not hesitate to contact the secretariat.", ["Should", "Would", "Had", "Might"], 0),
    G("C1", "The committee recommended that the chair ____ the proposal to the ministry without delay.", ["submit", "submits", "submitted", "will submit"], 0),
    G("C1", "It was the lack of consultation, rather than the policy itself, ____ provoked such strong opposition.", ["that", "what", "which it", "who"], 0),
    G("C1", "____ consulted earlier, the teachers' unions might have supported the reform.", ["Had they been", "If they were", "Were they", "Having"], 0),
    G("C1", "The findings, ____ should be noted, are based on a relatively small sample.", ["it", "which", "that", "what"], 0),
    G("C1", "Far from ____ the workload, the new reporting system has added to it.", ["reducing", "reduce", "to reduce", "reduced"], 0),
    G("C1", "The evidence ____ suggest that smaller classes improve outcomes, although other factors are clearly involved.", ["would seem to", "seems", "is seeming", "would be seem"], 0),
    G("C1", "No sooner had the inspection ended ____ the school received a request for further data.", ["than", "when", "that", "then"], 0),
    G("C1", "The framework, ____ several regions have already adopted, emphasises self-evaluation.", ["a version of which", "which a version", "of which version", "whose version of"], 0),
    G("C1", "Little ____ that the pilot would attract so much international attention.", ["did we anticipate", "we anticipated", "we did anticipate", "anticipated we"], 0),
    G("C1", "____ the complexity of the issue, a longer consultation period would have been advisable.", ["Given", "Giving", "To give", "Having given"], 0),
    G("C1", "The minister is reported ____ a review of the funding formula.", ["to have ordered", "to order having", "having ordered", "that ordered"], 0),
    G("C1", "Much ____ we would like to extend the deadline, the regulations do not permit it.", ["as", "that", "so", "than"], 0),
    G("C1", "Not until the final data had been verified ____ to publish the league tables.", ["was a decision taken", "a decision was taken", "was taken a decision", "did a decision take"], 0)
  ];

  var READING = [
    /* ---------------- A2 ---------------- */
    R("A2", "Dear colleagues,\nThe staff meeting is on Monday at 9 a.m. in Room 12. We will talk about the new timetable and the parents' evening. Please bring your class lists. The meeting will finish at 10 a.m.\nThank you,\nMrs Karimova, Head Teacher", [
      Q("When is the meeting?", ["Monday at 9 a.m.", "Monday at 10 a.m.", "Friday at 9 a.m.", "Tuesday at 9 a.m."], 0),
      Q("What must teachers bring?", ["Their class lists", "Their lunch", "The new timetable", "Their laptops"], 0),
      Q("How long is the meeting?", ["One hour", "Two hours", "Thirty minutes", "All day"], 0)
    ]),
    R("A2", "School Notice\nThe school library is open from 8 a.m. to 4 p.m., Monday to Friday. Pupils can borrow two books for two weeks. Teachers can borrow five books. Please return books on time. The library is closed during the school holidays.", [
      Q("When is the library closed?", ["During the holidays", "On Mondays", "At 8 a.m.", "In the afternoon"], 0),
      Q("How many books can a pupil borrow?", ["Two", "Five", "Ten", "One"], 0),
      Q("How long can a pupil keep a book?", ["Two weeks", "Two days", "Five weeks", "One month"], 0)
    ]),
    R("A2", "Last week, two inspectors visited our school. They watched six lessons and talked to teachers and pupils. They said the classrooms were clean and the pupils were polite. They also said we need more computers. The full report will arrive in May.", [
      Q("How many lessons did the inspectors watch?", ["Six", "Two", "Sixteen", "Five"], 0),
      Q("What did the inspectors say the school needs?", ["More computers", "More teachers", "More pupils", "A new library"], 0),
      Q("When will the full report arrive?", ["In May", "Last week", "Next week", "In September"], 0)
    ]),
    R("A2", "Dear Mr Aliyev,\nThank you for your email. The teacher training course is on 12 and 13 April at the Regional Education Centre. It starts at 9.30 a.m. each day. Lunch is free. Please bring your ID card. There are only 20 places, so please reply before 1 April.\nBest wishes,\nDilnoza Rashidova, Training Officer", [
      Q("Where is the training course?", ["At the Regional Education Centre", "At Mr Aliyev's school", "Online", "At the ministry"], 0),
      Q("What must Mr Aliyev bring?", ["His ID card", "His lunch", "His laptop", "Twenty books"], 0),
      Q("When should he reply?", ["Before 1 April", "On 12 April", "After 13 April", "Before 9.30 a.m."], 0)
    ]),

    /* ---------------- B1 ---------------- */
    R("B1", "Dear Ms Yusupova,\nThank you for your interest in a partnership between our schools. We would be happy to organise a one-week exchange visit for ten pupils and two teachers in October. Our school can provide accommodation with host families and lunch in the school canteen. However, we are unable to cover travel costs. Could you let us know by 30 June whether these dates are suitable? I look forward to hearing from you.\nKind regards,\nThomas Weber, Deputy Head", [
      Q("What is the purpose of the email?", ["To suggest an exchange visit", "To cancel a visit", "To ask for money", "To complain about pupils"], 0),
      Q("What will the German school NOT provide?", ["Travel costs", "Accommodation", "Lunch", "Host families"], 0),
      Q("What does Mr Weber ask Ms Yusupova to do?", ["Confirm the dates by 30 June", "Send ten pupils in June", "Pay for accommodation", "Visit in September"], 0)
    ]),
    R("B1", "School Improvement Report — Summary\nOver the past year, attendance at Lyceum No. 4 has risen from 89 % to 94 %. This is mainly because the school introduced a daily text message to parents when a pupil is absent. Reading results in Grade 5 also improved, but mathematics results stayed the same. Next year, the school plans to employ an additional mathematics teacher and to open a homework club after school. The budget for these changes has already been approved by the regional department.", [
      Q("Why did attendance improve?", ["Parents receive a text message when pupils are absent", "The school opened a homework club", "A new mathematics teacher was employed", "The school day became shorter"], 0),
      Q("Which results did not change?", ["Mathematics", "Reading", "Attendance", "Science"], 0),
      Q("What is true about next year's plans?", ["The budget has been approved", "The plans have been rejected", "The school needs more money", "A new building is planned"], 0)
    ]),
    R("B1", "To all staff:\nAs you know, the school will be visited by the national accreditation agency from 14 to 16 November. During the visit, the experts will observe lessons, interview staff and pupils, and check our documents. Heads of department should make sure that all lesson plans and assessment records are up to date by 1 November. Please do not prepare special lessons for the visit; the experts want to see normal teaching. If you have any questions, speak to the deputy head for quality, Mr Tashkentov.", [
      Q("What should heads of department do?", ["Update lesson plans and records by 1 November", "Prepare special lessons", "Interview the experts", "Cancel classes during the visit"], 0),
      Q("What does the notice say about lessons during the visit?", ["Teachers should teach normally", "Lessons will be cancelled", "Only the best teachers will teach", "Pupils will not attend"], 0),
      Q("Who should staff contact with questions?", ["The deputy head for quality", "The accreditation agency", "The head of department", "The parents"], 0)
    ]),
    R("B1", "Results of the staff survey, March\nSixty-eight teachers completed the survey, which is 85 % of all staff. Most teachers (72 %) said that they are satisfied with the support they receive from school leaders. However, almost half said that they do not have enough time for lesson planning because of paperwork. Many teachers also asked for more training in using digital tools. The leadership team will discuss the results at the next meeting and present an action plan in April.", [
      Q("What percentage of staff completed the survey?", ["85 %", "72 %", "68 %", "50 %"], 0),
      Q("What was the main complaint?", ["Too much paperwork", "Low salaries", "Poor support from leaders", "Too many pupils"], 0),
      Q("What will happen in April?", ["An action plan will be presented", "Another survey will be sent", "Teachers will receive digital training", "The leadership team will change"], 0)
    ]),

    /* ---------------- B2 ---------------- */
    R("B2", "Dear Dr Rakhimov,\nFollowing the external review of Tashkent Pedagogical College conducted on 3–5 October, I am pleased to inform you that the panel has recommended accreditation for a period of five years. The panel commended the college's systematic approach to collecting student feedback and the strong links it has established with partner schools. Nevertheless, the panel identified two conditions that must be met within twelve months: the college should introduce an annual review of all programmes, and it should publish clear procedures for handling student complaints. A progress report addressing these conditions is due by 1 October next year. The full report is attached.\nYours sincerely,\nDr Helen Marsh, Chair of the Review Panel", [
      Q("What is the overall outcome of the review?", ["Accreditation for five years with two conditions", "Accreditation was refused", "Accreditation for twelve months", "A second review is required"], 0),
      Q("Which of the following was praised by the panel?", ["Collection of student feedback", "The complaints procedure", "Annual programme reviews", "The quality of the buildings"], 0),
      Q("What must the college do by 1 October next year?", ["Submit a progress report", "Publish the full report", "Host another review visit", "Close weak programmes"], 0)
    ]),
    R("B2", "Briefing: Teacher workload\nA recent national survey indicates that teachers spend an average of eleven hours a week on administrative tasks, considerably more than in comparable countries. Although the ministry has repeatedly stated that reducing workload is a priority, schools report that each new initiative tends to bring additional reporting requirements. Head teachers interviewed for the survey argued that the problem lies less in the volume of data collected than in the duplication of requests from different agencies. Several proposed a single annual data return, which would replace the current system of separate submissions to the regional department, the inspectorate and the statistics office.", [
      Q("According to head teachers, what is the main cause of the problem?", ["Different agencies ask for the same data", "Teachers collect too much data", "The ministry does not consider workload a priority", "Teachers work fewer hours than abroad"], 0),
      Q("What does 'each new initiative tends to bring additional reporting requirements' imply?", ["New policies usually increase paperwork", "New policies are usually rejected", "Schools ignore new initiatives", "Reporting has become easier"], 0),
      Q("What solution is suggested?", ["One combined annual data submission", "Closing the statistics office", "Hiring administrative assistants", "Reducing the number of initiatives"], 0)
    ]),
    R("B2", "Dear Mr Nazarov,\nThank you for your detailed proposal regarding the renovation of the science laboratories. Having reviewed the costings with our finance team, I regret that we are unable to approve the full amount requested in the current financial year. We would, however, be prepared to fund the first phase, covering the two chemistry laboratories, provided that the school contributes 15 % of the cost from its own reserves. The remaining phases could be considered in next year's budget round, subject to a satisfactory evaluation of phase one. I would welcome the opportunity to discuss this further at our meeting on Thursday.\nYours sincerely,\nGulnora Saidova, Head of Regional Finance", [
      Q("What is Ms Saidova's response to the proposal?", ["Partial funding with conditions", "Full approval", "Complete rejection", "Postponement for two years"], 0),
      Q("What condition is attached to the funding?", ["The school must pay 15 % of the cost", "The school must complete all phases this year", "The school must renovate the physics laboratories first", "The school must hold a meeting on Thursday"], 0),
      Q("What will determine funding for the later phases?", ["The results of an evaluation of phase one", "The number of pupils studying chemistry", "A decision by the ministry", "The school's reserves"], 0)
    ]),
    R("B2", "Evaluation of the Mentoring Scheme for New Teachers — Executive Summary\nThe scheme, launched in 2023, pairs each newly qualified teacher with an experienced mentor for their first two years. Of the 240 participants, 91 % remained in the profession after two years, compared with 76 % of new teachers in schools outside the scheme. Participants particularly valued regular lesson observations followed by structured feedback. However, mentors reported that they had rarely been given sufficient time for the role, and in a quarter of schools the mentoring meetings had effectively stopped by the second year. The evaluators recommend that mentoring time be formally included in mentors' timetables and that schools be required to report participation rates annually.", [
      Q("What evidence suggests the scheme was effective?", ["More participants stayed in teaching than non-participants", "All 240 participants became mentors", "Lesson observations increased", "Mentors were given more time"], 0),
      Q("What was the main weakness identified?", ["Mentors lacked time for the role", "New teachers disliked feedback", "The scheme was too expensive", "Observations were too frequent"], 0),
      Q("What do the evaluators recommend?", ["Include mentoring in mentors' timetables", "End the scheme after one year", "Replace mentors every year", "Reduce the number of participants"], 0)
    ]),

    /* ---------------- C1 ---------------- */
    R("C1", "The shift from input-based to outcome-based accreditation has been widely heralded as a step towards greater institutional autonomy. In practice, however, the transition has proved far from straightforward. Institutions accustomed to demonstrating compliance through documentation have, in many cases, simply generated new forms of documentation to evidence outcomes, with the result that the administrative burden has scarcely diminished. Moreover, the agencies themselves have been reluctant to relinquish the detailed prescription that characterised earlier frameworks, not least because it offered a defensible basis for difficult judgements. It would be premature, therefore, to conclude that the reform has failed; rather, it has exposed the extent to which quality assurance cultures are shaped by habit as much as by regulation.", [
      Q("What is the author's main point about outcome-based accreditation?", ["Its implementation has been undermined by established habits", "It has clearly failed", "It has reduced paperwork significantly", "Agencies have embraced it enthusiastically"], 0),
      Q("Why have agencies been reluctant to abandon detailed prescription?", ["It gives them a defensible basis for judgements", "It is required by law", "Institutions have requested it", "It reduces their workload"], 0),
      Q("What does 'it would be premature to conclude that the reform has failed' suggest?", ["A final judgement cannot yet be made", "The reform has clearly succeeded", "The reform should be abandoned", "The reform was never implemented"], 0)
    ]),
    R("C1", "Extract from the minutes of the Governing Board, 14 March\nItem 6: Proposed merger with Westfield Academy. The Chair reported that preliminary discussions had taken place with the Westfield board. While acknowledging the potential economies of scale, several members expressed reservations about the implications for the school's distinctive ethos and about the speed at which the proposal was being advanced. The Finance Director noted that the projected savings, though significant, rested on assumptions about staffing that had yet to be tested. It was agreed that no commitment should be made until a full due-diligence exercise had been completed and that staff and parents be consulted before any decision was taken.\nAction: the Chair to commission an independent feasibility study and report back at the June meeting.", [
      Q("What was the board's decision regarding the merger?", ["To delay any commitment pending further investigation", "To approve the merger in principle", "To reject the merger outright", "To proceed immediately with consultation"], 0),
      Q("What concern did the Finance Director raise?", ["The savings depend on untested assumptions", "The savings are too small to matter", "Westfield has financial problems", "Staff costs will increase"], 0),
      Q("What is the Chair required to do?", ["Arrange an independent feasibility study", "Sign the merger agreement", "Consult Westfield's parents", "Reduce staffing costs"], 0)
    ]),
    R("C1", "Response of the Association of School Leaders to the consultation on revised inspection arrangements\nThe Association broadly welcomes the proposal to move towards a risk-based model of inspection, which we have long advocated. We are, nonetheless, concerned that the indicators proposed to identify 'at-risk' schools rely disproportionately on examination data, with the consequence that schools serving disadvantaged communities are likely to be inspected more frequently irrespective of the quality of their leadership. We would urge the inspectorate to incorporate contextual measures and to publish the weighting attached to each indicator. Furthermore, while we recognise the case for shorter notice periods, we consider that the proposed 24 hours is insufficient for schools to make reasonable arrangements for staff absence and would suggest a minimum of two working days.", [
      Q("What is the Association's overall position on risk-based inspection?", ["Supportive in principle but critical of the details", "Firmly opposed", "Indifferent", "Supportive without reservation"], 0),
      Q("What unintended consequence does the Association foresee?", ["Schools in poorer areas will be inspected more often regardless of leadership quality", "Examination results will fall", "Fewer schools will be inspected", "Head teachers will resign"], 0),
      Q("What does the Association propose regarding notice periods?", ["At least two working days", "Exactly 24 hours", "No advance notice", "One week"], 0)
    ]),
    R("C1", "Summary of findings: distributed leadership in secondary schools\nDrawing on case studies of twelve schools, the study examines whether distributing leadership responsibilities beyond the senior team is associated with improved teacher engagement. The evidence is, on balance, encouraging, though the authors caution against simplistic causal inferences. In schools where middle leaders were given genuine decision-making authority, teachers reported higher levels of professional trust and were more likely to participate in collaborative planning. Where, by contrast, delegation amounted to little more than the redistribution of administrative tasks, engagement scores were no higher than in conventionally led schools and, in two cases, markedly lower. The authors conclude that it is the substance rather than the form of distributed leadership that matters, and that head teachers who are unwilling to cede real authority are unlikely to reap its benefits.", [
      Q("What distinguished the schools where distributed leadership was effective?", ["Middle leaders had real decision-making power", "They had more senior leaders", "They delegated more administrative tasks", "They were smaller schools"], 0),
      Q("Why do the authors warn against 'simplistic causal inferences'?", ["The evidence does not prove that distributed leadership causes higher engagement", "The study included too many schools", "Engagement was not measured", "The results were entirely negative"], 0),
      Q("What is the authors' conclusion about head teachers?", ["They must genuinely share authority to benefit", "They should keep all authority", "They should delegate administrative tasks only", "They are irrelevant to the outcome"], 0)
    ])
  ];

  var LISTENING = [
    /* ---------------- A2 ---------------- */
    L("A2", "Hello, this is Nodira from the regional education office. The meeting on Tuesday is now at two o'clock, not ten o'clock. It is in Room 5 on the first floor. Please bring the attendance report. Thank you.", [
      Q("What time is the meeting now?", ["Two o'clock", "Ten o'clock", "Five o'clock", "One o'clock"], 0),
      Q("Where is the meeting?", ["Room 5", "Room 2", "Room 10", "Room 15"], 0),
      Q("What should the listener bring?", ["The attendance report", "The budget", "Lunch", "A laptop"], 0)
    ]),
    L("A2", "Good morning, everyone. Today the school closes at one o'clock because of the teachers' training. Pupils will go home after lunch. The school buses will leave at a quarter past one. Tomorrow, lessons start at the normal time, eight thirty.", [
      Q("Why does the school close early today?", ["Because of teacher training", "Because of bad weather", "Because of a holiday", "Because of an inspection"], 0),
      Q("When do the buses leave?", ["At a quarter past one", "At one o'clock", "At half past one", "At eight thirty"], 0),
      Q("When do lessons start tomorrow?", ["At eight thirty", "At one o'clock", "At nine o'clock", "At a quarter past one"], 0)
    ]),
    L("A2", "Hi Bobur, it's Malika. I can't come to the parents' evening on Thursday because I have a training course in Samarkand. Can you talk to the parents in my class? The class list is on my desk. I will be back on Friday morning. Thanks a lot.", [
      Q("Why can't Malika come on Thursday?", ["She has a training course", "She is ill", "She is on holiday", "She has a meeting with the head"], 0),
      Q("What does she ask Bobur to do?", ["Talk to the parents in her class", "Go to Samarkand", "Clean her desk", "Teach her lessons on Friday"], 0),
      Q("Where is the class list?", ["On her desk", "In the office", "In the library", "In Samarkand"], 0)
    ]),
    L("A2", "Welcome to our school. My name is Mr Rustamov and I am the head teacher. We have 45 teachers and 720 pupils. The school day starts at eight and finishes at three. Today you will visit three classrooms and the new sports hall. Lunch is at twelve in the canteen.", [
      Q("How many pupils are there?", ["720", "45", "320", "700"], 0),
      Q("When does the school day finish?", ["At three", "At eight", "At twelve", "At two"], 0),
      Q("What will the visitors see today?", ["Three classrooms and the sports hall", "The library and the canteen", "The head teacher's office", "Five classrooms"], 0)
    ]),

    /* ---------------- B1 ---------------- */
    L("B1", "Hello, this is Sarah Collins from the British Council. I'm calling about the teacher training workshop next month. We've had a lot of interest, so we've decided to run it twice: on the eighth of March and again on the fifteenth. Each workshop can take twenty-five teachers. Could you send me the names of your teachers by the end of this week? Also, let me know if anyone needs a certificate of attendance. My number is on the email I sent yesterday. Thanks, bye.", [
      Q("Why will the workshop run twice?", ["Because many people are interested", "Because the first date was cancelled", "Because the room is too small", "Because the trainer is busy"], 0),
      Q("How many teachers can attend each workshop?", ["25", "15", "8", "50"], 0),
      Q("What does Sarah ask the listener to do?", ["Send teachers' names by the end of the week", "Call her tomorrow", "Book a room", "Print the certificates"], 0)
    ]),
    L("B1", "OK, the next item is the school budget for next year. As you know, our funding will increase by three per cent, but our heating costs have gone up by almost ten per cent. So, in reality, we have less money to spend. I suggest we delay buying new furniture for the staff room and focus on the computer room instead, because the computers are now eight years old. Does anyone have a different view? If not, I'll put this in the proposal for the governors.", [
      Q("Why does the speaker say the school has less money in reality?", ["Heating costs have risen more than funding", "Funding has been cut", "Too many teachers were hired", "The computers were expensive"], 0),
      Q("What does the speaker suggest?", ["Spending on the computer room instead of the staff room", "Buying new furniture first", "Reducing the heating", "Closing the computer room"], 0),
      Q("What will the speaker do next?", ["Include the idea in a proposal for the governors", "Buy the computers immediately", "Cancel the meeting", "Ask the ministry for money"], 0)
    ]),
    L("B1", "Good evening, parents, and thank you for coming. I'd like to explain the new assessment system. From September, pupils will no longer receive marks out of ten. Instead, teachers will describe what each pupil can do, using four levels: beginning, developing, secure and exceeding. You will receive a written report twice a year, in December and in June, and you can book a meeting with the class teacher after each report. We believe this will give you a clearer picture of your child's progress.", [
      Q("What is changing in September?", ["Pupils will get descriptive levels instead of marks", "Pupils will get marks out of twenty", "Reports will stop", "Teachers will change classes"], 0),
      Q("How often will parents receive a written report?", ["Twice a year", "Once a year", "Every month", "Every week"], 0),
      Q("What can parents do after each report?", ["Book a meeting with the class teacher", "Change their child's class", "Complain to the ministry", "Receive marks out of ten"], 0)
    ]),
    L("B1", "Hello, Mr Karimov? It's Elena from the inspection office. I'm calling to confirm the inspection dates: Tuesday the fifth and Wednesday the sixth of October. Two inspectors will arrive at eight thirty on the first day. They'd like to see the self-evaluation report and the attendance data before they arrive, so could you email those by Friday? On the second day, they want to meet a small group of parents, so please invite five or six. Any questions, just call me back.", [
      Q("How many inspectors will come?", ["Two", "Five", "Six", "One"], 0),
      Q("What should Mr Karimov email by Friday?", ["The self-evaluation report and attendance data", "The list of parents", "The timetable", "The budget"], 0),
      Q("What is planned for the second day?", ["A meeting with parents", "A meeting with pupils", "Lesson observations only", "A visit to the ministry"], 0)
    ]),

    /* ---------------- B2 ---------------- */
    L("B2", "Before we break, a quick word about the international partnership programme. We've been shortlisted by a consortium of Finnish schools, who are looking for three partner institutions in Central Asia. If we're selected, the programme would fund two teacher exchanges a year for three years, as well as joint curriculum development in science. The catch is that the application requires a detailed sustainability plan showing how we'd continue the collaboration after the funding ends. I'd like a small working group to draft that by the end of the month. Volunteers, see me afterwards.", [
      Q("What stage has the school reached in the programme?", ["It has been shortlisted", "It has been selected", "It has been rejected", "It has not yet applied"], 0),
      Q("What is described as 'the catch'?", ["The application needs a sustainability plan", "The funding lasts only one year", "Only two teachers can take part", "The programme is based in Finland"], 0),
      Q("What does the speaker ask for?", ["Volunteers for a working group", "More funding", "A decision from the governors", "A translator"], 0)
    ]),
    L("B2", "Good afternoon, this is a message for Dr Umarova from the National Accreditation Agency. I'm calling regarding the self-assessment report submitted by your college last week. On the whole, the panel found it comprehensive, but there are two areas where we'd need additional evidence before the site visit. Firstly, the report refers to annual student satisfaction surveys, but no results are included. Secondly, the section on staff qualifications doesn't indicate how many teaching staff hold a master's degree. If you could send these through by the twentieth, we can proceed as scheduled. Otherwise, we may need to postpone the visit.", [
      Q("What was the panel's overall view of the report?", ["Generally comprehensive but missing some evidence", "Inadequate and rejected", "Excellent with no changes needed", "Too long"], 0),
      Q("What is missing from the section on students?", ["Survey results", "The number of students", "Graduation rates", "Student complaints"], 0),
      Q("What might happen if the evidence is not sent by the twentieth?", ["The visit may be postponed", "The college will lose accreditation", "The report will be published", "The panel will visit anyway"], 0)
    ]),
    L("B2", "Let's turn to the exam results. Overall, the pass rate rose by four percentage points, which is encouraging, but I want to draw your attention to the gap between our two campuses. At the main campus, eighty-two per cent of students passed mathematics, whereas at the north campus the figure was only sixty-one per cent. We've looked into this, and it seems to be linked to staff turnover: the north campus lost three experienced maths teachers last year and their replacements were newly qualified. I'm not suggesting the new teachers are to blame; rather, we failed to give them adequate support. So I'd like to propose a mentoring arrangement between the two campuses, starting next term.", [
      Q("What concerns the speaker most?", ["The difference in results between the two campuses", "The overall fall in pass rates", "The cost of new teachers", "The quality of the maths curriculum"], 0),
      Q("What does the speaker believe caused the lower results?", ["Inexperienced replacement teachers were not supported properly", "The new teachers were not qualified", "Students at the north campus are weaker", "The exams were harder"], 0),
      Q("What does the speaker propose?", ["Mentoring between the campuses", "Dismissing the new teachers", "Closing the north campus", "Changing the exam"], 0)
    ]),
    L("B2", "One question I'm often asked by new head teachers is how to handle a critical inspection report. My advice is always the same: resist the temptation to argue with every point. Instead, separate the findings into those you accept, those you partly accept, and those you genuinely dispute. For the first two groups, publish an action plan quickly; it shows parents and staff that you're in control. For the third group, use the formal complaints procedure, but only if you have hard evidence. Head teachers who challenge everything tend to lose credibility, even when some of their objections are valid.", [
      Q("What is the speaker's main advice?", ["Respond selectively rather than disputing everything", "Challenge every finding", "Ignore the report", "Resign immediately"], 0),
      Q("Why should an action plan be published quickly?", ["To show staff and parents that the school is in control", "Because the law requires it", "To avoid a second inspection", "To replace the complaints procedure"], 0),
      Q("What happens to head teachers who challenge everything?", ["They lose credibility", "They usually win", "They are promoted", "They get more funding"], 0)
    ]),

    /* ---------------- C1 ---------------- */
    L("C1", "I'd like to begin with a somewhat provocative claim: that much of what we call quality assurance in education is, in fact, quality assertion. Institutions assert that they have processes; agencies assert that they have verified them; and ministers assert that standards are therefore being maintained. What is conspicuously absent from this chain is any robust evidence that the processes in question make the slightest difference to what students actually learn. Now, I don't say this to dismiss the enterprise altogether. Rather, I want to argue that the field has reached a point where it must either demonstrate its impact on learning or accept that its legitimacy rests on little more than professional convention.", [
      Q("What does the speaker mean by 'quality assertion'?", ["Claims about quality that are not backed by evidence of learning", "Aggressive promotion of institutions", "Formal accreditation decisions", "Statistical quality control"], 0),
      Q("What is the speaker's attitude towards quality assurance?", ["Critical but not dismissive", "Entirely hostile", "Uncritically supportive", "Indifferent"], 0),
      Q("What choice does the speaker say the field faces?", ["Prove its impact on learning or admit it rests on convention", "Expand or shrink", "Centralise or decentralise", "Inspect more or less often"], 0)
    ]),
    L("C1", "I appreciate the candour with which you've set out your position, and I think we're closer than it might appear. Where we differ, essentially, is on the question of intellectual property in the jointly developed materials. Your proposal would assign ownership to the funding partner, which, I'm afraid, we couldn't accept, not least because our ministry's regulations require that publicly funded teaching materials remain in the public domain. What I'd suggest, as a way forward, is a joint licence under which both institutions retain the right to use and adapt the materials, with attribution, while neither may commercialise them without the other's consent. If that's broadly acceptable in principle, we could ask our legal teams to draft the wording.", [
      Q("What is the main point of disagreement?", ["Who owns the jointly developed materials", "The amount of funding", "The timetable for the project", "The choice of legal team"], 0),
      Q("Why can the speaker not accept the original proposal?", ["Ministry rules require publicly funded materials to stay public", "The speaker distrusts the partner", "The materials are not finished", "The funding is insufficient"], 0),
      Q("What does the speaker propose?", ["A joint licence with shared rights and limits on commercial use", "Giving all rights to the partner", "Abandoning the materials", "Delaying the decision for a year"], 0)
    ]),
    L("C1", "A word of caution before we draw conclusions from these figures. The apparent decline in reading attainment coincides with a change in the assessment instrument, and we have no reliable means of equating the two scales. It is entirely possible, therefore, that what we are seeing is an artefact of measurement rather than a genuine fall in standards. That said, the pattern is consistent across all regions, which would be somewhat surprising if it were purely a measurement effect. My recommendation would be to commission an independent equating study before any of this is made public, since a premature announcement would be very difficult to retract.", [
      Q("Why does the speaker urge caution about the figures?", ["The assessment changed, so results may not be comparable", "The figures are from only one region", "The data were collected by students", "The sample was too large"], 0),
      Q("What makes the speaker think the decline might be genuine?", ["The pattern is consistent across all regions", "Teachers reported it", "Attendance has fallen", "The ministry confirmed it"], 0),
      Q("What does the speaker recommend?", ["An independent study before publishing", "Immediate publication", "Changing the assessment again", "Ignoring the figures"], 0)
    ]),
    L("C1", "Looking back, I think our mistake was to assume that because the staff had agreed to the new assessment policy in principle, they had also signed up to what it would mean in practice. In hindsight, we should have piloted it in one department and allowed the inevitable teething problems to surface there, rather than imposing it school-wide and then dealing with resistance on all fronts simultaneously. Had we done so, I suspect we'd have ended up with a better policy and far less ill feeling. The irony is that most teachers now say the system works well; it's just that getting there cost us a great deal of goodwill that we're still rebuilding.", [
      Q("What does the speaker identify as the main mistake?", ["Assuming agreement in principle meant acceptance in practice", "Choosing the wrong assessment policy", "Consulting staff too much", "Piloting in one department"], 0),
      Q("What would the speaker have done differently?", ["Piloted the policy in one department first", "Abandoned the policy", "Introduced it faster", "Asked the ministry to impose it"], 0),
      Q("What is 'the irony' the speaker refers to?", ["The system now works well but the process damaged goodwill", "Teachers still reject the system", "The policy was never introduced", "The pilot failed"], 0)
    ])
  ];

  // Index with stable ids
  var BANK = { vocabulary: VOCAB, grammar: GRAMMAR, reading: READING, listening: LISTENING };
  SECTIONS.forEach(function (sec) {
    BANK[sec].forEach(function (it, i) { it.id = sec + ":" + it.level + ":" + i; });
  });

  /* ---------------------------------------------------------------------
     TEST ENGINE
  --------------------------------------------------------------------- */
  var T = null;          // active test state (null = none)
  var viewHost = null;   // element the "placement" view renders into
  var keysBound = false;

  function totalQuestions() {
    if (!T) return 0;
    if (T.kind === "level_up") return T.items.length;
    return SECTIONS.length * BLOCKS_PER_SECTION * BLOCK;
  }
  function levelOrder(level) {
    // the level itself, then nearest neighbours (lower first)
    var i = li(level), out = [level];
    for (var d = 1; d < LEVELS.length; d++) {
      if (i - d >= 0) out.push(LEVELS[i - d]);
      if (i + d < LEVELS.length) out.push(LEVELS[i + d]);
    }
    return out;
  }
  function toItem(src, passage) {
    var order = shuffle(src.options.map(function (_, i) { return i; }));
    return {
      id: passage ? passage.id + "#" + src.q : src.id,
      section: passage ? passage.section : src.section,
      level: passage ? passage.level : src.level,
      q: src.q,
      options: order.map(function (i) { return src.options[i]; }),
      answer: order.indexOf(src.answer),
      uz: src.uz || "",
      gap: /____/.test(src.q),
      passage: passage || null
    };
  }
  function sampleSimple(sec, level, n) {
    var out = [], order = levelOrder(level);
    for (var k = 0; k < order.length && out.length < n; k++) {
      var pool = shuffle(BANK[sec].filter(function (it) { return it.level === order[k] && !T.used[it.id]; }));
      while (pool.length && out.length < n) { var it = pool.shift(); T.used[it.id] = true; out.push(toItem(it)); }
    }
    return out;
  }
  function samplePassages(sec, level, n) {
    var out = [], order = levelOrder(level);
    for (var k = 0; k < order.length && out.length < n; k++) {
      var pool = shuffle(BANK[sec].filter(function (p) { return p.level === order[k] && !T.used[p.id]; }));
      while (pool.length && out.length < n) {
        var p = pool.shift(); T.used[p.id] = true;
        for (var i = 0; i < p.questions.length && out.length < n; i++) out.push(toItem(p.questions[i], p));
      }
    }
    return out;
  }
  function sample(sec, level, n) { return (sec === "reading" || sec === "listening") ? samplePassages(sec, level, n) : sampleSimple(sec, level, n); }

  function newTest(opts) {
    opts = opts || {};
    var kind = opts.kind === "level_up" ? "level_up" : "placement";
    var from = LEVELS.indexOf(opts.fromLevel) >= 0 ? opts.fromLevel : currentLevel();
    var target = LEVELS.indexOf(opts.targetLevel) >= 0 ? opts.targetLevel : LEVELS[Math.min(li(from) + 1, LEVELS.length - 1)];
    T = {
      kind: kind, fromLevel: from, targetLevel: target,
      startedAt: Date.now(), used: {}, items: [], pos: 0, answers: [], path: [],
      sectionIdx: 0, blockIdx: 0, blockStart: 0,
      working: kind === "level_up" ? target : START_LEVEL,
      plays: {}, selected: null, stage: "question", result: null, saving: false,
      sections: {}
    };
    SECTIONS.forEach(function (s) { T.sections[s] = { correct: 0, total: 0, level: T.working }; });
    if (kind === "level_up") {
      SECTIONS.forEach(function (s) { T.items = T.items.concat(sample(s, target, LEVEL_UP_MIX[s])); });
      T.path.push(target);
    } else {
      startBlock();
    }
    bindKeys();
  }
  function startBlock() {
    var sec = SECTIONS[T.sectionIdx];
    var items = sample(sec, T.working, BLOCK);
    T.blockStart = T.items.length;
    T.items = T.items.concat(items);
    T.path.push(T.working);
    T.sections[sec].level = T.working;
  }
  function endBlock() {
    var correct = 0;
    for (var i = T.blockStart; i < T.items.length; i++) if (T.answers[i] && T.answers[i].correct) correct++;
    var idx = li(T.working);
    if (correct >= 4) idx = Math.min(idx + 1, LEVELS.length - 1);
    else if (correct <= 2) idx = Math.max(idx - 1, 0);
    T.working = LEVELS[idx];
    T.sections[SECTIONS[T.sectionIdx]].level = T.working;
    T.blockIdx++;
    if (T.blockIdx >= BLOCKS_PER_SECTION) { T.blockIdx = 0; T.sectionIdx++; }
    if (T.sectionIdx < SECTIONS.length) startBlock();
  }
  function submitAnswer(choice) {
    if (!T || T.stage !== "question") return;
    var it = T.items[T.pos]; if (!it) return;
    var ok = choice === it.answer;
    T.answers[T.pos] = { id: it.id, section: it.section, level: it.level, choice: choice, correct: ok };
    T.sections[it.section].correct += ok ? 1 : 0;
    T.sections[it.section].total += 1;
    T.pos++; T.selected = null;
    if (T.kind === "placement" && T.pos - T.blockStart >= BLOCK && T.sectionIdx < SECTIONS.length) endBlock();
    if (T.pos >= T.items.length) finish(); else render();
  }
  function computeResult() {
    var total = T.answers.length, correct = 0, byLevel = {};
    LEVELS.forEach(function (l) { byLevel[l] = { c: 0, n: 0 }; });
    T.answers.forEach(function (a) { if (a.correct) correct++; byLevel[a.level].n++; if (a.correct) byLevel[a.level].c++; });
    var score = pct(correct, total), level;
    if (T.kind === "level_up") {
      level = score >= PASS_PCT ? T.targetLevel : T.fromLevel;
    } else {
      for (var i = LEVELS.length - 1; i >= 0; i--) {
        var b = byLevel[LEVELS[i]];
        if (b.n >= 5 && b.c / b.n >= 0.6) { level = LEVELS[i]; break; }
      }
      if (!level) {
        var freq = {}; T.path.forEach(function (l) { freq[l] = (freq[l] || 0) + 1; });
        level = T.path.slice().sort(function (a, b) { return (freq[b] - freq[a]) || (li(a) - li(b)); })[0] || START_LEVEL;
      }
    }
    return { level: level, score: score, correct: correct, total: total, passed: T.kind === "level_up" ? score >= PASS_PCT : null, byLevel: byLevel };
  }
  function finish() {
    T.stage = "result";
    T.durationSec = Math.round((Date.now() - T.startedAt) / 1000);
    T.result = computeResult();
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (x) { /* ignore */ } }
    unbindKeys();
    render();
  }
  function abandon() {
    T = null; unbindKeys();
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (x) { /* ignore */ } }
  }

  /* ---------------------------------------------------------------------
     KEYBOARD (1–4 select, Enter confirms; Escape does nothing)
  --------------------------------------------------------------------- */
  function onKey(e) {
    if (!T || T.stage !== "question") return;
    if (!viewHost || !document.body.contains(viewHost) || !document.getElementById("pl-root")) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target && e.target.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(tag || "")) return;
    if (e.key >= "1" && e.key <= "4") {
      var idx = Number(e.key) - 1, it = T.items[T.pos];
      if (it && idx < it.options.length) { e.preventDefault(); selectOption(idx); }
    } else if (e.key === "Enter") {
      if (e.target && e.target.closest && e.target.closest("button")) return; // the button's own click handles it
      if (T.selected != null) { e.preventDefault(); submitAnswer(T.selected); }
    }
  }
  function bindKeys() { if (!keysBound) { document.addEventListener("keydown", onKey); keysBound = true; } }
  function unbindKeys() { if (keysBound) { document.removeEventListener("keydown", onKey); keysBound = false; } }

  /* ---------------------------------------------------------------------
     RENDERING
  --------------------------------------------------------------------- */
  function injectCss() {
    if (document.getElementById("placement-css")) return;
    var css = "" +
      "#pl-root{max-width:860px;margin:0 auto}" +
      "#pl-root .pl-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}" +
      "#pl-root .pl-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--text-soft);font-size:.82rem}" +
      "#pl-root .pl-exit{background:none;border:none;color:var(--text-soft);text-decoration:underline;cursor:pointer;font:inherit;font-size:.8rem;padding:4px}" +
      "#pl-root .pl-passage{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;line-height:1.7;margin:14px 0;white-space:pre-line;font-size:.95rem}" +
      "#pl-root .pl-listen{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin:14px 0}" +
      "#pl-root .pl-q{font-size:1.12rem;font-weight:600;margin:14px 0 10px;line-height:1.5;color:var(--text)}" +
      "#pl-root .pl-q:focus{outline:none}" +
      "#pl-root .pl-gap{display:inline-block;min-width:72px;border-bottom:2px solid var(--accent);margin:0 3px;text-align:center;color:var(--navy-500)}" +
      "#pl-root .pl-uz{color:var(--text-soft);font-size:.82rem;margin:-4px 0 12px}" +
      "#pl-root .pl-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font:inherit;font-size:.95rem;cursor:pointer;line-height:1.4;transition:background .15s,border-color .15s}" +
      "#pl-root .pl-opt:hover{background:var(--surface-2)}" +
      "#pl-root .pl-opt:focus-visible{outline:2px solid var(--focus);outline-offset:1px}" +
      "#pl-root .pl-opt.on{border-color:var(--navy-500);box-shadow:inset 0 0 0 1px var(--navy-500);background:color-mix(in srgb,var(--navy-500) 10%,var(--surface))}" +
      "#pl-root .pl-key{flex:none;width:26px;height:26px;border-radius:8px;background:var(--surface-2);color:var(--text-soft);font-size:.75rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center}" +
      "#pl-root .pl-opt.on .pl-key{background:var(--navy-500);color:#fff}" +
      "#pl-root .pl-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}" +
      "#pl-root .pl-level{font-size:4.2rem;font-weight:800;line-height:1;letter-spacing:-.02em;color:var(--navy-800)}" +
      "[data-theme=\"dark\"] #pl-root .pl-level{color:var(--text)}" +
      "#pl-root .pl-score{font-size:1.4rem;font-weight:700;color:var(--accent)}" +
      "#pl-root .pl-path{display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
      "#pl-root .pl-secrow{display:flex;justify-content:space-between;gap:10px;font-size:.85rem;margin-bottom:4px}" +
      "#pl-root .pl-intro-list{margin:8px 0 0 18px;line-height:1.7}" +
      "@media (max-width:640px){#pl-root .pl-level{font-size:3.2rem}}";
    var st = document.createElement("style"); st.id = "placement-css"; st.textContent = css;
    document.head.appendChild(st);
  }

  function view(host) { viewHost = host; injectCss(); render(); }

  function render() {
    if (!viewHost || !document.body.contains(viewHost)) return;
    viewHost.innerHTML = "";
    var root = document.createElement("div"); root.id = "pl-root";
    viewHost.appendChild(root);
    if (!T) renderIntro(root);
    else if (T.stage === "result") renderResult(root);
    else renderQuestion(root);
  }

  function renderIntro(root) {
    root.innerHTML =
      '<div class="section-head"><div><h1>' + esc(t("English Placement Test", "Ingliz tili darajasini aniqlash testi")) + '</h1>' +
      '<p>' + esc(t("Find your CEFR level (A2–C1) in professional English for education leaders.", "Ta'lim rahbarlari uchun kasbiy ingliz tili bo'yicha CEFR darajangizni (A2–C1) aniqlang.")) + '</p></div></div>' +
      '<div class="card"><h3>' + esc(t("How it works", "Test qanday o'tadi")) + '</h3>' +
      '<p class="small muted">' + esc(t("About 15 minutes · 40 questions · 4 sections. The test adapts to your answers: questions get harder or easier as you go.",
        "Taxminan 15 daqiqa · 40 savol · 4 bo'lim. Test javoblaringizga moslashadi: savollar qiyinlashadi yoki osonlashadi.")) + '</p>' +
      '<ul class="pl-intro-list small">' +
      '<li><b>' + esc(t("Vocabulary", "Lug'at")) + '</b> — ' + esc(t("choose the right word for the sentence.", "gapga mos so'zni tanlang.")) + '</li>' +
      '<li><b>' + esc(t("Grammar", "Grammatika")) + '</b> — ' + esc(t("choose the correct form.", "to'g'ri shaklni tanlang.")) + '</li>' +
      '<li><b>' + esc(t("Reading", "O'qish")) + '</b> — ' + esc(t("short emails, notices and reports with questions.", "qisqa xatlar, e'lonlar va hisobotlar bo'yicha savollar.")) + '</li>' +
      '<li><b>' + esc(t("Listening", "Tinglash")) + '</b> — ' + esc(t("the text is read aloud (you can play it twice); the text is not shown.", "matn ovoz chiqarib o'qiladi (2 marta eshitish mumkin); matn ko'rsatilmaydi.")) + '</li>' +
      '</ul>' +
      '<p class="small muted mt">' + esc(t("Tip: use a quiet place and turn your sound on. Keys 1–4 select an answer, Enter confirms.",
        "Maslahat: tinch joy tanlang va ovozni yoqing. 1–4 tugmalari javobni tanlaydi, Enter tasdiqlaydi.")) + '</p>' +
      '<div class="btn-row mt"><button class="btn primary" id="pl-start" aria-label="' + esc(t("Start the placement test", "Darajani aniqlash testini boshlash")) + '">' + esc(t("Start", "Boshlash")) + '</button>' +
      '<button class="btn" id="pl-back" aria-label="' + esc(t("Back to dashboard", "Bosh sahifaga qaytish")) + '">' + esc(t("Back", "Orqaga")) + '</button></div></div>';
    document.getElementById("pl-start").onclick = function () { start({ kind: "placement", fromLevel: currentLevel() }); };
    document.getElementById("pl-back").onclick = function () { nav("dashboard"); };
    var b = document.getElementById("pl-start"); if (b) b.focus();
  }

  function sectionLabel(sec) { var l = SECTION_LABEL[sec]; return t(l[0], l[1]); }

  function renderQuestion(root) {
    var it = T.items[T.pos], n = totalQuestions(), done = T.pos;
    var progress = pct(done, n);
    var secNo = SECTIONS.indexOf(it.section) + 1;
    var kindLabel = T.kind === "level_up"
      ? t("Level-up test → " + T.targetLevel, T.targetLevel + " darajaga o'tish testi")
      : t("Placement test", "Darajani aniqlash testi");
    var prev = T.items[T.pos - 1];
    var newSection = !prev || prev.section !== it.section;
    var newPassage = it.passage && (!prev || !prev.passage || prev.passage.id !== it.passage.id);

    var html =
      '<div class="pl-top"><div class="pl-meta"><span class="tag">' + esc(kindLabel) + '</span>' +
      '<span>' + esc(t("Section", "Bo'lim")) + ' ' + secNo + '/4 · <b>' + esc(sectionLabel(it.section)) + '</b></span>' +
      '<span>· ' + esc(t("Question", "Savol")) + ' ' + (done + 1) + ' / ' + n + '</span></div>' +
      '<button class="pl-exit" id="pl-exit" aria-label="' + esc(t("Exit the test", "Testdan chiqish")) + '">' + esc(t("Exit test", "Testdan chiqish")) + '</button></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '" aria-label="' + esc(t("Test progress", "Test jarayoni")) + '">' + bar(progress) + '</div>' +
      '<div class="card mt">' +
      (newSection ? '<div class="small" style="color:var(--accent);font-weight:700;letter-spacing:.04em;text-transform:uppercase">' + esc(t("New section: ", "Yangi bo'lim: ")) + esc(sectionLabel(it.section)) + '</div>' : '') +
      '<div class="small muted">' + esc(taskLabel(it)) + '</div>';

    if (it.passage && it.section === "reading") {
      html += '<div class="pl-passage" id="pl-passage" tabindex="-1" aria-label="' + esc(t("Reading text", "O'qish matni")) + '">' + esc(it.passage.text) + '</div>';
    } else if (it.passage && it.section === "listening") {
      var plays = T.plays[it.passage.id] || 0, left = MAX_PLAYS - plays;
      html += '<div class="pl-listen"><button class="btn primary" id="pl-play" ' + (left <= 0 ? 'disabled' : '') +
        ' aria-label="' + esc(t("Play the recording", "Yozuvni eshittirish")) + '">' + (plays === 0 ? "▶ " + esc(t("Play", "Eshitish")) : "▶ " + esc(t("Play again", "Qayta eshitish"))) + '</button>' +
        '<span class="small muted" id="pl-plays">' + esc(left > 0 ? t(left + (left === 1 ? " play left" : " plays left"), left + " marta eshitish mumkin") : t("No plays left", "Eshitish imkoni tugadi")) + '</span>' +
        '<span class="small muted">· ' + esc(t("Listen carefully; the text is not shown.", "Diqqat bilan tinglang; matn ko'rsatilmaydi.")) + '</span></div>';
    }

    var qHtml = esc(it.q);
    if (it.gap) qHtml = qHtml.replace(/____/g, '<span class="pl-gap" id="pl-gap" aria-hidden="true">&nbsp;</span>');
    html += '<div class="pl-q" id="pl-q" tabindex="-1" role="heading" aria-level="2">' + (it.passage ? '<span class="muted small" style="font-weight:500">' + passageQNo(it) + '</span> ' : '') + qHtml + '</div>';
    if (uzOn()) html += '<div class="pl-uz">🇺🇿 ' + esc(it.uz || SECTION_HINT[it.section]) + '</div>';

    html += '<div id="pl-opts" role="radiogroup" aria-label="' + esc(t("Answer options", "Javob variantlari")) + '">';
    it.options.forEach(function (o, i) {
      html += '<button type="button" class="pl-opt' + (T.selected === i ? ' on' : '') + '" data-i="' + i + '" role="radio" aria-checked="' + (T.selected === i ? 'true' : 'false') +
        '" aria-label="' + esc(t("Option", "Variant") + " " + (i + 1) + ": " + o) + '"><span class="pl-key" aria-hidden="true">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
    });
    html += '</div><div class="pl-actions"><button class="btn primary" id="pl-next" ' + (T.selected == null ? 'disabled' : '') +
      ' aria-label="' + esc(t("Confirm answer and go to the next question", "Javobni tasdiqlab keyingi savolga o'tish")) + '">' +
      esc(done + 1 >= n ? t("Finish", "Yakunlash") : t("Next →", "Keyingi →")) + '</button></div></div>';
    root.innerHTML = html;

    document.getElementById("pl-exit").onclick = function () {
      if (window.confirm(t("Exit the test? Your answers will not be saved.", "Testdan chiqasizmi? Javoblaringiz saqlanmaydi."))) { abandon(); nav("dashboard"); }
    };
    Array.prototype.forEach.call(root.querySelectorAll(".pl-opt"), function (b) {
      b.onclick = function () { selectOption(Number(b.getAttribute("data-i"))); };
    });
    document.getElementById("pl-next").onclick = function () { if (T.selected != null) submitAnswer(T.selected); };
    var play = document.getElementById("pl-play");
    if (play) play.onclick = function () {
      var pid = it.passage.id, used = T.plays[pid] || 0;
      if (used >= MAX_PLAYS) return;
      T.plays[pid] = used + 1;
      speak(it.passage.text, 0.95);
      var leftNow = MAX_PLAYS - T.plays[pid];
      play.textContent = "▶ " + t("Play again", "Qayta eshitish");
      if (leftNow <= 0) play.disabled = true;
      var lab = document.getElementById("pl-plays");
      if (lab) lab.textContent = leftNow > 0 ? t(leftNow + (leftNow === 1 ? " play left" : " plays left"), leftNow + " marta eshitish mumkin") : t("No plays left", "Eshitish imkoni tugadi");
    };

    // focus management: new passage → passage/play button; otherwise the question
    var focusEl = (newPassage && it.section === "listening" && play) ? play : document.getElementById("pl-q");
    if (focusEl) setTimeout(function () { try { focusEl.focus({ preventScroll: false }); } catch (x) { focusEl.focus(); } }, 30);
  }
  function passageQNo(it) {
    // "Q2 of 3" within the passage, based on contiguous items sharing the passage
    var first = T.pos, last = T.pos;
    while (first > 0 && T.items[first - 1].passage && T.items[first - 1].passage.id === it.passage.id) first--;
    while (last + 1 < T.items.length && T.items[last + 1].passage && T.items[last + 1].passage.id === it.passage.id) last++;
    return (T.pos - first + 1) + "/" + (last - first + 1);
  }
  function taskLabel(it) {
    if (it.section === "reading") return t("Read the text and choose the best answer.", "Matnni o'qing va eng to'g'ri javobni tanlang.");
    if (it.section === "listening") return t("Listen and choose the best answer.", "Tinglang va eng to'g'ri javobni tanlang.");
    if (it.gap) return t("Choose the word or phrase that fills the gap.", "Bo'sh joyga mos so'z yoki iborani tanlang.");
    return t("Choose the best answer.", "Eng to'g'ri javobni tanlang.");
  }
  function selectOption(i) {
    if (!T || T.stage !== "question") return;
    var it = T.items[T.pos]; if (!it || i < 0 || i >= it.options.length) return;
    T.selected = i;
    var root = document.getElementById("pl-root"); if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll(".pl-opt"), function (b) {
      var on = Number(b.getAttribute("data-i")) === i;
      b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false");
    });
    var gap = document.getElementById("pl-gap"); if (gap) gap.textContent = it.options[i];
    var next = document.getElementById("pl-next"); if (next) { next.disabled = false; next.focus(); }
  }

  function renderResult(root) {
    var r = T.result, isUp = T.kind === "level_up";
    var title = isUp
      ? (r.passed ? t("Level-up passed!", "Daraja oshirildi!") : t("Not this time", "Bu safar yetmadi"))
      : t("Your result", "Sizning natijangiz");
    var sub = isUp
      ? (r.passed ? t("You scored " + r.score + "% — the pass mark is " + PASS_PCT + "%. Your level is now " + r.level + ".", r.score + "% to'pladingiz — o'tish bali " + PASS_PCT + "%. Endi darajangiz " + r.level + ".")
        : t("You scored " + r.score + "% — the pass mark is " + PASS_PCT + "%. Keep practising at " + r.level + " and try again later.", r.score + "% to'pladingiz — o'tish bali " + PASS_PCT + "%. " + r.level + " darajada mashq qiling va keyinroq qayta urinib ko'ring."))
      : t("Based on " + r.total + " questions across four sections.", "To'rt bo'limdagi " + r.total + " savol asosida.");
    var mins = Math.floor(T.durationSec / 60), secs = T.durationSec % 60;

    var secHtml = SECTIONS.map(function (s) {
      var d = T.sections[s], p = pct(d.correct, d.total);
      return '<div class="mb"><div class="pl-secrow"><span><b>' + esc(sectionLabel(s)) + '</b> <span class="muted small">· ' + esc(t("level", "daraja")) + ' ' + esc(d.level) + '</span></span>' +
        '<span class="muted">' + d.correct + '/' + d.total + ' (' + p + '%)</span></div>' + bar(p, p >= 60 ? "" : "var(--amber)") + '</div>';
    }).join("");

    var pathShown = T.path.filter(function (l, i) { return i === 0 || T.path[i - 1] !== l; });
    var pathHtml = pathShown.map(function (l, i) {
      return (i ? '<span class="muted">→</span>' : '') + '<span class="chip' + (l === r.level ? ' on' : '') + '" style="cursor:default">' + esc(l) + '</span>';
    }).join("");

    root.innerHTML =
      '<div class="section-head"><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div></div>' +
      '<div class="grid cols-2">' +
      '<div class="card center" aria-live="polite"><div class="small muted" style="text-transform:uppercase;letter-spacing:.06em">' + esc(isUp ? t("Your level", "Darajangiz") : t("Your CEFR level", "CEFR darajangiz")) + '</div>' +
      '<div class="pl-level mt" aria-label="' + esc(t("CEFR level " + r.level, "CEFR darajasi " + r.level)) + '">' + esc(r.level) + '</div>' +
      '<div class="pl-score mt">' + r.score + '%</div><div class="small muted">' + r.correct + ' / ' + r.total + ' ' + esc(t("correct", "to'g'ri")) + ' · ' + mins + ':' + (secs < 10 ? "0" : "") + secs + '</div>' +
      (isUp ? '' : '<div class="small muted mt">' + esc(t("Path", "Yo'l")) + ':</div><div class="pl-path mt" style="justify-content:center">' + pathHtml + '</div>') +
      '</div>' +
      '<div class="card"><h3>' + esc(t("By section", "Bo'limlar bo'yicha")) + '</h3>' + secHtml + '</div></div>' +
      '<div class="card mt"><p class="small muted">' + esc(isUp
        ? t("Your result will be saved to your profile.", "Natijangiz profilingizga saqlanadi.")
        : t("Your level will be saved and your lessons, vocabulary and tasks will be matched to it. You can retake the placement test after 30 days.",
          "Darajangiz saqlanadi, darslar, lug'at va topshiriqlar unga moslashtiriladi. Testni 30 kundan keyin qayta topshirish mumkin.")) + '</p>' +
      '<div class="btn-row"><button class="btn primary" id="pl-continue" aria-label="' + esc(t("Save the result and continue to the dashboard", "Natijani saqlab bosh sahifaga o'tish")) + '">' + esc(t("Continue", "Davom etish")) + '</button></div></div>';

    var btn = document.getElementById("pl-continue");
    btn.onclick = function () { if (!T || T.saving) return; T.saving = true; btn.disabled = true; btn.textContent = t("Saving…", "Saqlanmoqda…"); recordAndLeave(); };
    setTimeout(function () { btn.focus(); }, 30);
  }

  function recordAndLeave() {
    var r = T.result, kind = T.kind, from = T.fromLevel;
    var details = { sections: {}, path: T.path.slice(), durationSec: T.durationSec };
    SECTIONS.forEach(function (s) { details.sections[s] = { correct: T.sections[s].correct, total: T.sections[s].total, level: T.sections[s].level }; });
    var okMsg = kind === "level_up"
      ? (r.passed ? t("Congratulations — you have reached " + r.level + "!", "Tabriklaymiz — " + r.level + " darajaga chiqdingiz!")
        : t("Not passed this time. Keep practising at " + r.level + ".", "Bu safar o'tmadingiz. " + r.level + " darajada mashq qilishda davom eting."))
      : t("Your level: " + r.level + ". Your study plan has been updated.", "Darajangiz: " + r.level + ". O'quv rejangiz yangilandi.");
    var p;
    try {
      var lv = E().levels;
      p = (lv && typeof lv.recordTest === "function") ? lv.recordTest(kind, from, r.level, r.score, details) : Promise.resolve(null);
    } catch (x) { p = Promise.reject(x); }
    Promise.resolve(p).then(function () {
      toast(okMsg, "good");
    }, function (err) {
      toast(t("Result could not be saved: ", "Natijani saqlab bo'lmadi: ") + ((err && err.message) || t("connection error", "ulanish xatosi")), "warn");
    }).then(function () {
      abandon();
      nav("dashboard");
    });
  }

  /* ---------------------------------------------------------------------
     PUBLIC API
  --------------------------------------------------------------------- */
  var registered = false;
  function ensureView() {
    if (registered) return;
    if (E().registerView) { E().registerView("placement", view); registered = true; }
  }
  function start(opts) {
    ensureView();
    newTest(opts);
    nav("placement");
  }
  // Register as soon as ELH exists so that nav("placement") shows the intro even before start() is called.
  if (window.ELH && window.ELH.registerView) ensureView();
  else document.addEventListener("DOMContentLoaded", ensureView);

  window.ELH_PLACEMENT = { start: start, ready: true };
})();
