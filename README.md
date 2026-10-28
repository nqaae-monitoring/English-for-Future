# English for Future

Education Leadership English Hub — ta'lim rahbarlari uchun kundalik professional ingliz tili platformasi: sifat ta'minoti, akkreditatsiya, muzokaralar va global yetakchilik. Daraja: **A2 dan C1 gacha**.

Sayt: https://nqaae-monitoring.github.io/English-for-Future/

## Imkoniyatlar

- **Hisoblar** — Login ID + parol (Supabase Auth), bir hisob bilan istalgan qurilmadan kirish.
- **Bulutli sinxronizatsiya** — natijalar Postgres'da saqlanadi, brauzer kesh sifatida ishlaydi; oflayn o'zgarishlar navbatga olinib, ulanish qaytganda yuboriladi.
- **CEFR yo'li A2 → B1 → B2 → C1** — moslashuvchan darajani aniqlash testi, darajaga mos kontent (A2/B1 uchun yangi materiallar, o'zbekcha izohlar), 75 % bilan o'tiladigan daraja testlari.
- **XP, platforma darajalari (1–30), nishonlar** — kunlik 300 XP cheklovi serverda (`award_xp`).
- **Reyting jadvali** — hafta / oy / umumiy, ko'nikma va daraja filtrlari, 🥇🥈🥉 podium, Oltin/Kumush/Bronza/Rising ligalari, haftalik g'oliblar tarixi.
- **Admin paneli** — barcha o'quvchilar, qidiruv/filtr/saralash, batafsil sahifa, parolni tiklash, bloklash, rol va daraja o'zgartirish, CSV eksport.
- **Mavzular (Topics)** — bitta kasbiy vaziyat atrofida lug'at, iboralar, grammatika, tinglash, nutq va yozuvni birlashtirgan tuzilmali darslar; qo'shimcha mashqlar, rolli suhbat, yakuniy test (8/10), takrorlash kartochkalari. Birinchi mavzu: A2-01 "Introducing Yourself and Your Role" (`js/topics/`).
- Avvalgi barcha modullar (lug'at, iboralar, grammatika, tinglash, nutq, yozuv, muzokara, nutqlar, qiyin savollar, Qualifications English) saqlangan; tungi rejim, o'zbekcha interfeys, mobil ko'rinish.

## Ishga tushirish

1. Repozitoriyni GitHub Pages orqali joylang (**Settings → Pages → main / (root)**).
2. **SETUP.md** dagi qadamlar bo'yicha Supabase loyihasini yarating, `supabase/schema.sql` ni ishga tushiring va `config.js` ga URL + anon kalitni yozing.
3. Supabase sozlanmaguncha sayt "faqat shu qurilma" rejimida ishlaydi.

Lokal ko'rish uchun papkada `python -m http.server 8080` buyrug'ini berib, `http://localhost:8080` ni oching (fayllar alohida bo'lgani uchun `file://` orqali ochish tavsiya etilmaydi).

## Tuzilma

Fayllar ro'yxati va modullar o'rtasidagi kelishuvlar: `SETUP.md` (oxirgi bo'lim) va `docs/CONTRACTS.md`.
