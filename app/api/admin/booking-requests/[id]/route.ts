import {
  deleteBookingRequest,
  getBookingRequest,
  updateBookingRequest,
} from "@/lib/admin/booking-requests";
import { adminRoute, jsonError, readId, readJson } from "@/lib/api/server";
import { updateBookingRequestSchema } from "@/lib/validation/booking-requests";

type Context = RouteContext<"/api/admin/booking-requests/[id]">;

const missing = "Qeydiyyat tapılmadı.";

export const GET = adminRoute<Context>(async (_request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const request = await getBookingRequest(target.id, { markSeen: true });
  if (!request) return jsonError(404, "not-found", missing);
  return Response.json(request);
});

export const PATCH = adminRoute<Context>(async (request, { params }) => {
  const target = await readId(params, missing);
  if ("response" in target) return target.response;
  const body = await readJson(request, updateBookingRequestSchema);
  if ("response" in body) return body.response;
  const updated = await updateBookingRequest(target.id, body.data);
  if (!updated) return jsonError(404, "not-found", missing);
  return Response.json(updated);
});

export const DELETE = adminRoute<Context>(
  async (_request, { params }) => {
    const target = await readId(params, missing);
    if ("response" in target) return target.response;
    if (!(await deleteBookingRequest(target.id))) return jsonError(404, "not-found", missing);
    return new Response(null, { status: 204 });
  },
  { role: "owner" },
);
