import { useState } from "react";
import { ImageIcon, Layers3, LayoutTemplate, Palette, Plus, GripVertical, Eye, EyeOff } from "lucide-react";
import { SITE_BLOCK_LABELS, type SiteBlock, type SiteBlockType, type SitePageDocument, type SiteTheme } from "@shared/siteBuilder";
import { blockGroups } from "./studioMeta";
import { studioMedia } from "./studioMedia";
import { studioTemplates, type StudioTemplate } from "./studioTemplates";

type Panel = "templates" | "blocks" | "brand" | "media" | "layers";

const tabs = [
  { id: "templates" as const, label: "Templates", icon: LayoutTemplate },
  { id: "blocks" as const, label: "Blocos", icon: Plus },
  { id: "brand" as const, label: "Marca", icon: Palette },
  { id: "media" as const, label: "Mídia", icon: ImageIcon },
  { id: "layers" as const, label: "Camadas", icon: Layers3 },
];

const quickPalettes: Array<{ name: string; colors: [string, string, string]; theme: Partial<SiteTheme> }> = [
  { name: "Bonatto", colors: ["#e51b23", "#ffc900", "#171311"], theme: { primary: "#e51b23", accent: "#ffc900", dark: "#171311", surface: "#fff9f2", text: "#211814" } },
  { name: "Editorial", colors: ["#191714", "#d3ff36", "#f5efe5"], theme: { primary: "#191714", accent: "#d3ff36", dark: "#0b0b0a", surface: "#f5efe5", text: "#191714" } },
  { name: "Noturna", colors: ["#ff3d2e", "#ffd54a", "#10100f"], theme: { primary: "#ff3d2e", accent: "#ffd54a", dark: "#10100f", surface: "#f6f0e7", text: "#17120f" } },
];

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] font-bold text-white/45">{label}</span><span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] p-2"><input type="color" value={value} onChange={(event)=>onChange(event.target.value)} className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"/><input value={value} onChange={(event)=>onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] font-bold uppercase text-white/75 outline-none"/></span></label>;
}

