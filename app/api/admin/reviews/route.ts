import { createReview, listReviews } from "@/lib/admin/reviews";
import { adminRoute, domainError, readJson } from "@/lib/api/server";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { reviewInputSchema } from "@/lib/validation/reviews";

export const GET = adminRoute(async () => Response.json(await listReviews()));

export const POST = adminRoute(async (request) => {
  const body = await readJson(request, reviewInputSchema);
  if ("response" in body) return body.response;
  const result = await createReview(body.data);
  if ("error" in result) return domainError(result.error);
  revalidatePublic("content");
  return Response.json(result, { status: 201 });
});
