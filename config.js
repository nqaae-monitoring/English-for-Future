/* =========================================================================
   English for Future — config.js
   PUBLIC configuration only. The anon key is safe to publish: every table is
   protected by Row Level Security. NEVER put the service_role key here.

   Qanday to'ldirish (SETUP.md ga qarang):
     1. Supabase → Project Settings → API
     2. "Project URL" ni SUPABASE_URL ga, "anon public" kalitni SUPABASE_ANON_KEY ga qo'ying
   Bo'sh qoldirilsa platforma faqat shu qurilmada (offline rejimda) ishlaydi.
   ========================================================================= */
window.EFUTURE_CONFIG = {
  SUPABASE_URL: "",          // e.g. "https://abcdefghijklmnop.supabase.co"
  SUPABASE_ANON_KEY: "",     // e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
  ADMIN_FUNCTION: "admin-actions",   // Edge Function name used by the admin panel
  APP_NAME: "English for Future"
};
