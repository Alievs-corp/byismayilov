"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { CalendarCheck, CheckCheck, Download, Ellipsis, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  DataTable,
  useListState,
  type DataTableColumn,
  type DataTableFeatures,
} from "@/components/admin/data-table";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { BookingStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, formatDay } from "@/lib/admin/format";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  bookingsExportHref,
  useDeleteBookingMutation,
  useGetBookingsQuery,
  useUpdateBookingMutation,
} from "@/lib/api/bookings";
import { apiErrorMessage, type Page } from "@/lib/api/types";
import type { UserRole } from "@/lib/auth/roles";
import { telHref } from "@/lib/contact-links";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import {
  bookingStatuses,
  bookingStatusLabels,
  bookingTimeWindowLabels,
  type BookingRequestListItemDto,
  type BookingRequestSortField,
  type BookingRequestStatusFilter,
  type BookingStatus,
} from "@/lib/validation/booking-requests";

const column = createColumnHelper<DataTableFeatures, BookingRequestListItemDto>();

const emptyPage: Page<BookingRequestListItemDto> = { rows: [], rowCount: 0 };

export function BookingsView({ role }: { role: UserRole }) {
  const t = useT();
  const list = useListState<BookingRequestSortField>({ sort: "createdAt", order: "desc" });
  const [status, setStatus] = useState<BookingRequestStatusFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState<BookingRequestListItemDto | null>(null);
  const {
    data = emptyPage,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetBookingsQuery({ ...list.args, status, from, to });
  const [updateBooking] = useUpdateBookingMutation();
  const [deleteBooking] = useDeleteBookingMutation();

  const columns = useMemo<DataTableColumn<BookingRequestListItemDto>[]>(
    () =>
      column.columns([
        column.accessor("createdAt", {
          header: t("Göndərilib"),
          meta: { label: t("Göndərilib"), mobile: "hidden", className: "whitespace-nowrap" },
          cell: ({ getValue }) => formatDateTime(getValue<string>(), t.locale),
        }),
        column.accessor("name", {
          header: t("Ad"),
          meta: { label: t("Ad"), mobile: "title" },
          enableHiding: false,
          cell: ({ row }) => (
            <Link
              href={`/admin/bookings/${row.original.id}`}
              className="flex min-h-11 min-w-0 flex-col justify-center hover:underline lg:min-h-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                {row.original.unread ? (
                  <span
                    className="size-2 shrink-0 rounded-full bg-primary"
                    role="img"
                    aria-label={t("Oxunmayıb")}
                  />
                ) : null}
                <span
                  className={
                    row.original.unread ? "truncate font-medium" : "truncate text-foreground"
                  }
                >
                  {row.original.name}
                </span>
              </span>
              <span className="block truncate text-muted-foreground md:hidden">
                {formatDateTime(row.original.createdAt, t.locale)}
              </span>
            </Link>
          ),
        }),
        column.display({
          id: "phone",
          header: t("Telefon"),
          meta: { label: t("Telefon"), mobile: "detail", className: "whitespace-nowrap" },
          cell: ({ row }) => (
            <a
              href={telHref(row.original.phone)}
              className="inline-flex min-h-11 items-center hover:underline lg:min-h-0"
            >
              {formatAzerbaijaniPhone(row.original.phone)}
            </a>
          ),
        }),
        column.display({
          id: "services",
          header: t("Xidmətlər"),
          meta: { label: t("Xidmətlər"), mobile: "detail" },
          cell: ({ row }) =>
            row.original.services.length ? (
              <span className="line-clamp-2">{row.original.services.join(", ")}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
        column.accessor("preferredDate", {
          header: t("İstədiyi vaxt"),
          meta: { label: t("İstədiyi vaxt"), mobile: "detail", className: "whitespace-nowrap" },
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span>{formatDay(row.original.preferredDate, t.locale)}</span>
              <span className="text-muted-foreground">
                {t.message(bookingTimeWindowLabels[row.original.timeWindow])}
              </span>
            </span>
          ),
        }),
        column.display({
          id: "master",
          header: t("Usta"),
          meta: { label: t("Usta"), mobile: "hidden" },
          cell: ({ row }) =>
            row.original.masterName ? (
              <span className="line-clamp-2">{row.original.masterName}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
        column.accessor("status", {
          header: t("Status"),
          meta: { label: t("Status"), mobile: "detail" },
          cell: ({ row }) => <BookingStatusBadge status={row.original.status} />,
        }),
      ]),
    [t],
  );

  async function setBookingStatus(booking: BookingRequestListItemDto, next: BookingStatus) {
    try {
      await updateBooking({ id: booking.id, status: next }).unwrap();
      toast.success(
        t("«{name}»: {status}.", {
          name: booking.name,
          status: t.message(bookingStatusLabels[next]),
        }),
      );
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function remove(booking: BookingRequestListItemDto): Promise<boolean> {
    try {
      await deleteBooking(booking.id).unwrap();
      toast.success(t("«{name}» qeydiyyatı silindi.", { name: booking.name }));
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return false;
    }
  }

  function rowActions(booking: BookingRequestListItemDto) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("{name}: əməliyyatlar", { name: booking.name })}
          >
            <Ellipsis strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem asChild>
            <Link href={`/admin/bookings/${booking.id}`}>
              <Eye strokeWidth={1.5} />
              {t("Bax")}
            </Link>
          </DropdownMenuItem>
          {booking.status === "new" ? (
            <DropdownMenuItem onSelect={() => setBookingStatus(booking, "confirmed")}>
              <CalendarCheck strokeWidth={1.5} />
              {t("Təsdiqlə")}
            </DropdownMenuItem>
          ) : null}
          {booking.status === "confirmed" ? (
            <DropdownMenuItem onSelect={() => setBookingStatus(booking, "done")}>
              <CheckCheck strokeWidth={1.5} />
              {t("Tamamlandı kimi qeyd et")}
            </DropdownMenuItem>
          ) : null}
          {role === "owner" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(booking)}>
                <Trash2 strokeWidth={1.5} />
                {t("Sil")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function resetPage() {
    list.setPagination((old) => ({ ...old, pageIndex: 0 }));
  }

  const filtered = Boolean(list.args.search || status !== "all" || from || to);
  const statusOptions: { value: BookingRequestStatusFilter; label: string }[] = [
    { value: "all", label: t("Bütün qeydiyyatlar") },
    { value: "unread", label: t("Oxunmamış") },
    ...bookingStatuses.map((value) => ({
      value,
      label: t.message(bookingStatusLabels[value]),
    })),
  ];

  return (
    <>
      <PageHeader
        title={t("Qeydiyyatlar")}
        description={t(
          "Saytdakı onlayn qeydiyyat formasından gələn sorğular. Yeni qeydiyyat açılanda oxunmuş sayılır.",
        )}
        actions={
          <Button asChild variant="outline">
            <a href={bookingsExportHref({ status, search: list.args.search, from, to })} download>
              <Download strokeWidth={1.5} />
              {t("Excel-ə ixrac")}
            </a>
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
          {t("Qeydiyyatlar yüklənmədi.")}
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={data.rows}
          rowCount={data.rowCount}
          getRowId={(booking) => booking.id}
          list={list}
          loading={isLoading}
          fetching={isFetching}
          searchPlaceholder={t("Ad və ya telefon ilə axtar")}
          rowActions={rowActions}
          toolbar={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as BookingRequestStatusFilter);
                  resetPage();
                }}
              >
                <SelectTrigger aria-label={t("Status")} className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={from}
                max={to || undefined}
                aria-label={t("Tarixdən (istədiyi gün)")}
                title={t("Tarixdən (istədiyi gün)")}
                className="w-full sm:w-40"
                onChange={(event) => {
                  setFrom(event.target.value);
                  resetPage();
                }}
              />
              <Input
                type="date"
                value={to}
                min={from || undefined}
                aria-label={t("Tarixədək (istədiyi gün)")}
                title={t("Tarixədək (istədiyi gün)")}
                className="w-full sm:w-40"
                onChange={(event) => {
                  setTo(event.target.value);
                  resetPage();
                }}
              />
            </div>
          }
          empty={
            <EmptyState>
              {filtered
                ? t("Seçimə uyğun qeydiyyat tapılmadı.")
                : t("Hələ qeydiyyat yoxdur. Saytdan gələn onlayn qeydiyyatlar burada görünəcək.")}
            </EmptyState>
          }
        />
      )}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          title={t("«{name}» qeydiyyatı silinsin?", { name: deleting.name })}
          description={t("Qeydiyyat həmişəlik silinəcək. Bu əməliyyat geri qaytarılmır.")}
          confirmLabel={t("Sil")}
          destructive
          onConfirm={() => remove(deleting)}
        />
      ) : null}
    </>
  );
}
