import { countUnreadBookings } from "@/lib/admin/booking-requests";
import { adminRoute } from "@/lib/api/server";

export const GET = adminRoute(async () => Response.json({ count: await countUnreadBookings() }));
