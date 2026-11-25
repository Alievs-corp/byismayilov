"use client";

import { ArrowLeft, CalendarCheck, Phone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormLayout, FormSection } from "@/components/admin/form";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { BookingStatusBadge } from "@/components/admin/status-badge";
import { useUnsavedChangesGuard } from "@/components/admin/unsaved-changes";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatDay } from "@/lib/admin/format";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useDeleteBookingMutation,
  useGetBookingQuery,
  useUpdateBookingMutation,
} from "@/lib/api/bookings";
import { apiErrorMessage, isApiError } from "@/lib/api/types";
import type { UserRole } from "@/lib/auth/roles";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import {
  bookingLocaleLabels,
  bookingStatuses,
  bookingStatusLabels,
  bookingTimeWindowLabels,
  type BookingRequestDetailDto,
  type BookingRequestServiceDto,
  type BookingStatus,
} from "@/lib/validation/booking-requests";

const noteLimit = 5000;

export function BookingDetail({ id, role }: { id: string; role: UserRole }) {
  const t = useT();
  const query = useGetBookingQuery(id, { refetchOnMountOrArgChange: true });

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-8" />
          <Skeleton className="h-96 lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    const missing = isApiError(query.error) && query.error.status === 404;
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link href="/admin/bookings">{t("Qeydiyyatlara qayıt")}</Link>
          </Button>
        }
      >
        {missing ? t("Qeydiyyat tapılmadı.") : t("Qeydiyyat yüklənmədi. Səhifəni yeniləyin.")}
      </EmptyState>
    );
  }

  return <BookingView key={query.data.id} booking={query.data} role={role} />;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <dt className="text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ServiceRow({ service }: { service: BookingRequestServiceDto }) {
  const t = useT();
  return (
    <li className="py-2">
      {service.serviceId ? (
        <Link
          href={`/admin/services/${service.serviceId}`}
          className="block min-h-11 content-center break-words hover:underline lg:min-h-0"
        >
          {service.name}
        </Link>
      ) : (
        <span className="block break-words">{service.name}</span>
      )}
      {!service.serviceId ? (
        <span className="block text-muted-foreground">{t("Xidmət saytdan silinib.")}</span>
      ) : service.inTrash ? (
        <span className="block text-muted-foreground">{t("Xidmət silinənlərdədir.")}</span>
      ) : null}
    </li>
  );
}

