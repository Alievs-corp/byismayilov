import { listGalleryOptions } from "@/lib/admin/gallery";
import { adminRoute } from "@/lib/api/server";

export const GET = adminRoute(async () => Response.json(await listGalleryOptions()));
