import { bulkUpdateServices, getService, saveService } from "@/lib/admin/services";
import { adminRoute, domainError, jsonError, readId, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { serviceInputSchema } from "@/lib/validation/services";

type Context = RouteContext<"/api/admin/services/[id]">;

const missing = "Xidmət tapılmadı.";

export const GET = adminRoute<Context>(async (_request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const service = await getService(target.id);
  if (!service) return jsonError(404, "not-found", missing);
  return Response.json(service);
});

export const PUT = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, serviceInputSchema);
  if ("response" in body) return body.response;
  const result = await saveService(target.id, body.data);
  if ("error" in result) {
    return domainError(result.error);
  }
  revalidatePublic("catalog");
  return Response.json(result);
});

export const DELETE = adminRoute<Context>(async (_request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const result = await bulkUpdateServices({ action: "trash", ids: [target.id] });
  if (!result.updated) return jsonError(404, "not-found", missing);
  revalidatePublic("catalog");
  return Response.json(result);
});
