import { listBookingRequests } from "@/lib/admin/booking-requests";
import { adminRoute, readQuery } from "@/lib/api/server";
import { bookingRequestListQuery } from "@/lib/validation/booking-requests";

export const GET = adminRoute(async (request) => {
  const query = readQuery(request, bookingRequestListQuery);
  if ("response" in query) return query.response;
  return Response.json(await listBookingRequests(query.data));
});
