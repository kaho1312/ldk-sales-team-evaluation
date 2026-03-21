const USERS_KEY = "ldk_users";
const SESSION_KEY = "ldk_current_session";

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  email: string;
  firstName: string;
  lastName: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getUsers(): Record<string, User> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, User>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function isEmailValid(email: string): boolean {
  return email.toLowerCase().trim().endsWith("@ldk.lat");
}

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

  const users = getUsers();
  if (users[normalizedEmail]) {
    return { success: false, error: "Este correo ya está registrado" };
  }

  const passwordHash = await hashPassword(password);

  const user: User = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users[normalizedEmail] = user;
  saveUsers(users);

  const session: Session = {
    email: normalizedEmail,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { success: true };
}

export async function login(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const users = getUsers();
  const user = users[normalizedEmail];

  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    return { success: false, error: "Contraseña incorrecta" };
  }

  const session: Session = {
    email: normalizedEmail,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { success: true };
}

export function getAllUsers(): User[] {
  const users = getUsers();
  return Object.values(users);
}
