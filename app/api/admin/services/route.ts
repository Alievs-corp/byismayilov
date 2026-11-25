import { listServices, saveService } from "@/lib/admin/services";
import { adminRoute, domainError, readJson, readQuery } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { serviceInputSchema, serviceListQuery } from "@/lib/validation/services";

export const GET = adminRoute(async (request) => {
  const query = readQuery(request, serviceListQuery);
  if ("response" in query) return query.response;
  return Response.json(await listServices(query.data));
});

export const POST = adminRoute(async (request) => {
  const body = await readJson(request, serviceInputSchema);
  if ("response" in body) return body.response;
  const result = await saveService(null, body.data);
  if ("error" in result) {
    return domainError(result.error);
  }
  revalidatePublic("catalog");
  return Response.json(result, { status: 201 });
});
