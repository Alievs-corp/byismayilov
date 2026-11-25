import { duplicateService } from "@/lib/admin/services";
import { adminRoute, jsonError, readId } from "@/lib/api/server";

const missing = "Xidmət tapılmadı.";

export const POST = adminRoute<RouteContext<"/api/admin/services/[id]/duplicate">>(
  async (_request, { params }) => {
    const target = await readId(params, missing);
    if ("response" in target) return target.response;
    const copy = await duplicateService(target.id);
    if (!copy) return jsonError(404, "not-found", missing);
    return Response.json(copy, { status: 201 });
  },
);
