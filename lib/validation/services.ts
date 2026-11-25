import { z } from "zod";

import type { RichTextDoc } from "@/lib/content/rich-text";
import { servicePriceKinds, type ServicePriceKind } from "@/lib/db/schema/services";
import type { Localized } from "@/lib/i18n/localized";

import {
  localizedOptional,
  localizedRichText,
  localizedSlug,
  localizedText,
  publishStatusSchema,
  uuid,
} from "./fields";
import { listQuerySchema, type ListArgs } from "./list";
import type { MediaDto } from "./media";

export { servicePriceKinds, type ServicePriceKind };

export const servicePriceKindLabels: Record<ServicePriceKind, string> = {
  from: "Başlanğıc qiymət",
  exact: "Dəqiq qiymət",
  on_request: "Razılaşma ilə",
};

export const serviceSortFields = ["updatedAt", "name", "price", "status"] as const;

export type ServiceSortField = (typeof serviceSortFields)[number];

export const serviceStatusFilters = ["all", "published", "draft", "trash"] as const;

export type ServiceStatusFilter = (typeof serviceStatusFilters)[number];

export const serviceListQuery = listQuerySchema(serviceSortFields).extend({
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.enum(serviceStatusFilters).optional().default("all"),
  categoryId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
});

export type ServiceListArgs = ListArgs<ServiceSortField> & {
  status?: ServiceStatusFilter;
  categoryId?: string;
};

export const serviceLimits = {
  images: 40,
  categories: 20,
  maxPrice: 100000,
  maxDuration: 24 * 60,
} as const;

export const galleryImageSchema = z.object({
  mediaId: uuid("Şəkil seçin."),
  alt: localizedText(250, "Şəkil üçün alt mətn yazın."),
});

const numberInput = z.union([z.number(), z.string().trim()]).nullish();

const priceAmountSchema = numberInput.transform((value, context) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) {
    context.addIssue({ code: "custom", message: "Qiyməti rəqəmlə yazın, məsələn 30 və ya 25.50." });
    return z.NEVER;
  }
  if (amount > serviceLimits.maxPrice) {
    context.addIssue({ code: "custom", message: "Qiymət çox böyükdür." });
    return z.NEVER;
  }
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    context.addIssue({ code: "custom", message: "Qəpik üçün ən çox iki rəqəm yazın." });
    return z.NEVER;
  }
  return Math.round(amount * 100) / 100;
});

const durationSchema = numberInput.transform((value, context) => {
  if (value === null || value === undefined || value === "") return null;
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    context.addIssue({ code: "custom", message: "Müddəti dəqiqə ilə tam rəqəmlə yazın." });
    return z.NEVER;
  }
  if (minutes > serviceLimits.maxDuration) {
    context.addIssue({ code: "custom", message: "Müddət bir sutkadan çox ola bilməz." });
    return z.NEVER;
  }
  return minutes;
});

export const serviceInputSchema = z
  .object({
    name: localizedText(200, "Xidmətin adını yazın."),
    slug: localizedSlug,
    shortDescription: localizedRichText,
    description: localizedRichText,
    categoryIds: z
      .array(uuid())
      .max(serviceLimits.categories, "Ən çox 20 kateqoriya seçmək olar.")
      .refine((ids) => new Set(ids).size === ids.length, "Kateqoriya təkrarlanır."),
    priceKind: z.enum(servicePriceKinds, "Qiymət növünü seçin."),
    priceAmount: priceAmountSchema,
    durationMinutes: durationSchema,
    images: z
      .array(galleryImageSchema)
      .max(serviceLimits.images, "Ən çox 40 şəkil ola bilər.")
      .refine(
        (images) => new Set(images.map((image) => image.mediaId)).size === images.length,
        "Eyni şəkil iki dəfə əlavə olunub.",
      ),
    seoTitle: localizedOptional(120),
    seoDescription: localizedOptional(320),
    status: publishStatusSchema,
    isFeatured: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.priceKind !== "on_request" && value.priceAmount === null) {
      context.addIssue({
        code: "custom",
        path: ["priceAmount"],
        message: "Qiyməti AZN ilə yazın.",
      });
    }
  })
  .transform((value) =>
    value.priceKind === "on_request" ? { ...value, priceAmount: null } : value,
  );

export type ServiceInput = z.input<typeof serviceInputSchema>;

export type ServiceValues = z.output<typeof serviceInputSchema>;

export const serviceBulkActions = [
  "publish",
  "unpublish",
  "feature",
  "unfeature",
  "trash",
  "restore",
  "purge",
] as const;

export type ServiceBulkAction = (typeof serviceBulkActions)[number];

export const bulkServicesSchema = z.object({
  action: z.enum(serviceBulkActions, "Əməliyyat seçin."),
  ids: z.array(uuid()).min(1, "Xidmət seçin.").max(200, "Bir dəfəyə ən çox 200 xidmət."),
});

export type BulkServicesInput = z.infer<typeof bulkServicesSchema>;

export type BulkServicesResult = { updated: number; skipped: number; message?: string };

export type ServiceListItemDto = {
  id: string;
  name: Localized;
  slug: Localized;
  priceKind: ServicePriceKind;
  priceAmount: number | null;
  durationMinutes: number | null;
  status: "draft" | "published";
  isFeatured: boolean;
  thumbnail: Pick<MediaDto, "src" | "alt"> | null;
  categories: Localized[];
  updatedAt: string;
  deletedAt: string | null;
};

export type ServiceDetailDto = {
  id: string;
  name: Localized;
  slug: Localized;
  shortDescription: Localized<RichTextDoc> | null;
  description: Localized<RichTextDoc> | null;
  categoryIds: string[];
  priceKind: ServicePriceKind;
  priceAmount: number | null;
  durationMinutes: number | null;
  images: { mediaId: string; alt: Localized }[];
  media: MediaDto[];
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  status: "draft" | "published";
  isFeatured: boolean;
  publishedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOptionDto = Pick<ServiceListItemDto, "id" | "name" | "thumbnail">;
