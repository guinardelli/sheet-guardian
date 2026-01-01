import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import type { CleanupTokensResponse } from "../_shared/response-types.ts";

const logger = createLogger("CLEANUP-TOKENS");
const TTL_MS = 24 * 60 * 60 * 1000;

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    serviceRoleKey = getServiceRoleKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body: CleanupTokensResponse = { error: message };
    return new Response(JSON.stringify(body), {
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
      const body: CleanupTokensResponse = { error: error.message };
      return new Response(JSON.stringify(body), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: CleanupTokensResponse = { deleted: count ?? 0, cutoff };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected cleanup error", { message });
    const body: CleanupTokensResponse = { error: message };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
