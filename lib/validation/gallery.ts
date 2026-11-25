import { z } from "zod";

import type { Localized } from "@/lib/i18n/localized";

import { localizedOptional, uuid } from "./fields";
import type { MediaDto } from "./media";
import { optionalMediaId } from "./ordering";

const optionalId = z
  .union([z.literal(""), uuid("Seçim düzgün deyil.")])
  .nullish()
  .transform((value) => value || null);

export const galleryItemInputSchema = z.object({
  mediaId: uuid("Şəkil və ya video seçin."),
  beforeMediaId: optionalMediaId,
  posterId: optionalMediaId,
  caption: localizedOptional(300),
  categoryId: optionalId,
  masterId: optionalId,
  isActive: z.boolean(),
});

export type GalleryItemInput = z.input<typeof galleryItemInputSchema>;

export type GalleryItemValues = z.output<typeof galleryItemInputSchema>;

export type GalleryItemDto = {
  id: string;
  media: MediaDto | null;
  before: MediaDto | null;
  poster: MediaDto | null;
  caption: Localized | null;
  categoryId: string | null;
  categoryName: Localized | null;
  masterId: string | null;
  masterName: Localized | null;
  sortOrder: number;
  isActive: boolean;
};

export type GalleryOptionsDto = {
  categories: { id: string; name: string; parentId: string | null }[];
  masters: { id: string; name: string }[];
};
