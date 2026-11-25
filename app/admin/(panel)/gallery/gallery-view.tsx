"use client";

import { ArrowDown, ArrowUp, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MediaThumb } from "@/components/admin/image-picker";
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
import { useContentText } from "@/lib/store/hooks";
import {
  useDeleteGalleryItemMutation,
  useGetGalleryItemsQuery,
  useReorderGalleryItemsMutation,
  useToggleGalleryItemMutation,
} from "@/lib/api/gallery";
import { apiErrorMessage } from "@/lib/api/types";
import type { GalleryItemDto } from "@/lib/validation/gallery";

import { GalleryItemDialog } from "./gallery-item-dialog";

function itemName(
  item: GalleryItemDto,
  t: ReturnType<typeof useT>,
  text: ReturnType<typeof useContentText>,
): string {
  return item.caption ? text(item.caption) : t("İş {count}", { count: item.sortOrder + 1 });
}

function GalleryCard({
  item,
  handle,
  isFirst,
  isLast,
  onEdit,
  onMove,
  onToggle,
  onDelete,
}: {
  item: GalleryItemDto;
  handle: ComponentProps<"button">;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const text = useContentText();
  const name = itemName(item, t, text);
  return (
    <div className="flex w-full flex-col border border-border bg-white">
      <div className="flex items-center gap-1 border-b border-border p-1">
        <DragHandle label={t("{name}: yerini dəyiş", { name })} {...handle} />
        <span className="min-w-0 flex-1 truncate text-meta font-medium">{name}</span>
        <Switch
          checked={item.isActive}
          onCheckedChange={onToggle}
          aria-label={t("{name}: saytda göstər", { name })}
          title={item.isActive ? t("Saytda görünür") : t("Saytda gizlədilib")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("{name}: əməliyyatlar", { name })}>
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
        aria-label={t("{name}: redaktə et", { name })}
        className="flex aspect-[4/3] items-center justify-center bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative block size-full">
          {item.media ? <MediaThumb media={item.poster ?? item.media} sizes="240px" /> : null}
        </span>
      </button>
      <div className="flex min-h-11 items-center gap-2 px-3 py-2 text-meta">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {[
            item.categoryName ? text(item.categoryName) : null,
            item.masterName ? text(item.masterName) : null,
          ]
            .filter(Boolean)
            .join(" · ") || t("Kateqoriya seçilməyib")}
        </span>
        {item.before ? <Badge variant="outline">{t("Əvvəl/sonra")}</Badge> : null}
        {item.isActive ? null : <Badge variant="outline">{t("Gizli")}</Badge>}
      </div>
    </div>
  );
}

export function GalleryView() {
  const t = useT();
  const text = useContentText();
  const { data, isLoading, isError, refetch } = useGetGalleryItemsQuery();
  const [reorder] = useReorderGalleryItemsMutation();
  const [toggle] = useToggleGalleryItemMutation();
  const [remove] = useDeleteGalleryItemMutation();
  const [editing, setEditing] = useState<GalleryItemDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<GalleryItemDto | null>(null);

  const items = useMemo(() => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [data]);

  async function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const moved = items[from];
    const orderedIds = arrayMove(items, from, to).map((item) => item.id);
    try {
      await reorder({ orderedIds }).unwrap();
      if (moved) toast.success(t("«{name}» yerləşdirildi.", { name: itemName(moved, t, text) }));
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function setActive(item: GalleryItemDto, isActive: boolean) {
    try {
      await toggle({ id: item.id, isActive }).unwrap();
      toast.success(
        isActive
          ? t("«{name}» saytda göstərilir.", { name: itemName(item, t, text) })
          : t("«{name}» saytda gizlədildi.", { name: itemName(item, t, text) }),
      );
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function confirmDelete(): Promise<boolean> {
    if (!deleting) return true;
    try {
      await remove(deleting.id).unwrap();
      toast.success(t("«{name}» silindi.", { name: itemName(deleting, t, text) }));
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return false;
    }
  }

  return (
    <>
      <PageHeader
        title={t("İşlərimiz")}
        description={t(
          "Saç, dırnaq, makiyaj və digər işlərin şəkil və videoları saytda bu sırada göstərilir. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.",
        )}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus strokeWidth={1.5} />
            {t("Yeni iş")}
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
          {t("İşlər yüklənmədi.")}
        </EmptyState>
      ) : isLoading ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState action={<Button onClick={() => setEditing("new")}>{t("Yeni iş")}</Button>}>
          {t("Hələ iş əlavə olunmayıb.")}
        </EmptyState>
      ) : (
        <SortableList
          layout="grid"
          items={items}
          getId={(item) => item.id}
          getLabel={(item) => itemName(item, t, text)}
          onReorder={(from, to) => void move(from, to)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          itemClassName="flex"
        >
          {(item, index, { handle }) => (
            <GalleryCard
              item={item}
              handle={handle}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onEdit={() => setEditing(item)}
              onMove={(direction) => void move(index, index + direction)}
              onToggle={(isActive) => void setActive(item, isActive)}
              onDelete={() => setDeleting(item)}
            />
          )}
        </SortableList>
      )}
      {editing ? (
        <GalleryItemDialog
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? t("«{name}» silinsin?", { name: itemName(deleting, t, text) }) : ""}
        description={t("İş saytdan götürüləcək. Şəkil və video media kitabxanasında qalır.")}
        confirmLabel={t("Sil")}
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
