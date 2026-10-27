import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Each device signs in anonymously once; the session must survive reloads
        // and offline periods so queued changes can be pushed later.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Returns the current auth user id, signing in anonymously if needed. */
export async function ensureSignedIn(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user");
  return data.user.id;
}

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

function asErrorLike(error: unknown): ErrorLike | null {
  return error && typeof error === "object" ? (error as ErrorLike) : null;
}

/** True for "not allowed" failures: retrying will not help until the user signs in again. */
export function isAuthError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e) return false;
  return (
    e.code === "42501" || // RLS: insufficient privilege
    e.code === "PGRST301" || // JWT expired / invalid
    e.status === 401 ||
    e.status === 403 ||
    e.name === "AuthApiError"
  );
}

/** True when the request never reached the server (offline, DNS, CORS). */
export function isNetworkError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed")
  );
}

export function describeError(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  const e = asErrorLike(error);
  if (e?.code === "42501") {
    return "This device is not a member of the event. Sign out and sign in again with the access code.";
  }
  if (e?.code === "PGRST202") {
    return "Server function missing. Apply the latest Supabase migrations.";
  }
  if (e?.code === "PGRST205") {
    return "Server table missing. Apply the latest Supabase migrations.";
  }
  if (isNetworkError(error)) return "Network unavailable";
  return e?.message || String(error);
}
