import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ClipboardList,
  Command as CommandIcon,
  LayoutDashboard,
  Loader2,
  PackageSearch,
  Search,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-professional-ux";

export const OPEN_COMMAND_PALETTE_EVENT = "bonatto:open-command-palette";

type SearchRow = Record<string, unknown>;

function textValue(value: unknown) {
  return value == null ? "" : String(value);
}

export function GlobalCommandPalette() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isStaff = user?.role === "admin" || user?.role === "manager";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const selectedStoreId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const parsed = Number(window.localStorage.getItem("bonatto_admin_selected_store"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [open]);

  const searchQuery = trpc.analytics.globalSearch.useQuery(
    { query: debouncedQuery, storeId: selectedStoreId },
    {
      enabled: Boolean(isStaff && open && debouncedQuery.length >= 2),
      staleTime: 15_000,
      retry: false,
    },
  );

  useEffect(() => {
    if (!isStaff) return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const openFromUi = () => setOpen(true);
    window.addEventListener("keydown", keydown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromUi);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromUi);
    };
  }, [isStaff]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!isStaff) return null;

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  const data = searchQuery.data as {
    orders?: SearchRow[];
    customers?: SearchRow[];
    tables?: SearchRow[];
    conversations?: SearchRow[];
  } | undefined;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Busca e comandos"
      description="Navegue pelo painel ou pesquise pedidos, clientes, mesas e conversas."
      className="max-w-2xl"
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Buscar pedido, cliente, mesa ou digitar um comando..."
      />
      <CommandList className="max-h-[min(65vh,520px)]">
        {searchQuery.isFetching && debouncedQuery.length >= 2 && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Pesquisando...
          </div>
        )}
        <CommandEmpty>
          {debouncedQuery.length < 2 ? "Digite pelo menos 2 caracteres para pesquisar." : "Nenhum resultado encontrado."}
        </CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem value="dashboard inicio" onSelect={() => go("/admin?tab=dashboard")}>
            <LayoutDashboard /> Dashboard
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem value="pedidos vendas" onSelect={() => go("/admin?tab=orders")}>
            <ClipboardList /> Pedidos
          </CommandItem>
          <CommandItem value="clientes usuarios crm" onSelect={() => go("/admin?tab=users")}>
            <Users /> Clientes
          </CommandItem>
          <CommandItem value="cardapio produtos categorias" onSelect={() => go("/admin?tab=menu")}>
            <PackageSearch /> Cardápio
          </CommandItem>
          <CommandItem value="notificacoes alertas" onSelect={() => go("/notificacoes")}>
            <Bell /> Notificações
          </CommandItem>
          <CommandItem value="configuracoes ajustes" onSelect={() => go("/admin?tab=settings")}>
            <Settings /> Configurações
          </CommandItem>
        </CommandGroup>

        {debouncedQuery.length >= 2 && data?.orders?.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pedidos">
              {data.orders.map((row) => (
                <CommandItem
                  key={`order-${textValue(row.id)}`}
                  value={`pedido ${textValue(row.id)} ${textValue(row.customerName)} ${textValue(row.customerPhone)}`}
                  onSelect={() => go(`/admin?tab=orders&orderId=${encodeURIComponent(textValue(row.id))}`)}
                >
                  <ClipboardList />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">Pedido #{textValue(row.id)} · {textValue(row.customerName) || "Cliente"}</p>
                    <p className="truncate text-xs text-muted-foreground">{textValue(row.status)} · R$ {textValue(row.total)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {debouncedQuery.length >= 2 && data?.customers?.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {data.customers.map((row) => (
                <CommandItem
                  key={`customer-${textValue(row.id)}`}
                  value={`cliente ${textValue(row.name)} ${textValue(row.email)} ${textValue(row.phone)}`}
                  onSelect={() => go(`/admin?tab=users&userId=${encodeURIComponent(textValue(row.id))}`)}
                >
                  <Users />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{textValue(row.name) || "Cliente sem nome"}</p>
                    <p className="truncate text-xs text-muted-foreground">{textValue(row.email) || textValue(row.phone)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {debouncedQuery.length >= 2 && data?.tables?.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Mesas">
              {data.tables.map((row) => (
                <CommandItem
                  key={`table-${textValue(row.id)}`}
                  value={`mesa ${textValue(row.name)} ${textValue(row.customerName)}`}
                  onSelect={() => go("/admin?tab=dining")}
                >
                  <Store />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{textValue(row.name)}</p>
                    <p className="truncate text-xs text-muted-foreground">{textValue(row.customerName) || textValue(row.status)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {debouncedQuery.length >= 2 && data?.conversations?.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversas">
              {data.conversations.map((row) => (
                <CommandItem
                  key={`conversation-${textValue(row.orderId)}`}
                  value={`conversa ${textValue(row.orderId)} ${textValue(row.customerName)} ${textValue(row.lastMessage)}`}
                  onSelect={() => go(`/admin?tab=orders&orderId=${encodeURIComponent(textValue(row.orderId))}`)}
                >
                  <Search />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">Pedido #{textValue(row.orderId)} · {textValue(row.customerName)}</p>
                    <p className="truncate text-xs text-muted-foreground">{textValue(row.lastMessage)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CommandIcon className="h-3 w-3" /> Navegue com ↑ ↓ e Enter</span>
          <span>Esc para fechar</span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
