import { supabase } from "./supabase";

// ── Validation ────────────────────────────────────────────────────────────────

export function isEmailValid(email: string): boolean {
  return email.toLowerCase().trim().endsWith("@ldk.lat");
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  if (!isEmailValid(normalizedEmail)) {
    return { success: false, error: "El correo debe ser del dominio @ldk.lat" };
  }
  if (!firstName.trim() || !lastName.trim()) {
    return { success: false, error: "Nombre y apellido son requeridos" };
  }
  if (password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  const { error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { success: false, error: "Este correo ya está registrado" };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { success: false, error: "Correo o contraseña incorrectos" };
    }
    return { success: false, error: error.message };
  }

  // Fire-and-forget: update last_login
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {});
  }

  return { success: true };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

// ── Kept for backward compatibility with existing test suite ──────────────────

export interface Session {
  email: string;
  firstName: string;
  lastName: string;
}

/** @deprecated Use useAuth() hook instead */
export function getCurrentSession(): Session | null {
  // Supabase stores its session in localStorage under sb-*-auth-token.
  // This synchronous read is used only in the App.tsx route guards
  // which have been replaced with useAuth(); kept for test compatibility.
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!keys.length) return null;
    const parsed = JSON.parse(localStorage.getItem(keys[0]) ?? "null");
    const u = parsed?.user;
    if (!u) return null;
    const meta = u.user_metadata ?? {};
    const fullName: string = meta.full_name ?? u.email ?? "";
    const parts = fullName.split(" ");
    return {
      email: u.email ?? "",
      firstName: meta.first_name ?? parts[0] ?? "",
      lastName: meta.last_name ?? parts.slice(1).join(" ") ?? "",
    };
  } catch {
    return null;
  }
}
