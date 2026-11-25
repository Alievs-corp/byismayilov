import { createGalleryItem, listGalleryItems } from "@/lib/admin/gallery";
import { adminRoute, domainError, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { galleryItemInputSchema } from "@/lib/validation/gallery";

export const GET = adminRoute(async () => Response.json(await listGalleryItems()));

export const POST = adminRoute(async (request) => {
  const body = await readJson(request, galleryItemInputSchema);
  if ("response" in body) return body.response;
  const result = await createGalleryItem(body.data);
  if ("error" in result) return domainError(result.error);
  revalidatePublic("content");
  return Response.json(result, { status: 201 });
});
