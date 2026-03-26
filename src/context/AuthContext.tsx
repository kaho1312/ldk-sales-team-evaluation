import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function buildUser(id: string, email: string, meta: Record<string, string>, isAdmin: boolean): AuthUser {
    const fullName: string = meta?.full_name || email;
    const parts = fullName.split(" ");
    return {
      id,
      email,
      firstName: meta?.first_name || parts[0] || "",
      lastName: meta?.last_name || parts.slice(1).join(" ") || "",
      fullName,
      isAdmin,
    };
  }

  async function loadUser(id: string, email: string, meta: Record<string, string>) {
    // Set user immediately with auth metadata so the app never hangs
    setUser(buildUser(id, email, meta, false));

    // Then enrich with DB profile (is_admin, full_name) in the background
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("is_admin, full_name")
        .eq("id", id)
        .maybeSingle();

      if (profile) {
        const enrichedMeta = { ...meta, full_name: profile.full_name || meta?.full_name || email };
        setUser(buildUser(id, email, enrichedMeta, profile.is_admin ?? false));
      }
    } catch {
      // Profile fetch failed — user already set with basic info above, that's fine
    }
  }

  async function refresh() {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      await loadUser(u.id, u.email ?? "", (u.user_metadata ?? {}) as Record<string, string>);
    }
  }

  useEffect(() => {
    // Hard timeout: never stay in loading state more than 4 seconds
    const timeout = setTimeout(() => setLoading(false), 4000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUser(
          session.user.id,
          session.user.email ?? "",
          (session.user.user_metadata ?? {}) as Record<string, string>,
        );
      }
      clearTimeout(timeout);
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadUser(
            session.user.id,
            session.user.email ?? "",
            (session.user.user_metadata ?? {}) as Record<string, string>,
          );
        } else {
          setUser(null);
        }
      },
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
