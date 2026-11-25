"use client";

import { useState } from "react";
import { toast } from "sonner";

import { applyServerErrors, FormAlert, FormField, useZodForm } from "@/components/admin/form";
import { ImagePicker } from "@/components/admin/image-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/admin/i18n/use-t";
import { useCreateReviewMutation, useUpdateReviewMutation } from "@/lib/api/reviews";
import type { MediaDto } from "@/lib/validation/media";
import { reviewInputSchema, type ReviewDto } from "@/lib/validation/reviews";

const noRating = "none";

export function ReviewDialog({
  review,
  onClose,
}: {
  review: ReviewDto | null;
  onClose: () => void;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<MediaDto | null>(review?.photo ?? null);
  const [createReview] = useCreateReviewMutation();
  const [updateReview] = useUpdateReviewMutation();
  const form = useZodForm(reviewInputSchema, {
    defaultValues: {
      authorName: review?.authorName ?? "",
      body: review?.body ?? "",
      rating: review?.rating ?? null,
      photoId: review?.photo?.id ?? "",
      sourceUrl: review?.sourceUrl ?? "",
      isActive: review?.isActive ?? true,
    },
  });
  const { isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const input = form.getValues();
    try {
      if (review) {
        await updateReview({ id: review.id, ...input }).unwrap();
        toast.success(t("«{name}» saxlanıldı.", { name: values.authorName }));
      } else {
        await createReview(input).unwrap();
        toast.success(t("«{name}» əlavə olundu.", { name: values.authorName }));
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
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{review ? t("Rəyi redaktə et") : t("Yeni rəy")}</DialogTitle>
          <DialogDescription>
            {t("Rəyi müştərinin yazdığı kimi, öz dilində köçürün. Uydurma rəy əlavə etməyin.")}
          </DialogDescription>
        </DialogHeader>
        <form id="review-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormAlert message={error} />
          <FormField
            control={form.control}
            name="authorName"
            label={t("Müştərinin adı")}
            required
            render={({ field, id, invalid, describedBy }) => (
              <Input
                {...field}
                id={id}
                maxLength={120}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          />
          <FormField
            control={form.control}
            name="body"
            label={t("Rəy")}
            required
            render={({ field, id, invalid, describedBy }) => (
              <Textarea
                {...field}
                id={id}
                rows={5}
                maxLength={2000}
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          />
          <FormField
            control={form.control}
            name="rating"
            label={t("Qiymət")}
            description={t("Müştəri qiymət verməyibsə, boş saxlayın.")}
            render={({ field, id, invalid, describedBy }) => (
              <Select
                value={field.value ? String(field.value) : noRating}
                onValueChange={(value) => field.onChange(value === noRating ? null : Number(value))}
              >
                <SelectTrigger
                  id={id}
                  className="w-full sm:w-48"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noRating}>{t("Qiymət yoxdur")}</SelectItem>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {t("Qiymət: {count}/5", { count: value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="photoId"
            label={t("Foto")}
            description={t("İstəyə bağlı. Yalnız müştərinin icazəsi ilə.")}
            render={({ field, id, invalid, describedBy }) => (
              <ImagePicker
                id={id}
                label={t("Foto")}
                value={photo}
                invalid={invalid}
                describedBy={describedBy}
                onChange={(media) => {
                  setPhoto(media);
                  field.onChange(media?.id ?? "");
                  field.onBlur();
                }}
              />
            )}
          />
          <FormField
            control={form.control}
            name="sourceUrl"
            label={t("Mənbə")}
            description={t("Rəyin yazıldığı yer, məsələn Instagram və ya Google keçidi.")}
            render={({ field, id, invalid, describedBy }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                id={id}
                type="url"
                inputMode="url"
                placeholder="https://"
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          />
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
          <Button type="submit" form="review-form" disabled={isSubmitting}>
            {isSubmitting ? t("Saxlanılır") : review ? t("Saxla") : t("Əlavə et")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
