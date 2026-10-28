# English for Future — o‘rnatish bo‘yicha qo‘llanma (SETUP)

Bu qo‘llanma dasturchi bo‘lmagan administrator uchun yozilgan. Platforma ikki qismdan iborat:

1. **Sayt** — GitHub Pages’da turadigan statik fayllar (`index.html`, `css/`, `js/`). Hech qanday server kerak emas.
2. **Bulut (Supabase)** — foydalanuvchi hisoblari, natijalar, reyting va admin paneli uchun ma’lumotlar bazasi. Bepul tarifda ishlaydi.

Supabase sozlanmaguncha sayt **“faqat shu qurilma”** rejimida ishlaydi: hisobsiz kirish mumkin, natijalar brauzerda saqlanadi, reyting va admin paneli ishlamaydi.

---

## 1-qadam. Supabase loyihasini yaratish (10 daqiqa)

1. https://supabase.com saytiga kiring va **Start your project** → ro‘yxatdan o‘ting (GitHub orqali ham mumkin).
2. **New project** tugmasini bosing:
   - *Name*: `english-for-future`
   - *Database password*: kuchli parol o‘ylab toping va **saqlab qo‘ying** (keyin kerak bo‘lmaydi, lekin yo‘qotmang).
   - *Region*: `Central EU (Frankfurt)` yoki `Singapore` — O‘zbekistonga eng yaqinlari.
3. Loyiha 1–2 daqiqada tayyor bo‘ladi.

## 2-qadam. Ma’lumotlar bazasini yaratish (schema.sql)

1. Chap menyuda **SQL Editor** → **New query**.
2. Kompyuteringizdagi `supabase/schema.sql` faylini oching (Bloknot bilan ham bo‘ladi), **hammasini** nusxalab, SQL Editor oynasiga qo‘ying.
3. **Run** (yoki Ctrl+Enter) tugmasini bosing. Pastda `Success. No rows returned` chiqishi kerak.
   - Xato chiqsa: matn to‘liq nusxalanganini tekshiring va qayta Run qiling (skript qayta ishga tushirishga mo‘ljallangan).
4. Tekshirish: **Table Editor** bo‘limida `profiles`, `user_state`, `activity_log`, `level_tests`, `badges`, `weekly_winners` jadvallari paydo bo‘lgan bo‘lishi kerak.

## 3-qadam. Email tasdiqlashni o‘chirish

Foydalanuvchilar email emas, **Login ID + parol** bilan kiradi (tizim ichida ID avtomatik `id@users.efuture.local` ko‘rinishiga o‘tkaziladi). Shuning uchun email tasdiqlash o‘chirilgan bo‘lishi shart:

1. **Authentication** → **Providers** → **Email**.
2. **Confirm email** — **O‘CHIRING** (toggle off).
3. **Secure email change** ham o‘chirilsa bo‘ladi. **Save**.

> Agar bu o‘chirilmasa, ro‘yxatdan o‘tgan foydalanuvchi “Hisob yaratildi. Administrator uni faollashtirgach, kiring” xabarini ko‘radi va kira olmaydi.

## 4-qadam. Saytga kalitlarni yozish (config.js)

1. Supabase’da **Project Settings** (chap pastdagi tishli g‘ildirak) → **API**.
2. Ikki narsani nusxalang:
   - **Project URL** — `https://xxxxxxxx.supabase.co`
   - **anon public** kalit (uzun matn, `eyJ...` bilan boshlanadi)
3. Repozitoriydagi `config.js` faylini oching va to‘ldiring:

```js
window.EFUTURE_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi....",
  ADMIN_FUNCTION: "admin-actions",
  APP_NAME: "English for Future"
};
```

4. Faylni GitHub’ga yuklang (GitHub saytida `config.js` → qalam belgisi → tahrirlash → **Commit changes**). 1–2 daqiqadan so‘ng GitHub Pages yangilanadi.

> **Xavfsizlik:** `anon` kalitni ochiq joylash **xavfsiz** — barcha jadvallar Row Level Security bilan himoyalangan. `service_role` kalitni **hech qachon** saytga yoki GitHub’ga qo‘ymang.

## 5-qadam. Birinchi administratorni tayinlash

1. Saytga kirib, **Create account** orqali o‘zingizga hisob oching (masalan, Login ID `admin1`).
2. Supabase → **SQL Editor** → **New query** → quyidagini yozing va **Run** qiling:

```sql
update public.profiles set role = 'admin' where login_id = 'admin1';
```

3. Saytda chiqib, qayta kiring — chap menyuda **Admin** bo‘limi paydo bo‘ladi.

Keyingi administratorlarni Admin panelidan (foydalanuvchi → *Role* → `admin`) tayinlash mumkin.

## 6-qadam (ixtiyoriy). Parolni tiklash va bloklash uchun Edge Function

Admin panelidagi **Parolni tiklash** va **Bloklash** tugmalari maxfiy `service_role` kalit bilan ishlaydigan kichik server funksiyasini talab qiladi. U Supabase ichida ishlaydi va kalit faqat Supabase’da saqlanadi.

Kompyuteringizda bir marta bajariladi (Windows PowerShell):

