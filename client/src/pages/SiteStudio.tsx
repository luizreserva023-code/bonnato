import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  History,
  Layers3,
  Maximize2,
  Minimize2,
  Monitor,
  PanelLeft,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SiteBlockRenderer } from "@/features/site-studio/SiteBlockRenderer";
import { StudioLeftPanel } from "@/features/site-studio/StudioLeftPanel";
import { siteThemeStyle } from "@/features/site-studio/siteTheme";
import { createTemplateDocument, type StudioTemplate } from "@/features/site-studio/studioTemplates";
import { longTextProperties, pageOptions, propertyLabels } from "@/features/site-studio/studioMeta";
import {
  DEFAULT_HOME_DOCUMENT,
  SITE_BLOCK_LABELS,
  createSiteBlock,
  parseSiteDocument,
  type SiteBlock,
  type SiteBlockType,
  type SitePageDocument,
  type SitePageKey,
  type SiteTheme,
} from "@shared/siteBuilder";

type Device = "desktop" | "tablet" | "mobile";
type InspectorPanel = "content" | "design";

const deviceWidths: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
const deviceLabels: Record<Device, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Celular" };

function ResponsiveBlockControls({ block, device, onChange }: { block: SiteBlock; device: Device; onChange: (block: SiteBlock) => void }) {
  const setting = block.responsive?.[device] ?? {};
  return (
    <div className="space-y-3 border-t pt-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[.14em] text-[#a30f15]">Ajustes para {deviceLabels[device]}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-black/40">Estas opções afetam somente este tamanho de tela.</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2.5">
        <div><p className="text-xs font-bold">Exibir bloco</p><p className="text-[10px] text-black/40">Oculte conteúdos menos importantes.</p></div>
        <Switch checked={!setting.hidden} onCheckedChange={(checked) => onChange({ ...block, responsive: { ...block.responsive, [device]: { ...setting, hidden: !checked } } })} />
      </div>
      <div>
        <Label className="text-[11px] font-bold text-black/55">Espaçamento vertical</Label>
        <select className="mt-1.5 h-9 w-full rounded-lg border bg-white px-2 text-xs" value={setting.spacing ?? block.style.spacing} onChange={(event) => onChange({ ...block, responsive: { ...block.responsive, [device]: { ...setting, spacing: event.target.value as SiteBlock["style"]["spacing"] } } })}>
          <option value="compact">Compacto</option>
          <option value="normal">Normal</option>
          <option value="wide">Amplo</option>
        </select>
      </div>
    </div>
  );
}

function localDraftKey(storeId: number, pageKey: SitePageKey) {
  return `bonatto-studio:${storeId}:${pageKey}`;
}

function readLocalDraft(storeId: number, pageKey: SitePageKey): SitePageDocument {
  try {
    const value = localStorage.getItem(localDraftKey(storeId, pageKey));
    return value ? parseSiteDocument(JSON.parse(value)) : DEFAULT_HOME_DOCUMENT;
  } catch {
    return DEFAULT_HOME_DOCUMENT;
  }
}

function StudioLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-[#171311] text-white"><div className="text-center"><span className="mx-auto block size-8 animate-spin rounded-full border-2 border-white/15 border-t-[#e51b23]"/><p className="mt-4 text-sm font-bold text-white/55">Preparando seu espaço de criação</p></div></div>;
}

