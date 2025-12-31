import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("CLEANUP-TOKENS");
const TTL_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({
      error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  try {
    const { error, count } = await supabase
      .from("processing_tokens")
      .delete({ count: "exact" })
      .lt("expires_at", cutoff);

    if (error) {
      logger.error("Failed to cleanup tokens", { message: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deleted: count ?? 0, cutoff }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected cleanup error", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
