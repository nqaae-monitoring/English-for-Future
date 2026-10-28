/* =========================================================================
   Topic a2-01 — Introducing Yourself and Your Role (A2)
   Stable topic id: a2-01-introducing-yourself-and-your-role

   Part 1 merges the topic's module materials into the existing collections
   (HUB_CONTENT.A2.* — same item shapes as content.js; duplicates by term /
   phrase / id are skipped so existing records and learner progress survive).
   Part 2 registers the topic page (window.HUB_TOPICS) rendered by topics.js:
   intro, reading, dialogue, extra exercises, role-play, final quiz, review,
   homework, plus links to the module items above.
   All names, organisations and contacts are invented teaching examples.
   ========================================================================= */
(function (global) {
  "use strict";
  var TOPIC_ID = "a2-01-introducing-yourself-and-your-role";
  var C = global.HUB_CONTENT, D = global.HUB_DATA;
  if (!C || !D) { console.warn("a2-01: HUB_CONTENT/HUB_DATA missing"); return; }
  C.A2 = C.A2 || {};
  ["vocabulary", "phrases", "grammar", "listening", "writing", "speaking"].forEach(function (k) { C.A2[k] = C.A2[k] || []; });

  /* ---------------------------------------------------------------- helpers */
  var VT = "Professional Introductions";
  if (D.VOCAB_TOPICS.indexOf(VT) < 0) D.VOCAB_TOPICS.push(VT);
  function W(term, pron, pos, def, uz, example, coll, syn) {
    return { term: term, pron: pron, topic: VT, pos: pos, def: def, uz: uz, example: example, collocations: coll || [], synonyms: syn || [], antonyms: [], mistakes: "", formal: "", meeting: "", speech: "", exercise: null, mastery: "new", level: "A2", topicId: TOPIC_ID };
  }
  function PH(phrase, uz, situation, alternatives) {
    return { category: "Introducing yourself", phrase: phrase, situation: situation, formality: "neutral", dialogue: "", alternatives: alternatives || [], errors: "", uz: uz, level: "A2", topicId: TOPIC_ID };
  }
  function hasTerm(t) { return C.A2.vocabulary.concat(C.B1.vocabulary || [], D.VOCABULARY).some(function (v) { return v.term.toLowerCase() === t.toLowerCase(); }); }
  function hasPhrase(p) { return C.A2.phrases.concat(C.B1.phrases || [], D.PHRASES).some(function (x) { return x.phrase === p; }); }
  function hasId(arr, id) { return arr.some(function (x) { return x.id === id; }); }

  /* ---------------------------------------------------------------- 1. Vocabulary (16 units; "support" and "quality assurance" already exist and are linked) */
  var VOCAB = [
    W("name", "/neɪm/", "noun", "The word people call you by.", "ism", "My name is Aziz.", ["first name", "full name", "my name is"], []),
    W("role", "/rəʊl/", "noun", "Your job or what you do at work.", "lavozim yoki ishdagi vazifa", "My role is to support teachers.", ["my role is to", "main role", "role in the team"], ["job", "position"]),
    W("institution", "/ˌɪnstɪˈtjuːʃn/", "noun", "An organisation such as a school, college or centre.", "muassasa", "I work at an educational institution.", ["educational institution", "our institution"], ["organisation"]),
    W("department", "/dɪˈpɑːtmənt/", "noun", "A part of an organisation that does one kind of work.", "bo‘lim", "I work in the English department.", ["English department", "training department", "head of department"], ["unit", "section"]),
    W("colleague", "/ˈkɒliːɡ/", "noun", "A person you work with.", "hamkasb", "This is my colleague, Malika.", ["my colleague", "new colleague", "colleagues from other schools"], ["co-worker"]),
    W("director", "/dəˈrektə/", "noun", "The person who leads an organisation or a centre.", "direktor, rahbar", "I am the director of a training centre.", ["director of", "centre director"], ["head", "leader"]),
    W("principal", "/ˈprɪnsəpl/", "noun", "The head of a school.", "maktab direktori", "She is a school principal.", ["school principal", "the principal’s office"], ["headteacher"]),
    W("teacher", "/ˈtiːtʃə/", "noun", "A person who teaches students.", "o‘qituvchi", "I am an English teacher.", ["English teacher", "new teacher", "teacher training"], []),
    W("specialist", "/ˈspeʃəlɪst/", "noun", "A person who knows a lot about one area of work.", "mutaxassis", "He is a quality assurance specialist.", ["quality assurance specialist", "education specialist"], ["expert"]),
    W("manager", "/ˈmænɪdʒə/", "noun", "A person who plans and leads work or a project.", "menejer, boshqaruvchi", "I am a project manager.", ["project manager", "office manager"], []),
    W("responsible for", "/rɪˈspɒnsəbl fɔː/", "phrase", "Having the duty to do or look after something.", "uchun mas’ul", "I am responsible for staff training.", ["responsible for training", "responsible for organising meetings"], ["in charge of"]),
    W("coordinate", "/kəʊˈɔːdɪneɪt/", "verb", "To organise people or activities so they work well together.", "muvofiqlashtirmoq", "I coordinate training activities.", ["coordinate activities", "coordinate a project"], ["organise"]),
    W("organise", "/ˈɔːɡənaɪz/", "verb", "To plan and arrange an event or activity. (US spelling: organize)", "tashkil etmoq", "I organise meetings.", ["organise meetings", "organise workshops", "organise an event"], ["arrange", "plan"]),
    W("work with", "/wɜːk wɪð/", "phrase", "To do your job together with people or groups.", "bilan ishlamoq", "I work with students and teachers.", ["work with teachers", "work with school leaders"], ["cooperate with"])
  ];
  var vocabAdded = 0;
  VOCAB.forEach(function (v) { if (!hasTerm(v.term)) { C.A2.vocabulary.push(v); vocabAdded++; } });
  // link existing records to the topic without changing them
  C.A2.vocabulary.concat(D.VOCABULARY).forEach(function (v) { if (["support", "quality assurance"].indexOf(v.term) >= 0 && !v.topicId) v.topicId = TOPIC_ID; });

  /* ---------------------------------------------------------------- 2. Phrases (12 key phrases) */
  var PHRASES = [
    PH("Hello. My name is ...", "Salom. Mening ismim ...", "Starting an introduction.", ["Hi, I’m ...", "Good morning. I’m ..."]),
    PH("Please call me ...", "Menga ... deb murojaat qilishingiz mumkin.", "Inviting someone to use your first name.", ["You can call me ...", "Just call me ..."]),
    PH("I am a/an ...", "Men ...man.", "Saying your job title.", ["I’m a ...", "I work as a ..."]),
    PH("I work at ...", "Men ...da ishlayman.", "Naming your workplace (a place or organisation): at a school.", ["I’m based at ...", "My school is ..."]),
    PH("I work for ...", "Men ... tashkilotida ishlayman.", "Naming your employer: for an education agency.", ["I’m with ...", "My employer is ..."]),
    PH("I work in the ... department.", "Men ... bo‘limida ishlayman.", "Naming your department or field: in the training department; in education.", ["I’m in the ... department.", "My department is ..."]),
    PH("I am responsible for ...", "Men ... uchun mas’ulman.", "Explaining your duties: responsible for + noun / verb-ing.", ["I’m in charge of ...", "I look after ..."]),
    PH("My main role is to ...", "Mening asosiy vazifam ...", "Explaining your main duty: my role is to + verb.", ["My main job is to ...", "What I mainly do is ..."]),
    PH("I work with ...", "Men ... bilan ishlayman.", "Saying who you work with.", ["I cooperate with ...", "I support ..."]),
    PH("What do you do?", "Kasbingiz nima? / Qanday ish qilasiz?", "Asking about someone’s job. (Not “What are you doing?” — that asks about now.)", ["What is your role?", "What is your job?"]),
    PH("Where do you work?", "Qayerda ishlaysiz?", "Asking about someone’s workplace.", ["Which institution are you from?", "Who do you work for?"]),
    PH("Nice to meet you.", "Tanishganimdan xursandman.", "Polite closing of an introduction. Reply: “Nice to meet you too.”", ["Nice to meet you too.", "Pleased to meet you.", "It’s good to meet you."])
  ];
  var phrasesAdded = 0;
  PHRASES.forEach(function (p) { if (!hasPhrase(p.phrase)) { C.A2.phrases.push(p); phrasesAdded++; } });
  C.A2.phrases.forEach(function (p) { if (p.phrase === "I am responsible for the timetable and teacher training." && !p.topicId) p.topicId = TOPIC_ID; });

  /* ---------------------------------------------------------------- 3. Grammar (one unit in the module format; full A–E blocks live on the topic page) */
  var GRAMMAR = {
    id: "A2G11", level: "A2", topicId: TOPIC_ID, title: "Introducing Yourself: am/is/are, Present Simple, my/your, responsible for, a/an",
    focus: "Saying who you are and what you do",
    explain: "A. TO BE: I am a teacher. He is a director. We are colleagues. Short forms: I’m, He’s, She’s, We’re, They’re. Negative: I am not a director. Questions: Are you a teacher? — Yes, I am. / No, I’m not. " +
      "B. PRESENT SIMPLE for jobs and duties: I work at a school. I support teachers. With he/she add -s: He works at a school. She supports teachers. Questions: Where do you work? What does she do? (after “does” the verb has no -s). " +
      "C. MY / YOUR / HIS / HER / OUR / THEIR: My name is Aziz. What is your role? His department is small. Her role is to support students. Our team works with schools. Their office is in Tashkent. " +
      "D. “responsible for” + noun / verb-ing: I am responsible for training. I am responsible for organising meetings. “My role is to” + verb: My role is to support teachers. " +
      "E. A / AN depends on the next sound: a teacher, a director, an English teacher, an education specialist.",
    uz: "A. am/is/are — kimligingizni aytish. B. Present Simple — ish va vazifalar; he/she bilan -s. C. my/your/his/her/our/their — egalik. D. responsible for + ot/-ing; my role is to + fe’l. E. a/an — keyingi so‘zning boshlanish tovushiga bog‘liq.",
    examples: ["I am a teacher. / She is a specialist. / They are managers.", "I work at a school. → He works at a school.", "Where does she work? (not: Where does she works?)", "My name is Aziz. What is your role? Her role is to support students.", "I am responsible for organising meetings. My role is to support teachers.", "I am a teacher. I am an English teacher."],
    exercise: [
      { q: "Complete: 'I ___ an English teacher.' (am / is / are)", a: "I am an English teacher." },
      { q: "Change to he/she: 'I organise meetings.' → 'She ___ meetings.'", a: "She organises meetings." },
      { q: "Make the question: 'she / where / work / does ?'", a: "Where does she work?" },
      { q: "Correct: 'I am responsible for organise meetings.'", a: "I am responsible for organising meetings." },
      { q: "Choose a or an: '___ education specialist', '___ teacher'", a: "an education specialist, a teacher" }
    ]
  };
  if (!hasId(C.A2.grammar, GRAMMAR.id)) C.A2.grammar.push(GRAMMAR);

  /* ---------------------------------------------------------------- 4. Listening (module format: comprehension + dictation use the existing player) */
  var LISTENING = {
    id: "A2L11", level: "A2", topicId: TOPIC_ID, title: "Meet Malika", accent: "British", type: "Self-introduction",
    text: "Hello. I’m Malika. I am a project manager at a teacher training centre in Samarkand. I work with teachers and school leaders. I organise online courses and plan training events. I am responsible for the training calendar. Nice to meet you.",
    vocab: ["project manager", "training centre", "online courses", "responsible for", "training calendar"],
    questions: [
      { q: "What is Malika’s role?", a: "project manager" },
      { q: "Where is her centre?", a: "Samarkand" },
      { q: "Who does she work with?", a: "teachers and school leaders" },
      { q: "What does she organise?", a: "online courses" },
      { q: "What is she responsible for?", a: "the training calendar" }
    ],
    uz: "Malika o‘zini tanishtiradi: lavozimi, ish joyi, kim bilan ishlashi va nimaga mas’ulligi."
  };
  if (!hasId(C.A2.listening, LISTENING.id)) C.A2.listening.push(LISTENING);

  /* ---------------------------------------------------------------- 5. Speaking Studio task */
  var SPEAKING = {
    id: "a2-01-speaking", topicId: TOPIC_ID, level: "A2", title: "Your 30–45 Second Introduction",
    prompt: "Introduce yourself to a new colleague. Speak for about 30–45 seconds. Say your name, role, workplace and two responsibilities. Finish politely. Plan: Greeting → Name → Role → Workplace → Responsibilities → Closing.",
    seconds: 45, expected: ["my name is", "I am a", "I work at", "responsible for", "my main role is to", "nice to meet you"], keys: ["confidence", "fluency"],
    model: "Hello. My name is Sardor. I am a training coordinator at a learning centre in Tashkent. I work with teachers and school leaders. I organise workshops and prepare training materials. My main role is to support teachers. I am happy to meet you and learn about your work.",
    uz: "Yangi hamkasbga o‘zingizni tanishtiring: ism, lavozim, ish joyi, ikkita vazifa va muloyim yakun. 30–45 soniya."
  };
  if (!C.A2.speaking.some(function (s) { return s.id === SPEAKING.id || s.title === SPEAKING.title; })) C.A2.speaking.push(SPEAKING);

  /* ---------------------------------------------------------------- 6. Writing task */
  var WRITING = {
    id: "A2W11", level: "A2", topicId: TOPIC_ID, type: "Professional introduction",
    prompt: "Write 40–60 words to introduce yourself to a new international colleague. Include: 1) your name, 2) your job title, 3) your institution or workplace, 4) two responsibilities, 5) a polite closing sentence. You may use an invented name or workplace for practice.",
    model: "Hello. My name is Kamola. I am an English teacher at a secondary school in Bukhara. I work with students and other teachers. I plan lessons and organise English clubs. My main role is to help students improve their English. Nice to meet you.",
    tips: ["Template: Hello. My name is ____. I am a/an ____ at ____. I work in ____. I ____ and ____. My main role is to ____. Nice to meet you.", "Use 'I am a/an' for your job and 'I work at' for your workplace", "Give two responsibilities with 'I am responsible for' or 'I organise / I support'", "Finish politely: 'Nice to meet you.'"],
    uz: "Yangi xalqaro hamkasbga o‘zingizni tanishtirish uchun 40–60 so‘z yozing. Ismingiz, lavozimingiz, ish joyingiz, ikkita vazifangiz va muloyim yakuniy gapni kiriting. Mashq uchun to‘qima ism yoki ish joyidan foydalanishingiz mumkin.",
    rubric: [
      { name: "Content", uz: "Mazmun", max: 8, desc: "0–2 points each: name; job title and workplace; at least two responsibilities; polite closing." },
      { name: "Grammar", uz: "Grammatika", max: 4, desc: "4: main forms correct; 3: a few errors, meaning clear; 2: repeated errors; 1: errors block understanding; 0: not assessable." },
      { name: "Vocabulary", uz: "Lug‘at", max: 4, desc: "4: varied topic phrases used correctly; 3: adequate; 2: limited; 1: very limited; 0: none." },
      { name: "Structure & task", uz: "Tuzilish va topshiriq", max: 4, desc: "4: coherent, 40–60 words, right style; 3: minor deviation; 2: weak links or length off; 1: fragmented; 0: none. No separate word-count penalty." }
    ]
  };
  if (!hasId(C.A2.writing, WRITING.id)) C.A2.writing.push(WRITING);

  /* ================================================================ TOPIC PAGE */
  var MC = function (id, q, opts, answer, exEn, exUz) { return { id: id, q: q, options: opts.map(function (t, i) { return { id: id + "-" + "abc"[i], text: t }; }), answer: id + "-" + answer, explain_en: exEn || "", explain_uz: exUz || "", points: 1 }; };

  global.HUB_TOPICS = global.HUB_TOPICS || {};
  global.HUB_TOPICS[TOPIC_ID] = {
    id: TOPIC_ID, order: 1, level: "A2", category: "Professional Communication",
    title_en: "Introducing Yourself and Your Role", title_uz: "O‘zingiz va lavozimingizni tanishtirish",
    time: "45–60 min", review: "10 min", prereq: null, skills: ["Speaking", "Listening", "Reading", "Writing"],
    grammar: "am/is/are; Present Simple; possessive adjectives",
    context_en: "Meeting a new colleague or an international guest at an education organisation.",
    context_uz: "Ta’lim tashkilotida yangi hamkasb yoki xalqaro mehmon bilan tanishish.",
    desc_en: "Learn to introduce yourself, describe your role and ask simple professional questions.",
    desc_uz: "O‘zingizni tanishtirish, ishdagi vazifalaringizni aytish va kasbiy tanishuv savollarini berishni o‘rganing.",
    outcome_en: "By the end of this lesson, you can introduce yourself and explain your role in a short professional conversation.",
    outcomes_uz: ["Ism, lavozim, tashkilot va bo‘limni ayta olish.", "Kamida ikkita ish vazifasini sodda ingliz tilida tushuntirish.", "Suhbatdoshga kamida ikkita tanishuv savolini berish.", "40–60 so‘zli kasbiy tanishtiruv yozish.", "Taxminan 30–45 soniyalik tanishtiruv nutqini tayyorlash."],
    links: {
      vocabulary: VOCAB.map(function (v) { return v.term; }).concat(["support", "quality assurance"]),
      vocabTopic: VT,
      phrases: PHRASES.map(function (p) { return p.phrase; }),
      phraseCat: "Introducing yourself",
      grammar: "A2G11", listening: "A2L11", speaking: "Your 30–45 Second Introduction", writing: "A2W11"
    },
    badge: { code: "first_introduction", en: "First Introduction", uz: "Birinchi tanishuv", desc_en: "Completed your first professional introduction in English.", icon: "🤝" },
    sections: [
      { id: "a2-01-intro", type: "intro", order: 1, title_en: "Meet a New Colleague", title_uz: "Yangi hamkasb bilan tanishing",
        situation_en: "You are at an international education workshop. You meet a new colleague. Introduce yourself and explain what you do.",
        situation_uz: "Siz xalqaro ta’lim seminaridasiz. Yangi hamkasb bilan tanishib, kimligingiz va ishdagi vazifalaringiz haqida gapirasiz.",
        questions: ["What is your name?", "Where do you work?", "What do you do?"],
        tip_en: "“What do you do?” asks about your job or role. “What are you doing?” asks what you are doing right now.",
        tip_uz: "“What do you do?” odatda kasbingiz yoki ishdagi vazifangizni so‘raydi. “What are you doing?” esa hozir nima qilayotganingizni so‘raydi.",
        task_en: "Write one sentence about yourself.", task_uz: "O‘zingiz haqingizda bitta gap yozing.", sample: "My name is Dilnoza. I work at a school.",
        note_uz: "Bu diagnostik topshiriq: baholanmaydi va yakuniy natijaga qo‘shilmaydi." },
      { id: "a2-01-vocabulary", type: "vocabulary", order: 2, title_en: "Key Vocabulary (16)", title_uz: "Asosiy lug‘at (16)",
        note_en: "“Principal” or “director” depends on the organisation and country; for a school head this lesson uses “school principal”. Both “organise” and “organize” are accepted in exercises.",
        note_uz: "“Principal” va “director” tanlovi tashkilot va mamlakatga bog‘liq. Maktab direktori uchun “school principal” asosiy variant. “Organise” va “organize” yozuvlari qabul qilinadi." },
      { id: "a2-01-key-phrases", type: "phrases", order: 3, title_en: "Key Phrases (12)", title_uz: "Tayyor iboralar (12)",
        usage_en: ["at — a workplace or place: at a school", "for — an employer: for an education agency", "in — a department or field: in the training department; in education", "These are typical uses, not absolute rules: in some contexts more than one is correct."],
        usage_uz: ["at: ish joyi sifatida tashkilot yoki joy — at a school", "for: ish beruvchi tashkilot — for an education agency", "in: bo‘lim yoki faoliyat sohasi — in the training department; in education", "Bu farqlar mutlaq qoida emas: ayrim kontekstlarda bir nechta variant to‘g‘ri bo‘lishi mumkin."] },
      { id: "a2-01-grammar", type: "grammar", order: 4, title_en: "Grammar", title_uz: "Grammatika",
        blocks: [
          { title: "A. TO BE: am / is / are", lines: ["I am a teacher.", "He is a director.", "She is a specialist.", "We are colleagues.", "They are managers."], sub: [["Short forms", ["I am → I’m", "He is → He’s", "She is → She’s", "We are → We’re", "They are → They’re"]], ["Negative", ["I am not a director.", "She is not a teacher.", "They are not students."]], ["Questions", ["Are you a teacher?", "Is she a director?"]], ["Short answers", ["Yes, I am.", "No, I’m not.", "Yes, she is.", "No, she isn’t."]]] },
          { title: "B. PRESENT SIMPLE: jobs and duties", lines: ["I work at a school.", "I support teachers.", "I organise meetings.", "He works at a school.", "She supports teachers.", "He organises meetings."], sub: [["Questions", ["Where do you work?", "What does she do?"]]], note_en: "After “does” the main verb has no -s: ✓ Where does she work? ✗ Where does she works?", note_uz: "“Does” bilan savolda asosiy fe’lga -s qo‘shilmaydi: to‘g‘ri — Where does she work? noto‘g‘ri — Where does she works?" },
          { title: "C. MY / YOUR / HIS / HER / OUR / THEIR", lines: ["My name is Aziz.", "What is your role?", "His department is small.", "Her role is to support students.", "Our team works with schools.", "Their office is in Tashkent."] },
          { title: "D. RESPONSIBLE FOR and ROLE IS TO", lines: ["I am responsible for training.", "I am responsible for organising meetings.", "My role is to support teachers."], note_en: "responsible for + noun / verb-ing · my role is to + verb", note_uz: "responsible for + ot / fe’l-ing · my role is to + fe’l" },
          { title: "E. A / AN", lines: ["I am a teacher.", "I am a director.", "I am an English teacher.", "I am an education specialist."], note_en: "“A” or “an” depends on the first sound of the next word.", note_uz: "“A/an” tanlovi keyingi so‘zning boshlanish tovushiga bog‘liq." }
        ] },
      { id: "a2-01-reading", type: "reading", order: 5, title_en: "Reading: Meet Dilnoza", title_uz: "O‘qish: Dilnoza bilan tanishing", points: 5,
        text_en: "Hello. My name is Dilnoza Karimova. Please call me Dilnoza. I am a training coordinator at Bright Future Learning Centre in Tashkent. I work in the teacher development department. I organise workshops and support new teachers. I work with school leaders too. My main role is to help teachers learn new skills. I am happy to meet colleagues from other institutions.",
        text_uz: "Salom. Mening ismim Dilnoza Karimova. Menga Dilnoza deb murojaat qilishingiz mumkin. Men Toshkentdagi Bright Future o‘quv markazida trening koordinatori bo‘lib ishlayman. O‘qituvchilar malakasini rivojlantirish bo‘limida ishlayman. Seminarlar tashkil qilaman va yangi o‘qituvchilarga yordam beraman. Maktab rahbarlari bilan ham ishlayman. Mening asosiy vazifam o‘qituvchilarga yangi ko‘nikmalarni o‘rganishda yordam berish. Boshqa muassasalardagi hamkasblar bilan tanishganimdan xursandman.",
        questions: [
          MC("r1", "What is Dilnoza’s job?", ["A student", "A training coordinator", "A school principal"], "b", "The text says “I am a training coordinator”.", "Matnda “I am a training coordinator” deyilgan."),
          MC("r2", "Where does she work?", ["At Bright Future Learning Centre", "At an international airport", "At a hospital"], "a"),
          MC("r3", "Which department does she work in?", ["Finance", "IT", "Teacher development"], "c"),
          MC("r4", "What does she organise?", ["Workshops", "Sports competitions", "Exams only"], "a"),
          MC("r5", "Who does she work with?", ["Only students", "Teachers and school leaders", "Only parents"], "b")
        ] },
      { id: "a2-01-dialogue", type: "dialogue", order: 6, title_en: "Model Dialogue: At an Education Workshop", title_uz: "Namunaviy dialog: Ta’lim seminarida",
        lines: [["Anna", "Hello. I’m Anna. What’s your name?"], ["Aziz", "Hello, Anna. My name is Aziz Rahimov. Please call me Aziz."], ["Anna", "Nice to meet you, Aziz. What do you do?"], ["Aziz", "I’m a quality assurance specialist."], ["Anna", "Where do you work?"], ["Aziz", "I work for an education agency in Tashkent."], ["Anna", "What are you responsible for?"], ["Aziz", "I am responsible for collecting information from schools. I also help prepare reports."], ["Anna", "That sounds interesting. I’m a teacher trainer."], ["Aziz", "Nice to meet you, Anna."]],
        notes: [["What’s = What is.", "What’s = What is."], ["I’m = I am.", "I’m = I am."], ["“That sounds interesting” — a polite reaction.", "“That sounds interesting” — “Bu qiziqarli ekan”."], ["“I also ...” — adding a second duty.", "“I also ...” — “Men yana ... ham qilaman”."]],
        task_en: "Replace Aziz’s information with your own information and practise the conversation.", task_uz: "Aziz ma’lumotlarini o‘zingizniki bilan almashtirib, suhbatni mashq qiling.",
        placeholders: ["[name]", "[job title]", "[organisation]", "[city]", "[responsibility 1]", "[responsibility 2]"],
        template: "Hello, Anna. My name is [name]. Please call me [name].\nI’m a/an [job title].\nI work for [organisation] in [city].\nI am responsible for [responsibility 1]. I also [responsibility 2].\nNice to meet you, Anna." },
      { id: "a2-01-listening", type: "listening", order: 7, title_en: "Listening: Meet Malika", title_uz: "Tinglash: Malika bilan tanishing", points: 5, listeningId: "A2L11",
        questions: [
          MC("l1", "What is Malika’s role?", ["Project manager", "Student", "School principal"], "a"),
          MC("l2", "Where is her centre?", ["Bukhara", "Samarkand", "Tashkent"], "b"),
          MC("l3", "Who does she work with?", ["Doctors and nurses", "Only university students", "Teachers and school leaders"], "c"),
          MC("l4", "What does she organise?", ["Online courses", "School meals", "Sports clubs"], "a"),
          MC("l5", "What is she responsible for?", ["The library", "The training calendar", "The school building"], "b")
        ] },
      { id: "a2-01-matching", type: "matching", order: 8, title_en: "Match the Words", title_uz: "So‘zlarni moslashtiring", points: 6,
        instructions_en: "Match the words with their meanings.", instructions_uz: "So‘zlarni ma’nolari bilan moslashtiring.",
        pairs: [["v1", "colleague", "hamkasb"], ["v2", "department", "bo‘lim"], ["v3", "responsible for", "uchun mas’ul"], ["v4", "organise", "tashkil etmoq"], ["v5", "support", "yordam bermoq"], ["v6", "institution", "muassasa"]] },
      { id: "a2-01-gap-fill", type: "gapfill", order: 9, title_en: "Complete the Sentences", title_uz: "Bo‘sh joylarni to‘ldiring", points: 8,
        items: [
          { id: "g1", text: "I ___ an English teacher.", answers: ["am"], explain_en: "Use “am” with “I”.", explain_uz: "“I” bilan “am” ishlatiladi." },
          { id: "g2", text: "She ___ in the training department.", answers: ["works"], explain_en: "Present Simple adds -s with “she”.", explain_uz: "Present Simple’da “she” bilan fe’lga -s qo‘shiladi." },
          { id: "g3", text: "We ___ colleagues.", answers: ["are"] },
          { id: "g4", text: "___ name is Aziz.", answers: ["my"] },
          { id: "g5", text: "I am responsible ___ staff training.", answers: ["for"] },
          { id: "g6", text: "My role is ___ support teachers.", answers: ["to"] },
          { id: "g7", text: "He ___ meetings every Monday.", answers: ["organises", "organizes"] },
          { id: "g8", text: "What ___ you do?", answers: ["do"] }
        ] },
      { id: "a2-01-sentence-order", type: "order", order: 10, title_en: "Put the Words in Order", title_uz: "So‘zlardan gap tuzing", points: 5,
        items: [
          { id: "s1", words: ["name", "My", "is", "Malika"], answer: "My name is Malika." },
          { id: "s2", words: ["at", "work", "a school", "I"], answer: "I work at a school." },
          { id: "s3", words: ["your", "is", "role", "What"], answer: "What is your role?" },
          { id: "s4", words: ["responsible", "I", "training", "am", "for"], answer: "I am responsible for training." },
          { id: "s5", words: ["to", "Nice", "you", "meet"], answer: "Nice to meet you." }
        ] },
      { id: "a2-01-error-correction", type: "errors", order: 11, title_en: "Correct the Mistake", title_uz: "Xatoni tuzating", points: 5,
        items: [
          { id: "e1", wrong: "I is a teacher.", answers: ["I am a teacher.", "I'm a teacher."], explain_en: "“I” takes “am”.", explain_uz: "“I” bilan “am”." },
          { id: "e2", wrong: "She work at a school.", answers: ["She works at a school."], explain_en: "“She” takes “works”.", explain_uz: "“She” bilan “works”." },
          { id: "e3", wrong: "I am responsible for organise meetings.", answers: ["I am responsible for organising meetings.", "I am responsible for organizing meetings.", "I'm responsible for organising meetings.", "I'm responsible for organizing meetings."], explain_en: "After “for” use the -ing form.", explain_uz: "“For”dan keyin fe’lning -ing shakli keladi." },
          { id: "e4", wrong: "My role is support teachers.", answers: ["My role is to support teachers."], explain_en: "“My role is to + verb”.", explain_uz: "“My role is to + verb”." },
          { id: "e5", wrong: "I am an teacher.", answers: ["I am a teacher.", "I'm a teacher."], explain_en: "“Teacher” starts with a consonant sound.", explain_uz: "“Teacher” undosh tovush bilan boshlanadi." }
        ] },
      { id: "a2-01-situations", type: "situations", order: 12, title_en: "Choose the Best Response", title_uz: "Vaziyatga mos javobni tanlang", points: 4,
        questions: [
          MC("c1", "A new colleague says: “Nice to meet you.”", ["Nice to meet you too.", "I work on Monday.", "This is a department."], "a"),
          MC("c2", "You want to know someone’s job. What do you ask?", ["Where is your bag?", "What do you do?", "What time is lunch?"], "b"),
          MC("c3", "Someone asks: “Where do you work?”", ["I’m fine, thank you.", "My name is Aziz.", "I work at a training centre."], "c"),
          MC("c4", "You want someone to use your first name. What do you say?", ["Please call me Malika.", "Please work in Malika.", "Please name my role."], "a")
        ] },
      { id: "a2-01-writing", type: "writing", order: 13, title_en: "Writing: Your Professional Introduction", title_uz: "Yozish: Kasbiy tanishtiruv", writingId: "A2W11", max: 20,
        checklist_en: ["I wrote my name.", "I wrote my job title and workplace.", "I wrote two responsibilities.", "I finished politely.", "My text is 40–60 words."],
        checklist_uz: ["Ismimni yozdim.", "Lavozim va ish joyimni yozdim.", "Ikkita vazifamni yozdim.", "Muloyim yakunladim.", "Matn 40–60 so‘z."] },
      { id: "a2-01-speaking", type: "speaking", order: 14, title_en: "Speaking: Your 30–45 Second Introduction", title_uz: "Nutq: 30–45 soniyalik tanishtiruv", speakingTitle: "Your 30–45 Second Introduction", max: 20, prep: 60,
        plan: ["Greeting", "Name", "Role", "Workplace", "Responsibilities", "Closing"],
        rubric: [["Content", "Mazmun"], ["Intelligibility", "Tushunarlilik"], ["Fluency", "Nutq ravonligi"], ["Grammar and vocabulary", "Grammatika va lug‘at"]],
        checklist_en: ["I said my name.", "I explained my role.", "I named my workplace.", "I described two responsibilities.", "I finished politely."],
        checklist_uz: ["Ismimni aytdim.", "Lavozimimni tushuntirdim.", "Ish joyimni aytdim.", "Ikkita vazifamni aytdim.", "Muloyim yakunladim."] },
      { id: "a2-01-role-play", type: "roleplay", order: 15, title_en: "Role-play: Meet an International Colleague", title_uz: "Rolli suhbat: Xalqaro hamkasb bilan tanishing",
        role_en: "Alex is a teacher trainer at an international education workshop. You meet for the first time.", role_uz: "Alex — xalqaro ta’lim seminaridagi o‘qituvchilar treneri. Siz birinchi marta uchrashyapsiz.",
        turns: ["Hello. I’m Alex. What’s your name?", "What do you do?", "Where do you work?", "What are you responsible for?", "I’m a teacher trainer. I support teachers and organise workshops. Do you have a question for me?"],
        hints: ["My name is ... Please call me ...", "I am a/an ...", "I work at/for ...", "I am responsible for ...", "Ask two questions, e.g. “Where do you work?” “What are you responsible for?”"],
        closing_en: "Thank you! It was nice to meet you.", closing_uz: "Rahmat! Tanishganimdan xursandman." },
      { id: "a2-01-final-quiz", type: "quiz", order: 16, title_en: "Final Quiz", title_uz: "Yakuniy test", quizId: "a2-01-final-quiz", points: 10, pass: 80,
        instructions_en: "Choose the best answer. Each question has one correct answer.", instructions_uz: "Eng to‘g‘ri javobni tanlang. Har bir savolda bitta to‘g‘ri javob bor.",
        questions: [
          MC("f1", "My name ___ Nodira.", ["am", "is", "are"], "b", "“My name” is singular, so “is”.", "“My name” birlik shakl, shuning uchun “is”."),
          MC("f2", "I am ___ English teacher.", ["a", "an", "are"], "b", "“English” starts with a vowel sound.", "“English” unli tovush bilan boshlanadi."),
          MC("f3", "He ___ at a training centre.", ["work", "working", "works"], "c", "Present Simple with “he”: works.", "“He” bilan Present Simple’da “works”."),
          MC("f4", "I work ___ the quality assurance department.", ["in", "on", "to"], "a", "“in” is used for a department here.", "Bo‘lim uchun ushbu gapda “in” ishlatiladi."),
          MC("f5", "I am responsible ___ training.", ["to", "for", "at"], "b"),
          MC("f6", "My main role is ___ teachers.", ["support", "supporting to", "to support"], "c"),
          MC("f7", "Which question asks about someone’s job?", ["What do you do?", "How old is the building?", "Where is the meeting room?"], "a"),
          MC("f8", "Choose the correct sentence.", ["She organise workshops.", "She organises workshops.", "She organising workshops."], "b"),
          MC("f9", "“Nice to meet you.” — “___”", ["I am a department.", "At nine o’clock.", "Nice to meet you too."], "c"),
          MC("f10", "Read: “I’m Timur. I work at a school. I support new teachers and organise training sessions.” What are Timur’s responsibilities?", ["Supporting new teachers and organising training sessions", "Managing a hospital and helping patients", "Selling books and repairing computers"], "a")
        ],
        feedback: [
          { min: 80, en: "Well done! You can move on to the next topic.", uz: "Ajoyib! Keyingi mavzuga o‘tishingiz mumkin." },
          { min: 50, en: "Good progress. Review the key phrases and try again.", uz: "Yaxshi harakat. Asosiy iboralarni takrorlab, qayta urinib ko‘ring." },
          { min: 0, en: "Let’s practise again. Start with the vocabulary and model dialogue.", uz: "Yana mashq qilamiz. Lug‘at va namunaviy dialogdan boshlang." }
        ] },
      { id: "a2-01-review", type: "review", order: 17, title_en: "Review Cards", title_uz: "Takrorlash kartochkalari",
        cards: [["O‘zingizni ism bilan tanishtiring.", "My name is ..."], ["Lavozimingizni ayting.", "I am a/an ..."], ["Ish joyingizni ayting.", "I work at ..."], ["Bo‘limingizni ayting.", "I work in the ... department."], ["Mas’uliyatingizni ayting.", "I am responsible for ..."], ["Asosiy vazifangizni ayting.", "My main role is to ..."], ["Suhbatdoshning kasbini so‘rang.", "What do you do?"], ["Suhbatdoshning ish joyini so‘rang.", "Where do you work?"], ["Tanishganingizdan xursandligingizni ayting.", "Nice to meet you."], ["“Nice to meet you”ga javob bering.", "Nice to meet you too."]],
        fronts_en: ["Introduce yourself with your name.", "Say your job title.", "Say your workplace.", "Say your department.", "Say what you are responsible for.", "Say your main role.", "Ask about the other person’s job.", "Ask where the other person works.", "Say you are pleased to meet them.", "Reply to “Nice to meet you”."] },
      { id: "a2-01-homework", type: "homework", order: 18, title_en: "Homework: Prepare Your Personal Introduction", title_uz: "Uyga vazifa: Shaxsiy tanishtiruvni tayyorlang",
        steps_en: ["Write a 40–60 word introduction.", "Use at least 5 phrases from this topic.", "Practise saying it aloud twice.", "Write 3 questions to ask a colleague."],
        steps_uz: ["40–60 so‘zli tanishtiruv yozing.", "Unda kamida 5 ta mavzu iborasini ishlating.", "Nutqni ovoz chiqarib ikki marta mashq qiling.", "Hamkasbga berish uchun 3 ta savol yozing."],
        samples: ["What do you do?", "Where do you work?", "What are you responsible for?"],
        note_en: "You may use an invented organisation instead of your real workplace.", note_uz: "Topshiriqni haqiqiy ish joyini oshkor qilmasdan, to‘qima tashkilot bilan bajarish ham mumkin." }
    ]
  };
  global.HUB_TOPICS[TOPIC_ID]._merge = { vocabAdded: vocabAdded, phrasesAdded: phrasesAdded };
})(typeof window !== "undefined" ? window : this);
