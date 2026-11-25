import { env } from "@/lib/env";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo/json-ld";

import { JsonLdScript } from "./json-ld";

export function BreadcrumbData({ items }: { items: BreadcrumbItem[] }) {
  return <JsonLdScript data={breadcrumbJsonLd(items, env.NEXT_PUBLIC_SITE_URL)} />;
}
