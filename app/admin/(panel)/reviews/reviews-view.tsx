"use client";

import { ArrowDown, ArrowUp, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { arrayMove, DragHandle, SortableList } from "@/components/admin/sortable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useDeleteReviewMutation,
  useGetReviewsQuery,
  useReorderReviewsMutation,
  useToggleReviewMutation,
} from "@/lib/api/reviews";
import { apiErrorMessage } from "@/lib/api/types";
import type { ReviewDto } from "@/lib/validation/reviews";

import { ReviewDialog } from "./review-dialog";

function ReviewCard({
  review,
  handle,
  isFirst,
  isLast,
  onEdit,
  onMove,
  onToggle,
  onDelete,
}: {
  review: ReviewDto;
  handle: ComponentProps<"button">;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div className="flex w-full flex-col border border-border bg-white">
      <div className="flex items-center gap-1 border-b border-border p-1">
        <DragHandle label={t("{name}: yerini dəyiş", { name: review.authorName })} {...handle} />
        <span className="min-w-0 flex-1 truncate text-meta font-medium">{review.authorName}</span>
        <Switch
          checked={review.isActive}
          onCheckedChange={onToggle}
          aria-label={t("{name}: saytda göstər", { name: review.authorName })}
          title={review.isActive ? t("Saytda görünür") : t("Saytda gizlədilib")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("{name}: əməliyyatlar", { name: review.authorName })}
            >
              <Ellipsis strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil strokeWidth={1.5} />
              {t("Redaktə et")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(-1)}>
              <ArrowUp strokeWidth={1.5} />
              {t("Əvvələ")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onMove(1)}>
              <ArrowDown strokeWidth={1.5} />
              {t("Sona")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 strokeWidth={1.5} />
              {t("Sil")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("{name}: redaktə et", { name: review.authorName })}
        className="flex min-h-28 flex-col gap-2 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="line-clamp-4 text-meta whitespace-pre-line">{review.body}</span>
      </button>
      <div className="mt-auto flex min-h-11 items-center gap-2 border-t border-border px-3 py-2 text-meta">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {review.rating ? t("Qiymət: {count}/5", { count: review.rating }) : t("Qiymət yoxdur")}
        </span>
        {/^\[.*\]$/.test(review.authorName.trim()) ? (
          <Badge variant="outline" className="border-error text-error">
            {t("Ad yazılmalıdır")}
          </Badge>
        ) : null}
        {review.isActive ? null : <Badge variant="outline">{t("Gizli")}</Badge>}
      </div>
    </div>
  );
}

export function ReviewsView() {
  const t = useT();
  const { data, isLoading, isError, refetch } = useGetReviewsQuery();
  const [reorder] = useReorderReviewsMutation();
  const [toggle] = useToggleReviewMutation();
  const [remove] = useDeleteReviewMutation();
  const [editing, setEditing] = useState<ReviewDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ReviewDto | null>(null);

  const reviews = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  async function move(from: number, to: number) {
    if (to < 0 || to >= reviews.length || from === to) return;
    const moved = reviews[from];
    const orderedIds = arrayMove(reviews, from, to).map((review) => review.id);
    try {
      await reorder({ orderedIds }).unwrap();
      if (moved) toast.success(t("«{name}» yerləşdirildi.", { name: moved.authorName }));
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function setActive(review: ReviewDto, isActive: boolean) {
    try {
      await toggle({ id: review.id, isActive }).unwrap();
      toast.success(
        isActive
          ? t("«{name}» saytda göstərilir.", { name: review.authorName })
          : t("«{name}» saytda gizlədildi.", { name: review.authorName }),
      );
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function confirmDelete(): Promise<boolean> {
    if (!deleting) return true;
    try {
      await remove(deleting.id).unwrap();
      toast.success(t("«{name}» silindi.", { name: deleting.authorName }));
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return false;
    }
  }

  return (
    <>
      <PageHeader
        title={t("Rəylər")}
        description={t(
          "Müştəri rəyləri saytda bu sırada göstərilir. Yalnız real rəyləri əlavə edin. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.",
        )}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus strokeWidth={1.5} />
            {t("Yeni rəy")}
          </Button>
        }
      />
      {isError ? (
        <EmptyState
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("Yenidən yüklə")}
            </Button>
          }
        >
          {t("Rəylər yüklənmədi.")}
        </EmptyState>
      ) : isLoading ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState action={<Button onClick={() => setEditing("new")}>{t("Yeni rəy")}</Button>}>
          {t("Hələ rəy əlavə olunmayıb.")}
        </EmptyState>
      ) : (
        <SortableList
          layout="grid"
          items={reviews}
          getId={(review) => review.id}
          getLabel={(review) => review.authorName}
          onReorder={(from, to) => void move(from, to)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          itemClassName="flex"
        >
          {(review, index, { handle }) => (
            <ReviewCard
              review={review}
              handle={handle}
              isFirst={index === 0}
              isLast={index === reviews.length - 1}
              onEdit={() => setEditing(review)}
              onMove={(direction) => void move(index, index + direction)}
              onToggle={(isActive) => void setActive(review, isActive)}
              onDelete={() => setDeleting(review)}
            />
          )}
        </SortableList>
      )}
      {editing ? (
        <ReviewDialog
          review={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? t("«{name}» silinsin?", { name: deleting.authorName }) : ""}
        description={t("Rəy həmişəlik silinəcək. Foto media kitabxanasında qalır.")}
        confirmLabel={t("Sil")}
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
