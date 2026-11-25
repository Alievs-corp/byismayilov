import { updateGalleryItem } from "@/lib/admin/gallery";
import { deleteRow, setRowActive } from "@/lib/admin/ordering";
import { adminRoute, domainError, jsonError, readId, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { galleryItems } from "@/lib/db/schema";
import { galleryItemInputSchema } from "@/lib/validation/gallery";
import { toggleActiveSchema } from "@/lib/validation/ordering";

type Context = RouteContext<"/api/admin/gallery-items/[id]">;

const missing = "İş tapılmadı.";

export const PUT = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, galleryItemInputSchema);
  if ("response" in body) return body.response;
  const result = await updateGalleryItem(target.id, body.data);
  if ("error" in result) return domainError(result.error);
  revalidatePublic("content");
  return Response.json(result);
});

export const PATCH = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, toggleActiveSchema);
  if ("response" in body) return body.response;
  if (!(await setRowActive(galleryItems, target.id, body.data.isActive))) {
    return jsonError(404, "not-found", missing);
  }
  revalidatePublic("content");
  return new Response(null, { status: 204 });
});

export const DELETE = adminRoute<Context>(async (_request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  if (!(await deleteRow(galleryItems, target.id))) return jsonError(404, "not-found", missing);
  revalidatePublic("content");
  return new Response(null, { status: 204 });
});