1. **Node.js** o‘rnating: https://nodejs.org (LTS).
2. PowerShell’ni oching va:

```powershell
npm install -g supabase
supabase login
cd "D:\English-for-Future"
supabase link --project-ref XXXXXXXX
supabase functions deploy admin-actions
```

   `XXXXXXXX` — Project URL’dagi `https://XXXXXXXX.supabase.co` qismi. `supabase login` brauzerda tasdiqlashni so‘raydi.

3. Supabase → **Edge Functions** bo‘limida `admin-actions` ko‘rinsa — tayyor. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` o‘zgaruvchilari Supabase tomonidan avtomatik beriladi; qo‘shimcha secret kerak emas.

> Bu qadam bajarilmasa ham platforma to‘liq ishlaydi. Faqat parolni tiklash tugmasi “Edge Function joylanganmi?” xabarini beradi. Bunday holda parolni Supabase → **Authentication → Users** → foydalanuvchi → **Reset password / Send password recovery** orqali yoki foydalanuvchini o‘chirib qayta ro‘yxatdan o‘tkazish orqali hal qilish mumkin. Bloklash esa Admin paneldan baribir ishlaydi (profil belgisi orqali kirish taqiqlanadi).

## 7-qadam. Tekshirish ro‘yxati

- [ ] Saytda **Create account** → ID + parol bilan hisob ochildi, dashboard ochildi.
- [ ] Birinchi kirishda **darajani aniqlash testi** avtomatik boshlandi va natija (A2–C1) ko‘rsatildi.
- [ ] Boshqa qurilmada (yoki boshqa brauzerda) xuddi shu ID bilan kirganda natijalar bir xil.
- [ ] Yuqori panelda ✓ (saqlandi) belgisi ko‘rinadi; internet o‘chganda ⚠ chiqadi va qayta ulanganda ✓ ga qaytadi.
- [ ] **Leaderboard** bo‘limi o‘quvchilarni, 🥇🥈🥉 podiumni va ligalarni ko‘rsatadi.
- [ ] Admin hisobda **Admin** bo‘limi bor; barcha o‘quvchilar jadvali ochiladi; CSV eksport ishlaydi.

## Tez-tez beriladigan savollar

**Foydalanuvchi parolini unutdi.** Admin paneli → foydalanuvchi → **Parolni tiklash** (6-qadam bajarilgan bo‘lsa). Vaqtinchalik parolni unga ayting; u Sozlamalar → *Parolni o‘zgartirish* orqali yangilaydi.

**Login ID band deb chiqdi.** ID lar takrorlanmaydi va katta-kichik harf farqlanmaydi (`Nodir01` = `nodir01`). Boshqa ID tanlang.

**XP qanday hisoblanadi?** Dars/reja bosqichi 10, o‘zlashtirilgan so‘z 2, saqlangan ibora 1, grammatika mashqi 5, tinglash 8, nutq 15, yozuv 20, muzokara 25, baholash = ball/2, kunlik seriya bonusi 5×min(seriya,10). Kuniga eng ko‘pi 300 XP (server tomonida nazorat qilinadi, mijoz XP ni o‘zi yoza olmaydi).

**Daraja (A2/B1/B2/C1) qanday oshadi?** Faqat daraja testini 75 % va undan yuqori natija bilan topshirib. XP bilan emas. Darajani aniqlash testi 30 kunda bir marta qayta topshiriladi.

**Reyting qachon yangilanadi?** Haftalik reyting har **dushanba 00:00 (Toshkent vaqti)** da boshdan boshlanadi; o‘tgan haftalar g‘oliblari saqlanib qoladi.

**O‘quvchini reytingdan yashirish.** O‘quvchining o‘zi Sozlamalar → *Meni reytingda ko‘rsatish* ni o‘chiradi, yoki admin foydalanuvchi sahifasida.

**Ma’lumotlarni zaxiralash.** Supabase → **Database → Backups** (bepul tarifda kunlik). Foydalanuvchi o‘zi ham Sozlamalar → *Zaxira nusxa* orqali JSON yuklab olishi mumkin.

## Fayllar tuzilmasi

```
index.html            — sayt qobig‘i, kirish/ro‘yxatdan o‘tish ekrani
config.js             — Supabase URL + anon kalit (faqat ochiq ma’lumot)
css/app.css           — dizayn (navy, tungi rejim, mobil)
js/data.js            — B2/C1 o‘quv materiallari (asl kontent)
js/content.js         — A2/B1 materiallari + barcha materiallarning CEFR belgilari
js/app.js             — asosiy ilova: ko‘rinishlar, XP, darajalar, nishonlar
js/qualdata.js, qual.js — “Qualifications English” qo‘shimcha moduli
js/placement.js       — darajani aniqlash va daraja testlari
js/leaderboard.js     — reyting jadvali
js/admin.js           — admin paneli
js/sync.js            — bulut bilan sinxronizatsiya (2 s kechikish, oflayn navbat)
js/auth.js            — hisoblar (Login ID + parol)
supabase/schema.sql   — jadvallar, funksiyalar, RLS siyosatlari
supabase/functions/admin-actions/index.ts — parolni tiklash / bloklash funksiyasi
```
