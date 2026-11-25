import { z } from "zod";

import type { Localized } from "@/lib/i18n/localized";

import { localizedOptional, localizedText, uuid } from "./fields";
import type { MediaDto } from "./media";
import { optionalMediaId } from "./ordering";

export const masterServiceLimit = 100;

function isInstagramUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return url.protocol === "https:" && host === "instagram.com" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

export const instagramUrlSchema = z
  .string()
  .trim()
  .max(300, "Ən çox 300 simvol ola bilər.")
  .refine(
    (value) => value === "" || isInstagramUrl(value),
    "Instagram profilinin tam ünvanını yazın, məsələn https://www.instagram.com/ad",
  )
  .nullish()
  .transform((value) => value || null);

export const masterInputSchema = z.object({
  name: localizedText(120, "Adı yazın."),
  role: localizedText(120, "İxtisası yazın."),
  bio: localizedOptional(600),
  photoId: optionalMediaId,
  instagramUrl: instagramUrlSchema,
  serviceIds: z
    .array(uuid("Xidmət düzgün deyil."))
    .max(masterServiceLimit, `Ən çox ${masterServiceLimit} xidmət seçmək olar.`)
    .optional()
    .default([])
    .transform((ids) => [...new Set(ids)]),
  isActive: z.boolean(),
});

export type MasterInput = z.input<typeof masterInputSchema>;

export type MasterValues = z.output<typeof masterInputSchema>;

export type MasterDto = {
  id: string;
  name: Localized;
  role: Localized;
  bio: Localized | null;
  instagramUrl: string | null;
  serviceIds: string[];
  photo: MediaDto | null;
  sortOrder: number;
  isActive: boolean;
};

export type MasterServiceOptionDto = { id: string; name: string; status: "draft" | "published" };
