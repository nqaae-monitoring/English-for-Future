/* =========================================================================
   Topic a2-02 — Introducing Your Institution (A2)
   Stable topic id: a2-02-introducing-your-institution
   Part 1 merges module materials into HUB_CONTENT.A2.* (duplicates by term /
   phrase / id are skipped and linked, so existing records survive).
   Part 2 registers the topic page for topics.js.
   Institutions, names and numbers are invented teaching examples.
   ========================================================================= */
(function (global) {
  "use strict";
  var TOPIC_ID = "a2-02-introducing-your-institution";
  var C = global.HUB_CONTENT, D = global.HUB_DATA;
  if (!C || !D) { console.warn("a2-02: HUB_CONTENT/HUB_DATA missing"); return; }
  C.A2 = C.A2 || {};
  ["vocabulary", "phrases", "grammar", "listening", "writing", "speaking"].forEach(function (k) { C.A2[k] = C.A2[k] || []; });

  var VT = "Institutional Profile", PC = "Presenting your organization";
  if (D.VOCAB_TOPICS.indexOf(VT) < 0) D.VOCAB_TOPICS.push(VT);
  if (D.PHRASE_CATS.indexOf(PC) < 0) D.PHRASE_CATS.push(PC);
  // pron left empty on purpose: no verified IPA source in this build (the UI simply shows no transcription)
  function W(term, pos, def, uz, example, coll, note) {
    return { term: term, pron: "", topic: VT, pos: pos, def: def, uz: uz, example: example, collocations: coll || [], synonyms: [], antonyms: [], mistakes: note || "", formal: "", meeting: "", speech: "", exercise: null, mastery: "new", level: "A2", topicId: TOPIC_ID };
  }
  function PH(phrase, uz, situation, alternatives, dialogue) {
    return { category: PC, phrase: phrase, situation: situation, formality: "neutral", dialogue: dialogue || "", alternatives: alternatives || [], errors: "", uz: uz, level: "A2", topicId: TOPIC_ID };
  }
  function allVocab() { return C.A2.vocabulary.concat(C.B1.vocabulary || [], D.VOCABULARY); }
  function allPhrases() { return C.A2.phrases.concat(C.B1.phrases || [], D.PHRASES); }
  function hasTerm(t) { return allVocab().some(function (v) { return v.term.toLowerCase() === t.toLowerCase(); }); }
  function hasPhrase(p) { return allPhrases().some(function (x) { return x.phrase === p; }); }
  function hasId(arr, id) { return arr.some(function (x) { return x.id === id; }); }

  /* ---------------- 1. Vocabulary (18 units; existing records are linked, not duplicated) */
  var VOCAB = [
    W("institution", "noun", "An organisation that does a particular type of work, such as education.", "muassasa", "Our institution supports teachers.", ["educational institution", "public institution"]),
    W("school", "noun", "A place where children learn.", "maktab", "Our school has 600 students.", ["secondary school", "public school"]),
    W("university", "noun", "An institution where people study for degrees.", "universitet", "The university offers courses in education.", ["public university", "university students"]),
    W("training centre", "noun phrase", "A place where people learn skills for their work.", "o‘quv va malaka oshirish markazi", "We work at a teacher training centre.", ["teacher training centre", "regional training centre"]),
    W("located", "adjective", "In a particular place.", "joylashgan", "Our centre is located in Bukhara.", ["located in", "located near"]),
    W("established", "adjective", "Started at a particular time.", "tashkil etilgan", "The centre was established in 2018.", ["established in 2018", "established as a training centre"], "“Was established” is used here as a fixed phrase; the passive is not taught in this lesson."),
    W("staff", "noun", "The people who work for an organisation.", "xodimlar", "We have 25 staff members.", ["staff members", "teaching staff"], "Count people as “25 staff members”, not “25 staffs”."),
    W("student", "noun", "A person who studies at a school, college or university.", "o‘quvchi yoki talaba", "Our students study English.", ["university student", "international student"]),
    W("participant", "noun", "A person who takes part in an activity or course.", "ishtirokchi", "Each workshop has 20 participants.", ["course participants", "workshop participants"]),
    W("programme", "noun", "A planned course or set of activities. (US spelling: program)", "dastur", "We offer a teacher development programme.", ["training programme", "education programme"]),
    W("course", "noun", "A set of lessons about a subject.", "kurs", "We offer short English courses.", ["online course", "short course"]),
    W("offer", "verb", "To make a course or service available.", "taklif qilmoq, taqdim etmoq", "We offer courses for teachers.", ["offer courses", "offer training"]),
    W("provide", "verb", "To give people something they need.", "ta’minlamoq, taqdim etmoq", "We provide training materials.", ["provide support", "provide training"]),
    W("facility", "noun", "A room, building or piece of equipment used for an activity.", "foydalanish uchun yaratilgan joy yoki imkoniyat", "Our facilities include a library and a computer room.", ["learning facilities", "training facilities"], "Usually used in the plural: facilities."),
    W("library", "noun", "A place where people can read or borrow books.", "kutubxona", "There is a library on the first floor.", ["school library", "digital library"]),
    W("computer room", "noun phrase", "A room with computers for learning or work.", "kompyuter xonasi", "There are two computer rooms.", ["use the computer room", "a modern computer room"]),
    W("partner", "noun", "A person or organisation that works with another.", "hamkor", "We work with local and international partners.", ["international partner", "partner institution"]),
    W("aim", "noun", "Something that you want to achieve.", "maqsad", "Our aim is to support teachers.", ["main aim", "our aim is to"])
  ];
  var vocabAdded = 0, vocabLinked = [];
  VOCAB.forEach(function (v) { if (!hasTerm(v.term)) { C.A2.vocabulary.push(v); vocabAdded++; } else vocabLinked.push(v.term); });

  /* ---------------- 2. Phrases (14; one already exists and is linked) */
  var PHRASES = [
    PH("Welcome to our institution.", "Muassasamizga xush kelibsiz.", "Greeting a visitor.", ["Welcome to our centre."]),
    PH("Our institution is called ...", "Muassasamiz ... deb nomlanadi.", "Giving the name.", ["The name of our institution is ..."], "Our institution is called Bright Path Training Centre."),
    PH("We are a ...", "Biz ...miz.", "Saying the type of institution.", ["Our institution is a ..."], "We are a regional teacher training centre."),
    PH("We are located in ...", "Biz ...da joylashganmiz.", "Saying where it is.", ["Our centre is in ..."], "We are located in Samarkand."),
    PH("Our centre was established in ...", "Markazimiz ... yilda tashkil etilgan.", "Saying when it started.", ["Our centre opened in 2018."], "Our centre was established in 2018."),
    PH("We have ... staff members.", "Bizda ... nafar xodim bor.", "Giving the number of staff.", [], "We have 25 staff members."),
    PH("About ... participants attend our courses each year.", "Har yili kurslarimizda taxminan ... nafar ishtirokchi qatnashadi.", "Giving an approximate number of learners.", [], "About 400 participants attend our courses each year."),
    PH("We offer ...", "Biz ... taklif qilamiz.", "Describing courses or services.", ["Our courses include ..."], "We offer English courses and teaching workshops."),
    PH("We provide ... for ...", "Biz ... uchun ... taqdim etamiz.", "Describing a service and who it is for.", [], "We provide training for teachers."),
    PH("Our main aim is to ...", "Asosiy maqsadimiz ...", "Stating the main aim.", ["We aim to improve teaching."], "Our main aim is to improve teaching."),
    PH("We work with ...", "Biz ... bilan ishlaymiz.", "Naming partners.", [], "We work with schools and universities."),
    PH("There is a ...", "... bor.", "Describing one facility.", [], "There is a library in our centre."),
    PH("There are ...", "...lar bor.", "Describing several rooms or facilities.", [], "There are six classrooms."),
    PH("Thank you for visiting us.", "Bizga tashrif buyurganingiz uchun rahmat.", "Closing a visit politely.", ["We are happy to welcome you."])
  ];
  var phrasesAdded = 0, phrasesLinked = [];
  PHRASES.forEach(function (p) { if (!hasPhrase(p.phrase)) { C.A2.phrases.push(p); phrasesAdded++; } else phrasesLinked.push(p.phrase); });

  /* ---------------- 3. Grammar */
  var GRAMMAR = {
    id: "A2G12", level: "A2", topicId: TOPIC_ID, title: "Describing an Institution", focus: "we are / it is, have / has, there is / there are, present simple, numbers",
    explain: "A. WE ARE / IT IS: We are a training centre. Our institution is in Samarkand. It is a public institution. (“We” = speaking for the organisation; “it” = one organisation.) " +
      "B. HAVE / HAS: We have six classrooms. Our centre has a library. Negative: We do not have a sports hall. Questions: Do you have a library? — Yes, we do. / No, we don’t. Does your centre have online courses? — Yes, it does. " +
      "C. THERE IS / THERE ARE: There is a library. There are six classrooms. There is not a sports hall. There are not any laboratories. Is there a computer room? Are there any online courses? (there is + singular / uncountable; there are + plural). " +
      "D. ACTIVITIES: We offer short courses. Our centre offers short courses. We provide training. We work with schools. " +
      "E. NUMBERS: We have 25 staff members. About 400 participants attend our courses each year. (“about” = approximately; “each year” = every year). Numbers can be approximate, but do not present guesses as exact facts.",
    uz: "A. We are / It is — tashkilot nomidan “we”, bitta tashkilot “it”. B. have / has — bizda ... bor; inkor do not / does not have; savol Do you have ...? C. There is (birlik) / There are (ko‘plik). D. offer, provide, work with — faoliyatni tasvirlash. E. Son va taxmin: about, each year.",
    examples: ["We are a training centre. It is a public institution.", "We have six classrooms. → Our centre has a library.", "Do you have a library? — Yes, we do.", "There is a library. There are six classrooms.", "Is there a computer room? Are there any online courses?", "We offer short courses. The centre provides training.", "About 400 participants attend our courses each year."],
    exercise: [
      { q: "Complete: 'Our centre ___ a library.' (have / has)", a: "Our centre has a library." },
      { q: "Make it negative: 'We have a sports hall.'", a: "We do not have a sports hall." },
      { q: "Choose: 'There ___ two computer rooms.' (is / are)", a: "There are two computer rooms." },
      { q: "Make the question: 'your centre / online courses / have ?'", a: "Does your centre have online courses?" },
      { q: "Say it with 'about': 'We have 400 participants every year.'", a: "About 400 participants attend our courses each year." }
    ]
  };
  if (!hasId(C.A2.grammar, GRAMMAR.id)) C.A2.grammar.push(GRAMMAR);

  /* ---------------- 4. Listening (module format: comprehension q/a + dictation of the first sentence by the existing player) */
  var LISTENING = {
    id: "A2L12", level: "A2", topicId: TOPIC_ID, title: "Welcome to Green Valley School", accent: "British", type: "Institutional introduction",
    text: "Hello, and welcome to Green Valley School. Our school is in Bukhara. We have 40 teachers and about 600 students. There are 20 classrooms, a library and two computer rooms. We offer an English club after school. We also organise sports activities. Our main aim is to help students learn and develop their skills.",
    vocab: ["teachers", "students", "classrooms", "computer rooms", "English club", "main aim"],
    questions: [
      { q: "Where is the school?", a: "Bukhara" },
      { q: "How many teachers does it have?", a: "40" },
      { q: "About how many students does it have?", a: "600" },
      { q: "How many computer rooms are there?", a: "two" },
      { q: "What club does the school offer?", a: "an English club" }
    ],
    uz: "Maktab tanishtiruvi: joylashuv, o‘qituvchilar va o‘quvchilar soni, xonalar, to‘garak va asosiy maqsad."
  };
  if (!hasId(C.A2.listening, LISTENING.id)) C.A2.listening.push(LISTENING);

  /* ---------------- 5. Speaking */
  var SPEAKING = {
    id: "a2-02-speaking", topicId: TOPIC_ID, level: "A2", title: "Introduce Your Institution to a Visitor",
    prompt: "An international colleague is visiting your institution. Welcome the visitor and introduce your institution. Explain where it is, what it does and what facilities it has. Finish with its main aim. Speak for about 45–60 seconds. Plan: Welcome → Name and type → Location → Activities → One or two facts → Aim.",
    seconds: 60, expected: ["institution", "located", "offer", "provide", "staff members", "facilities", "aim"], keys: ["confidence", "fluency", "terminology"],
    model: "Welcome to Sunrise Learning Centre. We are a training centre in Tashkent. We offer English courses and computer courses for adults. We have twelve teachers and six classrooms. There is a small library and a computer room. We also work with local companies. Our main aim is to help people develop useful skills for work. Thank you for visiting us. We are happy to show you our centre and answer your questions.",
    uz: "Xorijiy hamkasbni kutib olib, tashkilotingizni tanishtiring: joylashuvi, faoliyati, imkoniyatlari va asosiy maqsadi. 45–60 soniya."
  };
  if (!C.A2.speaking.some(function (s) { return s.id === SPEAKING.id || s.title === SPEAKING.title; })) C.A2.speaking.push(SPEAKING);

  /* ---------------- 6. Writing */
  var WRITING = {
    id: "A2W12", level: "A2", topicId: TOPIC_ID, type: "Institution introduction",
    prompt: "Write 50–70 words for an international visitor. Include: your institution’s name and type; its location; two activities or services; one fact about staff, learners or facilities; its main aim. You may use an imaginary institution and approximate numbers.",
    model: "Our institution is called Sunrise Learning Centre. We are a training centre in Tashkent. We offer English courses and computer courses for adults. We have 12 teachers and six classrooms. There is a small library too. We work with local companies. Our main aim is to help people develop useful skills for work.",
    tips: ["Template: Our institution is called ____. We are a ____ in ____. We offer ____ and ____. We have ____. There is/are ____. Our main aim is to ____.", "Start with the institution’s name and type", "Use short, clear sentences and “we” consistently", "Check have/has and there is/there are", "Use approximate numbers if necessary"],
    uz: "Xorijiy mehmon uchun tashkilotingiz haqida 50–70 so‘z yozing. Tashkilot nomi va turi, joylashuvi, ikkita faoliyati yoki xizmati, xodimlar/o‘quvchilar/imkoniyatlar haqida bitta fakt va asosiy maqsadini kiriting.",
    rubric: [
      { name: "Content", uz: "Mazmun", max: 10, desc: "0–2 each: name and type; location; two activities or services; one fact about staff, learners or facilities; main aim." },
      { name: "Grammar", uz: "Grammatika", max: 4, desc: "4: main forms correct; 3: a few errors, meaning clear; 2: repeated errors; 1: hard to understand; 0: not assessable." },
      { name: "Vocabulary", uz: "Lug‘at", max: 4, desc: "4: topic vocabulary correct and sufficient; 3: minor gaps; 2: limited; 1: very limited; 0: not enough to assess." },
      { name: "Organisation and length", uz: "Tuzilish va hajm", max: 2, desc: "2: coherent and 50–70 words; 1: noticeable deviation; 0: no connected text. No extra length penalty elsewhere." }
    ]
  };
  if (!hasId(C.A2.writing, WRITING.id)) C.A2.writing.push(WRITING);

  /* ================================================================ TOPIC PAGE */
  var MC = function (id, q, opts, answer, exEn, exUz) { return { id: id, q: q, options: opts.map(function (t, i) { return { id: id + "-" + "abc"[i], text: t }; }), answer: id + "-" + answer, explain_en: exEn || "", explain_uz: exUz || "", points: 1 }; };
  global.HUB_TOPICS = global.HUB_TOPICS || {};
  global.HUB_TOPICS[TOPIC_ID] = {
    id: TOPIC_ID, order: 2, level: "A2", category: "Professional Communication",
    title_en: "Introducing Your Institution", title_uz: "Ta’lim tashkilotingizni tanishtirish",
    time: "45–60 min", review: "10 min", prereq: "a2-01-introducing-yourself-and-your-role", skills: ["Reading", "Listening", "Speaking", "Writing"],
    grammar: "We are / Our institution is; We have / has; There is / There are; Present Simple (offer, provide, support, work); numbers and quantities",
    context_en: "Welcoming an international colleague who visits your institution.", context_uz: "Tashkilotingizga tashrif buyurgan xorijiy hamkasbni kutib olish.",
    desc_en: "Learn to introduce your institution, describe its main activities and give simple facts about its staff, learners and facilities.",
    desc_uz: "Tashkilotingizni tanishtirish, uning faoliyati, xodimlari, o‘quvchilari va imkoniyatlari haqida sodda ma’lumot berishni o‘rganing.",
    outcome_en: "By the end of this lesson, you can welcome a visitor and introduce your institution: its name and type, location, activities, simple facts and main aim.",
    outcomes_uz: ["Tashkilot nomi va turini aytish.", "Joylashuvini tushuntirish.", "Kamida ikkita faoliyat yoki xizmatni tasvirlash.", "Xodimlar, o‘quvchilar va imkoniyatlar haqida oddiy faktlarni aytish.", "Tashkilot haqida 50–70 so‘zli matn yozish.", "Taxminan 45–60 soniyalik taqdimot qilish.", "Tashkilot haqida uchta sodda savolga javob berish."],
    links: { vocabulary: VOCAB.map(function (v) { return v.term; }), vocabTopic: VT, phrases: PHRASES.map(function (p) { return p.phrase; }), phraseCat: PC, grammar: "A2G12", listening: "A2L12", speaking: "Introduce Your Institution to a Visitor", writing: "A2W12" },
    sections: [
      { id: "a2-02-intro", type: "intro", order: 1, title_en: "Welcome to Our Institution", title_uz: "Muassasamizga xush kelibsiz",
        situation_en: "An international colleague visits your institution. Give a short introduction before the visit begins.", situation_uz: "Xorijiy hamkasb tashkilotingizga tashrif buyurdi. Tashrif boshlanishidan oldin tashkilot haqida qisqa ma’lumot bering.",
        questions: ["What is the name of your institution?", "Where is it?", "What does it do?"],
        tip_en: "Use “we” when you speak for your institution: We are a training centre. We offer courses.", tip_uz: "Tashkilot nomidan gapirganda “we” ishlatiladi: We are a training centre. We offer courses.",
        task_en: "Write two sentences about your institution.", task_uz: "Tashkilotingiz haqida ikkita gap yozing.", sample: "Our institution is a teacher training centre. It is in Samarkand.",
        note_uz: "Bu diagnostik topshiriq: baholanmaydi.", privacy_en: "You can use an imaginary institution and approximate numbers.", privacy_uz: "Mashq uchun to‘qima tashkilot va taxminiy raqamlardan foydalanishingiz mumkin." },
      { id: "a2-02-vocabulary", type: "vocabulary", order: 2, title_en: "Key Vocabulary (18)", title_uz: "Asosiy lug‘at (18)",
        note_en: "“Programme” (UK) and “program” (US) are both accepted. Count people as “25 staff members”. “Was established” is a fixed phrase here.", note_uz: "“Programme” (Britaniya) va “program” (AQSh) ikkalasi qabul qilinadi. Xodimlar soni: “25 staff members”. “Was established” — tayyor ibora." },
      { id: "a2-02-key-phrases", type: "phrases", order: 3, title_en: "Key Phrases (14)", title_uz: "Tayyor iboralar (14)",
        usage_en: ["Welcome a visitor, give the name and type, then location, activities, facts and aim.", "“We have ... staff members” for people; “There is / There are” for rooms and facilities.", "Approximate numbers: “about 400 participants”, “each year”."],
        usage_uz: ["Mehmonni kutib oling, nom va turni, so‘ng joylashuv, faoliyat, faktlar va maqsadni ayting.", "Odamlar uchun “We have ... staff members”; xonalar va imkoniyatlar uchun “There is / There are”.", "Taxminiy sonlar: “about 400 participants”, “each year”."] },
      { id: "a2-02-grammar", type: "grammar", order: 4, title_en: "Grammar: Describing an Institution", title_uz: "Grammatika: Tashkilotni tasvirlash",
        blocks: [
          { title: "A. WE ARE / IT IS", lines: ["We are a training centre.", "Our institution is in Samarkand.", "It is a public institution."], note_en: "“We” is used when you speak for the organisation. “It” refers to one organisation.", note_uz: "“We” tashkilot nomidan gapirganda ishlatiladi. “It” bitta tashkilotni anglatadi." },
          { title: "B. HAVE / HAS", lines: ["We have six classrooms.", "Our centre has a library.", "The university has three faculties."], sub: [["Negative", ["We do not have a sports hall.", "Our centre does not have a laboratory."]], ["Questions", ["Do you have a library?", "Does your centre have online courses?"]], ["Short answers", ["Yes, we do.", "No, we don’t.", "Yes, it does.", "No, it doesn’t."]]] },
          { title: "C. THERE IS / THERE ARE", lines: ["There is a library.", "There are six classrooms.", "There is not a sports hall.", "There are not any laboratories.", "Is there a computer room?", "Are there any online courses?"], note_en: "There is + singular countable or uncountable noun. There are + plural noun.", note_uz: "There is + birlikdagi sanaladigan ot yoki sanalmaydigan ot. There are + ko‘plikdagi ot." },
          { title: "D. DESCRIBING ACTIVITIES", lines: ["We offer short courses. / Our centre offers short courses.", "We provide training. / The centre provides training.", "We work with schools. / Our institution works with schools."] },
          { title: "E. NUMBERS AND APPROXIMATION", lines: ["We have 25 staff members.", "About 400 participants attend our courses each year."], note_en: "“About” = approximately. “Each year” = every year. Numbers may be approximate, but do not present them as exact facts.", note_uz: "“About” — taxminan. “Each year” — har yili. Sonlarni taxminan aytish mumkin, lekin ularni aniq fakt sifatida ko‘rsatmaslik kerak." }
        ] },
      { id: "a2-02-reading", type: "reading", order: 5, title_en: "Reading: Bright Path Training Centre", title_uz: "O‘qish: Bright Path malaka oshirish markazi", points: 6,
        text_en: "Welcome to Bright Path Training Centre. We are a teacher training centre in Samarkand. Our centre was established in 2018. We have 25 staff members and six classrooms. There is a library and a computer room. We offer English courses and teaching workshops. About 400 participants attend our courses each year. We work with local schools and two universities. Our main aim is to help teachers develop their skills.",
        text_uz: "Bright Path malaka oshirish markaziga xush kelibsiz. Biz Samarqanddagi o‘qituvchilar malakasini oshirish markazimiz. Markazimiz 2018-yilda tashkil etilgan. Bizda 25 nafar xodim va oltita o‘quv xonasi bor. Kutubxona va kompyuter xonasi mavjud. Ingliz tili kurslari va o‘qitish bo‘yicha seminarlar taklif qilamiz. Har yili kurslarimizda taxminan 400 nafar ishtirokchi qatnashadi. Mahalliy maktablar va ikkita universitet bilan ishlaymiz. Asosiy maqsadimiz o‘qituvchilarga ko‘nikmalarini rivojlantirishda yordam berish.",
        questions: [
          MC("r1", "Where is the centre?", ["Samarkand", "Tashkent", "Bukhara"], "a", "“We are a teacher training centre in Samarkand.”", "“We are a teacher training centre in Samarkand.”"),
          MC("r2", "When was it established?", ["2008", "2018", "2023"], "b", "“Our centre was established in 2018.”", "“Our centre was established in 2018.”"),
          MC("r3", "How many staff members does it have?", ["6", "400", "25"], "c", "“We have 25 staff members and six classrooms.”", "“We have 25 staff members and six classrooms.”"),
          MC("r4", "Which facilities are mentioned?", ["A library and a computer room", "A swimming pool and a stadium", "A hospital and a café"], "a", "“There is a library and a computer room.”", "“There is a library and a computer room.”"),
          MC("r5", "What does the centre offer?", ["Medical services", "English courses and teaching workshops", "Driving lessons"], "b", "“We offer English courses and teaching workshops.”", "“We offer English courses and teaching workshops.”"),
          MC("r6", "What is its main aim?", ["To sell computers", "To organise sports events", "To help teachers develop their skills"], "c", "“Our main aim is to help teachers develop their skills.”", "“Our main aim is to help teachers develop their skills.”")
        ] },
      { id: "a2-02-dialogue", type: "dialogue", order: 6, title_en: "Model Dialogue: A Visitor at the Centre", title_uz: "Namunaviy dialog: Markazga tashrif",
        lines: [["Host", "Welcome to Bright Path Training Centre."], ["Visitor", "Thank you. What does your centre do?"], ["Host", "We provide training for teachers."], ["Visitor", "What courses do you offer?"], ["Host", "We offer English courses and teaching workshops."], ["Visitor", "How many staff members do you have?"], ["Host", "We have 25 staff members."], ["Visitor", "Do you work with other institutions?"], ["Host", "Yes, we do. We work with local schools and two universities."], ["Visitor", "Do you have a library?"], ["Host", "Yes, we do. Let me show you."], ["Visitor", "Thank you. That would be great."]],
        notes: [["What does your centre do? — asks about the main activity.", "What does your centre do? — Markazingiz nima bilan shug‘ullanadi?"], ["What courses do you offer?", "What courses do you offer? — Qanday kurslar taklif qilasiz?"], ["How many ...? — asks for a number.", "How many ...? — Nechta? / Necha nafar?"], ["Let me show you. — an offer.", "Let me show you. — Sizga ko‘rsatay."], ["That would be great. — a polite reply.", "That would be great. — Juda yaxshi bo‘lardi."]],
        task_en: "Replace the centre’s information with information about your institution.", task_uz: "Markaz ma’lumotlarini o‘z tashkilotingiz ma’lumotlari bilan almashtiring.",
        placeholders: ["[institution name]", "[institution type]", "[main activity]", "[courses]", "[number of staff]", "[partners]", "[facility]"],
        template: "Welcome to [institution name].\nWe are a [institution type]. We [main activity].\nWe offer [courses].\nWe have [number of staff] staff members.\nWe work with [partners].\nYes, we do. There is a [facility]. Let me show you." },
      { id: "a2-02-listening", type: "listening", order: 7, title_en: "Listening: Welcome to Green Valley School", title_uz: "Tinglash: Green Valley maktabiga xush kelibsiz", points: 5, listeningId: "A2L12",
        items: [
          { id: "l1", q: "Where is the school?", answers: ["Bukhara", "in Bukhara", "It is in Bukhara", "The school is in Bukhara"] },
          { id: "l2", q: "How many teachers does it have?", answers: ["40", "forty", "40 teachers", "forty teachers", "It has 40 teachers", "It has forty teachers"] },
          { id: "l3", q: "About how many students does it have?", answers: ["600", "six hundred", "about 600", "about six hundred", "600 students", "about 600 students"] },
          { id: "l4", q: "How many computer rooms are there?", answers: ["2", "two", "two computer rooms", "2 computer rooms", "There are two computer rooms", "There are 2 computer rooms"] },
          { id: "l5", q: "What club does the school offer?", answers: ["an English club", "English club", "It offers an English club"] }
        ],
        dictation: { text: "We have forty teachers and about six hundred students.", accepted: ["We have forty teachers and about six hundred students.", "We have 40 teachers and about 600 students."] } },
      { id: "a2-02-matching", type: "matching", order: 8, title_en: "Match the Words", title_uz: "So‘zlarni moslashtiring", points: 8,
        instructions_en: "Match the words with their meanings.", instructions_uz: "So‘zlarni ma’nolari bilan moslashtiring.",
        pairs: [["m1", "staff", "xodimlar"], ["m2", "course", "kurs"], ["m3", "library", "kutubxona"], ["m4", "partner", "hamkor"], ["m5", "located", "joylashgan"], ["m6", "aim", "maqsad"], ["m7", "provide", "taqdim etmoq"], ["m8", "participant", "ishtirokchi"]] },
      { id: "a2-02-gap-fill", type: "gapfill", order: 9, title_en: "Complete the Sentences", title_uz: "Bo‘sh joylarni to‘ldiring", points: 10,
        items: [
          { id: "g1", text: "Our centre ___ in Samarkand.", answers: ["is"] },
          { id: "g2", text: "We ___ 25 staff members.", answers: ["have"] },
          { id: "g3", text: "The school ___ a library.", answers: ["has"] },
          { id: "g4", text: "There ___ two computer rooms.", answers: ["are"] },
          { id: "g5", text: "There ___ a training room.", answers: ["is"] },
          { id: "g6", text: "We are located ___ Bukhara.", answers: ["in"] },
          { id: "g7", text: "Our centre ___ English courses.", answers: ["offers"] },
          { id: "g8", text: "We provide training ___ teachers.", answers: ["for"] },
          { id: "g9", text: "Our main aim is ___ support students.", answers: ["to"] },
          { id: "g10", text: "___ your school have a library?", answers: ["does"] }
        ] },
      { id: "a2-02-sentence-order", type: "order", order: 10, title_en: "Put the Words in Order", title_uz: "So‘zlardan gap tuzing", points: 6,
        items: [
          { id: "s1", words: ["located", "We", "in Tashkent", "are"], answer: "We are located in Tashkent." },
          { id: "s2", words: ["has", "a library", "Our centre"], answer: "Our centre has a library." },
          { id: "s3", words: ["two computer rooms", "There", "are"], answer: "There are two computer rooms." },
          { id: "s4", words: ["offer", "We", "short courses"], answer: "We offer short courses." },
          { id: "s5", words: ["your institution", "does", "do", "What"], answer: "What does your institution do?" },
          { id: "s6", words: ["to", "Our aim", "support teachers", "is"], answer: "Our aim is to support teachers." }
        ] },
      { id: "a2-02-error-correction", type: "errors", order: 11, title_en: "Correct the Mistake", title_uz: "Xatoni tuzating", points: 6,
        items: [
          { id: "e1", wrong: "Our centre have six classrooms.", answers: ["Our centre has six classrooms."], explain_en: "“Our centre” is singular, so “has”.", explain_uz: "“Our centre” birlik shakl, shuning uchun “has”." },
          { id: "e2", wrong: "There is two libraries.", answers: ["There are two libraries."], explain_en: "Plural: “there are”.", explain_uz: "Ko‘plik bilan “there are”." },
          { id: "e3", wrong: "We offers English courses.", answers: ["We offer English courses."], explain_en: "With “we” use the base form.", explain_uz: "“We” bilan fe’lning asosiy shakli." },
          { id: "e4", wrong: "We are located at Samarkand.", answers: ["We are located in Samarkand.", "We're located in Samarkand."], explain_en: "With a city use “in” here.", explain_uz: "Shahar nomi bilan ushbu gapda “in”." },
          { id: "e5", wrong: "Our aim is help students.", answers: ["Our aim is to help students."], explain_en: "“Our aim is to + verb”.", explain_uz: "“Our aim is to + verb”." },
          { id: "e6", wrong: "Does your school has a library?", answers: ["Does your school have a library?"], explain_en: "After “does” use “have”.", explain_uz: "“Does”dan keyin “have”." }
        ] },
      { id: "a2-02-situations", type: "situations", order: 12, title_en: "Choose the Best Response", title_uz: "Vaziyatga mos javobni tanlang", points: 4,
        questions: [
          MC("c1", "A visitor asks: “What does your institution do?”", ["We provide training for teachers.", "My name is Malika.", "It is Monday."], "a"),
          MC("c2", "You want to ask about staff numbers.", ["Where is your school?", "How many staff members do you have?", "What is your name?"], "b"),
          MC("c3", "You want to describe a facility.", ["We are twenty.", "It offers yesterday.", "There is a library in our centre."], "c"),
          MC("c4", "A visitor asks: “Do you offer online courses?”", ["Yes, we do.", "Yes, we are.", "Yes, we have."], "a")
        ] },
      { id: "a2-02-writing", type: "writing", order: 13, title_en: "Writing: An Introduction to Your Institution", title_uz: "Yozish: Tashkilotingiz tanishtiruvi", writingId: "A2W12", max: 20,
        checklist_en: ["I wrote the name and type.", "I wrote the location.", "I wrote two activities or services.", "I wrote one fact about staff, learners or facilities.", "I wrote the main aim.", "My text is 50–70 words."],
        checklist_uz: ["Nom va turini yozdim.", "Joylashuvini yozdim.", "Ikkita faoliyat yoki xizmatni yozdim.", "Xodimlar, o‘quvchilar yoki imkoniyatlar haqida bitta fakt yozdim.", "Asosiy maqsadni yozdim.", "Matn 50–70 so‘z."] },
      { id: "a2-02-speaking", type: "speaking", order: 14, title_en: "Speaking: Introduce Your Institution to a Visitor", title_uz: "Nutq: Tashkilotingizni mehmonga tanishtiring", speakingTitle: "Introduce Your Institution to a Visitor", max: 20, prep: 60,
        plan: ["Welcome", "Name and type", "Location", "Activities", "One or two facts", "Aim"],
        rubric: [["Content", "Mazmun"], ["Intelligibility", "Tushunarlilik"], ["Fluency", "Nutq ravonligi"], ["Grammar and vocabulary", "Grammatika va lug‘at"]],
        checklist_en: ["I welcomed the visitor.", "I said the name and type.", "I said where it is.", "I described what it does.", "I mentioned facilities or numbers.", "I finished with the main aim."],
        checklist_uz: ["Mehmonni kutib oldim.", "Nom va turini aytdim.", "Qayerdaligini aytdim.", "Nima qilishini tasvirladim.", "Imkoniyatlar yoki sonlarni aytdim.", "Asosiy maqsad bilan yakunladim."] },
      { id: "a2-02-role-play", type: "roleplay", order: 15, title_en: "Role-play: A Guided Introduction", title_uz: "Rolli suhbat: Yo‘naltirilgan tanishtiruv",
        role_en: "The visitor is an international colleague visiting your institution for the first time. You may use an imaginary institution and approximate numbers.", role_uz: "Mehmon — tashkilotingizga birinchi marta tashrif buyurgan xorijiy hamkasb. To‘qima tashkilot va taxminiy raqamlardan foydalanishingiz mumkin.",
        turns: ["Thank you for welcoming me. What is the name of your institution?", "What kind of institution is it?", "Where is it located?", "What courses or services do you offer?", "How many staff members do you have?", "What facilities do you have?", "What is your main aim?"],
        hints: ["Our institution is called ...", "We are a ...", "We are located in ...", "We offer ... / We provide ... for ...", "We have ... staff members.", "There is a ... / There are ...", "Our main aim is to ..."],
        closing_en: "Thank you. That was very clear — I look forward to the visit!", closing_uz: "Rahmat. Juda tushunarli bo‘ldi — tashrifni intiqlik bilan kutaman!" },
      { id: "a2-02-final-quiz", type: "quiz", order: 16, title_en: "Final Quiz", title_uz: "Yakuniy test", quizId: "a2-02-final-quiz", points: 12, pass: 80,
        instructions_en: "Choose the best answer. Each question has one correct answer.", instructions_uz: "Eng to‘g‘ri javobni tanlang. Har bir savolda bitta to‘g‘ri javob bor.",
        questions: [
          MC("f1", "Our institution ___ in Bukhara.", ["is", "are", "am"], "a", "“Our institution” is singular: is.", "“Our institution” birlik: is."),
          MC("f2", "We ___ 30 staff members.", ["has", "have", "having"], "b", "With “we”: have.", "“We” bilan: have."),
          MC("f3", "The centre ___ three training rooms.", ["have", "are", "has"], "c", "“The centre” is singular: has.", "“The centre” birlik: has."),
          MC("f4", "There ___ a library.", ["is", "are", "have"], "a", "Singular: there is.", "Birlik: there is."),
          MC("f5", "There ___ two computer rooms.", ["is", "are", "has"], "b", "Plural: there are.", "Ko‘plik: there are."),
          MC("f6", "We are located ___ Samarkand.", ["on", "to", "in"], "c", "With a city: in.", "Shahar bilan: in."),
          MC("f7", "Our school ___ English courses.", ["offers", "offer", "offering"], "a", "“Our school” is singular: offers.", "“Our school” birlik: offers."),
          MC("f8", "Our main aim is ___ teachers.", ["support", "to support", "supports"], "b", "“Our aim is to + verb”.", "“Our aim is to + verb”."),
          MC("f9", "“Staff members” means:", ["People who visit a city", "People who buy books", "People who work for an organisation"], "c"),
          MC("f10", "Which question asks about facilities?", ["Do you have a library?", "What is your name?", "When is your birthday?"], "a"),
          MC("f11", "“Do you offer online courses?” — “___”", ["Yes, we are.", "Yes, we do.", "Yes, it is."], "b", "Answer “Do you …?” with “Yes, we do.”", "“Do you …?” savoliga “Yes, we do.”"),
          MC("f12", "Read: “Our centre offers language courses for adults. There are eight teachers and four classrooms.” Who are the courses for?", ["Only school principals", "Young children", "Adults"], "c")
        ],
        feedback: [
          { min: 80, en: "Well done! You can move on to the next topic.", uz: "Ajoyib! Keyingi mavzuga o‘tishingiz mumkin." },
          { min: 50, en: "Good progress. Review the key phrases and try again.", uz: "Yaxshi harakat. Asosiy iboralarni takrorlab, qayta urinib ko‘ring." },
          { min: 0, en: "Let’s practise again. Start with the vocabulary and model dialogue.", uz: "Yana mashq qilamiz. Lug‘at va namunaviy dialogdan boshlang." }
        ] },
      { id: "a2-02-review", type: "review", order: 17, title_en: "Review Cards", title_uz: "Takrorlash kartochkalari",
        cards: [["Tashkilot nomini ayting.", "Our institution is called ..."], ["Tashkilot turini ayting.", "We are a ..."], ["Joylashuvini ayting.", "We are located in ..."], ["Xodimlar sonini ayting.", "We have ... staff members."], ["Kurslarni ayting.", "We offer ..."], ["Xizmatni ayting.", "We provide ... for ..."], ["Bitta imkoniyatni ayting.", "There is a ..."], ["Bir nechta xonani ayting.", "There are ..."], ["Asosiy maqsadni ayting.", "Our main aim is to ..."], ["Hamkorlarni ayting.", "We work with ..."], ["Mehmonni kutib oling.", "Welcome to our institution."], ["Tashrif uchun rahmat ayting.", "Thank you for visiting us."]],
        fronts_en: ["Say the name of your institution.", "Say the type of institution.", "Say where it is.", "Say how many staff members you have.", "Say which courses you offer.", "Say which service you provide and for whom.", "Mention one facility.", "Mention several rooms.", "Say the main aim.", "Say who you work with.", "Welcome a visitor.", "Thank a visitor for coming."] },
      { id: "a2-02-homework", type: "homework", order: 18, title_en: "Homework: Your Institution Profile", title_uz: "Uyga vazifa: Tashkilot profili",
        profile: [["Name", "Nomi"], ["Type", "Turi"], ["Location", "Joylashuvi"], ["Main activities", "Asosiy faoliyati"], ["Number of staff", "Xodimlar soni"], ["Learners or participants", "O‘quvchilar yoki ishtirokchilar"], ["Facilities", "Imkoniyatlar"], ["Partners", "Hamkorlar"], ["Main aim", "Asosiy maqsad"]],
        steps_en: ["Write a 50–70 word introduction.", "Practise saying it aloud twice.", "Prepare answers to three questions: What does your institution do? What facilities do you have? What is your main aim?"],
        steps_uz: ["50–70 so‘zli tanishtiruv yozing.", "Uni ovoz chiqarib ikki marta mashq qiling.", "Uchta savolga tayyorlaning: What does your institution do? What facilities do you have? What is your main aim?"],
        samples: ["What does your institution do?", "What facilities do you have?", "What is your main aim?"],
        note_en: "You may use imaginary details instead of real ones.", note_uz: "Haqiqiy ma’lumotlar o‘rniga to‘qima ma’lumotlardan foydalanish mumkin." }
    ]
  };
  global.HUB_TOPICS[TOPIC_ID]._merge = { vocabAdded: vocabAdded, vocabLinked: vocabLinked, phrasesAdded: phrasesAdded, phrasesLinked: phrasesLinked };
})(typeof window !== "undefined" ? window : this);
