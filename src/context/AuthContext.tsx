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

async function fetchMe(): Promise<StoredUser | null> {
  const token = getStoredToken();
  if (!token || !API) return null;
  try {
    const res = await fetch(`${API.replace(/\/+$/, "")}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
    const fresh = await fetchMe();
    if (fresh) {
      localStorage.setItem("ldk_user", JSON.stringify(fresh));
      setUser(toAuthUser(fresh));
    } else if (!cached) {
      setUser(null);
    }
    // If server is unreachable but cache exists, keep cached user
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
