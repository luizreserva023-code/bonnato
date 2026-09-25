import {
  Crown,
  Home,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";

type HomeAppHubProps = {
  config?: Partial<HomeAppConfig>;
  showQuickActions?: boolean;
};

export type HomeAppConfig = {
  greetingSubtitle: string;
  orderTitle: string;
  orderDescription: string;
  orderButtonLabel: string;
  quickActionsTitle: string;
  offersLabel: string;
  couponsLabel: string;
  clubLabel: string;
  menuLabel: string;
};

export const DEFAULT_HOME_APP_CONFIG: HomeAppConfig = {
  greetingSubtitle: "O que vamos pedir hoje?",
  orderTitle: "Faça seu pedido",
  orderDescription: "Escolha seus produtos favoritos e peça direto pelo aplicativo.",
  orderButtonLabel: "Ver cardápio",
  quickActionsTitle: "Acesso rápido",
  offersLabel: "Ofertas",
  couponsLabel: "Cupons",
  clubLabel: "Clube",
  menuLabel: "Cardápio",
};

const bottomNavigation = [
  { label: "Início", href: "/", icon: Home, active: true },
  { label: "Ofertas", href: "/#promoções-title", icon: Sparkles, active: false },
  { label: "Pedidos", href: "/meus-pedidos", icon: PackageCheck, active: false },
  { label: "Cupons", href: "/minha-conta?tab=cupons", icon: Tag, active: false },
  { label: "Perfil", href: "/minha-conta", icon: UserRound, active: false },
] as const;

export function HomeAppHub({ config, showQuickActions = true }: HomeAppHubProps) {
  const copy = { ...DEFAULT_HOME_APP_CONFIG, ...config };
  const quickActions = [
    { label: copy.offersLabel, href: "#promoções-title", icon: Sparkles },
    { label: copy.couponsLabel, href: "#cupons-title", icon: Tag },
    { label: copy.clubLabel, href: "#recompensas-do-clube-title", icon: Crown },
    { label: copy.menuLabel, href: "/cardapio", icon: ShoppingBag },
  ] as const;

  return (
    <>
      {showQuickActions && <section className="container pb-6 pt-2 md:pb-10" aria-label="Início rápido">
        <div className="mx-auto max-w-6xl">
          <section aria-labelledby="quick-actions-title" className="rounded-[1.6rem] border border-black/[.06] bg-white p-4">
            <h2 id="quick-actions-title" className="px-1 text-base font-black text-[#241b18]">{copy.quickActionsTitle}</h2>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {quickActions.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2 text-center text-xs font-bold text-[#493c37] transition-colors hover:bg-[#f8f3ef] active:bg-[#f2e9e3] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#DA1923]">
                  <span className="grid size-9 place-items-center rounded-full bg-[#fbe9e8] text-[#DA1923]"><Icon className="size-[18px]" /></span>
                  <span className="w-full truncate">{label}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>}

      <Link
        href="/cardapio"
        aria-label={`${copy.orderTitle}. Abrir cardápio`}
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-40 flex min-h-12 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-[#DA1923] px-5 text-white shadow-[0_12px_30px_rgba(93,9,14,.28)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DA1923] md:bottom-6 md:left-auto md:right-6 md:w-auto md:min-w-56 md:translate-x-0"
      >
        <span className="text-sm font-black uppercase tracking-[0.02em]">{copy.orderTitle}</span>
        <ShoppingBag className="size-[18px]" aria-hidden="true" />
      </Link>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[.07] bg-white md:hidden">
        <div className="grid h-16 grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {bottomNavigation.map(({ label, href, icon: Icon, active }) => (
            <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#DA1923] ${active ? "text-[#DA1923]" : "text-[#756963] hover:text-[#493c37]"}`}>
              <span className={`grid size-7 place-items-center rounded-full ${active ? "bg-[#fbe9e8]" : "bg-transparent"}`}><Icon className="size-[18px]" /></span>
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
