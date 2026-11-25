"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  ImageOff,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { LocaleCompleteness } from "@/components/admin/locale-tabs";
import { filledLocales } from "@/lib/admin/form-values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  DataTable,
  useListState,
  type DataTableColumn,
  type DataTableFeatures,
} from "@/components/admin/data-table";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { PublishStatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildCategoryTree, flattenTree } from "@/lib/admin/category-tree";
import { formatDateTime, formatNumber } from "@/lib/admin/format";
import type { MessageKey } from "@/lib/admin/i18n";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useBulkServicesMutation,
  useDuplicateServiceMutation,
  useGetCategoriesQuery,
  useGetServicesQuery,
} from "@/lib/api/admin";
import { apiErrorMessage, type Page } from "@/lib/api/types";
import type { UserRole } from "@/lib/auth/roles";
import { useContentText } from "@/lib/store/hooks";
import type {
  ServiceBulkAction,
  ServiceListItemDto,
  ServiceSortField,
  ServiceStatusFilter,
} from "@/lib/validation/services";

const column = createColumnHelper<DataTableFeatures, ServiceListItemDto>();

const emptyPage: Page<ServiceListItemDto> = { rows: [], rowCount: 0 };

const statusOptions: { value: ServiceStatusFilter; label: MessageKey }[] = [
  { value: "all", label: "Bütün statuslar" },
  { value: "published", label: "Dərc olunub" },
  { value: "draft", label: "Qaralama" },
  { value: "trash", label: "Silinənlər" },
];

type ActionCopy = {
  label: MessageKey;
  title: MessageKey;
  titleOne: MessageKey;
  description: MessageKey;
  done: MessageKey;
  doneOne: MessageKey;
};

const actionCopy: Record<ServiceBulkAction, ActionCopy> = {
  publish: {
    label: "Dərc et",
    title: "{count} xidmət dərc olunsun?",
    titleOne: "«{name}» dərc olunsun?",
    description: "Xidmətlər saytda görünəcək.",
    done: "{count} xidmət dərc olundu.",
    doneOne: "«{name}» dərc olundu.",
  },
  unpublish: {
    label: "Qaralamaya çevir",
    title: "{count} xidmət qaralamaya çevrilsin?",
    titleOne: "«{name}» qaralamaya çevrilsin?",
    description: "Xidmətlər saytdan götürüləcək, amma silinməyəcək.",
    done: "{count} xidmət qaralamaya çevrildi.",
    doneOne: "«{name}» qaralamaya çevrildi.",
  },
  feature: {
    label: "Ana səhifəyə əlavə et",
    title: "{count} xidmət ana səhifəyə əlavə olunsun?",
    titleOne: "«{name}» ana səhifəyə əlavə olunsun?",
    description:
      "Xidmətlər ana səhifənin xidmətlər bölməsində görünəcək. Qaralamalar dərc olunana qədər görünmür.",
    done: "{count} xidmət ana səhifəyə əlavə olundu.",
    doneOne: "«{name}» ana səhifəyə əlavə olundu.",
  },
  unfeature: {
    label: "Ana səhifədən çıxar",
    title: "{count} xidmət ana səhifədən çıxarılsın?",
    titleOne: "«{name}» ana səhifədən çıxarılsın?",
    description: "Xidmətlər xidmətlər səhifəsində qalacaq, amma ana səhifədə görünməyəcək.",
    done: "{count} xidmət ana səhifədən çıxarıldı.",
    doneOne: "«{name}» ana səhifədən çıxarıldı.",
  },
  trash: {
    label: "Sil",
    title: "{count} xidmət silinsin?",
    titleOne: "«{name}» silinsin?",
    description:
      "Xidmətlər saytdan götürüləcək və silinənlərə düşəcək. 30 gün ərzində bərpa etmək olar.",
    done: "{count} xidmət silinənlərə köçürüldü.",
    doneOne: "«{name}» silinənlərə köçürüldü.",
  },
  restore: {
    label: "Bərpa et",
    title: "{count} xidmət bərpa olunsun?",
    titleOne: "«{name}» bərpa olunsun?",
    description: "Bərpa olunan xidmətlər qaralama kimi qayıdır.",
    done: "{count} xidmət bərpa olundu.",
    doneOne: "«{name}» bərpa olundu.",
  },
  purge: {
    label: "Həmişəlik sil",
    title: "{count} xidmət həmişəlik silinsin?",
    titleOne: "«{name}» həmişəlik silinsin?",
    description: "Bu əməliyyat geri qaytarılmır. Şəkillər media kitabxanasında qalır.",
    done: "{count} xidmət həmişəlik silindi.",
    doneOne: "«{name}» həmişəlik silindi.",
  },
};

