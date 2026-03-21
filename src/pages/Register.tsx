import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "@/lib/auth";
import ldkLogo from "@/assets/logo-ldk.jpeg";

export default function Register() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await register(firstName, lastName, email, password);
    setLoading(false);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Error al crear la cuenta");
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
              style={{
                borderRadius: "5px",
                boxShadow: "0 0 18px 4px #30bdff, 0 0 6px 2px #30bdff88",
              }}
            />
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">Crear Cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">Solo correos @ldk.lat</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                Nombre
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ana"
                className="w-full bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
                Apellido
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="García"
                className="w-full bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>
          </div>

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
            {email && !email.toLowerCase().endsWith("@ldk.lat") && (
              <p className="text-[11px] text-destructive mt-1">Debe ser un correo @ldk.lat</p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
              Contraseña
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
            {loading ? "Creando cuenta..." : "Crear cuenta →"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
