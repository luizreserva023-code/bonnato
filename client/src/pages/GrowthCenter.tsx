import { useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Bell, Bot, CheckCircle2, Circle, Mail, Megaphone, MessageCircle, Pause, Play, RefreshCw, Rocket, Sparkles, Target, TrendingUp, Users, Wrench, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { AdminEmptyState, AdminPage, AdminPill, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";

type Section = "overview" | "audiences" | "campaigns" | "automations" | "results";
const sections: Array<{id:Section;label:string;icon:typeof TrendingUp}> = [
  {id:"overview",label:"Visão geral",icon:TrendingUp},{id:"audiences",label:"Públicos",icon:Users},{id:"campaigns",label:"Campanhas",icon:Megaphone},{id:"automations",label:"Automações",icon:Zap},{id:"results",label:"Resultados",icon:Target},
];

const templates = [
  { key:"abandoned", title:"Recuperar carrinho", description:"Lembra o cliente e entrega um cupom depois de 30 minutos.", trigger:"checkout_abandoned" as const, steps:[{id:"wait-1",type:"wait" as const,label:"Aguardar 30 minutos",delayMinutes:30},{id:"push-1",type:"send_push" as const,label:"Enviar lembrete",title:"Seu pedido ficou esperando",message:"Volte para concluir seu pedido Bonatto."},{id:"coupon-1",type:"send_coupon" as const,label:"Enviar cupom",couponDiscountType:"percentage" as const,couponDiscountValue:10,couponExpiryDays:2}]},
  { key:"welcome", title:"Converter primeira compra", description:"Recebe o novo cliente e apresenta o cardápio.", trigger:"new_user" as const, steps:[{id:"push-1",type:"send_push" as const,label:"Boas-vindas",title:"Bem-vindo!",message:"Seu próximo sabor favorito está aqui."},{id:"coupon-1",type:"send_coupon" as const,label:"Cupom da primeira compra",couponDiscountType:"percentage" as const,couponDiscountValue:10,couponExpiryDays:7}]},
  { key:"inactive", title:"Reativar clientes", description:"Traz de volta quem não compra há 30 dias.", trigger:"tag_inativo_30" as const, steps:[{id:"push-1",type:"send_push" as const,label:"Mensagem de saudade",title:"A gente está com saudade",message:"Tem novidade e sabor esperando por você."},{id:"coupon-1",type:"send_coupon" as const,label:"Oferta de retorno",couponDiscountType:"percentage" as const,couponDiscountValue:12,couponExpiryDays:3}]},
  { key:"birthday", title:"Aniversário", description:"Presente automático no aniversário do cliente.", trigger:"birthday" as const, steps:[{id:"push-1",type:"send_push" as const,label:"Parabenizar",title:"Feliz aniversário!",message:"Hoje o presente tem sabor Bonatto."},{id:"loyalty-1",type:"update_loyalty" as const,label:"Adicionar presente",loyaltyPoints:150,loyaltyDescription:"Presente de aniversário"}]},
];

function GrowthHealthPanel({ storeId }: { storeId: number }) {
  const health = trpc.automations.health.useQuery({ storeId }, { refetchInterval: 30_000 });
  const processQueue = trpc.automations.processExecutions.useMutation({
    onSuccess: async () => {
      await health.refetch();
      toast.success("Fila de automações processada com segurança.");
    },
    onError: (error) => toast.error(error.message),
  });
  const status = health.data?.status ?? "attention";
  const statusLabel = status === "healthy" ? "Operação saudável" : status === "critical" ? "Ação necessária" : "Requer atenção";
  const statusClass = status === "healthy" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : status === "critical" ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-900 border-amber-200";
  const channels = [
    { label: "Push", enabled: health.data?.channels.push, icon: Bell },
    { label: "WhatsApp", enabled: health.data?.channels.whatsapp, icon: MessageCircle },
    { label: "E-mail", enabled: health.data?.channels.email, icon: Mail },
  ];
  return <AdminSurface className={`border ${statusClass}`}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {status === "healthy" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div><strong>{statusLabel}</strong><p className="mt-1 text-xs opacity-70">{health.data?.running ?? 0} em execução · {health.data?.overdue ?? 0} atrasadas · {health.data?.failedLast7Days ?? 0} falhas em 7 dias</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {channels.map(({ label, enabled, icon: Icon }) => <span key={label} className={`inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-bold ${enabled ? "opacity-100" : "opacity-45"}`}><Icon className="size-3" />{label} {enabled ? "ativo" : "pendente"}</span>)}
        <Button size="sm" variant="outline" disabled={processQueue.isPending} onClick={() => processQueue.mutate({ storeId })}><Wrench className="size-4" />Processar fila</Button>
      </div>
    </div>
  </AdminSurface>;
}

export default function GrowthCenter() {
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const [, navigate] = useLocation();
  const [section,setSection] = useState<Section>("overview");
  const storeId = selectedStoreId ?? 0;
  const metrics = trpc.automations.getGlobalMetrics.useQuery({storeId},{enabled:storeId>0});
  const journeys = trpc.automations.listJourneys.useQuery({storeId},{enabled:storeId>0});
  const tags = trpc.automations.listCustomerTags.useQuery({storeId},{enabled:storeId>0});
  const intelligence = trpc.operations.intelligence.dashboard.useQuery({storeId},{enabled:storeId>0});
  const createJourney = trpc.automations.createJourney.useMutation({onSuccess:async()=>{await Promise.all([journeys.refetch(),metrics.refetch()]);toast.success("Automação criada em modo rascunho.");},onError:(error)=>toast.error(error.message)});
  const toggleJourney = trpc.automations.toggleJourney.useMutation({onSuccess:async()=>{await Promise.all([journeys.refetch(),metrics.refetch()]);toast.success("Status da automação atualizado.");},onError:(error)=>toast.error(error.message)});
  const generate = trpc.operations.intelligence.generateSuggestions.useMutation({onSuccess:async()=>{await intelligence.refetch();toast.success("Diagnóstico atualizado.");},onError:(error)=>toast.error(error.message)});
  const updateSuggestion = trpc.operations.intelligence.updateSuggestion.useMutation({onSuccess:async()=>{await intelligence.refetch();toast.success("Recomendação atualizada.");},onError:(error)=>toast.error(error.message)});

  const audienceMap = new Map<string,Set<number>>();
  for(const item of tags.data??[]){const group=audienceMap.get(item.tag)??new Set<number>();group.add(item.userId);audienceMap.set(item.tag,group);}
  const summary = intelligence.data?.summary as Record<string,string|number>|undefined;
  const formatMoney=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
  const setupChecks = [
    {label:"Base segmentada",done:audienceMap.size>0},
    {label:"Primeira jornada criada",done:Boolean(journeys.data?.length)},
    {label:"Automação ativa",done:Boolean(journeys.data?.some((journey)=>journey.status==="active"))},
    {label:"Primeira conversão atribuída",done:(metrics.data?.conversions??0)>0},
  ];
  const setupProgress=Math.round((setupChecks.filter((item)=>item.done).length/setupChecks.length)*100);
  const uniqueSuggestions=(intelligence.data?.suggestions??[]).filter((item,index,items)=>items.findIndex((candidate)=>candidate.kind===item.kind)===index);

  if(!selectedStoreId) return <AdminEmptyState title="Selecione uma loja" description="A Central de Crescimento usa os dados e resultados de uma loja por vez."/>;
  return <AdminPage>
    <AdminTopbar title="Central de Crescimento" subtitle={`Clientes, campanhas e receita de ${selectedStoreName}.`} actions={<Button variant="outline" onClick={()=>Promise.all([metrics.refetch(),journeys.refetch(),tags.refetch(),intelligence.refetch()])}><RefreshCw className="size-4"/>Atualizar</Button>}/>
    <div className="flex gap-2 overflow-x-auto border-b pb-3">{sections.map((item)=>{const Icon=item.icon;return <button key={item.id} onClick={()=>setSection(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${section===item.id?"bg-[#6e0d12] text-white":"bg-white text-slate-600 hover:bg-slate-100"}`}><Icon className="size-4"/>{item.label}</button>})}</div>
    <GrowthHealthPanel storeId={storeId} />

    {section==="overview"&&<div className="space-y-5"><AdminSurface className="overflow-hidden bg-[#191412] text-white"><div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ffca28]">Plano de crescimento</p><h3 className="mt-2 text-2xl font-black tracking-tight">Sua operação está {setupProgress}% preparada para automatizar vendas.</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">Complete os marcos abaixo para medir receita, recuperar clientes e aprender quais campanhas realmente funcionam.</p><Button className="mt-5 bg-[#e51b23] text-white hover:bg-[#ca151d]" onClick={()=>setSection(setupProgress<50?"automations":"results")}>{setupProgress<50?"Configurar primeira automação":"Ver resultados"}<ArrowRight className="size-4"/></Button></div><div><div className="mb-3 flex items-center justify-between text-xs"><span className="font-bold text-white/55">Configuração</span><strong>{setupProgress}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ffca28] transition-[width] duration-500" style={{width:`${setupProgress}%`}}/></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{setupChecks.map((item)=><div key={item.label} className="flex items-center gap-2 text-xs text-white/65">{item.done?<CheckCircle2 className="size-4 text-[#ffca28]"/>:<Circle className="size-4 text-white/20"/>}{item.label}</div>)}</div></div></div></AdminSurface><AdminStatGrid><AdminStat label="Receita atribuída" value={formatMoney(metrics.data?.attributedRevenue??0)}/><AdminStat label="Conversões" value={metrics.data?.conversions??0}/><AdminStat label="Taxa de conversão" value={`${metrics.data?.conversionRate??0}%`}/><AdminStat label="Automações ativas" value={metrics.data?.activeJourneys??0}/></AdminStatGrid><div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]"><AdminSurface><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Próximas ações sugeridas</h3><p className="text-sm text-muted-foreground">Recomendações calculadas com os dados reais da loja.</p></div><Button size="sm" variant="outline" onClick={()=>generate.mutate({storeId})} disabled={generate.isPending}><Sparkles className="size-4"/>Analisar</Button></div><div className="mt-4 space-y-3">{uniqueSuggestions.length?uniqueSuggestions.map((item)=><div key={item.id} className="rounded-2xl border p-4"><div className="flex items-start gap-3"><Bot className="mt-0.5 size-5 shrink-0 text-[#6e0d12]"/><div className="min-w-0 flex-1"><strong>{item.title}</strong><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><div className="mt-3 flex flex-wrap items-center gap-2"><AdminPill>Confiança {item.confidence}%</AdminPill><button className="text-xs font-bold text-[#6e0d12]" disabled={updateSuggestion.isPending} onClick={()=>updateSuggestion.mutate({storeId,id:item.id,status:"applied"})}>Marcar como feita</button><button className="text-xs font-bold text-muted-foreground" disabled={updateSuggestion.isPending} onClick={()=>updateSuggestion.mutate({storeId,id:item.id,status:"dismissed"})}>Descartar</button></div></div></div></div>):<AdminEmptyState title="Nenhuma recomendação pendente" description="Clique em Analisar para gerar um novo diagnóstico."/>}</div></AdminSurface><AdminSurface><h3 className="font-black">Saúde da base</h3><div className="mt-4 space-y-4">{[["Pedidos em 30 dias",Number(summary?.totalOrders??0)],["Ticket médio",formatMoney(Number(summary?.averageTicket??0))],["Tempo de cozinha",`${Number(summary?.averageKitchenMinutes??0)} min`],["Cancelamentos",Number(summary?.cancelledOrders??0)]].map(([label,value])=><div key={String(label)} className="flex items-center justify-between border-b pb-3 text-sm"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>)}</div></AdminSurface></div></div>}

    {section==="audiences"&&<div className="grid gap-4 lg:grid-cols-3"><AdminSurface className="lg:col-span-2"><div className="flex items-center justify-between"><div><h3 className="font-black">Públicos automáticos</h3><p className="text-sm text-muted-foreground">Segmentos atualizados pelo comportamento de compra.</p></div><AdminPill>{audienceMap.size} públicos</AdminPill></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{Array.from(audienceMap.entries()).map(([tag,members])=><div key={tag} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><strong className="capitalize">{tag.replaceAll("_"," ")}</strong><span className="text-xl font-black">{members.size}</span></div><p className="mt-2 text-xs text-muted-foreground">Clientes atualizados automaticamente</p></div>)}</div>{!audienceMap.size&&<AdminEmptyState title="Base ainda sem segmentação" description="Atualize as tags na área de automações para formar os primeiros públicos."/>}</AdminSurface><AdminSurface><Rocket className="size-8 text-[#6e0d12]"/><h3 className="mt-4 font-black">Público útil gera ação</h3><p className="mt-2 text-sm text-muted-foreground">Escolha um segmento e use-o em uma jornada. Não criamos listas sem uma finalidade comercial.</p><Button className="mt-5 w-full" onClick={()=>navigate("/automacoes")}>Gerenciar públicos<ArrowRight className="size-4"/></Button></AdminSurface></div>}

    {section==="campaigns"&&<AdminSurface><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Campanhas e jornadas</h3><p className="text-sm text-muted-foreground">Ative, pause e acompanhe cada jornada sem sair desta central.</p></div><Button onClick={()=>navigate("/automacoes")}><Megaphone className="size-4"/>Editor avançado</Button></div><div className="mt-5 overflow-hidden rounded-2xl border">{journeys.data?.map((journey)=><div key={journey.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><div className="flex items-center gap-2"><strong>{journey.name}</strong><AdminPill>{journey.status==="active"?"Ativa":journey.status==="paused"?"Pausada":"Rascunho"}</AdminPill></div><p className="mt-1 text-xs text-muted-foreground">{journey.trigger} · {journey.steps.length} etapas</p></div><Button size="sm" variant={journey.status==="active"?"outline":"default"} disabled={toggleJourney.isPending} onClick={()=>toggleJourney.mutate({id:journey.id,storeId,status:journey.status==="active"?"paused":"active"})}>{journey.status==="active"?<><Pause className="size-4"/>Pausar</>:<><Play className="size-4"/>Ativar</>}</Button></div>)}</div>{!journeys.data?.length&&<AdminEmptyState title="Nenhuma campanha criada" description="Comece com uma automação pronta ou crie uma jornada personalizada."/>}</AdminSurface>}

    {section==="automations"&&<div className="grid gap-4 md:grid-cols-2">{templates.map((template)=>{const existing=journeys.data?.find((journey)=>journey.trigger===template.trigger);return <AdminSurface key={template.key}><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-[#6e0d12]/10 text-[#6e0d12]"><Zap className="size-5"/></div><AdminPill>{existing?"Já configurada":"Modelo pronto"}</AdminPill></div><h3 className="mt-5 text-lg font-black">{template.title}</h3><p className="mt-2 text-sm text-muted-foreground">{template.description}</p><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600"/>{template.steps.length} etapas configuradas</div><Button className="mt-5 w-full" variant={existing?"outline":"default"} disabled={createJourney.isPending} onClick={()=>existing?setSection("campaigns"):createJourney.mutate({storeId,name:template.title,description:template.description,trigger:template.trigger,steps:template.steps})}>{existing?"Gerenciar automação":"Criar como rascunho"}</Button></AdminSurface>})}</div>}

    {section==="results"&&<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><AdminSurface><h3 className="font-black">Desempenho por jornada</h3><div className="mt-4 space-y-3">{metrics.data?.topJourneys.map((item)=>{const rate=item.executions>0?Math.round((item.conversions/item.executions)*100):0;return <div key={item.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><strong>{item.name}</strong><AdminPill>{item.executions} execuções</AdminPill></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6e0d12]" style={{width:`${Math.min(100,rate)}%`}}/></div><p className="mt-2 text-xs text-muted-foreground">{item.conversions} conversões · {rate}%</p></div>})}</div>{!metrics.data?.topJourneys.length&&<AdminEmptyState title="Ainda não há resultados" description="Os dados aparecem depois que uma jornada começar a executar."/>}</AdminSurface><AdminSurface><Activity className="size-7 text-[#6e0d12]"/><h3 className="mt-4 font-black">Resumo do mês</h3><div className="mt-5 space-y-4">{[["Execuções",metrics.data?.totalExecutions??0],["Concluídas",metrics.data?.completedExecutions??0],["Conversões",metrics.data?.conversions??0],["Receita",formatMoney(metrics.data?.attributedRevenue??0)]].map(([label,value])=><div key={String(label)} className="flex justify-between border-b pb-3 text-sm"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>)}</div></AdminSurface></div>}
  </AdminPage>;
}

