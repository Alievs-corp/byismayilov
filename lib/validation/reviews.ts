import { z } from "zod";

import { requiredText } from "./fields";
import type { MediaDto } from "./media";
import { optionalMediaId, webUrlSchema } from "./ordering";

export const reviewInputSchema = z.object({
  authorName: requiredText(120, "Müştərinin adını yazın."),
  body: requiredText(2000, "Rəyin mətnini yazın."),
  rating: z
    .number("Qiymət 1 ilə 5 arasında olmalıdır.")
    .int("Qiymət 1 ilə 5 arasında olmalıdır.")
    .min(1, "Qiymət 1 ilə 5 arasında olmalıdır.")
    .max(5, "Qiymət 1 ilə 5 arasında olmalıdır.")
    .nullish()
    .transform((value) => value ?? null),
  photoId: optionalMediaId,
  sourceUrl: webUrlSchema,
  isActive: z.boolean(),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;

export type ReviewValues = z.output<typeof reviewInputSchema>;

export type ReviewDto = {
  id: string;
  authorName: string;
  body: string;
  rating: number | null;
  sourceUrl: string | null;
  photo: MediaDto | null;
  sortOrder: number;
  isActive: boolean;
};
