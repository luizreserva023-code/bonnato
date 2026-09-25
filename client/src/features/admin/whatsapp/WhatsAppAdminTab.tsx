import {
  BadgeDollarSign,
  BellRing,
  FileText,
  History,
  MessageCircle,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminEmptyState,
  AdminInsightCard,
  AdminPage,
  AdminPill,
  AdminStat,
  AdminStatGrid,
  AdminSurface,
  AdminTopbar,
} from "@/components/admin/ui";
import { useAdminStore } from "@/contexts/AdminStoreContext";

const FUTURE_TRIGGERS = [
  { label: "Pedido confirmado", description: "Confirmação, número do pedido e resumo da compra." },
  { label: "Pedido em preparo", description: "Atualização automática quando a cozinha iniciar o pedido." },
  { label: "Saiu para entrega", description: "Aviso de saída com acompanhamento da entrega." },
  { label: "Pedido entregue", description: "Confirmação de entrega e possibilidade de pós-venda." },
  { label: "Recuperação de cliente", description: "Templates aprovados para campanhas e recompra." },
  { label: "Cupom e fidelidade", description: "Benefícios, pontos, resgates e ofertas autorizadas." },
];

export default function WhatsAppAdminTab() {
  const { selectedStoreName } = useAdminStore();

  return (
    <AdminPage>
      <AdminTopbar
        title="WhatsApp"
        subtitle={`${selectedStoreName} • Estrutura preparada para a API oficial do WhatsApp Business`}
        actions={<AdminPill tone="warning">Planejado</AdminPill>}
      />

      <AdminStatGrid className="xl:grid-cols-4">
        <AdminStat label="Saldo da carteira" value="R$ 0,00" icon={<WalletCards className="h-4 w-4" />} sub="Carteira ainda não ativada" />
        <AdminStat label="Consumo no período" value="R$ 0,00" icon={<BadgeDollarSign className="h-4 w-4" />} sub="Nenhuma cobrança registrada" />
        <AdminStat label="Templates ativos" value="0" icon={<FileText className="h-4 w-4" />} sub="Meta ainda não conectada" />
        <AdminStat label="Mensagens enviadas" value="0" icon={<MessageCircle className="h-4 w-4" />} sub="Canal oficial ainda inativo" />
      </AdminStatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <AdminSurface
          title="Carteira"
          subtitle="Saldo pré-pago para consumo de mensagens e templates."
          actions={<AdminPill tone="neutral">R$ 0,00 disponível</AdminPill>}
        >
          <div className="rounded-[16px] border border-[var(--admin-border)] bg-[var(--admin-surface-alt)] p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">Saldo disponível</p>
                <p className="mt-2 text-[34px] font-semibold tracking-[-.04em] text-[var(--admin-text-primary)]">R$ 0,00</p>
                <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                  Quando a carteira for ativada, cada débito ficará registrado em um histórico auditável.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled className="gap-2">
                  <History className="h-4 w-4" />
                  Ver consumo
                </Button>
                <Button disabled className="gap-2">
                  <BadgeDollarSign className="h-4 w-4" />
                  Recarregar
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
              <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">Créditos</p>
              <p className="mt-2 text-lg font-semibold text-[var(--admin-success)]">R$ 0,00</p>
            </div>
            <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
              <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">Débitos</p>
              <p className="mt-2 text-lg font-semibold text-[var(--admin-text-primary)]">R$ 0,00</p>
            </div>
            <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
              <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">Saldo mínimo</p>
              <p className="mt-2 text-lg font-semibold text-[var(--admin-text-primary)]">Não definido</p>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface
          title="Conexão WhatsApp Business"
          subtitle="A integração futura será feita pela API oficial da Meta."
          actions={<AdminPill tone="danger">Não conectado</AdminPill>}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[14px] border border-[var(--admin-border)] p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--admin-brand-50)] text-[var(--admin-brand-800)]">
                <PlugZap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--admin-text-primary)]">Meta Cloud API</p>
                <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">
                  Business Account, número, Phone Number ID, webhooks e templates aprovados serão sincronizados aqui.
                </p>
              </div>
            </div>
            <Button disabled className="w-full gap-2">
              <PlugZap className="h-4 w-4" />
              Conectar WhatsApp
            </Button>
            <p className="text-center text-[11px] text-[var(--admin-text-muted)]">
              A conexão será liberada depois da definição de custos, recarga e regras de cobrança.
            </p>
          </div>
        </AdminSurface>
      </div>

      <AdminSurface
        title="Templates de mensagem"
        subtitle="Cadastro, sincronização com a Meta, aprovação, categoria e custo efetivo por envio."
        actions={<AdminPill tone="neutral">0 templates</AdminPill>}
      >
        <AdminEmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum template oficial conectado"
          description="Quando a Meta Cloud API for ativada, os templates aprovados serão sincronizados e poderão ser vinculados às automações. O custo não será fixado manualmente: será calculado conforme categoria, destino e regra vigente do provedor."
          action={<Button disabled>Cadastrar template</Button>}
        />
      </AdminSurface>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminSurface title="Automações previstas" subtitle="Gatilhos que poderão disparar templates aprovados.">
          <div className="divide-y divide-[var(--admin-border)]">
            {FUTURE_TRIGGERS.map((trigger) => (
              <div key={trigger.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--admin-brand-50)] text-[var(--admin-brand-800)]">
                  <Workflow className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--admin-text-primary)]">{trigger.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">{trigger.description}</p>
                </div>
              </div>
            ))}
          </div>
        </AdminSurface>

        <div className="space-y-4">
          <AdminInsightCard
            eyebrow="Controle financeiro"
            title="A carteira registra cada movimentação, como um livro-caixa, além de mostrar o saldo atual."
            description="Cada recarga, reserva de custo, envio, estorno e ajuste precisa gerar um lançamento imutável para permitir auditoria e reconciliação."
            icon={<WalletCards className="h-4 w-4" />}
          />
          <AdminInsightCard
            eyebrow="Proteção de margem"
            title="Custo do provedor e preço cobrado devem ficar separados."
            description="A plataforma precisa guardar custo real, preço debitado da carteira e eventual margem. Isso permite trocar de provedor sem quebrar o histórico."
            icon={<ShieldCheck className="h-4 w-4" />}
            tone="info"
          />
          <AdminInsightCard
            eyebrow="Alertas"
            title="Saldo baixo precisa interromper campanhas antes de gerar dívida."
            description="Teremos limite mínimo, aviso de saldo, bloqueio seguro e opção futura de recarga automática."
            icon={<BellRing className="h-4 w-4" />}
            tone="warning"
          />
        </div>
      </div>

      <AdminSurface title="Status da implementação" subtitle="O que será necessário para ativar esta área de forma segura.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["1. Provedor oficial", "Adicionar Meta Cloud API à camada WhatsApp já existente."],
            ["2. Ledger da carteira", "Criar créditos, débitos, reservas, estornos e reconciliação."],
            ["3. Templates oficiais", "Sincronizar categoria, status, idioma e aprovação pela Meta."],
            ["4. Webhooks e métricas", "Registrar enviado, entregue, lido, falhou e custo final."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[14px] border border-[var(--admin-border)] bg-white p-4">
              <p className="text-[13px] font-semibold text-[var(--admin-text-primary)]">{title}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--admin-text-secondary)]">{body}</p>
            </div>
          ))}
        </div>
      </AdminSurface>
    </AdminPage>
  );
}
