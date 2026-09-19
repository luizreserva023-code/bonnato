import { ArrowLeft, Home, Pizza } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <section className="flex min-h-[70dvh] items-center px-5 py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-[#191412] text-white shadow-[0_28px_80px_rgba(75,28,24,0.18)] md:grid-cols-[1.05fr_0.95fr]">
        <div className="p-8 sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ff3943]">Caminho errado, sabor certo</p>
          <h1 className="mt-5 text-7xl font-black leading-none text-white sm:text-8xl">404</h1>
          <h2 className="mt-5 text-3xl font-black uppercase leading-none sm:text-5xl">Essa página saiu do forno.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">
            O endereço não existe ou mudou. Volte para a home ou abra o cardápio para continuar seu pedido.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => setLocation("/")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#da1923] px-6 font-bold text-white hover:bg-[#ef202b]">
              <Home className="h-4 w-4" /> Ir para a home
            </button>
            <Link href="/cardapio" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 font-bold text-white hover:bg-white/10">
              <Pizza className="h-4 w-4" /> Abrir cardápio
            </Link>
          </div>
        </div>
        <div className="relative grid min-h-64 place-items-center overflow-hidden bg-[#da1923] p-10">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "22px 22px" }} />
          <div className="relative flex h-44 w-44 rotate-6 items-center justify-center rounded-[2.5rem] bg-[#fff5ec] text-[#da1923] shadow-2xl">
            <Pizza className="h-24 w-24" strokeWidth={1.4} />
          </div>
          <button onClick={() => history.back()} className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-white/85 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar à página anterior
          </button>
        </div>
      </div>
    </section>
  );
}
