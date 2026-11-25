import { bulkUpdateServices } from "@/lib/admin/services";
import { adminRoute, jsonError, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { bulkServicesSchema } from "@/lib/validation/services";

export const POST = adminRoute(async (request, { user }) => {
  const body = await readJson(request, bulkServicesSchema);
  if ("response" in body) return body.response;
  if (body.data.action === "purge" && user.role !== "owner") {
    return jsonError(403, "forbidden", "Həmişəlik silmək yalnız sahibə icazəlidir.");
  }
  const result = await bulkUpdateServices(body.data);
  if (result.updated) revalidatePublic("catalog");
  return Response.json(result);
});
