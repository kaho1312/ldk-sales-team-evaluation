import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerificationEmail } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import ldkLogo from "@/assets/logo-ldk.jpeg";

type Status = "checking" | "success" | "error";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const token = params.get("token") || "";

  const [status, setStatus] = useState<Status>(token ? "checking" : "error");
  const [error, setError] = useState("");

  // Resend mini-form, shown when the token is missing/invalid/expired.
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setStatus("success");
        refresh().then(() => navigate("/"));
      } else {
        setStatus("error");
        setError(result.error || "El enlace de verificación es inválido o ha expirado");
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    await resendVerificationEmail(resendEmail);
    setResending(false);
    setResendSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-8 w-full max-w-[400px] backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <img
              src={ldkLogo}
              alt="LDK Logo"
              className="w-20 h-20 object-cover"
              style={{ borderRadius: "5px", boxShadow: "0 0 18px 4px #30bdff, 0 0 6px 2px #30bdff88" }}
            />
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">Verificar correo</h1>
        </div>

        {status === "checking" && (
          <div className="text-center text-sm text-muted-foreground py-4">Verificando tu cuenta...</div>
        )}

        {status === "success" && (
          <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success leading-relaxed">
            ✓ ¡Correo verificado! Iniciando sesión...
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive leading-relaxed">
              {token
                ? error
                : "Falta el token de verificación. Abre el enlace completo desde tu correo, o solicita uno nuevo abajo."}
            </div>

            {resendSent ? (
              <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success leading-relaxed">
                Si esa cuenta existe y aún no está verificada, te enviamos un nuevo enlace. Revisa tu
                bandeja de entrada (y la carpeta de spam).
              </div>
            ) : (
              <form onSubmit={handleResend} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="nombre@ldk.lat"
                    className="w-full bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-3 tracking-wide hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resending ? "Enviando..." : "Reenviar enlace de verificación →"}
                </button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="text-primary font-semibold hover:underline">
                ← Volver a iniciar sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
