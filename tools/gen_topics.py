# -*- coding: utf-8 -*-
"""Generate js/topics/topics-03-50.js from the authoring package (JSON + Markdown).
Usage: python -I gen_topics.py <package_dir> <data.js path> <out.js>
"""
import json, re, io, os, sys, glob

PKG, DATA_JS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
cur = json.load(io.open(os.path.join(PKG, "curriculum_03_50.json"), encoding="utf-8"))
topics = sorted(cur["topics"], key=lambda t: t["number"])
data_js = io.open(DATA_JS, encoding="utf-8").read()
VOCAB_TOPICS = re.findall(r'"([^"]+)"', re.search(r'const VOCAB_TOPICS = \[(.*?)\];', data_js, re.S).group(1))
PHRASE_CATS = re.findall(r'"([^"]+)"', re.search(r'const PHRASE_CATS = \[(.*?)\];', data_js, re.S).group(1))
VOCAB_TOPICS += ["School Management", "Meetings & Emails"]  # added at runtime by content.js / installer

# topic number -> (vocabulary topic, phrase category); validated against data.js, fallback below
VT_MAP = {3:"School Management",4:"School Management",5:"Meetings & Emails",6:"School Management",7:"Assessment",8:"Meetings & Emails",9:"Meetings & Emails",10:"Meetings & Emails",11:"Stakeholders",12:"Leadership",
 13:"Policy",14:"Governance",15:"Curriculum",16:"Curriculum",17:"Stakeholders",18:"Meetings & Emails",19:"Meetings & Emails",20:"Meetings & Emails",21:"Meetings & Emails",22:"Governance",23:"Leadership",24:"Leadership",25:"Leadership",
 26:"Quality Assurance",27:"Accreditation",28:"Quality Assurance",29:"Quality Assurance",30:"Assessment",31:"Stakeholders",32:"Assessment",33:"Accreditation",34:"Accreditation",35:"Quality Assurance",36:"Leadership",37:"Investment & Partnerships",38:"Investment & Partnerships",39:"Leadership",40:"Leadership",
 41:"Leadership",42:"Policy",43:"Leadership",44:"Qualifications",45:"Assessment",46:"Policy",47:"Leadership",48:"Investment & Partnerships",49:"Leadership",50:"Leadership"}
PC_MAP = {3:"Introducing yourself",4:"Introducing yourself",5:"Opening a meeting",6:"Welcoming a delegation",7:"Presenting evidence",8:"Requesting clarification",9:"Proposing cooperation",10:"Summarizing",11:"Welcoming a delegation",12:"Explaining reforms",
 13:"Presenting your organization",14:"Presenting your organization",15:"Explaining reforms",16:"Presenting your organization",17:"Presenting your organization",18:"Opening a meeting",19:"Expressing an opinion",20:"Summarizing",21:"Interrupting politely",22:"Explaining reforms",23:"Making recommendations",24:"Making recommendations",25:"Summarizing",
 26:"Presenting evidence",27:"Presenting evidence",28:"Presenting evidence",29:"Presenting evidence",30:"Presenting evidence",31:"Presenting evidence",32:"Answering difficult questions",33:"Presenting your organization",34:"Answering difficult questions",35:"Making recommendations",36:"Making recommendations",37:"Proposing cooperation",38:"Negotiating conditions",39:"Emphasizing key points",40:"Managing objections",
 41:"Emphasizing key points",42:"Presenting evidence",43:"Explaining reforms",44:"Presenting evidence",45:"Presenting evidence",46:"Summarizing",47:"Disagreeing diplomatically",48:"Negotiating conditions",49:"Keynote openings",50:"Managing objections"}
VT_MAP_FALLBACK = "Leadership"; PC_MAP_FALLBACK = "Presenting your organization"
LEVEL_WORDS = {"A2": "50–80", "B1": "80–120", "B2": "120–160", "C1": "160–220"}