type PendingAction = { action: ServiceBulkAction; ids: string[]; names: string[] };

function Thumbnail({ service }: { service: ServiceListItemDto }) {
  return (
    <span className="relative size-10 shrink-0 border border-border bg-surface">
      {service.thumbnail ? (
        <Image src={service.thumbnail.src} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

export function ServicesView({ role }: { role: UserRole }) {
  const t = useT();
  const text = useContentText();
  const router = useRouter();
  const list = useListState<ServiceSortField>({ sort: "updatedAt", order: "desc" });
  const [status, setStatus] = useState<ServiceStatusFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const categoriesQuery = useGetCategoriesQuery();
  const {
    data = emptyPage,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetServicesQuery({
    ...list.args,
    status,
    categoryId,
  });
  const [bulkServices] = useBulkServicesMutation();
  const [duplicateService] = useDuplicateServiceMutation();
  const inTrash = status === "trash";

  const categoryOptions = useMemo(
    () => flattenTree(buildCategoryTree(categoriesQuery.data ?? [])),
    [categoriesQuery.data],
  );

  const names = useMemo(
    () => new Map(data.rows.map((row) => [row.id, text(row.name)])),
    [data.rows, text],
  );

  const priceText = useCallback(
    (service: ServiceListItemDto) => {
      if (service.priceKind === "on_request" || service.priceAmount === null) {
        return t("Razılaşma ilə");
      }
      const amount = formatNumber(service.priceAmount, t.locale);
      return service.priceKind === "from"
        ? t("{amount} AZN-dən", { amount })
        : t("{amount} AZN", { amount });
    },
    [t],
  );

  function resetPage() {
    list.setPagination((old) => ({ ...old, pageIndex: 0 }));
    setSelected(new Set());
  }

  const columns = useMemo<DataTableColumn<ServiceListItemDto>[]>(
    () =>
      column.columns([
        column.accessor("name", {
          header: t("Xidmət"),
          meta: { label: t("Xidmət"), mobile: "title" },
          enableHiding: false,
          cell: ({ row }) => (
            <Link
              href={`/admin/services/${row.original.id}`}
              className="flex min-h-11 min-w-0 items-center gap-3 hover:underline"
            >
              <Thumbnail service={row.original} />
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium">{text(row.original.name)}</span>
                  {row.original.isFeatured && !row.original.deletedAt ? (
                    <span title={t("Ana səhifədə")} className="inline-flex shrink-0 text-primary">
                      <Star
                        className="size-3.5 fill-current"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{t("Ana səhifədə")}</span>
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-muted-foreground md:hidden">
                  {priceText(row.original)}
                </span>
              </span>
            </Link>
          ),
        }),
        column.accessor("priceAmount", {
          id: "price",
          header: t("Qiymət"),
          meta: { label: t("Qiymət"), mobile: "hidden", className: "whitespace-nowrap" },
          cell: ({ row }) => priceText(row.original),
        }),
        column.accessor("durationMinutes", {
          header: t("Müddət"),
          enableSorting: false,
          meta: { label: t("Müddət"), mobile: "detail", className: "whitespace-nowrap" },
          cell: ({ getValue }) => {
            const minutes = getValue<number | null>();
            return minutes === null
              ? "—"
              : t("{count} dəq", { count: formatNumber(minutes, t.locale) });
          },
        }),
        column.display({
          id: "categories",
          header: t("Kateqoriyalar"),
          meta: { label: t("Kateqoriya"), mobile: "detail" },
          cell: ({ row }) =>
            row.original.categories.length ? (
              <span className="line-clamp-2">{row.original.categories.map(text).join(", ")}</span>
            ) : (
              <span className="text-muted-foreground">{t("Kateqoriyasız")}</span>
            ),
        }),
        column.display({
          id: "locales",
          header: t("Dillər"),
          meta: { label: t("Dillər"), mobile: "detail" },
          cell: ({ row }) => <LocaleCompleteness filled={filledLocales(row.original.name)} />,
        }),
        column.accessor("status", {
          header: t("Status"),
          meta: { label: t("Status"), mobile: "detail" },
          cell: ({ row }) =>
            row.original.deletedAt ? (
              <Badge variant="outline">{t("Silinib")}</Badge>
            ) : (
              <PublishStatusBadge status={row.original.status} />
            ),
        }),
        column.accessor("updatedAt", {
          header: t("Dəyişib"),
          meta: { label: t("Dəyişib"), mobile: "hidden" },
          cell: ({ getValue }) => formatDateTime(getValue<string>(), t.locale),
        }),
      ]),
    [text, t, priceText],
  );

  async function run(action: PendingAction): Promise<boolean> {
    try {
      const result = await bulkServices({ action: action.action, ids: action.ids }).unwrap();
      const copy = actionCopy[action.action];
      const single = action.ids.length === 1 ? action.names[0] : undefined;
      if (result.updated) {
        toast.success(
          single ? t(copy.doneOne, { name: single }) : t(copy.done, { count: result.updated }),
        );
      }
      if (result.message) toast.warning(t.message(result.message));
      else if (!result.updated) toast.warning(t("Heç bir xidmət dəyişmədi."));
      setSelected(new Set());
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return false;
    }
  }

  function ask(action: ServiceBulkAction, ids: string[]) {
    setPending({ action, ids, names: ids.map((id) => names.get(id) ?? "") });
  }

  async function duplicate(service: ServiceListItemDto) {
    try {
      const copy = await duplicateService(service.id).unwrap();
      toast.success(t("«{name}» üçün kopya yaradıldı.", { name: text(service.name) }));
      router.push(`/admin/services/${copy.id}`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  function rowActions(service: ServiceListItemDto) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("{name}: əməliyyatlar", { name: text(service.name) })}
          >
            <Ellipsis strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {service.deletedAt ? (
            <>
              <DropdownMenuItem onSelect={() => ask("restore", [service.id])}>
                <RotateCcw strokeWidth={1.5} />
                {t("Bərpa et")}
              </DropdownMenuItem>
              {role === "owner" ? (
                <DropdownMenuItem variant="destructive" onSelect={() => ask("purge", [service.id])}>
                  <Trash2 strokeWidth={1.5} />
                  {t("Həmişəlik sil")}
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/services/${service.id}`}>
                  <Pencil strokeWidth={1.5} />
                  {t("Redaktə et")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicate(service)}>
                <Copy strokeWidth={1.5} />
                {t("Kopyasını yarat")}
              </DropdownMenuItem>
              {service.status === "published" ? (
                <DropdownMenuItem onSelect={() => ask("unpublish", [service.id])}>
                  <EyeOff strokeWidth={1.5} />
                  {t("Qaralamaya çevir")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => ask("publish", [service.id])}>
                  <Eye strokeWidth={1.5} />
                  {t("Dərc et")}
                </DropdownMenuItem>
              )}
              {service.isFeatured ? (
                <DropdownMenuItem onSelect={() => ask("unfeature", [service.id])}>
                  <StarOff strokeWidth={1.5} />
                  {t("Ana səhifədən çıxar")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => ask("feature", [service.id])}>
                  <Star strokeWidth={1.5} />
                  {t("Ana səhifəyə əlavə et")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => ask("trash", [service.id])}>
                <Trash2 strokeWidth={1.5} />
                {t("Sil")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const selectedIds = [...selected];
  const bulkActions: ServiceBulkAction[] = inTrash
    ? role === "owner"
      ? ["restore", "purge"]
      : ["restore"]
    : ["publish", "unpublish", "feature", "unfeature", "trash"];

  const selectionBar = (
    <div
      role="region"
      aria-label={t("Seçilmiş xidmətlər#selection")}
      className="flex flex-wrap items-center gap-2 border border-border bg-accent px-3 py-2 text-meta"
    >
      <span className="mr-auto font-medium">
        {t("{count} xidmət seçilib", { count: selected.size })}
      </span>
      {bulkActions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={action === "trash" || action === "purge" ? "destructive" : "outline"}
          className={action === "trash" || action === "purge" ? "bg-white" : undefined}
          onClick={() => ask(action, selectedIds)}
        >
          {t(actionCopy[action].label)}
        </Button>
      ))}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("Seçimi ləğv et")}
        onClick={() => setSelected(new Set())}
      >
        <X strokeWidth={1.5} />
      </Button>
    </div>
  );

  const filtered = Boolean(list.args.search || categoryId || status !== "all");

  return (
    <>
      <PageHeader
        title={t("Xidmətlər")}
        description={t("Salonun bütün xidmətləri. Dərc olunanlar saytda dərhal görünür.")}
        actions={
          <Button asChild>
            <Link href="/admin/services/new">
              <Plus strokeWidth={1.5} />
              {t("Yeni xidmət")}
            </Link>
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
          {t("Xidmətlər yüklənmədi.")}
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={data.rows}
          rowCount={data.rowCount}
          getRowId={(service) => service.id}
          list={list}
          loading={isLoading}
          fetching={isFetching}
          searchPlaceholder={t("Ad və ya ünvan ilə axtar")}
          rowActions={rowActions}
          selection={{
            selected,
            onChange: setSelected,
            label: (id) => names.get(id) ?? t("xidmət"),
          }}
          selectionBar={selectionBar}
          toolbar={
            <>
              <Select
                value={categoryId || "all"}
                onValueChange={(value) => {
                  setCategoryId(value === "all" ? "" : value);
                  resetPage();
                }}
              >
                <SelectTrigger aria-label={t("Kateqoriya")} className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Bütün kateqoriyalar")}</SelectItem>
                  {categoryOptions.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.depth ? `— ${text(node.name)}` : text(node.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as ServiceStatusFilter);
                  resetPage();
                }}
              >
                <SelectTrigger aria-label={t("Status")} className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          empty={
            <EmptyState
              action={
                filtered ? undefined : (
                  <Button asChild>
                    <Link href="/admin/services/new">{t("Yeni xidmət")}</Link>
                  </Button>
                )
              }
            >
              {inTrash
                ? t("Silinənlər boşdur. Silinən xidmətlər burada 30 gün saxlanılır.")
                : filtered
                  ? t("Seçimə uyğun xidmət tapılmadı.")
                  : t("Hələ xidmət yoxdur.")}
            </EmptyState>
          }
        />
      )}
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          title={
            pending.ids.length === 1 && pending.names[0]
              ? t(actionCopy[pending.action].titleOne, { name: pending.names[0] })
              : t(actionCopy[pending.action].title, { count: pending.ids.length })
          }
          description={t(actionCopy[pending.action].description)}
          confirmLabel={t(actionCopy[pending.action].label)}
          destructive={pending.action === "trash" || pending.action === "purge"}
          onConfirm={() => run(pending)}
        />
      ) : null}
    </>
  );
}
