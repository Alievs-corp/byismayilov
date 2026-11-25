"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { applyServerErrors, FormAlert, FormField, useZodForm } from "@/components/admin/form";
import { ImagePicker } from "@/components/admin/image-picker";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { filledLocales, formText, hasLocaleError } from "@/lib/admin/form-values";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useCreateGalleryItemMutation,
  useGetGalleryOptionsQuery,
  useUpdateGalleryItemMutation,
} from "@/lib/api/gallery";
import { locales, type Locale } from "@/lib/i18n/config";
import { galleryItemInputSchema, type GalleryItemDto } from "@/lib/validation/gallery";
import { mediaKindOf, type MediaDto } from "@/lib/validation/media";

const none = "none";

type MediaKindChoice = "image" | "video";

export function GalleryItemDialog({
  item,
  onClose,
}: {
  item: GalleryItemDto | null;
  onClose: () => void;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<MediaDto | null>(item?.media ?? null);
  const [before, setBefore] = useState<MediaDto | null>(item?.before ?? null);
  const [poster, setPoster] = useState<MediaDto | null>(item?.poster ?? null);
  const [kind, setKind] = useState<MediaKindChoice>(
    item?.media && mediaKindOf(item.media.mimeType) === "video" ? "video" : "image",
  );
  const { data: options } = useGetGalleryOptionsQuery();
  const [createItem] = useCreateGalleryItemMutation();
  const [updateItem] = useUpdateGalleryItemMutation();
  const form = useZodForm(galleryItemInputSchema, {
    defaultValues: {
      mediaId: item?.media?.id ?? "",
      beforeMediaId: item?.before?.id ?? "",
      posterId: item?.poster?.id ?? "",
      caption: formText(item?.caption),
      categoryId: item?.categoryId ?? "",
      masterId: item?.masterId ?? "",
      isActive: item?.isActive ?? true,
    },
  });
  const { isSubmitting, errors } = form.formState;
  const caption = useWatch({ control: form.control, name: "caption" });

  const captionInvalid: Partial<Record<Locale, boolean>> = {};
  for (const locale of locales) captionInvalid[locale] = hasLocaleError(errors.caption, locale);

  function switchKind(next: MediaKindChoice) {
    if (next === kind) return;
    setKind(next);
    setFile(null);
    form.setValue("mediaId", "", { shouldDirty: true });
    if (next === "video") {
      setBefore(null);
      form.setValue("beforeMediaId", "", { shouldDirty: true });
    } else {
      setPoster(null);
      form.setValue("posterId", "", { shouldDirty: true });
    }
  }

  const onSubmit = form.handleSubmit(async () => {
    setError(null);
    const input = form.getValues();
    try {
      if (item) {
        await updateItem({ id: item.id, ...input }).unwrap();
        toast.success(t("İş saxlanıldı."));
      } else {
        await createItem(input).unwrap();
        toast.success(t("İş əlavə olundu."));
      }
      onClose();
    } catch (caught) {
      setError(applyServerErrors(form, caught));
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("İşi redaktə et") : t("Yeni iş")}</DialogTitle>
          <DialogDescription>
            {t("İşlər «İşlərimiz» səhifəsində bu sırada göstərilir.")}
          </DialogDescription>
        </DialogHeader>
        <form id="gallery-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormAlert message={error} />
          <Tabs value={kind} onValueChange={(value) => switchKind(value as MediaKindChoice)}>
            <TabsList aria-label={t("Növ")}>
              <TabsTrigger value="image">{t("Şəkil")}</TabsTrigger>
              <TabsTrigger value="video">{t("Video")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <FormField
            control={form.control}
            name="mediaId"
            label={kind === "video" ? t("Video") : t("Şəkil (nəticə)")}
            required
            render={({ field, id, invalid, describedBy }) => (
              <ImagePicker
                id={id}
                kind={kind}
                label={kind === "video" ? "Video" : "Şəkil"}
                value={file}
                invalid={invalid}
                describedBy={describedBy}
                onChange={(media) => {
                  setFile(media);
                  field.onChange(media?.id ?? "");
                  field.onBlur();
                }}
              />
            )}
          />
          {kind === "image" ? (
            <FormField
              control={form.control}
              name="beforeMediaId"
              label={t("«Əvvəl» şəkli")}
              description={t("İstəyə bağlı: əvvəl və sonra müqayisəsi üçün.")}
              render={({ field, id, invalid, describedBy }) => (
                <ImagePicker
                  id={id}
                  label="Şəkil"
                  value={before}
                  invalid={invalid}
                  describedBy={describedBy}
                  onChange={(media) => {
                    setBefore(media);
                    field.onChange(media?.id ?? "");
                    field.onBlur();
                  }}
                />
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="posterId"
              label={t("Poster")}
              description={t("Video yüklənənə qədər göstərilən şəkil.")}
              render={({ field, id, invalid, describedBy }) => (
                <ImagePicker
                  id={id}
                  label="Poster"
                  value={poster}
                  invalid={invalid}
                  describedBy={describedBy}
                  onChange={(media) => {
                    setPoster(media);
                    field.onChange(media?.id ?? "");
                    field.onBlur();
                  }}
                />
              )}
            />
          )}
          <LocaleTabs
            invalid={captionInvalid}
            filled={{ ru: filledLocales(caption).ru, en: filledLocales(caption).en }}
          >
            {(locale) => (
              <FormField
                control={form.control}
                name={`caption.${locale}`}
                label={t("İzah ({locale})", { locale: locale.toUpperCase() })}
                description={t("Qısa izah. Boş qalsa, saytda göstərilmir.")}
                render={({ field, id, invalid, describedBy }) => (
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id={id}
                    maxLength={300}
                    autoComplete="off"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                  />
                )}
              />
            )}
          </LocaleTabs>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="categoryId"
              label={t("Kateqoriya")}
              render={({ field, id, invalid, describedBy }) => (
                <Select
                  value={field.value || none}
                  onValueChange={(value) => field.onChange(value === none ? "" : value)}
                >
                  <SelectTrigger
                    id={id}
                    className="w-full"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={none}>{t("Seçilməyib")}</SelectItem>
                    {(options?.categories ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.parentId ? `— ${category.name}` : category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={form.control}
              name="masterId"
              label={t("Usta")}
              render={({ field, id, invalid, describedBy }) => (
                <Select
                  value={field.value || none}
                  onValueChange={(value) => field.onChange(value === none ? "" : value)}
                >
                  <SelectTrigger
                    id={id}
                    className="w-full"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={none}>{t("Seçilməyib")}</SelectItem>
                    {(options?.masters ?? []).map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {master.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isActive"
            label={t("Saytda göstər")}
            render={({ field, id, describedBy }) => (
              <Switch
                id={id}
                className="self-start"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={describedBy}
              />
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={isSubmitting} onClick={onClose}>
            {t("Ləğv et")}
          </Button>
          <Button type="submit" form="gallery-form" disabled={isSubmitting}>
            {isSubmitting ? t("Saxlanılır") : item ? t("Saxla") : t("Əlavə et")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
