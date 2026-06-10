import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "@/lib/auth";
import ldkLogo from "@/assets/logo-ldk.jpeg";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);
    if (result.success) {
      setDone(true);
      setTimeout(() => navigate("/login"), 2200);
    } else {
      setError(result.error || "El enlace es inválido o ha expirado");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-8 w-full max-w-[400px] backdrop-blur-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <img
              src={ldkLogo}
              alt="LDK Logo"
              className="w-20 h-20 object-cover"
              style={{ borderRadius: "5px", boxShadow: "0 0 18px 4px #30bdff, 0 0 6px 2px #30bdff88" }}
            />
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">Crea una contraseña para tu cuenta</p>
        </div>

        {!token ? (
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive leading-relaxed">
              Falta el token de restablecimiento. Abre el enlace completo desde tu correo o solicita uno nuevo.
            </div>
            <Link
              to="/forgot"
              className="block text-center w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-3 tracking-wide hover:brightness-110 transition-all"
            >
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success leading-relaxed">
              ✓ Tu contraseña se actualizó. Redirigiéndote para iniciar sesión...
            </div>
            <Link
              to="/login"
              className="block text-center w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-3 tracking-wide hover:brightness-110 transition-all"
            >
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-3 tracking-wide hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Guardando..." : "Guardar contraseña →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
