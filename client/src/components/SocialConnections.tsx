import { getSocialConnectUrl, type SocialProvider } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, Link2, Loader2, RefreshCw, ShieldCheck, Trash2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PROVIDERS: Array<{ id: SocialProvider; label: string; connectLabel: string; description: string }> = [
  { id: "google", label: "Google", connectLabel: "Conectar Google", description: "Nome, e-mail verificado e foto de perfil." },
  { id: "facebook", label: "Facebook", connectLabel: "Conectar Facebook", description: "Perfil público, e-mail autorizado e foto." },
  { id: "apple", label: "Apple", connectLabel: "Conectar Apple", description: "Identificador seguro, nome e e-mail autorizado." },
  { id: "instagram", label: "Instagram profissional", connectLabel: "Conectar Instagram profissional", description: "Disponível somente para contas Business ou Creator." },
];

function ProviderIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "google") return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.1 5.1 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84A6.6 6.6 0 0 1 12 5.38Z" />
    </svg>
  );
  if (provider === "facebook") return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1877F2]" aria-hidden="true"><path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" /></svg>;
  if (provider === "apple") return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-black" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39a4.8 4.8 0 0 1 4.12-2.51c1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" /></svg>;
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><defs><linearGradient id="social-ig" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#f58529" /><stop offset=".5" stopColor="#dd2a7b" /><stop offset="1" stopColor="#515bd4" /></linearGradient></defs><path fill="url(#social-ig)" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.75a4 4 0 0 0-4 4v8.5a4 4 0 0 0 4 4h8.5a4 4 0 0 0 4-4v-8.5a4 4 0 0 0-4-4H7.75ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Zm5.35-3.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" /></svg>;
}

export function SocialConnections() {
  const utils = trpc.useUtils();
  const { data: config } = trpc.system.socialAuthConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { data: accounts = [], isLoading } = trpc.auth.socialAccounts.useQuery();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const syncMutation = trpc.auth.syncSocialAccount.useMutation({
    onSuccess: async () => {
      await utils.auth.socialAccounts.invalidate();
      toast.success("Dados sociais sincronizados.");
    },
    onError: (error) => toast.error(error.message),
  });
  const disconnectMutation = trpc.auth.disconnectSocialAccount.useMutation({
    onSuccess: async () => {
      await utils.auth.socialAccounts.invalidate();
      toast.success("Conta social desconectada.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => window.location.replace("/"),
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("oauthConnected");
    const oauthError = params.get("oauthError");
    if (connected) toast.success(`${connected} conectado com segurança.`);
    if (oauthError === "instagram_professional_required") {
      toast.error("Esta integração está disponível para contas profissionais do Instagram.");
    } else if (oauthError) {
      toast.error("Não foi possível conectar esta conta social.");
    }
    if (connected || oauthError) {
      params.delete("oauthConnected");
      params.delete("oauthError");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const connectedByProvider = new Map(accounts.map((account) => [account.provider, account]));

  return (
    <div className="space-y-4">
      <Card className="border-[#ead7d1]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-primary" />Contas conectadas</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Você controla quais redes estão vinculadas. Os tokens ficam criptografados no servidor e nunca são enviados ao navegador.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : PROVIDERS.map((provider) => {
            const account = connectedByProvider.get(provider.id);
            const enabled = Boolean(config?.providers[provider.id]);
            return (
              <div key={provider.id} className="flex flex-col gap-3 rounded-2xl border border-[#eee0dc] bg-[#fffaf8] p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm"><ProviderIcon provider={provider.id} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{provider.label}</p>
                      {account && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Check className="h-3 w-3" />Conectado</span>}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{account?.providerEmail ?? account?.providerUsername ?? provider.description}</p>
                    {account?.lastSyncedAt && <p className="mt-1 text-[11px] text-muted-foreground">Sincronizado em {new Date(account.lastSyncedAt).toLocaleString("pt-BR")}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {account ? (
                    <>
                      {provider.id !== "apple" && (
                        <Button type="button" size="sm" variant="outline" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate({ provider: provider.id })} aria-label={`Sincronizar ${provider.label}`}>
                          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" className="gap-2 text-red-700" disabled={disconnectMutation.isPending} onClick={() => {
                        if (window.confirm(`Desconectar ${provider.label}?`)) disconnectMutation.mutate({ provider: provider.id });
                      }}>
                        <Unlink className="h-4 w-4" />Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={!enabled} onClick={() => window.location.assign(getSocialConnectUrl(provider.id))}>
                      {enabled ? provider.connectLabel : "Aguardando configuração"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            A sincronização usa apenas os dados e escopos exibidos pelo provedor. Informações editadas por você no perfil têm prioridade.
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-950">Excluir minha conta</p>
            <p className="text-xs leading-relaxed text-red-800/70">Seus dados pessoais serão anonimizados e as conexões sociais revogadas.</p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild><Button type="button" variant="outline" className="gap-2 border-red-300 text-red-800"><Trash2 className="h-4 w-4" />Excluir conta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir sua conta permanentemente?</DialogTitle>
                <DialogDescription>Digite EXCLUIR e, se sua conta tiver senha, informe-a para confirmar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="EXCLUIR" autoComplete="off" />
                <Input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Senha atual, se houver" autoComplete="current-password" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                <Button type="button" variant="destructive" disabled={deleteConfirmation !== "EXCLUIR" || deleteMutation.isPending} onClick={() => deleteMutation.mutate({ confirmation: "EXCLUIR", password: deletePassword || undefined })}>
                  {deleteMutation.isPending ? "Excluindo..." : "Excluir definitivamente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
