/**
 * SavedCards — componente para listar, adicionar e remover cartões salvos via Stripe.
 * Usa Stripe Elements (CardElement) para capturar dados do cartão com segurança.
 * Os dados do cartão NUNCA passam pelo nosso servidor — vão direto ao Stripe.
 */
import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, Loader2, ShieldCheck, Lock } from "lucide-react";

// Stripe publishable key from env
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// Brand icons mapping
const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
  diners: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  unknown: "Cartão",
};

const BRAND_COLORS: Record<string, string> = {
  visa: "bg-blue-600",
  mastercard: "bg-[#6E0D12]",
  amex: "bg-green-700",
  elo: "bg-yellow-600",
  hipercard: "bg-[#5a0a0f]",
  default: "bg-gray-600",
};

function getBrandColor(brand: string) {
  return BRAND_COLORS[brand] ?? BRAND_COLORS.default;
}

// ─── Add Card Form (inside Elements context) ─────────────────────────────────

interface AddCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCardForm({ onSuccess, onCancel }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const createSetupIntentMutation = trpc.payments.createSetupIntent.useMutation();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      // 1. Create SetupIntent on server
      const { clientSecret } = await createSetupIntentMutation.mutateAsync({
        origin: window.location.origin,
      });

      if (!clientSecret) throw new Error("Não foi possível iniciar o salvamento do cartão");

      // 2. Confirm card setup with Stripe (card data goes directly to Stripe)
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Elemento de cartão não encontrado");

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        throw new Error(error.message ?? "Erro ao salvar cartão");
      }

      if (setupIntent?.status === "succeeded") {
        toast.success("Cartão salvo com sucesso! Disponível para compras futuras.");
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar cartão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [stripe, elements, createSetupIntentMutation, onSuccess]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#1a1a1a",
                fontFamily: "inherit",
                "::placeholder": { color: "#9ca3af" },
              },
              invalid: { color: "#ef4444" },
            },
            hidePostalCode: true,
          }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Seus dados são criptografados e processados com segurança pelo Stripe. Nunca armazenamos os dados do seu cartão.</span>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !stripe} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Salvar Cartão
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ─── Card Item ────────────────────────────────────────────────────────────────

interface SavedCardItemProps {
  card: {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: string;
  };
  onDelete: (id: string) => void;
  deleting: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function SavedCardItem({ card, onDelete, deleting, selectable, selected, onSelect }: SavedCardItemProps) {
  const brandLabel = BRAND_LABELS[card.brand] ?? "Cartão";
  const brandColor = getBrandColor(card.brand);
  const expiry = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;
  const fundingLabel = card.funding === "debit" ? "Débito" : card.funding === "prepaid" ? "Pré-pago" : "Crédito";

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
        selectable
          ? selected
            ? "border-primary bg-primary/5 cursor-pointer"
            : "border-border hover:border-primary/50 cursor-pointer"
          : "border-border"
      }`}
      onClick={() => selectable && onSelect?.(card.id)}
    >
      <div className="flex items-center gap-3">
        {selectable && (
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${selected ? "border-primary" : "border-muted-foreground"}`}>
            {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
        )}
        <div className={`flex h-9 w-14 items-center justify-center rounded-md text-white text-xs font-bold ${brandColor}`}>
          {brandLabel.slice(0, 4).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">
            {brandLabel} •••• {card.last4}
          </p>
          <p className="text-xs text-muted-foreground">
            {fundingLabel} · Expira {expiry}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {selected && selectable && (
          <Badge variant="default" className="text-xs">Selecionado</Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          disabled={deleting}
          title="Remover cartão"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Main SavedCards Component ────────────────────────────────────────────────

interface SavedCardsProps {
  /** If true, shows a radio-select UI to pick a card for payment */
  selectable?: boolean;
  selectedCardId?: string;
  onSelectCard?: (id: string) => void;
  /** Compact mode for checkout (no title/description) */
  compact?: boolean;
}

export function SavedCards({ selectable, selectedCardId, onSelectCard, compact }: SavedCardsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: cards = [], isLoading } = trpc.payments.listSavedCards.useQuery();

  const deleteCardMutation = trpc.payments.deleteCard.useMutation({
    onMutate: ({ paymentMethodId }) => setDeletingId(paymentMethodId),
    onSuccess: () => {
      utils.payments.listSavedCards.invalidate();
      toast.success("Cartão removido com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message ?? "Erro ao remover cartão.");
    },
    onSettled: () => setDeletingId(null),
  });

  const handleAddSuccess = useCallback(() => {
    setShowAddForm(false);
    utils.payments.listSavedCards.invalidate();
  }, [utils]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = (
    <div className="space-y-3">
      {cards.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
          <CreditCard className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum cartão salvo ainda.</p>
          <p className="text-xs">Adicione um cartão para pagar mais rápido nas próximas compras.</p>
        </div>
      )}

      {cards.map((card) => (
        <SavedCardItem
          key={card.id}
          card={card}
          onDelete={(id) => deleteCardMutation.mutate({ paymentMethodId: id })}
          deleting={deletingId === card.id}
          selectable={selectable}
          selected={selectedCardId === card.id}
          onSelect={onSelectCard}
        />
      ))}

      {showAddForm ? (
        <Elements stripe={stripePromise}>
          <AddCardForm onSuccess={handleAddSuccess} onCancel={() => setShowAddForm(false)} />
        </Elements>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar novo cartão
        </Button>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Cartões Salvos
        </CardTitle>
        <CardDescription>
          Gerencie seus cartões para pagamentos mais rápidos. Seus dados são protegidos pelo Stripe.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {content}
      </CardContent>
    </Card>
  );
}

export default SavedCards;
