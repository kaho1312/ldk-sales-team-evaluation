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

  async function loadUser(id: string, email: string, meta: Record<string, string>) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin, full_name")
      .eq("id", id)
      .maybeSingle();

    const fullName: string = profile?.full_name || meta?.full_name || email;
    const parts = fullName.split(" ");

    setUser({
      id,
      email,
      firstName: meta?.first_name || parts[0] || "",
      lastName: meta?.last_name || parts.slice(1).join(" ") || "",
      fullName,
      isAdmin: profile?.is_admin ?? false,
    });
  }

  async function refresh() {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      await loadUser(u.id, u.email ?? "", (u.user_metadata ?? {}) as Record<string, string>);
    }
  }

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUser(
          session.user.id,
          session.user.email ?? "",
          (session.user.user_metadata ?? {}) as Record<string, string>,
        );
      }
      setLoading(false);
    });

    // Reactive session updates
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

    return () => subscription.unsubscribe();
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
