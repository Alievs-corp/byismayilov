import { updateMaster } from "@/lib/admin/masters";
import { deleteRow, setRowActive } from "@/lib/admin/ordering";
import { adminRoute, domainError, jsonError, readId, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { masters } from "@/lib/db/schema";
import { masterInputSchema } from "@/lib/validation/masters";
import { toggleActiveSchema } from "@/lib/validation/ordering";

type Context = RouteContext<"/api/admin/masters/[id]">;

const missing = "Usta tapılmadı.";

export const PUT = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, masterInputSchema);
  if ("response" in body) return body.response;
  const result = await updateMaster(target.id, body.data);
  if ("error" in result) return domainError(result.error);
  revalidatePublic("content");
  return Response.json(result);
});

export const PATCH = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, toggleActiveSchema);
  if ("response" in body) return body.response;
  if (!(await setRowActive(masters, target.id, body.data.isActive))) {
    return jsonError(404, "not-found", missing);
  }
  revalidatePublic("content");
  return new Response(null, { status: 204 });
});

export const DELETE = adminRoute<Context>(async (_request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  if (!(await deleteRow(masters, target.id))) return jsonError(404, "not-found", missing);
  revalidatePublic("content");
  return new Response(null, { status: 204 });
});