export function StudioLeftPanel({
  document,
  selectedId,
  draggedId,
  onAddBlock,
  onApplyTemplate,
  onThemeChange,
  onUseMedia,
  onSelect,
  onToggleVisibility,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  document: SitePageDocument | null;
  selectedId: string | null;
  draggedId: string | null;
  onAddBlock: (type: SiteBlockType) => void;
  onApplyTemplate: (template: StudioTemplate) => void;
  onThemeChange: (patch: Partial<SiteTheme>) => void;
  onUseMedia: (url: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>("templates");
  const theme = document?.theme;

  return <aside className="hidden min-h-0 overflow-hidden border-r border-white/10 bg-[#211c19] text-white lg:flex lg:flex-col">
    <nav className="grid shrink-0 grid-cols-5 border-b border-white/10 bg-[#1b1715] p-1.5" aria-label="Ferramentas do Studio">{tabs.map(({id,label,icon:Icon})=><button type="button" key={id} title={label} onClick={()=>setPanel(id)} className={`grid min-h-12 place-items-center rounded-xl px-1 text-[8px] font-bold transition-colors ${panel===id?"bg-white text-black":"text-white/38 hover:bg-white/5 hover:text-white"}`}><Icon className="size-4"/><span>{label}</span></button>)}</nav>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {panel==="templates"&&<div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">Comece com uma direção</p><p className="mt-1 text-[10px] leading-relaxed text-white/30">Troque a página inteira e personalize depois. Você pode desfazer.</p><div className="mt-4 space-y-3">{studioTemplates.map((template)=><button type="button" key={template.id} disabled={!document} onClick={()=>onApplyTemplate(template)} className="group w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-white/30 active:scale-[.99] disabled:pointer-events-none disabled:opacity-35"><span className="relative block h-28 overflow-hidden p-3" style={{background:template.colors[0]}}><span className="absolute -right-8 -top-8 size-24 rounded-full" style={{background:template.colors[1]}}/><span className="absolute bottom-3 left-3 h-2 w-20 rounded-full" style={{background:template.colors[2]}}/><span className="absolute bottom-7 left-3 h-5 w-32 rounded-sm bg-white/90"/><span className="absolute right-3 top-3 rounded bg-black/35 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">{template.recommended?"Recomendado":"Template"}</span></span><span className="block p-3"><strong className="text-xs text-white/85">{template.name}</strong><span className="mt-1 block text-[9px] leading-relaxed text-white/35">{template.description}</span></span></button>)}</div></div>}

      {panel==="blocks"&&<div className="space-y-7 p-4">{blockGroups.map((group)=><section key={group.label}><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">{group.label}</p><p className="mt-1 text-[10px] leading-relaxed text-white/30">{group.description}</p><div className="mt-3 grid grid-cols-2 gap-2">{group.blocks.map(({type,icon:Icon})=><button type="button" key={type} onClick={()=>onAddBlock(type)} className="group min-h-24 rounded-2xl border border-white/[.08] bg-white/[.035] p-3 text-left transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#e51b23]/60 hover:bg-white/[.07] active:scale-[.98]"><span className="grid size-8 place-items-center rounded-xl bg-[#e51b23]/12 text-[#ff3941]"><Icon className="size-4"/></span><span className="mt-3 block text-[11px] font-bold leading-tight text-white/75 group-hover:text-white">{SITE_BLOCK_LABELS[type]}</span></button>)}</div></section>)}</div>}

      {panel==="brand"&&theme&&<div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">Kit de marca</p>
        <p className="mt-1 text-[10px] leading-relaxed text-white/30">Essas escolhas atualizam toda a página de uma vez.</p>
        <div className="mt-5">
          <p className="text-[10px] font-bold text-white/45">Paletas rápidas</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {quickPalettes.map((palette)=><button key={palette.name} type="button" onClick={()=>onThemeChange(palette.theme)} className="rounded-xl border border-white/10 bg-white/[.04] p-2 text-left transition-colors hover:border-white/30" title={`Aplicar paleta ${palette.name}`}><span className="flex overflow-hidden rounded-md">{palette.colors.map((color)=><span key={color} className="h-5 flex-1" style={{background:color}}/>)}</span><span className="mt-1.5 block truncate text-[8px] font-bold text-white/55">{palette.name}</span></button>)}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <ColorControl label="Cor principal" value={theme.primary} onChange={(primary)=>onThemeChange({primary})}/>
          <ColorControl label="Cor de destaque" value={theme.accent} onChange={(accent)=>onThemeChange({accent})}/>
          <ColorControl label="Fundo claro" value={theme.surface} onChange={(surface)=>onThemeChange({surface})}/>
          <ColorControl label="Fundo escuro" value={theme.dark} onChange={(dark)=>onThemeChange({dark})}/>
          <ColorControl label="Texto" value={theme.text} onChange={(text)=>onThemeChange({text})}/>
        </div>
        <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
          <label className="block text-[10px] font-bold text-white/45">Fonte dos títulos<select value={theme.headingFont} onChange={(event)=>onThemeChange({headingFont:event.target.value as SiteTheme["headingFont"]})} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[.06] px-3 text-xs text-white outline-none"><option className="text-black" value="brand">Bonatto condensada</option><option className="text-black" value="modern">Moderna</option><option className="text-black" value="classic">Clássica</option></select></label>
          <label className="block text-[10px] font-bold text-white/45">Fonte dos textos<select value={theme.bodyFont} onChange={(event)=>onThemeChange({bodyFont:event.target.value as SiteTheme["bodyFont"]})} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[.06] px-3 text-xs text-white outline-none"><option className="text-black" value="brand">Bonatto</option><option className="text-black" value="modern">Moderna</option><option className="text-black" value="friendly">Amigável</option></select></label>
          <label className="block text-[10px] font-bold text-white/45">Estilo dos botões<select value={theme.buttonStyle} onChange={(event)=>onThemeChange({buttonStyle:event.target.value as SiteTheme["buttonStyle"]})} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[.06] px-3 text-xs text-white outline-none"><option className="text-black" value="pill">Redondo</option><option className="text-black" value="rounded">Suave</option><option className="text-black" value="square">Reto</option></select></label>
          <label className="block text-[10px] font-bold text-white/45">Largura do conteúdo<select value={theme.contentWidth} onChange={(event)=>onThemeChange({contentWidth:event.target.value as SiteTheme["contentWidth"]})} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/[.06] px-3 text-xs text-white outline-none"><option className="text-black" value="compact">Compacta</option><option className="text-black" value="standard">Padrão</option><option className="text-black" value="wide">Ampla</option></select></label>
        </div>
      </div>}

      {panel==="media"&&<div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">Biblioteca Bonatto</p><p className="mt-1 text-[10px] leading-relaxed text-white/30">Selecione uma imagem para aplicar ao destaque escolhido.</p><div className="mt-4 grid grid-cols-2 gap-2">{studioMedia.map((asset)=><button type="button" key={asset.url} onClick={()=>onUseMedia(asset.url)} className="group overflow-hidden rounded-xl border border-white/10 bg-white/[.04] text-left hover:border-white/30"><img src={asset.url} alt={asset.name} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"/><span className="block truncate px-2 pt-2 text-[9px] font-bold text-white/70">{asset.name}</span><span className="block px-2 pb-2 text-[8px] text-white/30">{asset.group}</span></button>)}</div></div>}

      {panel==="layers"&&<div className="p-3"><p className="px-2 pb-3 text-[10px] leading-relaxed text-white/35">Arraste para mudar a ordem em que os blocos aparecem.</p><div className="space-y-1">{document?.blocks.map((block:SiteBlock,index)=><div role="button" tabIndex={0} draggable onDragStart={()=>onDragStart(block.id)} onDragEnd={onDragEnd} onDragOver={(event)=>event.preventDefault()} onDrop={()=>onDrop(block.id)} onClick={()=>onSelect(block.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(block.id)}}} key={block.id} className={`group flex w-full cursor-pointer items-center gap-2 rounded-xl border px-2 py-2.5 text-left text-xs transition-[background-color,border-color,opacity] ${draggedId===block.id?"opacity-40":selectedId===block.id?"border-[#e51b23]/60 bg-[#e51b23] text-white":"border-transparent text-white/58 hover:bg-white/5 hover:text-white"}`}><GripVertical className="size-4 shrink-0 opacity-35"/><span className="w-4 shrink-0 text-[9px] tabular-nums opacity-35">{String(index+1).padStart(2,"0")}</span><span className="min-w-0 flex-1 truncate font-semibold">{SITE_BLOCK_LABELS[block.type]}</span><button type="button" aria-label={`${block.visible?"Ocultar":"Exibir"} ${SITE_BLOCK_LABELS[block.type]}`} onClick={(event)=>{event.stopPropagation();onToggleVisibility(block.id)}} className="grid size-7 place-items-center rounded-lg opacity-45 hover:bg-white/10 hover:opacity-100">{block.visible?<Eye className="size-3.5"/>:<EyeOff className="size-3.5"/>}</button></div>)}</div></div>}
    </div>
  </aside>;
}
