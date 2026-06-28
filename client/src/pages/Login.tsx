import { getLoginUrl, hasSocialAuthConfig, isSocialProviderEnabled, type SocialProvider } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

const MASCOTE_URL = "/brand/palmito-2-circular.png";
const LOGO_TIPOGRAFICA_URL = "/brand/palmito-logo-tipografica.png";

const BENEFITS = [
  { icon: "🎁", text: "Cupons exclusivos para clientes cadastrados" },
  { icon: "🔥", text: "Promoções e combos especiais" },
  { icon: "🎰", text: "Participe de sorteios e ganhe prêmios" },
  { icon: "📦", text: "Acompanhe seus pedidos em tempo real" },
];

type Mode = "login" | "register" | "forgot";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo") ?? "/";

  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [phoneForm, setPhoneForm] = useState({ phone: "", name: "", code: "" });
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(returnTo);
    }
  }, [isAuthenticated, loading, navigate, returnTo]);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.loginEmail.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(returnTo);
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.auth.registerEmail.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(returnTo);
    },
    onError: (err) => setError(err.message),
  });

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setForgotSent(true);
    },
    onError: (err) => setError(err.message),
  });

  const requestPhoneOtpMutation = trpc.auth.requestPhoneOtp.useMutation({
    onSuccess: (data) => {
      setPhoneStep("code");
      setError("");
      toast.success(data.delivered ? "Código enviado para seu WhatsApp." : "Código gerado. Use o código exibido para teste.");
      if (data.previewCode) {
        toast.message(`Código de teste: ${data.previewCode}`);
      }
    },
    onError: (err) => setError(err.message),
  });

  const verifyPhoneOtpMutation = trpc.auth.verifyPhoneOtp.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(returnTo);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      loginMutation.mutate({ email: form.email, password: form.password });
    } else if (mode === "register") {
      registerMutation.mutate({ name: form.name, email: form.email, password: form.password });
    } else {
      forgotMutation.mutate({ email: form.email });
    }
  };

  const isLoading =
    loginMutation.isPending || registerMutation.isPending || forgotMutation.isPending || requestPhoneOtpMutation.isPending || verifyPhoneOtpMutation.isPending;

  const getProviderLoginUrl = (provider: SocialProvider) =>
    getLoginUrl(returnTo === "/" ? undefined : returnTo, provider);
  const socialAuthReady = hasSocialAuthConfig();
  const socialProviders = [
    {
      name: "Google",
      provider: "google" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      provider: "facebook" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      name: "Apple",
      provider: "apple" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="black">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      ),
    },
    {
      name: "Instagram",
      provider: "instagram" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <defs>
            <linearGradient id="igGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f58529" />
              <stop offset="35%" stopColor="#dd2a7b" />
              <stop offset="70%" stopColor="#8134af" />
              <stop offset="100%" stopColor="#515bd4" />
            </linearGradient>
          </defs>
          <path
            fill="url(#igGradient)"
            d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.75A4 4 0 0 0 3.75 7.75v8.5A4 4 0 0 0 7.75 20.25h8.5A4 4 0 0 0 20.25 16.25v-8.5a4 4 0 0 0-4-4Z"
          />
          <path fill="url(#igGradient)" d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.75A3.25 3.25 0 1 0 12 15.25 3.25 3.25 0 0 0 12 8.75Z" />
          <circle cx="17.35" cy="6.65" r="1.1" fill="url(#igGradient)" />
        </svg>
      ),
    },
  ].filter((provider) => isSocialProviderEnabled(provider.provider));
  const brandName = "Bonatto";
  const mascotUrl = MASCOTE_URL;
  const wordmarkUrl = LOGO_TIPOGRAFICA_URL;
  const loginHeroTitle = "Entrar na sua conta";
  const loginHeroSubtitle = "Bem-vindo de volta! 👋";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6E0D12]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">

      {/* ── Left: painel bordô ── */}
      <div
        className="relative hidden md:flex md:w-[45%] flex-col justify-between p-12 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #9b1520 0%, #6E0D12 55%, #5a0a0f 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        {/* Mascote decorativo de fundo */}
        <img
          src={mascotUrl}
          alt=""
          className="absolute right-[-40px] bottom-[-20px] w-72 h-72 opacity-10 pointer-events-none select-none"
        />

        {/* Logo topo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={mascotUrl} alt={brandName} className="w-12 h-12" />
          <img src={wordmarkUrl} alt={brandName} className="h-8 w-auto" />
        </div>

        {/* Texto central */}
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white leading-tight mb-6">
            A pizza que faz todo mundo{" "}
            <span className="text-white/60">{brandName}</span>
          </h1>
          <div className="space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <span className="text-xl">{b.icon}</span>
                <span className="text-white/80 text-sm">{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex text-yellow-300 text-sm">{"⭐".repeat(5)}</div>
          <span className="text-white/70 text-sm">4.8 · 10.000+ pedidos entregues</span>
        </div>
      </div>

      {/* ── Right: formulário branco com grid ── */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 min-h-screen md:min-h-0 overflow-hidden bg-white">

        {/* Grid de fundo */}
        <GridPattern
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.04 }}
        />
        {/* Vinheta suave nas bordas */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.95) 100%)",
          }}
        />

        {/* Conteúdo acima do grid */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center">

          {/* Logo mobile */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
              style={{ background: "linear-gradient(160deg, #9b1520 0%, #6E0D12 100%)" }}
            >
              <img src={mascotUrl} alt={brandName} className="w-16 h-16" />
            </div>
            <img src={wordmarkUrl} alt={brandName} className="h-8 w-auto" style={{ filter: "invert(1) sepia(1) saturate(5) hue-rotate(300deg) brightness(0.4)" }} />
          </div>

          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl font-black text-gray-900 mb-1">
                {mode === "login" && loginHeroTitle}
                {mode === "register" && "Criar conta gratuita"}
                {mode === "forgot" && "Redefinir senha"}
              </h2>
              <p className="text-gray-500 text-sm">
                {mode === "login" && "Bem-vindo de volta! 👋"}
                {mode === "register" && "Rápido, grátis e sem complicação."}
                {mode === "forgot" && "Enviaremos um link para seu e-mail."}
              </p>
            </div>

            {/* Botões sociais */}
            {mode !== "forgot" && (
              <>
                <div className="mb-5 rounded-2xl border border-[#6E0D12]/10 bg-[#fff8f7] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6E0D12] text-white shadow-sm">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Entrar com celular</p>
                          <p className="text-xs text-gray-500">Receba um código rápido e acesse sem senha.</p>
                        </div>
                        {phoneStep === "code" && (
                          <button
                            type="button"
                            className="text-xs font-medium text-[#6E0D12]"
                            onClick={() => {
                              setPhoneStep("phone");
                              setPhoneForm((current) => ({ ...current, code: "" }));
                              setError("");
                            }}
                          >
                            Trocar número
                          </button>
                        )}
                      </div>

                      {phoneStep === "phone" ? (
                        <div className="mt-4 grid gap-3">
                          {mode === "register" && (
                            <div className="space-y-1.5">
                              <Label className="text-gray-600 text-xs font-semibold">Nome para cadastro</Label>
                              <Input
                                type="text"
                                placeholder="Seu nome"
                                value={phoneForm.name}
                                onChange={(e) => setPhoneForm((s) => ({ ...s, name: e.target.value }))}
                                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12] shadow-sm"
                              />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-gray-600 text-xs font-semibold">WhatsApp</Label>
                            <Input
                              type="tel"
                              placeholder="(37) 99999-9999"
                              value={phoneForm.phone}
                              onChange={(e) => setPhoneForm((s) => ({ ...s, phone: e.target.value }))}
                              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12] shadow-sm"
                            />
                          </div>
                          <Button
                            type="button"
                            disabled={requestPhoneOtpMutation.isPending || phoneForm.phone.trim().length < 10}
                            className="w-full btn-bonatto text-white font-semibold border-0"
                            onClick={() =>
                              requestPhoneOtpMutation.mutate({
                                phone: phoneForm.phone,
                                purpose: "login",
                              })
                            }
                          >
                            Enviar código por celular
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-gray-600 text-xs font-semibold">Código de 6 dígitos</Label>
                            <div className="flex justify-center sm:justify-start">
                              <InputOTP
                                maxLength={6}
                                value={phoneForm.code}
                                onChange={(value) => setPhoneForm((s) => ({ ...s, code: value }))}
                              >
                                <InputOTPGroup>
                                  <InputOTPSlot index={0} />
                                  <InputOTPSlot index={1} />
                                  <InputOTPSlot index={2} />
                                  <InputOTPSlot index={3} />
                                  <InputOTPSlot index={4} />
                                  <InputOTPSlot index={5} />
                                </InputOTPGroup>
                              </InputOTP>
                            </div>
                          </div>
                          <Button
                            type="button"
                            disabled={verifyPhoneOtpMutation.isPending || phoneForm.code.length !== 6}
                            className="w-full btn-bonatto text-white font-semibold border-0"
                            onClick={() =>
                              verifyPhoneOtpMutation.mutate({
                                phone: phoneForm.phone,
                                code: phoneForm.code,
                                name: phoneForm.name || undefined,
                                purpose: "login",
                              })
                            }
                          >
                            Confirmar código e entrar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {socialAuthReady && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                      {socialProviders.map((provider) => (
                        <a key={provider.name} href={getProviderLoginUrl(provider.provider)}>
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 text-sm font-medium text-gray-700 shadow-sm"
                          >
                            {provider.icon}
                            <span className="text-xs">{provider.name}</span>
                          </button>
                        </a>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">ou entre com e-mail</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  </>
                )}
              </>
            )}

            {mode !== "forgot" && !socialAuthReady && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Login social ainda não configurado neste deploy. Por enquanto, use e-mail e senha.
              </div>
            )}

            {/* Formulário */}
            {forgotSent ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">📬</div>
                <h3 className="text-gray-900 font-semibold text-lg mb-2">E-mail enviado!</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha. O link expira em 1 hora.
                </p>
                <button
                  onClick={() => { setMode("login"); setForgotSent(false); setError(""); }}
                  className="text-[#6E0D12] text-sm hover:text-[#9b1520] transition-colors font-medium"
                >
                  ← Voltar para o login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label className="text-gray-600 text-xs font-semibold">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Seu nome"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12] shadow-sm"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-gray-600 text-xs font-semibold">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12] shadow-sm"
                      required
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">Senha</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => { setMode("forgot"); setError(""); }}
                          className="text-xs text-[#6E0D12] hover:text-[#9b1520] transition-colors font-medium"
                        >
                          Esqueci a senha
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="pl-9 pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6E0D12] focus-visible:border-[#6E0D12] shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-[#6E0D12] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-bonatto text-white font-semibold gap-2 mt-1 border-0"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === "login" && "Entrar"}
                      {mode === "register" && "Criar minha conta"}
                      {mode === "forgot" && "Enviar link de redefinição"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Toggle de modo */}
            {!forgotSent && (
              <div className="mt-6 text-center">
                {mode === "login" && (
                  <p className="text-gray-500 text-sm">
                    Não tem conta?{" "}
                    <button
                      onClick={() => { setMode("register"); setError(""); }}
                      className="text-[#6E0D12] hover:text-[#9b1520] font-semibold transition-colors"
                    >
                      Criar conta grátis
                    </button>
                  </p>
                )}
                {mode === "register" && (
                  <p className="text-gray-500 text-sm">
                    Já tem conta?{" "}
                    <button
                      onClick={() => { setMode("login"); setError(""); }}
                      className="text-[#6E0D12] hover:text-[#9b1520] font-semibold transition-colors"
                    >
                      Entrar
                    </button>
                  </p>
                )}
                {mode === "forgot" && !forgotSent && (
                  <button
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
                  >
                    ← Voltar para o login
                  </button>
                )}
              </div>
            )}

            {/* Link de volta */}
            <div className="mt-6 text-center">
              <a href="/" className="text-sm text-[#6E0D12] font-medium hover:underline">
                ← Voltar ao cardápio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
