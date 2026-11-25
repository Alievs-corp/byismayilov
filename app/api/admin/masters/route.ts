import { createMaster, listMasters } from "@/lib/admin/masters";
import { adminRoute, domainError, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { masterInputSchema } from "@/lib/validation/masters";

export const GET = adminRoute(async () => Response.json(await listMasters()));

export const POST = adminRoute(async (request) => {
  const body = await readJson(request, masterInputSchema);
  if ("response" in body) return body.response;
  const result = await createMaster(body.data);
  if ("error" in result) return domainError(result.error);
  revalidatePublic("content");
  return Response.json(result, { status: 201 });
});
