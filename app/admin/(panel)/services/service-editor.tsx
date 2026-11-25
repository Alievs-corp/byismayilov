"use client";

import Link from "next/link";

import { EmptyState } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/admin/i18n/use-t";
import { useGetCategoriesQuery, useGetServiceQuery } from "@/lib/api/admin";
import { isApiError } from "@/lib/api/types";

import { ServiceForm } from "./service-form";

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-10 w-1/2" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-8" />
        <Skeleton className="h-96 lg:col-span-4" />
      </div>
    </div>
  );
}

export function ServiceEditor({ id }: { id?: string }) {
  const t = useT();
  const categories = useGetCategoriesQuery();
  const service = useGetServiceQuery(id ?? "", { skip: !id, refetchOnMountOrArgChange: true });

  if (categories.isLoading || (id && service.isLoading)) return <EditorSkeleton />;

  if (id && service.isError) {
    const missing = isApiError(service.error) && service.error.status === 404;
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link href="/admin/services">{t("Xidmətlərə qayıt")}</Link>
          </Button>
        }
      >
        {missing ? t("Xidmət tapılmadı.") : t("Xidmət yüklənmədi. Səhifəni yeniləyin.")}
      </EmptyState>
    );
  }

  return (
    <ServiceForm
      key={service.data?.id ?? "new"}
      service={id ? (service.data ?? null) : null}
      categories={categories.data ?? []}
    />
  );
}