function BookingView({ booking, role }: { booking: BookingRequestDetailDto; role: UserRole }) {
  const t = useT();
  const router = useRouter();
  const noteId = useId();
  const [note, setNote] = useState(booking.adminNote ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updateBooking, { isLoading: updating }] = useUpdateBookingMutation();
  const [deleteBooking] = useDeleteBookingMutation();
  const noteDirty = note.trim() !== (booking.adminNote ?? "");
  const guard = useUnsavedChangesGuard(noteDirty);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function changeStatus(status: BookingStatus) {
    try {
      await updateBooking({ id: booking.id, status }).unwrap();
      toast.success(t("Status: {status}.", { status: t.message(bookingStatusLabels[status]) }));
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function saveNote() {
    setNoteError(null);
    try {
      const saved = await updateBooking({ id: booking.id, adminNote: note }).unwrap();
      setNote(saved.adminNote ?? "");
      toast.success(t("Qeyd saxlanıldı."));
    } catch (error) {
      const message = isApiError(error)
        ? t.message(error.data.fields?.adminNote ?? error.data.message)
        : apiErrorMessage(error);
      setNoteError(message);
    }
  }

  async function remove(): Promise<boolean> {
    try {
      await deleteBooking(booking.id).unwrap();
      guard.release();
      toast.success(t("Qeydiyyat silindi."));
      router.push("/admin/bookings");
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return false;
    }
  }

  return (
    <>
      <PageHeader
        title={booking.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span>
              {t("Göndərilib: {date}", { date: formatDateTime(booking.createdAt, t.locale) })}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/bookings">
                <ArrowLeft strokeWidth={1.5} />
                {t("Bütün qeydiyyatlar")}
              </Link>
            </Button>
            {booking.status === "new" ? (
              <Button type="button" disabled={updating} onClick={() => changeStatus("confirmed")}>
                <CalendarCheck strokeWidth={1.5} />
                {t("Təsdiqlə")}
              </Button>
            ) : null}
          </>
        }
      />

      <FormLayout
        main={
          <>
            <FormSection title={t("Müştəri")}>
              <dl className="flex flex-col gap-3 text-meta">
                <DetailRow label={t("Telefon")}>
                  <span className="flex flex-wrap items-center gap-2">
                    <a
                      href={telHref(booking.phone)}
                      className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap hover:underline lg:min-h-0"
                    >
                      <Phone className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      {formatAzerbaijaniPhone(booking.phone)}
                    </a>
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        href={whatsappHref(booking.phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("{name}: WhatsApp-da yaz", { name: booking.name })}
                        title={t("WhatsApp-da yaz")}
                      >
                        <WhatsAppIcon className="size-4" />
                      </a>
                    </Button>
                  </span>
                </DetailRow>
                <DetailRow label={t("İstədiyi tarix")}>
                  {booking.preferredDate ? (
                    formatDay(booking.preferredDate, t.locale)
                  ) : (
                    <span className="text-muted-foreground">{t("Seçilməyib")}</span>
                  )}
                </DetailRow>
                <DetailRow label={t("Vaxt")}>
                  {t.message(bookingTimeWindowLabels[booking.timeWindow])}
                </DetailRow>
                <DetailRow label={t("Usta")}>
                  {booking.masterName ? (
                    booking.masterId ? (
                      <Link
                        href="/admin/masters"
                        className="inline-flex min-h-11 items-center hover:underline lg:min-h-0"
                      >
                        {booking.masterName}
                      </Link>
                    ) : (
                      booking.masterName
                    )
                  ) : (
                    <span className="text-muted-foreground">{t("Fərq etməz")}</span>
                  )}
                </DetailRow>
              </dl>
            </FormSection>

            <FormSection title={t("Mesaj")}>
              {booking.message ? (
                <p className="text-meta break-words whitespace-pre-line">{booking.message}</p>
              ) : (
                <p className="text-meta text-muted-foreground">{t("Müştəri mesaj yazmayıb.")}</p>
              )}
            </FormSection>

            <FormSection title={t("Xidmətlər ({count})", { count: booking.services.length })}>
              {booking.services.length ? (
                <ul className="divide-y divide-border text-meta">
                  {booking.services.map((service) => (
                    <ServiceRow key={service.id} service={service} />
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-muted-foreground">
                  {t("Qeydiyyat konkret xidmət seçilmədən göndərilib.")}
                </p>
              )}
            </FormSection>
          </>
        }
        aside={
          <>
            <FormSection title={t("Status")}>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${noteId}-status`} className="text-meta font-medium">
                  {t("Qeydiyyatın vəziyyəti")}
                </label>
                <Select
                  value={booking.status}
                  onValueChange={(value) => changeStatus(value as BookingStatus)}
                  disabled={updating}
                >
                  <SelectTrigger id={`${noteId}-status`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t.message(bookingStatusLabels[status])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>

            <FormSection title={t("Admin qeydi")}>
              <div className="flex flex-col gap-2">
                <label htmlFor={noteId} className="text-meta font-medium">
                  {t("Qeyd")}
                </label>
                <Textarea
                  id={noteId}
                  value={note}
                  rows={5}
                  maxLength={noteLimit}
                  aria-invalid={Boolean(noteError)}
                  aria-describedby={`${noteId}-help`}
                  onChange={(event) => setNote(event.target.value)}
                />
                <p id={`${noteId}-help`} className="text-meta text-muted-foreground">
                  {t("Yalnız idarə panelində görünür, müştəriyə göndərilmir.")}
                </p>
                {noteError ? <p className="text-meta text-destructive">{noteError}</p> : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={!noteDirty || updating}
                  onClick={saveNote}
                >
                  {t("Qeydi saxla")}
                </Button>
              </div>
            </FormSection>

            <FormSection title={t("Məlumat")}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
                <dt className="text-muted-foreground">{t("Sayt dili")}</dt>
                <dd>{t.message(bookingLocaleLabels[booking.locale])}</dd>
                <dt className="text-muted-foreground">{t("Göndərilib")}</dt>
                <dd>{t("{date} (Bakı)", { date: formatDateTime(booking.createdAt, t.locale) })}</dd>
                <dt className="text-muted-foreground">{t("Dəyişib")}</dt>
                <dd>{formatDateTime(booking.updatedAt, t.locale)}</dd>
              </dl>
              {role === "owner" ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="self-start"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 strokeWidth={1.5} />
                  {t("Sil")}
                </Button>
              ) : null}
            </FormSection>
          </>
        }
      />

      {guard.dialog}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("«{name}» qeydiyyatı silinsin?", { name: booking.name })}
        description={t(
          "Qeydiyyat həmişəlik silinəcək. Spam və ya təkrar sorğular üçün istifadə edin.",
        )}
        confirmLabel={t("Sil")}
        destructive
        onConfirm={remove}
      />
    </>
  );
}
