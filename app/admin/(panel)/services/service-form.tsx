"use client";

import { Copy, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CategoryMultiSelect } from "@/components/admin/category-select";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  applyServerErrors,
  FormActions,
  FormAlert,
  FormField,
  FormLayout,
  FormSection,
  useZodForm,
} from "@/components/admin/form";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { SeoFields } from "@/components/admin/seo-fields";
import { SlugInput } from "@/components/admin/slug-input";
import { PublishStatusBadge } from "@/components/admin/status-badge";
import { useUnsavedChangesGuard } from "@/components/admin/unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/admin/format";
import {
  copyEmptyFromDefault,
  filledLocales,
  formRichText,
  formText,
  hasLocaleError,
} from "@/lib/admin/form-values";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useBulkServicesMutation,
  useCreateServiceMutation,
  useDuplicateServiceMutation,
  useUpdateServiceMutation,
} from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/types";
import { richTextToPlain, type RichTextDoc } from "@/lib/content/rich-text";
import { localePath, locales, type Locale } from "@/lib/i18n/config";
import type { Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";
import { slugify } from "@/lib/slug";
import type { CategoryNodeDto } from "@/lib/validation/categories";
import type { MediaDto } from "@/lib/validation/media";
import { useContentText } from "@/lib/store/hooks";
import {
  serviceInputSchema,
  servicePriceKindLabels,
  servicePriceKinds,
  type ServiceDetailDto,
  type ServiceInput,
} from "@/lib/validation/services";

import { ServiceGallery } from "./service-gallery";

const emptyLocalized = { az: "", ru: "", en: "" };

function inputValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function richText(value: Localized<RichTextDoc> | null) {
  return formRichText(value);
}

function toFormValues(service: ServiceDetailDto | null): ServiceInput {
  if (!service) {
    return {
      name: { ...emptyLocalized },
      slug: { ...emptyLocalized },
      shortDescription: richText(null),
      description: richText(null),
      categoryIds: [],
      priceKind: "on_request",
      priceAmount: "",
      durationMinutes: "",
      images: [],
      seoTitle: { ...emptyLocalized },
      seoDescription: { ...emptyLocalized },
      status: "draft",
      isFeatured: false,
    };
  }
  const text = formText;
  return {
    name: text(service.name),
    slug: text(service.slug),
    shortDescription: richText(service.shortDescription),
    description: richText(service.description),
    categoryIds: service.categoryIds,
    priceKind: service.priceKind,
    priceAmount: service.priceAmount === null ? "" : String(service.priceAmount),
    durationMinutes: service.durationMinutes === null ? "" : String(service.durationMinutes),
    images: service.images.map((image) => ({ mediaId: image.mediaId, alt: text(image.alt) })),
    seoTitle: text(service.seoTitle),
    seoDescription: text(service.seoDescription),
    status: service.status,
    isFeatured: service.isFeatured,
  };
}

export function ServiceForm({
  service,
  categories,
}: {
  service: ServiceDetailDto | null;
  categories: CategoryNodeDto[];
}) {
  const t = useT();
  const text = useContentText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mediaById, setMediaById] = useState(
    () => new Map((service?.media ?? []).map((item) => [item.id, item])),
  );
  const [slugTouched, setSlugTouched] = useState<Record<Locale, boolean>>({
    az: Boolean(service),
    ru: Boolean(service?.slug.ru),
    en: Boolean(service?.slug.en),
  });
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [createService] = useCreateServiceMutation();
  const [updateService] = useUpdateServiceMutation();
  const [duplicateService, { isLoading: duplicating }] = useDuplicateServiceMutation();
  const [bulkServices] = useBulkServicesMutation();

  const form = useZodForm(serviceInputSchema, { defaultValues: toFormValues(service) });
  const { isDirty, isSubmitting, errors } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting);

  const values = useWatch({ control: form.control });
  const name = values.name;
  const status = values.status ?? "draft";

  function remember(media: MediaDto[]) {
    setMediaById((current) => {
      const next = new Map(current);
      for (const item of media) next.set(item.id, item);
      return next;
    });
  }

  const priceKind = values.priceKind ?? "on_request";

  const textInvalid = useMemo(() => {
    const result: Partial<Record<Locale, boolean>> = {};
    for (const locale of locales) {
      result[locale] =
        hasLocaleError(errors.name, locale) ||
        hasLocaleError(errors.slug, locale) ||
        hasLocaleError(errors.shortDescription, locale) ||
        hasLocaleError(errors.description, locale);
    }
    return result;
  }, [errors.name, errors.slug, errors.shortDescription, errors.description]);

  const onSubmit = form.handleSubmit(
    async (payload) => {
      setError(null);
      try {
        if (service) {
          await updateService({ id: service.id, ...payload }).unwrap();
          form.reset(form.getValues());
          toast.success(
            status === "published" ? t("Saxlanıldı, saytda yeniləndi.") : t("Saxlanıldı."),
          );
        } else {
          const created = await createService(payload).unwrap();
          guard.release();
          toast.success(t("Xidmət yaradıldı."));
          router.replace(`/admin/services/${created.id}`);
        }
      } catch (caught) {
        setError(applyServerErrors(form, caught));
      }
    },
    () => setError(t("Formada səhvlər var. Qırmızı sahələri düzəldin.")),
  );

  async function duplicate() {
    if (!service) return;
    try {
      const copy = await duplicateService(service.id).unwrap();
      toast.success(t("Kopya qaralama kimi yaradıldı."));
      router.push(`/admin/services/${copy.id}`);
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function changeTrash(action: "trash" | "restore"): Promise<boolean> {
    if (!service) return false;
    try {
      await bulkServices({ action, ids: [service.id] }).unwrap();
      if (action === "trash") {
        guard.release();
        toast.success(t("Xidmət silinənlərə köçürüldü. 30 gün ərzində bərpa etmək olar."));
        router.push("/admin/services");
      } else {
        toast.success(t("Xidmət bərpa olundu və qaralamadadır."));
      }
      return true;
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
      return false;
    }
  }

  const title = service ? text(service.name) : t("Yeni xidmət");
  const publicHref =
    service && service.status === "published" && !service.deletedAt
      ? localePath("az", routes.service(service.slug.az))
      : null;

  const saveButton = (
    <Button type="submit" form="service-form" disabled={isSubmitting}>
      {isSubmitting ? t("Saxlanılır") : service ? t("Saxla") : t("Yarat")}
    </Button>
  );

  return (
    <FormProvider {...form}>
      <PageHeader
        title={title}
        description={
          service ? (
            <span className="flex flex-wrap items-center gap-2">
              <PublishStatusBadge status={service.status} />
              <span>
                {t("Son dəyişiklik: {date}", {
                  date: formatDateTime(service.updatedAt, t.locale),
                })}
              </span>
            </span>
          ) : (
            t("Xidməti əvvəl qaralama kimi yaradın, hazır olanda dərc edin.")
          )
        }
        actions={
          <>
            {publicHref ? (
              <Button asChild variant="ghost" size="sm">
                <a href={publicHref} target="_blank" rel="noreferrer">
                  <ExternalLink strokeWidth={1.5} />
                  {t("Saytda bax")}
                </a>
              </Button>
            ) : null}
            {service ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={duplicate}
                disabled={duplicating}
              >
                <Copy strokeWidth={1.5} />
                {t("Kopyasını yarat")}
              </Button>
            ) : null}
            <span className="max-md:hidden">{saveButton}</span>
          </>
        }
      />

      {service?.deletedAt ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border bg-white p-4 text-meta">
          <p>{t("Bu xidmət silinənlərdədir və saytda görünmür.")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => changeTrash("restore")}>
            <RotateCcw strokeWidth={1.5} />
            {t("Bərpa et")}
          </Button>
        </div>
      ) : null}

      <form id="service-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormAlert message={error} />
        <FormLayout
          main={
            <>
              <FormSection title={t("Əsas məlumat")}>
                <LocaleTabs
                  onCopyFromDefault={(locale) =>
                    copyEmptyFromDefault(form, ["name", "shortDescription", "description"], locale)
                  }
                  invalid={textInvalid}
                  filled={filledLocales(name)}
                >
                  {(locale) => (
                    <>
                      <FormField
                        control={form.control}
                        name={`name.${locale}`}
                        label={t("Ad ({locale})", { locale: locale.toUpperCase() })}
                        required={locale === "az"}
                        render={({ field, id, invalid, describedBy }) => (
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            id={id}
                            maxLength={200}
                            aria-invalid={invalid}
                            aria-describedby={describedBy}
                            onChange={(event) => {
                              field.onChange(event);
                              if (!slugTouched[locale]) {
                                form.setValue(`slug.${locale}`, slugify(event.target.value), {
                                  shouldDirty: true,
                                });
                              }
                            }}
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`slug.${locale}`}
                        label={t("Ünvan ({locale})", { locale: locale.toUpperCase() })}
                        required={locale === "az"}
                        render={({ field, id, invalid, describedBy }) => (
                          <SlugInput
                            id={id}
                            value={field.value ?? ""}
                            onChange={(next) => {
                              setSlugTouched((current) => ({ ...current, [locale]: true }));
                              field.onChange(next);
                            }}
                            onBlur={field.onBlur}
                            entity="service"
                            locale={locale}
                            excludeId={service?.id}
                            source={name?.[locale] ?? ""}
                            pathFor={routes.service}
                            invalid={invalid}
                            describedBy={describedBy}
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`shortDescription.${locale}`}
                        label={t("Qısa təsvir ({locale})", { locale: locale.toUpperCase() })}
                        description={t(
                          "Xidmətlər siyahısında və xidmət səhifəsinin yuxarısında göstərilir.",
                        )}
                        render={({ field, id, invalid, describedBy }) => (
                          <RichTextEditor
                            minimal
                            id={id}
                            value={field.value}
                            onChange={field.onChange}
                            invalid={invalid}
                            describedBy={describedBy}
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`description.${locale}`}
                        label={t("Ətraflı təsvir ({locale})", { locale: locale.toUpperCase() })}
                        render={({ field, id, invalid, describedBy }) => (
                          <RichTextEditor
                            id={id}
                            value={field.value}
                            onChange={field.onChange}
                            invalid={invalid}
                            describedBy={describedBy}
                          />
                        )}
                      />
                    </>
                  )}
                </LocaleTabs>
              </FormSection>

              <FormSection title={t("Şəkillər")}>
                <ServiceGallery mediaById={mediaById} remember={remember} />
              </FormSection>
            </>
          }
          aside={
            <>
              <FormSection title={t("Dərc")}>
                <FormField
                  control={form.control}
                  name="status"
                  label={t("Status")}
                  description={
                    status === "published"
                      ? t("Saxlayanda dəyişiklik saytda bir neçə saniyəyə görünür.")
                      : t("Qaralama saytda görünmür.")
                  }
                  render={({ field, id, invalid, describedBy }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id={id}
                        className="w-full"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t("Qaralama")}</SelectItem>
                        <SelectItem value="published">{t("Dərc olunub")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isFeatured"
                  label={t("Ana səhifədə göstər")}
                  description={t(
                    "Seçilmiş xidmətlər ana səhifədə görünür. Sıranı «Ana səhifə bölmələri»ndə dəyişin.",
                  )}
                  render={({ field, id, describedBy }) => (
                    <Switch
                      id={id}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-describedby={describedBy}
                    />
                  )}
                />
                {service ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
                    <dt className="text-muted-foreground">{t("Yaradılıb")}</dt>
                    <dd>{formatDateTime(service.createdAt, t.locale)}</dd>
                    <dt className="text-muted-foreground">{t("Dərc olunub")}</dt>
                    <dd>{formatDateTime(service.publishedAt, t.locale)}</dd>
                  </dl>
                ) : null}
                {service && !service.deletedAt ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="self-start"
                    onClick={() => setConfirmTrash(true)}
                  >
                    <Trash2 strokeWidth={1.5} />
                    {t("Sil")}
                  </Button>
                ) : null}
              </FormSection>

              <FormSection title={t("Qiymət və müddət")}>
                <FormField
                  control={form.control}
                  name="priceKind"
                  label={t("Qiymət növü")}
                  render={({ field, id, invalid, describedBy }) => (
                    <Select
                      value={field.value}
                      onValueChange={(next) => {
                        field.onChange(next);
                        if (next === "on_request") {
                          form.setValue("priceAmount", "", { shouldDirty: true });
                          form.clearErrors("priceAmount");
                        }
                      }}
                    >
                      <SelectTrigger
                        id={id}
                        className="w-full"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {servicePriceKinds.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t.message(servicePriceKindLabels[kind])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {priceKind === "on_request" ? null : (
                  <FormField
                    control={form.control}
                    name="priceAmount"
                    label={t("Qiymət, AZN")}
                    required
                    description={
                      priceKind === "from"
                        ? t("Saytda «{amount} AZN-dən» kimi göstərilir.", { amount: "30" })
                        : t("Saytda «{amount} AZN» kimi göstərilir.", { amount: "30" })
                    }
                    render={({ field, id, invalid, describedBy }) => (
                      <Input
                        {...field}
                        value={inputValue(field.value)}
                        id={id}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                      />
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  label={t("Müddət, dəqiqə")}
                  description={t("İstəyə bağlıdır. Məsələn 60.")}
                  render={({ field, id, invalid, describedBy }) => (
                    <Input
                      {...field}
                      value={inputValue(field.value)}
                      id={id}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                    />
                  )}
                />
              </FormSection>

              <FormSection title={t("Kateqoriyalar")}>
                <FormField
                  control={form.control}
                  name="categoryIds"
                  label={t("Kateqoriyalar")}
                  render={({ field, id, invalid, describedBy }) => (
                    <CategoryMultiSelect
                      id={id}
                      categories={categories}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={invalid}
                      describedBy={describedBy}
                    />
                  )}
                />
              </FormSection>

              <FormSection title={t("Axtarış sistemləri")}>
                <LocaleTabs
                  filled={{
                    ru: Boolean(values.seoTitle?.ru || values.seoDescription?.ru),
                    en: Boolean(values.seoTitle?.en || values.seoDescription?.en),
                  }}
                >
                  {(locale) => (
                    <SeoFields
                      locale={locale}
                      title={values.seoTitle?.[locale] ?? ""}
                      description={values.seoDescription?.[locale] ?? ""}
                      onTitleChange={(next) =>
                        form.setValue(`seoTitle.${locale}`, next, { shouldDirty: true })
                      }
                      onDescriptionChange={(next) =>
                        form.setValue(`seoDescription.${locale}`, next, { shouldDirty: true })
                      }
                      fallbackTitle={`${name?.[locale] || name?.az || ""} | byismayilov`}
                      fallbackDescription={richTextToPlain(
                        (values.shortDescription?.[locale] ??
                          values.shortDescription?.az ??
                          null) as RichTextDoc | null,
                      ).slice(0, 160)}
                      path={routes.service(values.slug?.[locale] || values.slug?.az || "")}
                      errors={{
                        title: errors.seoTitle?.[locale]?.message,
                        description: errors.seoDescription?.[locale]?.message,
                      }}
                    />
                  )}
                </LocaleTabs>
              </FormSection>
            </>
          }
        />
        <FormActions className="md:hidden">{saveButton}</FormActions>
      </form>

      {guard.dialog}
      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        title={t("«{name}» silinsin?", { name: title })}
        description={t(
          "Xidmət saytdan götürüləcək və silinənlərə düşəcək. 30 gün ərzində bərpa etmək olar.",
        )}
        confirmLabel={t("Sil")}
        destructive
        onConfirm={() => changeTrash("trash")}
      />
    </FormProvider>
  );
}
