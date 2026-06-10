import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/lib/auth";
import ldkLogo from "@/assets/logo-ldk.jpeg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "No se pudo procesar la solicitud");
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
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">Restablecer contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">Te enviaremos un enlace por correo</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success leading-relaxed">
              Si existe una cuenta con ese correo, te enviamos un enlace para crear una nueva contraseña.
              Revisa tu bandeja de entrada (y la carpeta de spam).
            </div>
            <Link
              to="/login"
              className="block text-center w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-3 tracking-wide hover:brightness-110 transition-all"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ldk.lat"
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
              {loading ? "Enviando..." : "Enviar enlace →"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-semibold hover:underline">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
