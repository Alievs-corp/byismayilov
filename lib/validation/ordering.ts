import { z } from "zod";

import { uuid } from "./fields";

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const webUrlSchema = z
  .string()
  .trim()
  .max(2000, "Ən çox 2000 simvol ola bilər.")
  .refine(
    (value) => value === "" || isWebUrl(value),
    "Tam ünvan yazın: http:// və ya https:// ilə başlamalıdır.",
  )
  .nullish()
  .transform((value) => value || null);

export const optionalMediaId = z
  .union([z.literal(""), uuid("Şəkil düzgün deyil.")])
  .nullish()
  .transform((value) => value || null);

export const toggleActiveSchema = z.object({ isActive: z.boolean("Dəyər seçin.") });

export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;

export const reorderSchema = z.object({
  orderedIds: z.array(uuid()).min(1, "Sıra boşdur.").max(500),
});

export type ReorderInput = z.infer<typeof reorderSchema>;
