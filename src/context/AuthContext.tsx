import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getStoredToken, getStoredUser, type StoredUser } from "@/lib/auth";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
});

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function toAuthUser(u: StoredUser): AuthUser {
  const parts = (u.full_name || u.email).split(" ");
  return {
    id: u.id,
    email: u.email,
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
    fullName: u.full_name || u.email,
    isAdmin: !!u.is_admin,
  };
}

// Discriminated result so callers can tell "the token is no good" (401 / deleted
// account) apart from "the server is unreachable" (network error / 5xx). Conflating
// the two is what let an expired session linger as a logged-in-but-broken app.
type MeResult =
  | { status: "ok"; user: StoredUser }
  | { status: "unauthorized" }
  | { status: "network-error" };

async function fetchMe(): Promise<MeResult> {
  const token = getStoredToken();
  if (!token || !API) return { status: "unauthorized" };
  try {
    const res = await fetch(`${API.replace(/\/+$/, "")}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 401 = token expired/invalid; 404 = the account no longer exists. Either way
    // the cached session is unusable and must be cleared.
    if (res.status === 401 || res.status === 404) return { status: "unauthorized" };
    if (!res.ok) return { status: "network-error" }; // 5xx / transient — keep cache
    return { status: "ok", user: await res.json() };
  } catch {
    return { status: "network-error" };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    // Show cached user immediately to avoid flicker
    const cached = getStoredUser();
    if (cached) setUser(toAuthUser(cached));

    // Refresh from server
    const result = await fetchMe();
    if (result.status === "ok") {
      localStorage.setItem("ldk_user", JSON.stringify(result.user));
      setUser(toAuthUser(result.user));
    } else if (result.status === "unauthorized") {
      // Expired/invalid token (or deleted account): clear the stale session so the
      // route guards send the user to /login instead of leaving them on a
      // logged-in-but-broken page where every API call 401s (e.g. the admin panel
      // showing "Error al cargar usuarios").
      localStorage.removeItem("ldk_jwt");
      localStorage.removeItem("ldk_user");
      setUser(null);
    }
    // status === "network-error": server unreachable but cache exists → keep the
    // cached user so a transient outage doesn't log everyone out.
  }

  async function refresh() {
    await loadUser();
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 4000);
    loadUser().finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    function onStorage(e: StorageEvent) {
      if (e.key === "ldk_jwt" || e.key === "ldk_user") {
        if (!e.newValue) setUser(null);
        else loadUser();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("storage", onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