export default function SiteStudio() {
  const { loading: authLoading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login?returnTo=%2Fstudio" });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const sites = trpc.siteStudio.mySites.useQuery();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [pageKey, setPageKey] = useState<SitePageKey>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const [inspectorPanel, setInspectorPanel] = useState<InspectorPanel>("content");
  const [zoom, setZoom] = useState(85);
  const [focusMode, setFocusMode] = useState(false);
  const [document, setDocument] = useState<SitePageDocument | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [title, setTitle] = useState("Página inicial");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SitePageDocument[]>([]);
  const [future, setFuture] = useState<SitePageDocument[]>([]);

  useEffect(() => {
    if (!storeId && sites.data?.length) setStoreId(sites.data[0].id);
  }, [sites.data, storeId]);

  const workspace = trpc.siteStudio.workspace.useQuery(
    { storeId: storeId ?? 0, pageKey },
    { enabled: Boolean(storeId), retry: false },
  );
  const localMode = Boolean(storeId && workspace.isError);

  useEffect(() => {
    if (!workspace.data) return;
    const next = workspace.data.draft;
    setDocument(next);
    setSavedSnapshot(JSON.stringify(next));
    setTitle(workspace.data.title);
    setSelectedId(next.blocks[0]?.id ?? null);
    setHistory([]);
    setFuture([]);
  }, [workspace.data]);

  useEffect(() => {
    if (!localMode || !storeId) return;
    const next = readLocalDraft(storeId, pageKey);
    setDocument(next);
    setSavedSnapshot(JSON.stringify(next));
    setTitle(pageOptions.find((item) => item.value === pageKey)?.label ?? "Página");
    setSelectedId(next.blocks[0]?.id ?? null);
    setHistory([]);
    setFuture([]);
  }, [localMode, pageKey, storeId]);

  const save = trpc.siteStudio.saveDraft.useMutation({
    onSuccess: async () => {
      await utils.siteStudio.workspace.invalidate();
      toast.success("Rascunho salvo");
    },
    onError: (error) => toast.error(error.message),
  });
  const publish = trpc.siteStudio.publish.useMutation({
    onSuccess: async (result) => {
      await utils.siteStudio.workspace.invalidate();
      toast.success(`Versão ${result.versionNumber} publicada`);
    },
    onError: (error) => toast.error(error.message),
  });
  const restore = trpc.siteStudio.restore.useMutation({
    onSuccess: async () => {
      await utils.siteStudio.workspace.invalidate();
      toast.success("Versão restaurada como rascunho");
    },
    onError: (error) => toast.error(error.message),
  });

  const dirty = Boolean(document && JSON.stringify(document) !== savedSnapshot);
  const selected = document?.blocks.find((block) => block.id === selectedId) ?? null;

  function commit(next: SitePageDocument) {
    if (document) setHistory((items) => [...items.slice(-29), document]);
    setFuture([]);
    setDocument(next);
  }

  function updateBlock(id: string, updater: (block: SiteBlock) => SiteBlock) {
    if (!document) return;
    commit({ ...document, blocks: document.blocks.map((block) => block.id === id ? updater(block) : block) });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous || !document) return;
    setFuture((items) => [document, ...items]);
    setDocument(previous);
    setHistory((items) => items.slice(0, -1));
  }

  function redo() {
    const next = future[0];
    if (!next || !document) return;
    setHistory((items) => [...items, document]);
    setDocument(next);
    setFuture((items) => items.slice(1));
  }

  function addBlock(type: SiteBlockType) {
    if (!document) return;
    const block = createSiteBlock(type);
    commit({ ...document, blocks: [...document.blocks, block] });
    setSelectedId(block.id);
    setInspectorPanel("content");
  }

  function updateTheme(patch: Partial<SiteTheme>) {
    if (!document) return;
    commit({ ...document, theme: { ...document.theme, ...patch } });
  }

  function applyTemplate(template: StudioTemplate) {
    if (!document) return;
    const next = createTemplateDocument(template.id);
    commit(next);
    setSelectedId(next.blocks[0]?.id ?? null);
    setInspectorPanel("content");
    toast.success(`Template “${template.name}” aplicado`);
  }

  function useMedia(url: string) {
    if (!document) return;
    const target = selected && Object.hasOwn(selected.props, "imageUrl")
      ? selected
      : document.blocks.find((block) => Object.hasOwn(block.props, "imageUrl"));
    if (target) {
      updateBlock(target.id, (block) => ({ ...block, props: { ...block.props, imageUrl: url } }));
      setSelectedId(target.id);
      toast.success("Imagem aplicada ao destaque");
      return;
    }
    const hero = createSiteBlock("hero");
    hero.props.imageUrl = url;
    commit({ ...document, blocks: [hero, ...document.blocks] });
    setSelectedId(hero.id);
    toast.success("Destaque criado com a imagem selecionada");
  }

  function duplicateBlock(block: SiteBlock) {
    if (!document) return;
    const clone = { ...block, id: `${block.type}-${Date.now()}`, props: { ...block.props }, style: { ...block.style }, responsive: { desktop: { ...block.responsive?.desktop }, tablet: { ...block.responsive?.tablet }, mobile: { ...block.responsive?.mobile } } };
    const index = document.blocks.findIndex((item) => item.id === block.id);
    const blocks = [...document.blocks];
    blocks.splice(index + 1, 0, clone);
    commit({ ...document, blocks });
    setSelectedId(clone.id);
  }

  function removeBlock(id: string) {
    if (!document) return;
    const index = document.blocks.findIndex((block) => block.id === id);
    const blocks = document.blocks.filter((block) => block.id !== id);
    commit({ ...document, blocks });
    setSelectedId(blocks[Math.min(index, blocks.length - 1)]?.id ?? null);
  }

  function dropOn(targetId: string) {
    if (!document || !draggedId || draggedId === targetId) return;
    const blocks = [...document.blocks];
    const from = blocks.findIndex((item) => item.id === draggedId);
    const to = blocks.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    commit({ ...document, blocks });
    setDraggedId(null);
  }

  async function handleSave() {
    if (!document || !storeId) return;
    if (localMode) {
      localStorage.setItem(localDraftKey(storeId, pageKey), JSON.stringify(document));
      setSavedSnapshot(JSON.stringify(document));
      toast.success("Rascunho salvo neste navegador");
      return;
    }
    await save.mutateAsync({ storeId, pageKey, title, document });
    setSavedSnapshot(JSON.stringify(document));
  }

  async function handlePublish() {
    if (!document || !storeId || localMode) return;
    if (dirty) await handleSave();
    publish.mutate({ storeId, pageKey, note: "Publicação pelo Studio" });
  }

  if (authLoading || sites.isLoading) return <StudioLoading />;
  if (sites.isError || sites.data?.length === 0) return <div className="grid min-h-[100dvh] place-items-center bg-[#171311] p-6 text-center text-white"><div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e51b23]"><Layers3 className="size-6"/></div><h1 className="mt-6 text-3xl font-black uppercase tracking-[-.04em]">Studio indisponível</h1><p className="mt-3 text-sm leading-relaxed text-white/55">Sua conta ainda não recebeu acesso de editor para uma marca.</p><Button className="mt-6 bg-white text-black hover:bg-white/90" onClick={() => navigate("/admin")}>Voltar ao painel</Button></div></div>;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#171311] text-[#211b18]">
      <header className="relative z-30 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1d1816] px-3 py-2 text-white sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => navigate("/admin")} className="grid size-9 shrink-0 place-items-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white active:scale-[.97]" aria-label="Voltar"><ArrowLeft className="size-4"/></button>
          <div className="hidden h-6 w-px bg-white/10 sm:block"/>
          <div className="hidden items-center gap-2 sm:flex"><span className="grid size-8 place-items-center rounded-lg bg-[#e51b23] text-xs font-black">B</span><strong className="text-xs uppercase tracking-[.18em]">Studio</strong></div>
          <label className="relative ml-1"><span className="sr-only">Loja</span><select className="h-9 max-w-44 appearance-none rounded-xl border border-white/10 bg-white/[.06] py-0 pl-3 pr-8 text-xs font-bold outline-none transition-colors hover:bg-white/10 focus:border-white/30" value={storeId ?? ""} onChange={(event) => setStoreId(Number(event.target.value))}>{sites.data?.map((site) => <option className="text-black" key={site.id} value={site.id}>{site.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-white/40"/></label>
          <label className="relative"><span className="sr-only">Página</span><select className="h-9 max-w-40 appearance-none rounded-xl border border-white/10 bg-white/[.06] py-0 pl-3 pr-8 text-xs font-bold outline-none transition-colors hover:bg-white/10 focus:border-white/30" value={pageKey} onChange={(event) => setPageKey(event.target.value as SitePageKey)}>{pageOptions.map((page) => <option className="text-black" key={page.value} value={page.value}>{page.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-white/40"/></label>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1 rounded-xl bg-black/20 p-1 md:flex"><button type="button" className="grid size-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25" disabled={!history.length} onClick={undo} aria-label="Desfazer"><Undo2 className="size-4"/></button><button type="button" className="grid size-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25" disabled={!future.length} onClick={redo} aria-label="Refazer"><Redo2 className="size-4"/></button></div>
          <div className="hidden rounded-xl bg-black/20 p-1 sm:flex">{(["desktop","tablet","mobile"] as Device[]).map((item) => { const Icon = item === "desktop" ? Monitor : item === "tablet" ? Tablet : Smartphone; return <button type="button" key={item} title={deviceLabels[item]} onClick={() => setDevice(item)} className={`grid size-8 place-items-center rounded-lg transition-colors ${device === item ? "bg-white text-black" : "text-white/45 hover:text-white"}`}><Icon className="size-4"/></button>; })}</div>
          <button type="button" onClick={()=>setFocusMode((value)=>!value)} title={focusMode?"Sair da apresentação":"Apresentar sem painéis"} className={`hidden size-9 place-items-center rounded-xl transition-colors md:grid ${focusMode?"bg-white text-black":"text-white/45 hover:bg-white/10 hover:text-white"}`}>{focusMode?<Minimize2 className="size-4"/>:<Maximize2 className="size-4"/>}</button>
          <span className={`hidden items-center gap-1.5 px-2 text-[10px] font-bold lg:inline-flex ${dirty ? "text-[#ffca28]" : "text-white/40"}`}>{dirty ? <span className="size-1.5 rounded-full bg-[#ffca28]"/> : <Check className="size-3"/>}{dirty ? "Não salvo" : "Salvo"}</span>
          <Button variant="outline" size="sm" className="border-white/12 bg-transparent text-white hover:bg-white/10 hover:text-white" disabled={!document || save.isPending} onClick={handleSave}><Save className="size-4"/><span className="hidden sm:inline">Salvar</span></Button>
          <Button size="sm" title={localMode ? "Disponível após ativar o banco do Studio" : "Publicar alterações"} className="bg-[#e51b23] text-white hover:bg-[#c9141c] disabled:bg-white/10 disabled:text-white/30" disabled={!document || publish.isPending || localMode} onClick={handlePublish}><Upload className="size-4"/><span className="hidden sm:inline">Publicar</span></Button>
        </div>
      </header>

      {localMode && <div className="relative z-20 flex min-h-10 items-center justify-center gap-2 bg-[#ffca28] px-4 py-2 text-center text-[11px] font-bold text-[#2a1c00]"><span className="size-1.5 rounded-full bg-[#2a1c00]"/>Modo de demonstração: seus rascunhos ficam salvos neste navegador. A publicação continua protegida.</div>}

      <div className={`grid min-h-0 flex-1 ${focusMode?"grid-cols-1":"lg:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(540px,1fr)_320px]"}`}>
        {!focusMode&&<StudioLeftPanel document={document} selectedId={selectedId} draggedId={draggedId} onAddBlock={addBlock} onApplyTemplate={applyTemplate} onThemeChange={updateTheme} onUseMedia={useMedia} onSelect={setSelectedId} onToggleVisibility={(id)=>updateBlock(id,(block)=>({...block,visible:!block.visible}))} onDragStart={setDraggedId} onDragEnd={()=>setDraggedId(null)} onDrop={dropOn}/>} 

        <main className="relative min-h-0 overflow-auto bg-[#d8d2cc] px-3 py-5 sm:px-6 sm:py-8">
          <div className="pointer-events-none absolute inset-0 opacity-[.18]" style={{ backgroundImage: "radial-gradient(#645952 1px, transparent 1px)", backgroundSize: "18px 18px" }}/>
          <div className="relative mx-auto origin-top transition-[width,zoom] duration-300 [transition-timing-function:cubic-bezier(.23,1,.32,1)]" style={{ width: deviceWidths[device], maxWidth: "100%", zoom: `${zoom}%` }}>
            <div data-studio-device={device} className={`overflow-hidden border border-black/10 bg-[var(--site-surface)] shadow-[0_28px_70px_rgba(69,44,30,.20)] ${device === "mobile" ? "rounded-[2.5rem] border-[6px] border-[#211c19]" : "rounded-2xl"}`} style={document?siteThemeStyle(document.theme):undefined}>
              <div className={`flex h-10 items-center justify-between border-b border-black/[.07] bg-white px-4 ${device === "mobile" ? "pt-1" : ""}`}><div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--site-primary)]"/><span className="size-2 rounded-full bg-[var(--site-accent)]"/><span className="size-2 rounded-full bg-black/15"/></div><span className="text-[9px] font-black uppercase tracking-[.16em] text-black/30">{pageOptions.find((page) => page.value === pageKey)?.label} · {deviceLabels[device]}</span><span className="size-4"/></div>
              {workspace.isLoading && !document ? <div className="grid h-[32rem] place-items-center"><span className="size-7 animate-spin rounded-full border-2 border-black/10 border-t-[#e51b23]"/></div> : <div className="space-y-2 p-1 sm:p-2">{document?.blocks.map((block) => <div key={block.id} onClick={() => setSelectedId(block.id)} className={`group relative cursor-pointer rounded-[2.1rem] outline outline-2 outline-offset-[-2px] transition-[outline-color,opacity] duration-150 ${selectedId === block.id ? "outline-[var(--site-primary)]" : "outline-transparent hover:outline-[#e51b23]/30"}`}><SiteBlockRenderer block={block} editing/><span className={`pointer-events-none absolute left-3 top-3 rounded-lg bg-[#171311] px-2 py-1 text-[9px] font-bold text-white shadow-lg transition-opacity ${selectedId === block.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>{SITE_BLOCK_LABELS[block.type]}</span></div>)}</div>}
            </div>
          </div>
          <div className="sticky bottom-4 z-20 mx-auto mt-6 flex w-fit items-center gap-1 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-[0_12px_35px_rgba(40,25,18,.16)] backdrop-blur"><button type="button" aria-label="Diminuir zoom" onClick={()=>setZoom((value)=>Math.max(50,value-10))} className="grid size-8 place-items-center rounded-xl text-black/45 hover:bg-black/5 hover:text-black"><ZoomOut className="size-4"/></button><button type="button" onClick={()=>setZoom(100)} className="min-w-12 rounded-lg px-2 py-1 text-[10px] font-black tabular-nums text-black/55 hover:bg-black/5">{zoom}%</button><button type="button" aria-label="Aumentar zoom" onClick={()=>setZoom((value)=>Math.min(130,value+10))} className="grid size-8 place-items-center rounded-xl text-black/45 hover:bg-black/5 hover:text-black"><ZoomIn className="size-4"/></button></div>
        </main>

        {!focusMode&&<aside className="hidden min-h-0 overflow-y-auto border-l border-black/10 bg-[#faf8f6] xl:block">
          <div className="sticky top-0 z-10 border-b bg-[#faf8f6] px-5 py-4"><div className="flex items-center gap-2"><PanelLeft className="size-4 text-[#e51b23]"/><strong className="text-sm">Propriedades</strong></div><div className="mt-4 grid grid-cols-2 rounded-xl bg-black/[.045] p-1"><button type="button" onClick={() => setInspectorPanel("content")} className={`rounded-lg py-2 text-[11px] font-bold transition-colors ${inspectorPanel === "content" ? "bg-white shadow-sm" : "text-black/40"}`}>Conteúdo</button><button type="button" onClick={() => setInspectorPanel("design")} className={`rounded-lg py-2 text-[11px] font-bold transition-colors ${inspectorPanel === "design" ? "bg-white shadow-sm" : "text-black/40"}`}>Design</button></div></div>

          <div className="p-5">
            {selected && inspectorPanel === "design" ? <ResponsiveBlockControls block={selected} device={device} onChange={(next) => updateBlock(selected.id, () => next)} /> : null}
            {!selected ? <div className="py-16 text-center"><Layers3 className="mx-auto size-7 text-black/20"/><p className="mt-3 text-sm font-bold text-black/55">Selecione um bloco</p><p className="mt-1 text-xs leading-relaxed text-black/35">As opções de conteúdo e estilo aparecerão aqui.</p></div> : <div className="space-y-6"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{SITE_BLOCK_LABELS[selected.type]}</p><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-black/35">Bloco selecionado</p></div><Switch checked={selected.visible} onCheckedChange={(visible) => updateBlock(selected.id, (block) => ({ ...block, visible }))}/></div>

              {inspectorPanel === "content" ? <div className="space-y-4 border-t pt-5">{Object.entries(selected.props).map(([key, value]) => <div key={key}><Label className="text-[11px] font-bold text-black/55">{propertyLabels[key] ?? key.replace(/([A-Z])/g," $1")}</Label>{typeof value === "boolean" ? <div className="mt-2 flex items-center justify-between rounded-xl border bg-white px-3 py-2.5"><span className="text-xs text-black/50">{value ? "Ativado" : "Desativado"}</span><Switch checked={value} onCheckedChange={(checked) => updateBlock(selected.id, (block) => ({ ...block, props: { ...block.props, [key]: checked } }))}/></div> : longTextProperties.has(key) ? <Textarea className="mt-1.5 min-h-24 resize-none bg-white text-sm" value={String(value)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, props: { ...block.props, [key]: event.target.value } }))}/> : <Input className="mt-1.5 bg-white text-sm" type={typeof value === "number" ? "number" : "text"} min={typeof value === "number" ? 1 : undefined} max={typeof value === "number" ? 20 : undefined} value={String(value)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, props: { ...block.props, [key]: typeof value === "number" ? Number(event.target.value) : event.target.value } }))}/>}</div>)}</div> : <div className="space-y-5 border-t pt-5"><div><Label className="text-[11px] font-bold text-black/55">Cor de fundo</Label><div className="mt-1.5 flex gap-2"><input aria-label="Selecionar cor de fundo" type="color" value={selected.style.background === "transparent" ? "#f8f3ee" : selected.style.background} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, background: event.target.value } }))} className="h-9 w-11 cursor-pointer rounded-lg border bg-white p-1"/><Input value={selected.style.background} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, background: event.target.value } }))} className="bg-white text-xs"/></div></div><div><Label className="text-[11px] font-bold text-black/55">Cor do texto</Label><div className="mt-1.5 flex gap-2"><input aria-label="Selecionar cor do texto" type="color" value={selected.style.color === "inherit" ? "#211b18" : selected.style.color} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, color: event.target.value } }))} className="h-9 w-11 cursor-pointer rounded-lg border bg-white p-1"/><Input value={selected.style.color} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, color: event.target.value } }))} className="bg-white text-xs"/></div></div><div className="grid grid-cols-2 gap-3"><div><Label className="text-[11px] font-bold text-black/55">Espaçamento</Label><select className="mt-1.5 h-9 w-full rounded-lg border bg-white px-2 text-xs" value={selected.style.spacing} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, spacing: event.target.value as SiteBlock["style"]["spacing"] } }))}><option value="compact">Compacto</option><option value="normal">Normal</option><option value="wide">Amplo</option></select></div><div><Label className="text-[11px] font-bold text-black/55">Cantos</Label><select className="mt-1.5 h-9 w-full rounded-lg border bg-white px-2 text-xs" value={selected.style.radius} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, style: { ...block.style, radius: event.target.value as SiteBlock["style"]["radius"] } }))}><option value="none">Reto</option><option value="medium">Médio</option><option value="large">Grande</option></select></div></div><button type="button" onClick={() => updateBlock(selected.id, (block) => ({ ...block, style: { background: "transparent", color: "inherit", spacing: "normal", radius: "large" } }))} className="text-xs font-bold text-[#a30f15]">Restaurar estilo padrão</button></div>}

              <div className="grid grid-cols-[1fr_auto] gap-2 border-t pt-5"><Button variant="outline" className="bg-white" onClick={() => duplicateBlock(selected)}><Copy className="size-4"/>Duplicar</Button><Button variant="outline" aria-label="Excluir bloco" className="bg-white text-red-600 hover:text-red-700" onClick={() => removeBlock(selected.id)}><Trash2 className="size-4"/></Button></div>
            </div>}

            <div className="mt-8 border-t pt-6"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><History className="size-4 text-[#e51b23]"/><strong className="text-xs">Histórico</strong></div><span className="text-[9px] font-bold uppercase tracking-[.14em] text-black/30">Publicações</span></div><div className="mt-3 space-y-2">{workspace.data?.versions.map((version) => <div key={version.id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-xs"><div><span className="font-bold">Versão {version.versionNumber}</span><p className="mt-0.5 text-[9px] text-black/35">Cópia segura</p></div><button type="button" className="font-bold text-[#a30f15]" onClick={() => storeId && restore.mutate({ storeId, pageKey, versionId: version.id })}>Restaurar</button></div>)}{localMode && <p className="rounded-xl bg-[#ffca28]/25 p-3 text-[10px] leading-relaxed text-[#4b3600]">O histórico será ativado junto com a publicação no banco.</p>}</div></div>
          </div>
        </aside>}
      </div>
    </div>
  );
}
