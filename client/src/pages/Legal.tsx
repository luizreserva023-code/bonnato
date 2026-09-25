import { ShieldCheck } from "lucide-react";

type LegalPageProps = { kind: "terms" | "privacy" };

const CONTENT = {
  terms: {
    title: "Termos de Uso",
    intro: "Ao criar uma conta, você concorda em usar a plataforma de forma legítima e em manter seus dados de acesso protegidos.",
    sections: [
      ["Conta e acesso", "Você é responsável pelas informações fornecidas e pelas atividades realizadas na sua conta. Podemos suspender acessos usados de forma fraudulenta ou abusiva."],
      ["Pedidos e pagamentos", "Preços, disponibilidade, prazos e formas de pagamento são apresentados antes da confirmação. O pedido passa a valer após a confirmação exibida na plataforma."],
      ["Contas sociais", "A conexão com Google, Facebook, Apple ou Instagram é opcional. Você pode revogar uma conexão no seu perfil, desde que mantenha outro método de acesso."],
    ],
  },
  privacy: {
    title: "Política de Privacidade",
    intro: "Tratamos seus dados para operar pedidos, pagamentos, benefícios e autenticação, seguindo os princípios de necessidade e transparência da LGPD.",
    sections: [
      ["Dados coletados", "Podemos tratar nome, e-mail, telefone, endereço, histórico de pedidos e os dados sociais que você autorizar explicitamente no provedor."],
      ["Finalidades", "Usamos os dados para autenticar sua conta, entregar pedidos, oferecer suporte, aplicar benefícios e proteger a plataforma contra fraude."],
      ["Seus controles", "No perfil você pode revisar conexões, sincronizar dados, revogar provedores e solicitar a exclusão da conta. Tokens sociais são armazenados criptografados no servidor."],
    ],
  },
} as const;

export default function LegalPage({ kind }: LegalPageProps) {
  const content = CONTENT[kind];
  return (
    <div className="bg-[#fffaf8] px-4 py-12 text-[#211719] sm:py-20">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#ead7d1] bg-white p-6 shadow-[0_18px_60px_rgba(83,23,23,0.08)] sm:p-10">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fce8e8] text-[#6E0D12]"><ShieldCheck className="h-6 w-6" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6E0D12]">Bonatto Pizza</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{content.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6d5a5d]">{content.intro}</p>
        <div className="mt-9 space-y-7">
          {content.sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#6d5a5d]">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-[#eee0dc] pt-5 text-xs text-[#8a7779]">Versão vigente: 1º de agosto de 2026.</p>
      </article>
    </div>
  );
}
