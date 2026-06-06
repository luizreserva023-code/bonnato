import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Award, Clock, MapPin, Package, Star, TrendingUp } from "lucide-react";
import { useRoute } from "wouter";

const LOGO_URL = "/brand/bonatto-logo-driver.jpg";

function StarRating({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export default function DriverProfile() {
  const [, params] = useRoute("/motoboy/perfil/:driverId");
  const driverId = params?.driverId ? parseInt(params.driverId) : 0;

  const { data, isLoading, error } = trpc.ratings.driverProfile.useQuery(
    { driverId },
    { enabled: driverId > 0 }
  );

  if (!driverId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">ID de motoboy inválido.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Motoboy não encontrado.</p>
      </div>
    );
  }

  const { driver, ratings, stats, history } = data;
  const avgRating = stats.avg;
  const totalDeliveries = history.length;
  const totalRatings = stats.count;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-[#6E0D12] text-white px-4 pt-8 pb-16 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <img src={LOGO_URL} alt="Bonatto Pizza" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-bold text-sm">Bonatto Pizza</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl font-black border-4 border-white/40">
              {driver.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black">{driver.name}</h1>
              <p className="text-white/80 text-sm">Entregador Bonatto Pizza</p>
              <div className="flex items-center gap-2 mt-1">
                <StarRating value={avgRating} size="sm" />
                <span className="text-sm font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</span>
                <span className="text-white/60 text-xs">({totalRatings} avaliações)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="text-center">
            <CardContent className="p-4">
              <Package className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-black text-primary">{totalDeliveries}</p>
              <p className="text-xs text-muted-foreground">Entregas</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-yellow-500">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
              <p className="text-xs text-muted-foreground">Nota Média</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Award className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-green-500">{totalRatings}</p>
              <p className="text-xs text-muted-foreground">Avaliações</p>
            </CardContent>
          </Card>
        </div>

        {/* Rating distribution */}
        {ratings.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Distribuição das Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratings.filter((r) => r.rating === star).length;
                const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-right font-medium">{star}</span>
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-muted-foreground text-xs">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent reviews */}
        {ratings.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                Avaliações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ratings.slice(0, 10).map((r) => (
                <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {r.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{r.customerName}</span>
                    </div>
                    <StarRating value={r.rating} size="sm" />
                  </div>
                  {r.comment && (
                    <p className="text-sm text-muted-foreground ml-9 italic">"{r.comment}"</p>
                  )}
                  <p className="text-xs text-muted-foreground ml-9 mt-1">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Delivery history */}
        {history.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Histórico de Entregas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.slice(0, 20).map((order) => (
                <div key={order.id} className="flex items-start justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Pedido #{order.id}</p>
                      <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="bg-green-100 text-green-800 border-0 text-xs">Entregue</Badge>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {ratings.length === 0 && history.length === 0 && (
          <Card className="mb-8">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma entrega registrada ainda.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
