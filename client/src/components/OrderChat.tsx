import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, X, ChevronDown, Bot, Sparkles, UserRound, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

// Logo da Bonatto Pizza (ícone circular)
const BONATTO_AVATAR_URL = "/brand/palmito-2-circular.png";

interface OrderChatProps {
  orderId: number;
  currentUserRole: "customer" | "admin";
  currentUserName: string;
  /** URL do avatar do cliente (do OAuth) */
  currentUserAvatarUrl?: string | null;
  inline?: boolean; // if true, renders inline (no floating bubble)
}

// Botões de ação rápida para o cliente
const QUICK_ACTIONS = [
  { label: "📦 Status do pedido", message: "Qual é o status do meu pedido?" },
  { label: "⏱ Tempo de entrega", message: "Quanto tempo falta para a entrega?" },
  { label: "🍕 Ver cardápio", message: "Quais são as opções do cardápio?" },
];

// Avatar genérico para o cliente sem foto
function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
      <UserRound className="w-4 h-4 text-primary" />
    </div>
  );
}

// Avatar da Bonatto Pizza
function BonattoAvatar() {
  return (
    <img
      src={BONATTO_AVATAR_URL}
      alt="Bonatto Pizza"
      className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
    />
  );
}

// Indicador de digitação animado com avatar da Bonatto
function TypingIndicator() {
  return (
    <div className="flex justify-start items-end gap-1.5">
      <BonattoAvatar />
      <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-[#6E0D12] rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-[#6E0D12] rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-[#6E0D12] rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function OrderChat({
  orderId,
  currentUserRole,
  currentUserName,
  currentUserAvatarUrl,
  inline = false,
}: OrderChatProps) {
  const [open, setOpen] = useState(inline);
  const [text, setText] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [humanRequested, setHumanRequested] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: chatData, isLoading } = trpc.chat.messages.useQuery(
    { orderId },
    { refetchInterval: open ? 4000 : false, enabled: open || inline }
  );
  const messages = chatData?.messages ?? [];
  const aiPausedFromServer = chatData?.aiPaused ?? false;
  // Sincroniza o estado local com o servidor
  useEffect(() => {
    if (aiPausedFromServer && !humanRequested) setHumanRequested(true);
  }, [aiPausedFromServer]);

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setText("");
      utils.chat.messages.invalidate({ orderId });
    },
  });

  const aiReplyMutation = trpc.chat.aiReply.useMutation({
    onSuccess: () => {
      setIsAiTyping(false);
      utils.chat.messages.invalidate({ orderId });
    },
    onError: () => {
      setIsAiTyping(false);
    },
  });

  const requestHumanMutation = trpc.chat.requestHuman.useMutation({
    onSuccess: () => {
      setHumanRequested(true);
      utils.chat.messages.invalidate({ orderId });
    },
  });

  const resumeAIMutation = trpc.chat.resumeAI.useMutation({
    onSuccess: () => {
      setHumanRequested(false);
      utils.chat.messages.invalidate({ orderId });
    },
  });

  const markReadMutation = trpc.chat.markRead.useMutation({
    onError: () => {
      // Silently ignore ownership errors — user may not own this order
    },
  });

  // Mark as read when chat opens
  useEffect(() => {
    if (open || inline) {
      markReadMutation.mutate({ orderId });
    }
  }, [open, orderId]);

  // Scroll to bottom on new messages or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAiTyping]);

  // Hide quick actions once there are messages
  useEffect(() => {
    if (messages.length > 0) setShowQuickActions(false);
  }, [messages.length]);

  const handleSend = (messageText?: string) => {
    const trimmed = (messageText ?? text).trim();
    if (!trimmed) return;

    // Envia a mensagem do cliente
    sendMutation.mutate(
      { orderId, message: trimmed, senderRole: currentUserRole },
      {
        onSuccess: () => {
          setText("");
          utils.chat.messages.invalidate({ orderId });

          // Se for cliente e IA não foi pausada, solicita resposta da IA após 1s
          if (currentUserRole === "customer" && !humanRequested && !aiPausedFromServer) {
            setIsAiTyping(true);
            setTimeout(() => {
              aiReplyMutation.mutate({ orderId });
            }, 1200);
          }
        },
      }
    );
  };

  const handleQuickAction = (message: string) => {
    setShowQuickActions(false);
    handleSend(message);
  };

  const handleRequestHuman = () => {
    requestHumanMutation.mutate({ orderId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatContent = (
    <div className={cn("flex flex-col", inline ? "h-96" : "h-80")}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <p className="text-center text-sm text-muted-foreground py-4">Carregando mensagens...</p>
        )}

        {/* Mensagem de boas-vindas + botões de ação rápida */}
        {!isLoading && messages.length === 0 && showQuickActions && currentUserRole === "customer" && (
          <div className="space-y-3">
            <div className="flex justify-start items-end gap-1.5">
              <BonattoAvatar />
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%]">
                <p className="text-xs font-semibold mb-1 text-[#6E0D12] flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  Bonatto Pizza
                </p>
                <p className="text-sm text-foreground">
                  Olá, {currentUserName}! 👋 Sou a assistente virtual da Bonatto Pizza. Como posso te ajudar?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-1 ml-8">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.message)}
                  className="text-left text-xs px-2.5 py-2 rounded-xl border border-[#e8c0c0] bg-[#fdf2f2] text-[#6E0D12] hover:bg-[#f9d0d0] transition-colors font-medium leading-tight"
                >
                  {action.label}
                </button>
              ))}
              {/* Botão de atendente humano */}
              {!humanRequested && (
                <button
                  onClick={handleRequestHuman}
                  disabled={requestHumanMutation.isPending}
                  className="text-left text-xs px-2.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium leading-tight flex items-center gap-1"
                >
                  <PhoneCall className="h-3 w-3 shrink-0" />
                  Falar com atendente
                </button>
              )}
            </div>
          </div>
        )}

        {!isLoading && messages.length === 0 && !showQuickActions && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Nenhuma mensagem ainda.
          </p>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderRole === currentUserRole;
          const isAdminMsg = msg.senderRole === "admin";
          return (
            <div
              key={msg.id}
              className={cn("flex items-end gap-1.5", isOwn ? "justify-end" : "justify-start")}
            >
              {/* Avatar à esquerda (mensagens do restaurante) */}
              {!isOwn && (
                isAdminMsg ? <BonattoAvatar /> : <UserAvatar name={currentUserName} avatarUrl={currentUserAvatarUrl} />
              )}

              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  isOwn
                    ? "bg-[#6E0D12] text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {!isOwn && (
                  <p className="text-xs font-semibold mb-1 opacity-70 flex items-center gap-1">
                    {isAdminMsg && <Sparkles className="h-2.5 w-2.5 text-[#6E0D12]" />}
                    {isAdminMsg ? "Bonatto Pizza" : currentUserName}
                  </p>
                )}
                <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                <p className={cn("text-xs mt-1 opacity-60", isOwn ? "text-right" : "text-left")}>
                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {isOwn && msg.readAt && " ✓✓"}
                </p>
              </div>

              {/* Avatar à direita (mensagens do próprio usuário) */}
              {isOwn && (
                <UserAvatar name={currentUserName} avatarUrl={currentUserAvatarUrl} />
              )}
            </div>
          );
        })}

        {/* Indicador de digitação da IA */}
        {isAiTyping && <TypingIndicator />}

        {/* Banner de atendente humano solicitado */}
        {humanRequested && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
            <PhoneCall className="h-3.5 w-3.5 shrink-0" />
            Atendente humano solicitado. Aguarde — responderemos em breve!
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Botões de ação rápida compactos (persistem durante a conversa) */}
      {currentUserRole === "customer" && messages.length > 0 && !isAiTyping && (
        <div className="px-2 pb-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.message)}
              className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full border border-[#e8c0c0] bg-[#fdf2f2] text-[#6E0D12] hover:bg-[#f9d0d0] transition-colors font-medium whitespace-nowrap"
            >
              {action.label}
            </button>
          ))}
          {!humanRequested && (
            <button
              onClick={handleRequestHuman}
              disabled={requestHumanMutation.isPending}
              className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium whitespace-nowrap flex items-center gap-1"
            >
              <PhoneCall className="h-3 w-3" />
              Atendente
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAiTyping ? "Aguardando resposta..." : "Digite sua mensagem..."}
          className="flex-1 text-sm h-9"
          maxLength={1000}
          disabled={isAiTyping || sendMutation.isPending}
        />
        <Button
          size="sm"
          onClick={() => handleSend()}
          disabled={!text.trim() || sendMutation.isPending || isAiTyping}
          className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white h-9 w-9 p-0 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#6E0D12] text-white">
          <img src={BONATTO_AVATAR_URL} alt="Bonatto" className="w-6 h-6 rounded-full object-cover" />
          <span className="text-sm font-semibold">Chat com o Restaurante</span>
          {currentUserRole === "customer" && !humanRequested && (
            <span className="ml-auto text-xs opacity-75 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> IA disponível
            </span>
          )}
          {humanRequested && currentUserRole === "admin" && (
            <button
              onClick={() => resumeAIMutation.mutate({ orderId })}
              disabled={resumeAIMutation.isPending}
              className="ml-auto text-xs opacity-90 flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-colors"
            >
              <Sparkles className="h-3 w-3" /> Retomar IA
            </button>
          )}
          {humanRequested && currentUserRole === "customer" && (
            <span className="ml-auto text-xs opacity-75 flex items-center gap-1">
              <PhoneCall className="h-3 w-3" /> Atendente humano
            </span>
          )}
        </div>
        {chatContent}
      </div>
    );
  }

  // Floating bubble (for customer view)
  return (
    <div className="relative">
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2]"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-xs">Chat com o Restaurante</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 rotate-180" />}
      </Button>

      {/* Chat panel */}
      {open && (
        <div className="absolute bottom-10 right-0 w-80 bg-background border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#6E0D12] text-white">
            <div className="flex items-center gap-2">
              <img src={BONATTO_AVATAR_URL} alt="Bonatto" className="w-6 h-6 rounded-full object-cover" />
              <span className="text-sm font-semibold">Chat com o Restaurante</span>
            </div>
            <div className="flex items-center gap-2">
              {currentUserRole === "customer" && !humanRequested && (
                <span className="text-xs opacity-75 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> IA
                </span>
              )}
              {humanRequested && (
                <span className="text-xs opacity-75 flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" /> Humano
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-6 w-6 p-0 text-white hover:bg-[#5a0a0f]"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {chatContent}
        </div>
      )}
    </div>
  );
}