def md_for(num):
    f = glob.glob(os.path.join(PKG, "%02d_*.md" % num))
    return io.open(f[0], encoding="utf-8").read() if f else ""
def section(md, n):
    m = re.search(r'^## %d\. [^\n]*\n(.*?)(?=^## \d+\. |\Z)' % n, md, re.S | re.M)
    return m.group(1).strip() if m else ""
def sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
def example_for(term, *texts):
    tl = term.lower()
    for tx in texts:
        for s in sentences(tx):
            if re.search(r'\b' + re.escape(tl) + r'\b', s.lower()): return s
    return ""
def split_line(line):
    i = line.find(": ")
    return (line[:i].strip(), line[i + 2:].strip()) if i > 0 else ("", line.strip())

out_topics, out_modules = [], {"A2": {}, "B1": {}, "B2": {}, "C1": {}}
for L in out_modules: out_modules[L] = {k: [] for k in ["vocabulary", "phrases", "grammar", "listening", "writing", "speaking"]}
stats = {"topics": 0, "vocab": 0, "phrases": 0, "quiz": 0}
warnings = []

for t in topics:
    n, tid, lvl = t["number"], t["id"], t["level"]
    md = md_for(n)
    vt = VT_MAP.get(n, VT_MAP_FALLBACK); pc = PC_MAP.get(n, PC_MAP_FALLBACK)
    if vt not in VOCAB_TOPICS: warnings.append("vocab topic missing %s -> %s" % (n, vt)); vt = VT_MAP_FALLBACK
    if pc not in PHRASE_CATS: warnings.append("phrase cat missing %s -> %s" % (n, pc)); pc = PC_MAP_FALLBACK
    reading, listening = t["reading"], t["listening"]
    # ---- grammar text from markdown section 5
    g5 = section(md, 5)
    gm = re.search(r'\*\*(.+?)\*\*\s*\n+(.*?)\n\s*\n', g5 + "\n\n", re.S)
    g_title = gm.group(1).strip() if gm else "Grammar focus"
    g_expl_uz = gm.group(2).strip().replace("\n", " ") if gm else ""
    # ---- sentence order words from markdown section 12
    s12 = section(md, 12)
    order_words = [w.strip() for w in re.findall(r'^S\d+\. (.+)$', s12, re.M)]
    # ---- writing length from section 13
    w13 = section(md, 13)
    lm = re.search(r'Hajm:\s*([^\n]+)', w13); wlen = lm.group(1).strip() if lm else LEVEL_WORDS.get(lvl, "50–80 so‘z")
    # ---- speaking timing from section 14
    s14 = section(md, 14)
    tm = re.search(r'Nutq:\s*([^.\n]+)', s14); speak_time = tm.group(1).strip() if tm else "45–60 soniya"
    # ---- review/homework bullets from section 18
    hw_uz = [b.strip() for b in re.findall(r'^- (.+)$', section(md, 18), re.M)]
    # ---- intro goal from section 2
    s2 = section(md, 2)
    goal = re.search(r'Maqsad:\s*([^\n]+)', s2); goal_uz = goal.group(1).strip() if goal else ""

    vocab = t["vocabulary"]; phrases = t["phrases"]; gram = t["grammar"]
    terms = [v["en"] for v in vocab]
    # ---- module items
    for v in vocab:
        out_modules[lvl]["vocabulary"].append({"term": v["en"], "pron": "", "topic": vt, "pos": "", "def": v["uz"], "uz": v["uz"], "example": example_for(v["en"], reading, listening, t["writing_model"], t["speaking_model"]) or (phrases[0]["en"] if phrases else ""), "collocations": [], "synonyms": [], "antonyms": [], "mistakes": "", "formal": "", "meeting": "", "speech": "", "exercise": None, "mastery": "new", "level": lvl, "topicId": tid})
    for p in phrases:
        out_modules[lvl]["phrases"].append({"category": pc, "phrase": p["en"], "situation": t["title_en"], "formality": "neutral", "dialogue": "", "alternatives": [], "errors": "", "uz": p["uz"], "level": lvl, "topicId": tid})
    out_modules[lvl]["grammar"].append({"id": "T%02dG" % n, "level": lvl, "topicId": tid, "title": g_title + " — " + t["title_en"], "focus": g_title,
        "explain": "Study the three model sentences and how the key form is built: " + " / ".join(g["sentence"] for g in gram), "uz": g_expl_uz,
        "examples": [g["sentence"] for g in gram], "exercise": [{"q": "Complete: '" + g["gap"] + "'", "a": g["sentence"]} for g in gram]})
    out_modules[lvl]["listening"].append({"id": "T%02dL" % n, "level": lvl, "topicId": tid, "title": t["title_en"], "accent": "British (browser speech)", "type": "Topic listening", "text": listening, "vocab": terms[:5],
        "questions": [{"q": q["question"], "a": q["model_answer"]} for q in t["listening_questions"]], "uz": ""})
    out_modules[lvl]["speaking"].append({"id": "t%02d-speaking" % n, "topicId": tid, "level": lvl, "title": t["title_en"], "prompt": t["speaking_task"] + " Plan: context → main message → supporting details → next step. Preparation 60 s; speak for about " + speak_time.replace("soniya", "seconds") + ".",
        "seconds": 60, "expected": terms[:5], "keys": ["fluency", "confidence", "terminology"], "model": t["speaking_model"], "uz": ""})
    task = t["writing_task"]
    sub = task.split(":", 1)[1] if ":" in task else task
    sub = sub.split(". ")[0]
    checklist = [c.strip(" .") for c in re.split(r';\s*', sub) if c.strip()]
    if len(checklist) < 2: checklist = [task]
    out_modules[lvl]["writing"].append({"id": "T%02dW" % n, "level": lvl, "topicId": tid, "type": t["title_en"], "prompt": task + " Length: " + wlen.replace("so‘z", "words") + ". Use at least 3 topic terms and 2 phrases from this topic. Invented details are fine.",
        "model": t["writing_model"], "tips": ["Template: Use the reading text as a model: keep its structure, change the names, roles and details to your own invented example.", "Cover every task point", "Use at least three topic terms and two phrases", "Check the grammar focus of this topic"], "uz": "",
        "rubric": [{"name": "Content", "uz": "Mazmun", "max": 8, "desc": "0–2 for each of the four task points."}, {"name": "Grammar", "uz": "Grammatika", "max": 4, "desc": "4 level-appropriate and accurate; 3 minor errors; 2 repeated errors, meaning mostly clear; 1 hard to understand; 0 not assessable."}, {"name": "Vocabulary", "uz": "Lug‘at", "max": 4, "desc": "4 appropriate and sufficient; 3 minor gaps; 2 limited; 1 very limited; 0 nothing to assess."}, {"name": "Structure, style and length", "uz": "Tuzilish, uslub va hajm", "max": 4, "desc": "4 coherent and fits the task; 3 minor deviation; 2 noticeable deviation; 1 fragmented; 0 no text. Length is judged here only."}]})
    stats["vocab"] += len(vocab); stats["phrases"] += len(phrases)

    # ---- quiz with opaque option ids
    qs = []
    for i, q in enumerate(t["final_quiz"]):
        qid = "f%02d" % (i + 1); opts = []; ans = None
        for k, o in enumerate(q["options"]):
            oid = qid + "-" + "abcd"[k]; opts.append({"id": oid, "text": o["text"]})
            if o["id"] == q["correct_option_id"]: ans = oid
        if ans is None: warnings.append("no answer %s %s" % (tid, qid))
        qs.append({"id": qid, "q": q["prompt"], "options": opts, "answer": ans, "explain_en": q.get("explanation", ""), "explain_uz": "", "points": 1})
    stats["quiz"] += len(qs)
    first_sentence = sentences(listening)[0] if sentences(listening) else listening
    pre = "a2-%02d-" % (n - 1) if False else None
    sections = [
        {"id": tid + "-intro", "type": "intro", "order": 1, "title_en": "Introduction: " + t["title_en"], "title_uz": "Kirish: " + t["title_uz"],
         "situation_en": "Professional communication in an education institution: " + t["title_en"] + ". After this lesson you can use the 8 key terms in context, choose the 4 phrases for the situation, extract information from the reading and listening, and complete the writing and speaking tasks.",
         "situation_uz": goal_uz, "questions": [q["question"] for q in t["reading_questions"]],
         "tip_en": "Grammar focus: " + g_title + ".", "tip_uz": g_expl_uz,
         "task_en": "What do you already do in this situation? Write two sentences.", "task_uz": "Bu vaziyatda hozir nima qilasiz? Ikkita gap yozing.", "sample": sentences(reading)[0] if sentences(reading) else "",
         "note_uz": "Bu diagnostik ish, ball qo‘yilmaydi.", "privacy_en": "Examples and numbers in this topic are invented for practice; you may use an imaginary organisation too.", "privacy_uz": "Misollar va raqamlar o‘quv uchun to‘qilgan; siz ham to‘qima tashkilotdan foydalanishingiz mumkin."},
        {"id": tid + "-vocabulary", "type": "vocabulary", "order": 2, "title_en": "Key Vocabulary (8)", "title_uz": "Asosiy lug‘at (8)",
         "note_en": "Meanings are given for this lesson’s context. Pronunciation: use the 🔊 button (browser speech); no transcription is shown.", "note_uz": "Ma’nolar shu dars kontekstiga tegishli. Talaffuz: 🔊 tugmasi (brauzer ovozi); transkripsiya ko‘rsatilmaydi."},
        {"id": tid + "-key-phrases", "type": "phrases", "order": 3, "title_en": "Key Phrases (4)", "title_uz": "Tayyor iboralar (4)",
         "usage_en": ["Use these phrases in the dialogue, role-play, writing and speaking tasks.", "Finish each phrase with details from your own work situation."], "usage_uz": ["Bu iboralarni dialog, rolli suhbat, yozish va gapirish topshiriqlarida ishlating.", "Har bir iborani o‘z ish vaziyatingizga mos yakunlang."]},
        {"id": tid + "-grammar", "type": "grammar", "order": 4, "title_en": "Grammar: " + g_title, "title_uz": "Grammatika: " + g_title,
         "blocks": [{"title": g_title, "lines": [g["sentence"] for g in gram], "sub": [["Compare", [g["incorrect"] + "  ✗  →  " + g["sentence"] + "  ✓" for g in gram]]], "note_en": "Rule: " + g_title + ". See the Uzbek note for the explanation and practise in the Grammar module.", "note_uz": g_expl_uz}]},
        {"id": tid + "-reading", "type": "reading", "order": 5, "title_en": "Reading", "title_uz": "O‘qish", "text_en": reading, "text_uz": "",
         "open": [{"q": q["question"], "a": q["model_answer"]} for q in t["reading_questions"]]},
        {"id": tid + "-dialogue", "type": "dialogue", "order": 6, "title_en": "Model Dialogue", "title_uz": "Namunaviy dialog",
         "lines": [list(split_line(l)) for l in t["dialogue"]],
         "notes": [["Swap roles, then replace the organisation, task or decision details with your own invented example.", "Rollarni almashtiring, keyin tashkilot, vazifa yoki qaror tafsilotlarini o‘zingizning to‘qima misolingiz bilan almashtiring."]],
         "task_en": "Practise both roles, then change the details to your own example.", "task_uz": "Ikkala rolni mashq qiling, so‘ng tafsilotlarni o‘z misolingizga almashtiring."},
        {"id": tid + "-listening", "type": "listening", "order": 7, "title_en": "Listening and Dictation", "title_uz": "Tinglash va diktant", "listeningId": "T%02dL" % n,
         "open": [{"q": q["question"], "a": q["model_answer"]} for q in t["listening_questions"]],
         "dictation": {"text": first_sentence, "accepted": [first_sentence]}},
        {"id": tid + "-matching", "type": "matching", "order": 8, "title_en": "Matching", "title_uz": "Moslashtirish", "points": len(vocab),
         "instructions_en": "Match the English terms with their Uzbek meanings.", "instructions_uz": "Inglizcha atamalarni o‘zbekcha ma’nolari bilan moslashtiring.",
         "pairs": [["m%d" % (i + 1), v["en"], v["uz"]] for i, v in enumerate(vocab)]},
        {"id": tid + "-gap-fill", "type": "gapfill", "order": 9, "title_en": "Gap-fill", "title_uz": "Bo‘sh joylarni to‘ldiring", "points": len(gram),
         "items": [{"id": "g%d" % (i + 1), "text": g["gap"].replace("____", "___"), "answers": [g["answer"]]} for i, g in enumerate(gram)]},
        {"id": tid + "-error-correction", "type": "errors", "order": 10, "title_en": "Error Correction", "title_uz": "Xatoni tuzating", "points": len(gram),
         "items": [{"id": "e%d" % (i + 1), "wrong": g["incorrect"], "answers": [g["sentence"]], "explain_en": "", "explain_uz": g_expl_uz} for i, g in enumerate(gram)]},
        {"id": tid + "-sentence-order", "type": "order", "order": 11, "title_en": "Sentence Order", "title_uz": "So‘z tartibi", "points": len(gram),
         "items": [{"id": "s%d" % (i + 1), "words": [w.strip() for w in (order_words[i] if i < len(order_words) else " / ".join(g["sentence"].rstrip(".").split())).split(" / ")], "answer": g["sentence"]} for i, g in enumerate(gram)]},
        {"id": tid + "-writing", "type": "writing", "order": 12, "title_en": "Writing", "title_uz": "Yozish", "writingId": "T%02dW" % n, "max": 20,
         "checklist_en": ["I covered: " + c for c in checklist] + ["Length: " + wlen.replace("so‘z", "words"), "I used at least 3 topic terms and 2 phrases."],
         "checklist_uz": ["Bajardim: " + c for c in checklist] + ["Hajm: " + wlen, "Kamida 3 atama va 2 ibora ishlatdim."]},
        {"id": tid + "-speaking", "type": "speaking", "order": 13, "title_en": "Speaking", "title_uz": "Gapirish", "speakingTitle": t["title_en"], "max": 20, "prep": 60,
         "plan": ["Context", "Main message", "Supporting details", "Next step"],
         "rubric": [["Content", "Mazmun"], ["Intelligibility", "Tushunarlilik"], ["Fluency", "Nutq ravonligi"], ["Grammar and vocabulary", "Grammatika va lug‘at"]],
         "checklist_en": ["I gave the context.", "I made the main point.", "I added supporting details.", "I finished with a next step.", "I spoke for about " + speak_time.replace("soniya", "seconds") + "."],
         "checklist_uz": ["Kontekstni aytdim.", "Asosiy fikrni aytdim.", "Tafsilotlar qo‘shdim.", "Keyingi qadam bilan yakunladim.", "Taxminan " + speak_time + " gapirdim."]},
        {"id": tid + "-role-play", "type": "roleplay", "order": 14, "title_en": "Role-play", "title_uz": "Rolli suhbat",
         "role_en": "Your partner represents the organisation in the reading text; you complete this topic’s task. Continue the model dialogue.", "role_uz": "Hamkor readingdagi tashkilot vakili; siz mavzudagi vazifani bajarasiz. Dialogni davom ettiring.",
         "turns": [q["question"] for q in t["reading_questions"]] + ["What would you do next, and why?"],
         "hints": ["Use the reading text and the key phrases."] * len(t["reading_questions"]) + ["Give one next step and one reason."],
         "closing_en": "Thank you — that was clear and helpful.", "closing_uz": "Rahmat — aniq va foydali bo‘ldi."},
        {"id": tid + "-final-quiz", "type": "quiz", "order": 15, "title_en": "Final Quiz", "title_uz": "Yakuniy test", "quizId": tid + "-final-quiz", "points": len(qs), "pass": 80,
         "instructions_en": "10 questions, 1 point each. You may reopen the lesson texts below: this checks language and content, not memory.", "instructions_uz": "10 savol, har biri 1 ball. Quyidagi matnlarni qayta ochishingiz mumkin: bu xotira emas, til va mazmun tekshiruvi.",
         "refs": [{"title_en": "Lesson text (reading)", "title_uz": "Dars matni (o‘qish)", "text": reading}, {"title_en": "Listening script", "title_uz": "Tinglash matni", "text": listening}],
         "questions": qs,
         "feedback": [{"min": 80, "en": "Well done! You can move on to the next topic.", "uz": "Ajoyib! Keyingi mavzuga o‘tishingiz mumkin."}, {"min": 50, "en": "Good progress. Review the key phrases and try again.", "uz": "Yaxshi harakat. Asosiy iboralarni takrorlab, qayta urinib ko‘ring."}, {"min": 0, "en": "Let’s practise again. Start with the vocabulary and model dialogue.", "uz": "Yana mashq qilamiz. Lug‘at va namunaviy dialogdan boshlang."}]},
        {"id": tid + "-review", "type": "review", "order": 16, "title_en": "Review Cards", "title_uz": "Takrorlash kartochkalari",
         "cards": [[v["uz"], v["en"]] for v in vocab] + [[p["uz"], p["en"]] for p in phrases]},
        {"id": tid + "-homework", "type": "homework", "order": 17, "title_en": "Homework", "title_uz": "Uyga vazifa",
         "steps_en": ["Review the 8 vocabulary cards EN→UZ and UZ→EN.", "Complete the 4 phrases for your own work situation.", "Rewrite correctly the three grammar sentences you got wrong.", "Edit your writing after the feedback.", "Say the speaking task twice; the second time without looking at the text.", "Choose one phrase to use at work tomorrow."],
         "steps_uz": hw_uz or ["Lug‘at kartalarini takrorlang.", "Iboralarni o‘z vaziyatingizga moslang.", "Yozish va gapirishni qayta mashq qiling."],
         "samples": [p["en"] for p in phrases[:3]], "note_en": "Invented details are fine; do not share confidential information.", "note_uz": "To‘qima tafsilotlar mumkin; maxfiy ma’lumotni oshkor qilmang."}
    ]
    out_topics.append({"id": tid, "order": n, "level": lvl, "category": "Professional Communication", "title_en": t["title_en"], "title_uz": t["title_uz"],
        "time": "45–60 min", "review": "10 min", "prereq": topics[topics.index(t) - 1]["id"] if n > 3 else "a2-02-introducing-your-institution", "skills": ["Reading", "Listening", "Speaking", "Writing"],
        "grammar": g_title, "context_en": "Professional communication in an education institution.", "context_uz": "Ta’lim muassasasidagi kasbiy muloqot.",
        "desc_en": "Use 8 key terms and 4 phrases, read and listen for information, then complete a writing and a speaking task on: " + t["title_en"] + ".",
        "desc_uz": goal_uz or ("Mavzu: " + t["title_uz"]),
        "outcome_en": "By the end of this lesson, you can handle this situation in English: " + t["title_en"] + ".",
        "outcomes_uz": ["8 asosiy atamani kontekstda ishlatish.", "4 tayyor iborani vaziyatga mos tanlash.", "Reading va listeningdan ma’lumot ajratish.", "Yozish topshirig‘ini bajarish (" + wlen + ").", "Gapirish topshirig‘ini bajarish (" + speak_time + ")."],
        "links": {"vocabulary": terms, "vocabTopic": vt, "phrases": [p["en"] for p in phrases], "phraseCat": pc, "grammar": "T%02dG" % n, "listening": "T%02dL" % n, "speaking": t["title_en"], "writing": "T%02dW" % n},
        "sections": sections})
    stats["topics"] += 1

