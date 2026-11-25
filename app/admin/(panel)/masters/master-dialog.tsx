"use client";

import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { applyServerErrors, FormAlert, FormField, useZodForm } from "@/components/admin/form";
import { ImagePicker } from "@/components/admin/image-picker";
import { LocaleTabs } from "@/components/admin/locale-tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { filledLocales, formText, hasLocaleError } from "@/lib/admin/form-values";
import { useT } from "@/lib/admin/i18n/use-t";
import {
  useCreateMasterMutation,
  useGetMasterServiceOptionsQuery,
  useUpdateMasterMutation,
} from "@/lib/api/masters";
import { locales, type Locale } from "@/lib/i18n/config";
import { pickLocale } from "@/lib/i18n/localized";
import { masterInputSchema, type MasterDto } from "@/lib/validation/masters";
import type { MediaDto } from "@/lib/validation/media";

function ServiceChecklist({
  id,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: string[];
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string[]) => void;
}) {
  const t = useT();
  const { data = [], isLoading, isError } = useGetMasterServiceOptionsQuery();
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const query = search.trim().toLocaleLowerCase("az");
  const options = query
    ? data.filter((option) => option.name.toLocaleLowerCase("az").includes(query))
    : data;

  if (isError) {
    return <p className="text-meta text-destructive">{t("Xidmətlər yüklənmədi.")}</p>;
  }

  return (
    <div className="flex flex-col gap-2" aria-describedby={describedBy}>
      <Input
        id={id}
        type="search"
        value={search}
        placeholder={t("Xidmət axtar")}
        aria-invalid={invalid}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div
        className="max-h-56 overflow-y-auto border border-border"
        role="group"
        aria-label={t("Xidmətlər")}
      >
        {isLoading ? (
          <p className="p-3 text-meta text-muted-foreground">{t("Yüklənir")}</p>
        ) : options.length === 0 ? (
          <p className="p-3 text-meta text-muted-foreground">
            {data.length ? t("Axtarışa uyğun xidmət yoxdur.") : t("Hələ xidmət əlavə olunmayıb.")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {options.map((option) => (
              <li key={option.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-meta">
                  <Checkbox
                    checked={selected.has(option.id)}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? [...value, option.id]
                          : value.filter((serviceId) => serviceId !== option.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 break-words">{option.name}</span>
                  {option.status === "draft" ? (
                    <span className="text-muted-foreground">{t("Qaralama")}</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-meta text-muted-foreground">
        {t("Seçilib: {count}", { count: value.length })}
      </p>
    </div>
  );
}

export function MasterDialog({
  member,
  onClose,
}: {
  member: MasterDto | null;
  onClose: () => void;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<MediaDto | null>(member?.photo ?? null);
  const [createMaster] = useCreateMasterMutation();
  const [updateMaster] = useUpdateMasterMutation();
  const form = useZodForm(masterInputSchema, {
    defaultValues: {
      name: formText(member?.name),
      role: formText(member?.role),
      bio: formText(member?.bio),
      photoId: member?.photo?.id ?? "",
      instagramUrl: member?.instagramUrl ?? "",
      serviceIds: member?.serviceIds ?? [],
      isActive: member?.isActive ?? true,
    },
  });
  const { isSubmitting, errors } = form.formState;
  const name = useWatch({ control: form.control, name: "name" });
  const role = useWatch({ control: form.control, name: "role" });

  const textInvalid: Partial<Record<Locale, boolean>> = {};
  for (const locale of locales) {
    textInvalid[locale] =
      hasLocaleError(errors.name, locale) ||
      hasLocaleError(errors.role, locale) ||
      hasLocaleError(errors.bio, locale);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const label = pickLocale(values.name, t.locale);
    const input = form.getValues();
    try {
      if (member) {
        await updateMaster({ id: member.id, ...input }).unwrap();
        toast.success(t("«{name}» saxlanıldı.", { name: label }));
      } else {
        await createMaster(input).unwrap();
        toast.success(t("«{name}» əlavə olundu.", { name: label }));
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
          <DialogTitle>{member ? t("Ustanı redaktə et") : t("Yeni usta")}</DialogTitle>
          <DialogDescription>
            {t("Usta «Ustalar» səhifəsində və qeydiyyat formasında göstərilir.")}
          </DialogDescription>
        </DialogHeader>
        <form id="master-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormAlert message={error} />
          <FormField
            control={form.control}
            name="photoId"
            label={t("Foto")}
            description={t("Kvadrat və ya portret foto, ən azı 800 px.")}
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
          <LocaleTabs
            invalid={textInvalid}
            filled={{
              ru: filledLocales(name).ru || filledLocales(role).ru,
              en: filledLocales(name).en || filledLocales(role).en,
            }}
          >
            {(locale) => (
              <>
                <FormField
                  control={form.control}
                  name={`name.${locale}`}
                  label={t("Ad və soyad ({locale})", { locale: locale.toUpperCase() })}
                  required={locale === "az"}
                  description={t("Hər dil üçün o dildəki yazılışı ilə.")}
                  render={({ field, id, invalid, describedBy }) => (
                    <Input
                      {...field}
                      value={field.value ?? ""}
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
                  name={`role.${locale}`}
                  label={t("İxtisas ({locale})", { locale: locale.toUpperCase() })}
                  required={locale === "az"}
                  description={t("Məsələn: saç ustası, manikür ustası.")}
                  render={({ field, id, invalid, describedBy }) => (
                    <Input
                      {...field}
                      value={field.value ?? ""}
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
                  name={`bio.${locale}`}
                  label={t("Qısa bioqrafiya ({locale})", { locale: locale.toUpperCase() })}
                  description={t("Bir-iki cümlə. Boş qalsa, saytda göstərilmir.")}
                  render={({ field, id, invalid, describedBy }) => (
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      id={id}
                      rows={3}
                      maxLength={600}
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                    />
                  )}
                />
              </>
            )}
          </LocaleTabs>
          <FormField
            control={form.control}
            name="instagramUrl"
            label={t("Instagram")}
            description={t("Profilin tam ünvanı. Boş qalsa, saytda göstərilmir.")}
            render={({ field, id, invalid, describedBy }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                id={id}
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.instagram.com/"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          />
          <FormField
            control={form.control}
            name="serviceIds"
            label={t("Etdiyi xidmətlər")}
            description={t("Qeydiyyat formasında bu xidmətlər üçün usta kimi təklif olunur.")}
            render={({ field, id, invalid, describedBy }) => (
              <ServiceChecklist
                id={id}
                value={field.value ?? []}
                invalid={invalid}
                describedBy={describedBy}
                onChange={(next) => {
                  field.onChange(next);
                  field.onBlur();
                }}
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
          <Button type="submit" form="master-form" disabled={isSubmitting}>
            {isSubmitting ? t("Saxlanılır") : member ? t("Saxla") : t("Əlavə et")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
