import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";

const LOGO_URL = "/brand/bonatto-logo-driver.jpg";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const utils = trpc.useUtils();

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setSuccess(true);
      setTimeout(() => navigate("/"), 2500);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!token) {
      setError("Token inválido. Solicite um novo link de redefinição.");
      return;
    }
    resetMutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={LOGO_URL} alt="Bonatto Pizza" className="w-16 h-16 rounded-full shadow-lg mb-3" />
          <span className="font-black text-xl text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Bonatto Pizza
          </span>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-white text-xl font-bold mb-2">Senha redefinida!</h2>
            <p className="text-white/50 text-sm mb-4">
              Você já está logado. Redirecionando para o cardápio...
            </p>
            <div className="w-6 h-6 border-2 border-[#7d0f14] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h2 className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Nova senha
              </h2>
              <p className="text-white/50 text-sm">
                Escolha uma senha segura para sua conta.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12]"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-[#a01218] text-sm bg-[#2d0305]/40 border border-[#3a0608]/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {!token && (
                <div className="text-yellow-400 text-sm bg-yellow-950/40 border border-yellow-900/50 rounded-lg px-3 py-2">
                  Link inválido. Solicite um novo link de redefinição de senha.
                </div>
              )}

              <Button
                type="submit"
                disabled={resetMutation.isPending || !token}
                className="w-full bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-semibold gap-2 mt-1"
              >
                {resetMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Salvar nova senha
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a href="/login" className="text-sm text-[#a01218] hover:text-[#c0606a] transition-colors">
                ← Voltar para o login
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