js = io.StringIO()
js.write("""/* =========================================================================
   Topics 03–50 — generated from the authoring package (curriculum_03_50.json +
   per-topic Markdown) by scratchpad/gen_topics.py. Do not edit by hand: re-run
   the generator. Module items are merged into HUB_CONTENT.<level>.* with
   duplicate checks (existing terms / phrases / ids are linked, not re-added).
   Examples, organisations and numbers are invented teaching material.
   ========================================================================= */
(function (global) {
  "use strict";
  var C = global.HUB_CONTENT, D = global.HUB_DATA;
  if (!C || !D) { console.warn("topics-03-50: HUB_CONTENT/HUB_DATA missing"); return; }
  var MODULES = """)
js.write(json.dumps(out_modules, ensure_ascii=False, separators=(",", ":")))
js.write(";\n  var TOPICS = ")
js.write(json.dumps(out_topics, ensure_ascii=False, separators=(",", ":")))
js.write(""";
  function all(kind) { var out = []; ["A2", "B1", "B2", "C1"].forEach(function (l) { if (C[l] && C[l][kind]) out = out.concat(C[l][kind]); }); return out.concat(D[kind.toUpperCase()] || []); }
  var merge = { vocabAdded: 0, vocabLinked: 0, phrasesAdded: 0, phrasesLinked: 0 };
  ["School Management", "Meetings & Emails"].forEach(function (vt) { if (D.VOCAB_TOPICS.indexOf(vt) < 0) D.VOCAB_TOPICS.push(vt); });
  Object.keys(MODULES).forEach(function (lvl) {
    C[lvl] = C[lvl] || {};
    ["vocabulary", "phrases", "grammar", "listening", "writing", "speaking"].forEach(function (k) { C[lvl][k] = C[lvl][k] || []; });
    var M = MODULES[lvl];
    M.vocabulary.forEach(function (v) { if (all("vocabulary").some(function (x) { return x.term.toLowerCase() === v.term.toLowerCase(); })) merge.vocabLinked++; else { C[lvl].vocabulary.push(v); merge.vocabAdded++; } });
    M.phrases.forEach(function (p) { if (all("phrases").some(function (x) { return x.phrase === p.phrase; })) merge.phrasesLinked++; else { C[lvl].phrases.push(p); merge.phrasesAdded++; } });
    ["grammar", "listening", "writing"].forEach(function (k) { M[k].forEach(function (it) { if (!all(k).some(function (x) { return x.id === it.id; })) C[lvl][k].push(it); }); });
    M.speaking.forEach(function (it) { if (!all("speaking").some(function (x) { return x.id === it.id || x.title === it.title; })) C[lvl].speaking.push(it); });
  });
  global.HUB_TOPICS = global.HUB_TOPICS || {};
  TOPICS.forEach(function (tp) { if (!global.HUB_TOPICS[tp.id]) global.HUB_TOPICS[tp.id] = tp; });
  global.HUB_TOPICS_PKG_MERGE = merge;
})(typeof window !== "undefined" ? window : this);
""")
io.open(OUT, "w", encoding="utf-8", newline="\n").write(js.getvalue())
print("written", OUT, len(js.getvalue()), "bytes")
print("stats", stats)
print("warnings", warnings[:20], len(warnings))
