import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Admin from "./pages/Admin.tsx";
import AdminAttempt from "./pages/AdminAttempt.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { getStoredToken } from "@/lib/auth";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

const SPINNER_FRAMES = ["|", "/", "-", "\\"];

function Loading() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-primary text-2xl font-mono w-6 text-center select-none">
          {SPINNER_FRAMES[frame]}
        </span>
        <span className="text-muted-foreground text-sm tracking-wide">Cargando...</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || (!user && getStoredToken())) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={<RequireAuth><Index /></RequireAuth>}
            />
            <Route
              path="/admin"
              element={<RequireAuth><RequireAdmin><Admin /></RequireAdmin></RequireAuth>}
            />
            <Route
              path="/admin/attempt/:id"
              element={<RequireAuth><RequireAdmin><AdminAttempt /></RequireAdmin></RequireAuth>}
            />
            <Route
              path="/login"
              element={<RedirectIfAuthed><Login /></RedirectIfAuthed>}
            />
            <Route
              path="/register"
              element={<RedirectIfAuthed><Register /></RedirectIfAuthed>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
