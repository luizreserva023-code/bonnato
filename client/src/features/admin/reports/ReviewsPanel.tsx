import { useState } from "react";
import { Star } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { AdminSurface } from "@/components/admin/ui";
import { JoinedPagination } from "@/components/ui/joined-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ReviewsPanel({ storeId }: { storeId?: number }) {
  const [page, setPage] = useState(1);
  const query = trpc.ratings.adminOrderReviews.useQuery({
    storeId,
    page,
    pageSize: 25,
  }, {
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const pagination = query.data?.pagination;
  return (
    <AdminSurface
      title="Avaliações"
      subtitle="Experiência dos pedidos concluídos, isolada pela unidade selecionada."
    >
      {query.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        </div>
      )}
      {query.isError && (
        <div className="rounded-xl border p-4 text-sm">
          Não foi possível carregar as avaliações.
          <Button variant="link" onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {!query.isLoading && !query.isError && (query.data?.rows.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ainda não há avaliações nesta unidade.
        </div>
      )}

      {(query.data?.rows.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">Comentário</th>
              </tr>
            </thead>
            <tbody>
              {query.data!.rows.map((review) => (
                <tr key={review.id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(review.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-semibold">#{review.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
                      {[1,2,3,4,5].map((star) => (
                        <Star key={star} className={`h-4 w-4 ${star <= review.rating ? "fill-current" : "opacity-20"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="max-w-xl px-4 py-3 text-muted-foreground">
                    {review.comment || "Sem comentário"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {pagination.total} avaliações
          </span>
          <JoinedPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </AdminSurface>
  );
}
