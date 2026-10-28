// Supabase Edge Function: admin-actions
// -----------------------------------------------------------------------------
// Privileged user-management actions that need the service-role key (and so
// cannot live in client-side SQL RPCs):
//
//   POST { action: "reset_password", user_id, new_password }
//   POST { action: "block",          user_id }
//   POST { action: "unblock",        user_id }
//
// Auth: `Authorization: Bearer <admin's access token>`. The token is verified
// with auth.getUser() through an anon client; the caller must then have
// role = 'admin' in public.profiles (checked with the service client).
//
// Responses: { ok: true } | { ok: false, error: string } with matching status.
// CORS: any origin, GET/POST/OPTIONS (the app is a static GitHub Pages site).
//
// Env (set automatically on Supabase; for local `supabase functions serve`
// they come from the local stack): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
// -----------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Effectively permanent ban (100 years). Supabase accepts Go duration strings.
const BAN_FOREVER = "876000h";
const BAN_NONE = "none";
const MIN_PASSWORD_LENGTH = 8;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

type Action = "reset_password" | "block" | "unblock";

interface RequestBody {
  action?: Action;
  user_id?: string;
  new_password?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function fail(error: string, status: number): Response {
  return json({ ok: false, error }, status);
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  // Health check.
  if (req.method === "GET") {
    return json({ ok: true, service: "admin-actions" });
  }

  if (req.method !== "POST") {
    return fail("method_not_allowed", 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return fail("server_misconfigured", 500);
  }

  // --- 1. Verify the caller's JWT -------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return fail("not_authenticated", 401);
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser(
    token,
  );
  if (userError || !userData?.user) {
    return fail("not_authenticated", 401);
  }
  const caller = userData.user;

  // --- 2. Caller must be an admin (service client bypasses RLS) --------------
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await service
    .from("profiles")
    .select("role, blocked")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    return fail(`profile_lookup_failed: ${profileError.message}`, 500);
  }
  if (!callerProfile || callerProfile.role !== "admin" || callerProfile.blocked) {
    return fail("forbidden", 403);
  }

  // --- 3. Parse and validate the body ---------------------------------------
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail("invalid_json", 400);
  }

  const action = body?.action;
  const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";

  if (action !== "reset_password" && action !== "block" && action !== "unblock") {
    return fail("invalid_action", 400);
  }
  if (!UUID_RE.test(userId)) {
    return fail("invalid_user_id", 400);
  }

  // Make sure the target exists in profiles (also guards against typos).
  const { data: target, error: targetError } = await service
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) {
    return fail(`target_lookup_failed: ${targetError.message}`, 500);
  }
  if (!target) {
    return fail("user_not_found", 404);
  }

  // --- 4. Perform the action -------------------------------------------------
  try {
    switch (action) {
      case "reset_password": {
        const password = typeof body.new_password === "string"
          ? body.new_password
          : "";
        if (password.length < MIN_PASSWORD_LENGTH) {
          return fail("password_too_short", 400);
        }
        const { error } = await service.auth.admin.updateUserById(userId, {
          password,
        });
        if (error) {
          return fail(`auth_update_failed: ${error.message}`, 500);
        }
        return json({ ok: true });
      }

      case "block": {
        if (userId === caller.id) {
          return fail("cannot_block_self", 400);
        }
        const { error: authError } = await service.auth.admin.updateUserById(
          userId,
          { ban_duration: BAN_FOREVER },
        );
        if (authError) {
          return fail(`auth_update_failed: ${authError.message}`, 500);
        }
        const { error: dbError } = await service
          .from("profiles")
          .update({ blocked: true })
          .eq("id", userId);
        if (dbError) {
          return fail(`profile_update_failed: ${dbError.message}`, 500);
        }
        return json({ ok: true });
      }

      case "unblock": {
        const { error: authError } = await service.auth.admin.updateUserById(
          userId,
          { ban_duration: BAN_NONE },
        );
        if (authError) {
          return fail(`auth_update_failed: ${authError.message}`, 500);
        }
        const { error: dbError } = await service
          .from("profiles")
          .update({ blocked: false })
          .eq("id", userId);
        if (dbError) {
          return fail(`profile_update_failed: ${dbError.message}`, 500);
        }
        return json({ ok: true });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`unexpected: ${message}`, 500);
  }

  // Unreachable, but keeps the type checker happy.
  return fail("invalid_action", 400);
});
