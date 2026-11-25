import { exportBookingRequestsCsv, exportFileName } from "@/lib/admin/booking-requests";
import { adminRoute, readQuery } from "@/lib/api/server";
import { bookingRequestFiltersSchema } from "@/lib/validation/booking-requests";

export const GET = adminRoute(async (request) => {
  const query = readQuery(request, bookingRequestFiltersSchema);
  if ("response" in query) return query.response;
  const csv = await exportBookingRequestsCsv(query.data);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
});
