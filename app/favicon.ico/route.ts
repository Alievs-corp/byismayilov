import { connection } from "next/server";

import { getSiteSettings } from "@/lib/public/settings";

export async function GET() {
  await connection();
  const { favicon } = await getSiteSettings();
  return new Response(null, {
    status: 307,
    headers: {
      Location: favicon?.src ?? "/favicon-48.png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
