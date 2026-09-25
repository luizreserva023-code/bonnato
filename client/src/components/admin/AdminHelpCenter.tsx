"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleHelp,
  Clock3,
  Info,
  MousePointer2,
  Search,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HELP_TOPICS,
  SCREEN_HELP,
  TUTORIAL_MODULES,
  resolveAdminActionHelp,
  searchAdminHelp,
  type AdminHelpTopic,
} from "@/help/adminHelpCatalog";

export const OPEN_ADMIN_HELP_EVENT = "bonatto:open-admin-help";
const HELP_MODE_STORAGE_KEY = "bonatto_admin_help_mode_v1";
const TUTORIAL_PROGRESS_STORAGE_KEY = "bonatto_admin_tutorial_progress_v1";

type HelpView = "screen" | "search" | "tutorial";

type AdminHelpContextValue = {
  helpMode: boolean;
  setHelpMode: (enabled: boolean) => void;
  openHelp: (view?: HelpView, topic?: AdminHelpTopic | null) => void;
};

const AdminHelpContext = createContext<AdminHelpContextValue | null>(null);

function tutorialIdForTab(activeTab: string) {
  if (activeTab === "dashboard") return "dashboard";
  if (activeTab === "orders") return "orders";
  if (activeTab === "menu") return "catalog";
  if (["coupons", "promotions", "raffles", "upsells", "recovery", "club", "rewards", "reviews"].includes(activeTab)) return "marketing";
  if (activeTab === "users") return "customers";
  if (activeTab === "drivers") return "delivery";
  if (["reports", "growth"].includes(activeTab)) return "performance";
  if (activeTab === "payments") return "payments";
  if (activeTab === "settings") return "settings";
  if (["whatsapp", "marketplaces"].includes(activeTab)) return "integrations";
  return "getting-started";
}
function interactiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const element = target.closest(
    "button,a,[role='button'],[role='combobox'],input[type='button'],input[type='submit']",
  );
  if (!(element instanceof HTMLElement)) return null;
  if (element.closest("[data-help-ui='true']")) return null;
  return element;
}

function labelForElement(element: HTMLElement) {
  return (
    element.dataset.helpLabel
    || element.getAttribute("aria-label")
    || element.getAttribute("title")
    || element.textContent
    || ""
  ).replace(/\s+/g, " ").trim();
}

function fallbackTopic(label: string, activeLabel: string, activeTab: string): AdminHelpTopic {
  const screen = SCREEN_HELP[activeTab];
  return {
    id: "dynamic." + activeTab + "." + label,
    title: label || "Controle desta tela",
    summary: "Este controle pertence à área " + activeLabel + ". No Modo Ajuda, o clique foi bloqueado para que você possa entender a ação antes de executá-la.",
    details: screen
      ? "Contexto da tela: " + screen.purpose
      : "Use a Central de Ajuda para localizar a documentação relacionada a esta função.",
    whenToUse: "Desative o Modo Ajuda antes de executar a ação de verdade.",
    keywords: [label, activeLabel],
  };
}

