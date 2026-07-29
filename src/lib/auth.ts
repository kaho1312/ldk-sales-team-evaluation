const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const JWT_KEY = "ldk_jwt";
const USER_KEY = "ldk_user";

export interface StoredUser {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

function apiUrl(path: string): string {
  return `${API.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
}

export function isEmailValid(email: string): boolean {
  return email.toLowerCase().trim().endsWith("@ldk.lat");
}

export function getStoredToken(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(token: string, user: StoredUser) {
  localStorage.setItem(JWT_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Registering does NOT log the agent in — the account is created unverified
// and can't be used until the emailed link is clicked (see verifyEmail below).
// `needsVerification` is true on success so the UI can show "check your
// email" instead of navigating in; `emailSent` distinguishes "check your
// email" from "account created but the email failed to send" (Resend outage).
export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; needsVerification?: boolean; emailSent?: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!isEmailValid(normalizedEmail)) return { success: false, error: "El correo debe ser del dominio @ldk.lat" };
  if (!firstName.trim() || !lastName.trim()) return { success: false, error: "Nombre y apellido son requeridos" };
  if (password.length < 6) return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };

  try {
    const res = await fetch(apiUrl("/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password, full_name: `${firstName.trim()} ${lastName.trim()}` }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.message || "Error al crear la cuenta" };
    return { success: true, needsVerification: !!data.needsVerification, emailSent: data.emailSent !== false };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

// `needsVerification` is set when the credentials were correct but the account
// hasn't clicked its verification link yet (backend 403) — lets the UI offer a
// "resend the email" action instead of a plain "wrong password" message.
export async function login(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> {
  try {
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.message || "Correo o contraseña incorrectos", needsVerification: !!data.needsVerification };
    storeSession(data.token, data.user);
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Password reset ────────────────────────────────────────────────────────────

// Request a reset link. The backend always responds 200 (it never reveals whether
// the email is registered), so success here just means the request was accepted.
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl("/auth/forgot"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "No se pudo procesar la solicitud" };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

// Set a new password using a token from the reset email link.
export async function resetPassword(token: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (password.length < 6) return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
  try {
    const res = await fetch(apiUrl("/auth/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.message || "El enlace es inválido o ha expirado" };
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

// ── Email verification ────────────────────────────────────────────────────────

// Consume a token from the verification email link. On success the backend
// also logs the account in (same shape as login), so the session is stored
// here just like a normal login.
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl("/auth/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.message || "El enlace de verificación es inválido o ha expirado" };
    storeSession(data.token, data.user);
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

// Request a fresh verification link. The backend always responds 200 (never
// reveals whether the email is registered or already verified).
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl("/auth/resend-verification"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "No se pudo procesar la solicitud" };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión" };
  }
}

// ── Legacy shape kept for backward compatibility ──────────────────────────────

export interface Session {
  email: string;
  firstName: string;
  lastName: string;
}

/** @deprecated Use useAuth() hook instead */
export function getCurrentSession(): Session | null {
  const user = getStoredUser();
  if (!user) return null;
  const parts = (user.full_name || user.email).split(" ");
  return {
    email: user.email,
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}
