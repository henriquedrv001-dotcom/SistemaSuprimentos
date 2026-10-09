import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(url && anonKey);
export const supabase = hasSupabaseConfig
  ? createClient(url!, anonKey!)
  : null;

// Importante: nunca colocar chave service_role no frontend.
// As regras de segurança precisam ser aplicadas no banco, com RLS/policies.
