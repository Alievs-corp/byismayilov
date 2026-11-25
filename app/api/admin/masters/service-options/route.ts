import { listMasterServiceOptions } from "@/lib/admin/masters";
import { adminRoute } from "@/lib/api/server";

export const GET = adminRoute(async () => Response.json(await listMasterServiceOptions()));