function readCompletedModules() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = JSON.parse(window.localStorage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY) ?? "[]");
    const validIds = new Set(TUTORIAL_MODULES.map((module) => module.id));
    const completed = Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === "string" && validIds.has(item))
      : [];
    return new Set(completed);
  } catch {
    return new Set<string>();
  }
}
function TopicDetail({ topic, onBack }: { topic: AdminHelpTopic; onBack: () => void }) {
  return (
    <div className="space-y-5 px-5 pb-6" data-help-ui="true">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <CircleHelp className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-[0.12em]">Como funciona</span>
        </div>
        <h3 className="text-lg font-bold text-foreground">{topic.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{topic.summary}</p>
      </div>
      {topic.details && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">O que faz</p>
          <p className="text-sm leading-6">{topic.details}</p>
        </div>
      )}
      {topic.whenToUse && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Quando usar</p>
          <p className="text-sm leading-6">{topic.whenToUse}</p>
        </div>
      )}
      {topic.after && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-800">O que acontece depois</p>
              <p className="mt-1 text-sm leading-5 text-emerald-900">{topic.after}</p>
            </div>
          </div>
        </div>
      )}
      {topic.warning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-800">Atenção</p>
              <p className="mt-1 text-sm leading-5 text-amber-900">{topic.warning}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenHelpView({
  activeTab,
  activeLabel,
  openTopic,
  openTutorial,
}: {
  activeTab: string;
  activeLabel: string;
  openTopic: (topic: AdminHelpTopic) => void;
  openTutorial: () => void;
}) {
  const screen = SCREEN_HELP[activeTab];
  const tutorialId = tutorialIdForTab(activeTab);
  const relatedTopics = Object.values(HELP_TOPICS).filter((topic) => topic.relatedTutorialId === tutorialId).slice(0, 6);

  if (!screen) {
    return (
      <div className="p-5">
        <p className="text-sm text-muted-foreground">Ainda não há um guia contextual específico para {activeLabel}.</p>
        <Button type="button" className="mt-4" onClick={openTutorial}>Abrir tutorial completo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Entenda esta tela</p>
        <h3 className="mt-1 text-lg font-bold">{screen.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{screen.purpose}</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">O que você pode fazer aqui</p>
        <div className="space-y-2">
          {screen.canDo.map((item) => (
            <div key={item} className="flex gap-2 text-sm leading-5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Fluxo recomendado</p>
        <ol className="space-y-2">
          {screen.recommendedFlow.map((item, index) => (
            <li key={item} className="flex gap-2.5 text-sm leading-5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
      {screen.cautions?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          {screen.cautions.map((item) => (
            <div key={item} className="flex gap-2 text-sm leading-5 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}
      {relatedTopics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Ações importantes</p>
          <div className="space-y-2">
            {relatedTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => openTopic(topic)}
                className="w-full rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-semibold">{topic.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{topic.summary}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      <Button type="button" variant="outline" className="w-full gap-2" onClick={openTutorial}>
        <BookOpen className="h-4 w-4" /> Abrir tutorial completo
      </Button>
    </div>
  );
}
function SearchHelpView({
  query,
  setQuery,
  openTopic,
}: {
  query: string;
  setQuery: (value: string) => void;
  openTopic: (topic: AdminHelpTopic) => void;
}) {
  const results = useMemo(() => searchAdminHelp(query).slice(0, 30), [query]);
  const tutorialMatches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return [];
    return TUTORIAL_MODULES.filter((module) =>
      [module.title, module.description, ...module.steps.flatMap((step) => [step.title, step.description])]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(q),
    ).slice(0, 8);
  }, [query]);

  return (
    <div className="space-y-4 p-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: cancelar pedido, carrossel, PIX..."
          className="pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        A busca consulta a mesma base usada pelos helpers e pelo tutorial.
      </p>
      <div className="space-y-2">
        {results.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => openTopic(topic)}
            className="w-full rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <p className="text-sm font-semibold">{topic.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{topic.summary}</p>
          </button>
        ))}
      </div>
      {tutorialMatches.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Também aparece no tutorial</p>
          <div className="space-y-2">
            {tutorialMatches.map((module) => (
              <div key={module.id} className="rounded-xl bg-muted/40 px-3.5 py-3">
                <p className="text-sm font-semibold">{module.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.length === 0 && tutorialMatches.length === 0 && (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          Nenhum conteúdo encontrado. Tente uma ação, tela ou termo mais específico.
        </div>
      )}
    </div>
  );
}

function TutorialView({
  completed,
  toggleCompleted,
  expandedId,
  setExpandedId,
  openTopic,
}: {
  completed: Set<string>;
  toggleCompleted: (id: string) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  openTopic: (topic: AdminHelpTopic) => void;
}) {
  const progress = Math.round((completed.size / TUTORIAL_MODULES.length) * 100);

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Treinamento Bonatto</p>
            <p className="mt-1 text-sm font-semibold">{completed.size} de {TUTORIAL_MODULES.length} módulos concluídos</p>
          </div>
          <span className="text-lg font-black text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-3" />
      </div>
      <div className="space-y-2.5">
        {TUTORIAL_MODULES.map((module) => {
          const isDone = completed.has(module.id);
          const isOpen = expandedId === module.id;
          return (
            <div key={module.id} className="overflow-hidden rounded-2xl border bg-background">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left"
                onClick={() => setExpandedId(isOpen ? null : module.id)}
              >
                {isDone
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{module.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" /> cerca de {module.estimatedMinutes} min
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/15 px-4 py-4">
                  <ol className="space-y-4">
                    {module.steps.map((step, index) => (
                      <li key={module.id + "-" + step.title} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{step.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                          {step.path && <Badge variant="secondary" className="mt-2 text-[10px]">{step.path}</Badge>}
                          {step.helpId && HELP_TOPICS[step.helpId] && (
                            <button
                              type="button"
                              className="mt-2 block text-xs font-semibold text-primary hover:underline"
                              onClick={() => openTopic(HELP_TOPICS[step.helpId as string])}
                            >
                              Ver explicação desta ação
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <Button
                    type="button"
                    variant={isDone ? "outline" : "default"}
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => toggleCompleted(module.id)}
                  >
                    {isDone ? "Marcar como não concluído" : "Marcar módulo como concluído"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function AdminHelpProvider({
  activeTab,
  activeLabel,
  children,
}: {
  activeTab: string;
  activeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<HelpView>("screen");
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<AdminHelpTopic | null>(null);
  const [expandedTutorialId, setExpandedTutorialId] = useState<string | null>(null);
  const [completedModules, setCompletedModules] = useState<Set<string>>(() => readCompletedModules());
  const [helpMode, setHelpModeState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HELP_MODE_STORAGE_KEY) === "true";
  });
  const [hoverHelp, setHoverHelp] = useState<{ topic: AdminHelpTopic; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const hoveredElement = useRef<HTMLElement | null>(null);

  const setHelpMode = (enabled: boolean) => {
    setHelpModeState(enabled);
    try { window.localStorage.setItem(HELP_MODE_STORAGE_KEY, String(enabled)); } catch {}
    setHoverHelp(null);
  };

  const openHelp = (nextView: HelpView = "screen", topic: AdminHelpTopic | null = null) => {
    setView(nextView);
    setSelectedTopic(topic);
    setOpen(true);
  };

  const toggleCompleted = (id: string) => {
    setCompletedModules((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { window.localStorage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".bonatto-admin");
    if (!root) return;
    root.dataset.helpMode = String(helpMode);
    return () => { delete root.dataset.helpMode; };
  }, [helpMode, activeTab]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: HelpView; topicId?: string }>).detail;
      const topic = detail?.topicId ? HELP_TOPICS[detail.topicId] ?? null : null;
      openHelp(detail?.view ?? "screen", topic);
    };
    window.addEventListener(OPEN_ADMIN_HELP_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_ADMIN_HELP_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    const clearHoverTimer = () => {
      if (hoverTimer.current !== null) {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    };

    const resolveElementTopic = (element: HTMLElement, allowFallback: boolean) => {
      const label = labelForElement(element);
      const topic = resolveAdminActionHelp({
        helpId: element.dataset.helpId,
        label,
        activeTab,
      });
      return topic ?? (allowFallback ? fallbackTopic(label, activeLabel, activeTab) : null);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!helpMode) return;
      const element = interactiveTarget(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const topic = resolveElementTopic(element, true);
      if (topic) openHelp("screen", topic);
    };

    const onMouseOver = (event: MouseEvent) => {
      if (helpMode || open) return;
      const element = interactiveTarget(event.target);
      if (!element || hoveredElement.current === element) return;
      hoveredElement.current = element;
      clearHoverTimer();
      const topic = resolveElementTopic(element, true);
      if (!topic) return;
      hoverTimer.current = window.setTimeout(() => {
        setHoverHelp({ topic, rect: element.getBoundingClientRect() });
      }, 550);
    };
    const onMouseOut = (event: MouseEvent) => {
      const element = interactiveTarget(event.target);
      if (!element) return;
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && element.contains(related)) return;
      if (hoveredElement.current === element) hoveredElement.current = null;
      clearHoverTimer();
      setHoverHelp(null);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (helpMode || open) return;
      const element = interactiveTarget(event.target);
      if (!element) return;
      const topic = resolveElementTopic(element, true);
      if (topic) setHoverHelp({ topic, rect: element.getBoundingClientRect() });
    };

    const onFocusOut = () => setHoverHelp(null);

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      clearHoverTimer();
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [activeLabel, activeTab, helpMode, open]);

  const hoverStyle = hoverHelp
    ? {
        left: Math.max(12, Math.min(hoverHelp.rect.left, window.innerWidth - 340)),
        top: hoverHelp.rect.bottom + 10 > window.innerHeight - 150
          ? Math.max(12, hoverHelp.rect.top - 130)
          : hoverHelp.rect.bottom + 10,
      }
    : undefined;

  return (
    <AdminHelpContext.Provider value={{ helpMode, setHelpMode, openHelp }}>
      {children}
      {hoverHelp && !open && (
        <div
          data-help-ui="true"
          className="fixed z-[70] w-[328px] rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl"
          style={hoverStyle}
          role="tooltip"
        >
          <div className="flex items-start gap-2.5">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-bold">{hoverHelp.topic.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{hoverHelp.topic.summary}</p>
            </div>
          </div>
        </div>
      )}

      {helpMode && (
        <div
          data-help-ui="true"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-primary/20 bg-background px-4 py-3 shadow-xl"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <MousePointer2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold">Modo Ajuda ativo</p>
            <p className="text-[11px] text-muted-foreground">Clique em um controle para saber o que ele faz.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setHelpMode(false)}>Sair</Button>
        </div>
      )}

      <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSelectedTopic(null); }}>
        <SheetContent
          data-help-ui="true"
          side="right"
          className="w-[min(94vw,560px)] gap-0 p-0 sm:max-w-[560px]"
        >
          <SheetHeader className="border-b px-5 pb-4 pt-5">
            <div className="flex items-start gap-3 pr-7">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <CircleHelp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <SheetTitle>Central de Ajuda</SheetTitle>
                <SheetDescription>Helpers, documentação contextual e treinamento do sistema.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="border-b px-5 py-3">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold">Modo Ajuda</p>
                <p className="text-xs text-muted-foreground">Clique nos controles sem executar as ações.</p>
              </div>
              <Switch checked={helpMode} onCheckedChange={setHelpMode} aria-label="Ativar modo ajuda" />
            </div>
          </div>

          {selectedTopic ? (
            <ScrollArea className="min-h-0 flex-1">
              <TopicDetail topic={selectedTopic} onBack={() => setSelectedTopic(null)} />
            </ScrollArea>
          ) : (
            <Tabs value={view} onValueChange={(value) => setView(value as HelpView)} className="min-h-0 flex-1 gap-0">
              <div className="border-b px-5 py-3">
                <TabsList className="grid h-10 w-full grid-cols-3">
                  <TabsTrigger value="screen" className="gap-1.5 text-xs">
                    <Info className="h-3.5 w-3.5" /> Esta tela
                  </TabsTrigger>
                  <TabsTrigger value="search" className="gap-1.5 text-xs">
                    <Search className="h-3.5 w-3.5" /> Pesquisar
                  </TabsTrigger>
                  <TabsTrigger value="tutorial" className="gap-1.5 text-xs">
                    <BookOpen className="h-3.5 w-3.5" /> Tutorial
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="screen" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <ScreenHelpView
                    activeTab={activeTab}
                    activeLabel={activeLabel}
                    openTopic={setSelectedTopic}
                    openTutorial={() => {
                      setExpandedTutorialId(tutorialIdForTab(activeTab));
                      setView("tutorial");
                    }}
                  />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="search" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <SearchHelpView query={query} setQuery={setQuery} openTopic={setSelectedTopic} />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="tutorial" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <TutorialView
                    completed={completedModules}
                    toggleCompleted={toggleCompleted}
                    expandedId={expandedTutorialId}
                    setExpandedId={setExpandedTutorialId}
                    openTopic={setSelectedTopic}
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </AdminHelpContext.Provider>
  );
}
export function useAdminHelp() {
  const context = useContext(AdminHelpContext);
  if (!context) throw new Error("useAdminHelp must be used inside AdminHelpProvider");
  return context;
}

export function AdminHelpButton({ compact = false }: { compact?: boolean }) {
  const { helpMode, openHelp } = useAdminHelp();

  return (
    <Button
      data-help-ui="true"
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      className={compact ? "h-8 w-8" : "h-9 gap-2"}
      aria-label="Abrir Central de Ajuda"
      onClick={() => openHelp("screen")}
    >
      <CircleHelp className="h-4 w-4" />
      {!compact && <span>Ajuda</span>}
      {!compact && helpMode && (
        <span className="ml-0.5 h-2 w-2 rounded-full bg-emerald-500" aria-label="Modo ajuda ativo" />
      )}
    </Button>
  );
}

export function openAdminHelp(view: HelpView = "screen", topicId?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_ADMIN_HELP_EVENT, { detail: { view, topicId } }));
}
