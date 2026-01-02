import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env.ts";

export type AuthResult =
  | { success: true; user: User; supabase: SupabaseClient }
  | { success: false; error: string; status: number };

/**
 * Valida o JWT do usuario e retorna um cliente Supabase que respeita RLS.
 * O cliente e criado com a anon key + JWT do usuario, garantindo que
 * todas as queries passem pelo RLS com auth.uid() correto.
 */
export const authenticateUser = async (
  authHeader: string | null
): Promise<AuthResult> => {
  if (!authHeader?.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  // Cria cliente com anon key para validar o JWT
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      success: false,
      error: userError?.message ?? "Invalid or expired token",
      status: 401
    };
  }

  // Cria um novo cliente com o JWT do usuario para queries com RLS
  const supabaseWithAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { success: true, user: userData.user, supabase: supabaseWithAuth };
};

/**
 * Verifica se o request possui um token de administrador valido.
 * Usado para endpoints de manutencao (cron jobs, health checks).
 * Usa comparacao constant-time para evitar timing attacks.
 */
export const validateAdminToken = (
  authHeader: string | null,
  expectedSecret: string
): boolean => {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.replace("Bearer ", "");

  if (token.length === 0 || expectedSecret.length === 0) {
    return false;
  }

  // Constant-time comparison para evitar timing attacks
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const secretBytes = encoder.encode(expectedSecret);

  if (tokenBytes.length !== secretBytes.length) {
    return false;
  }

  // Comparacao byte-a-byte em tempo constante
  let result = 0;
  for (let i = 0; i < tokenBytes.length; i++) {
    result |= tokenBytes[i] ^ secretBytes[i];
  }
  return result === 0;
};
