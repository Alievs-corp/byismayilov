"use client";

import { Plus, Search, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGetServicesQuery } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import type { ServiceOptionDto } from "@/lib/validation/services";
import { useContentText } from "@/lib/store/hooks";
import { useT } from "@/lib/admin/i18n/use-t";

import { arrayMove, DragHandle, SortableList } from "./sortable";

function ServiceThumb({ service }: { service: ServiceOptionDto }) {
  return (
    <span className="relative size-10 shrink-0 border border-border bg-surface">
      {service.thumbnail ? (
        <Image src={service.thumbnail.src} alt="" fill sizes="40px" className="object-cover" />
      ) : null}
    </span>
  );
}

export function ServicePicker({
  value,
  onChange,
  max = 12,
  id,
  invalid,
  describedBy,
}: {
  value: ServiceOptionDto[];
  onChange: (value: ServiceOptionDto[]) => void;
  max?: number;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const text = useContentText();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isFetching } = useGetServicesQuery(
    {
      search: query,
      sort: "name",
      order: "asc",
      page: 0,
      pageSize: 20,
      status: "all",
    },
    { skip: !open },
  );
  const chosen = new Set(value.map((service) => service.id));
  const full = value.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {value.length ? (
        <SortableList
          items={value}
          getId={(service) => service.id}
          getLabel={(service) => text(service.name)}
          onReorder={(from, to) => onChange(arrayMove(value, from, to))}
          className="flex flex-col border border-border"
          itemClassName="border-b border-border bg-white last:border-0"
        >
          {(service, _index, { handle }) => (
            <div className="flex items-center gap-2 py-1 pr-1 pl-1">
              <DragHandle
                label={t("{name}: yerini dəyiş", { name: text(service.name) })}
                {...handle}
              />
              <ServiceThumb service={service} />
              <span className="min-w-0 flex-1 text-meta">
                <span className="block truncate">{text(service.name)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("{name}: çıxar", { name: text(service.name) })}
                onClick={() => onChange(value.filter((item) => item.id !== service.id))}
              >
                <X strokeWidth={1.5} />
              </Button>
            </div>
          )}
        </SortableList>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="self-start"
          >
            <Plus strokeWidth={1.5} />
            {full ? t("Ən çox {count} xidmət", { count: max }) : t("Xidmət əlavə et")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <div className="border-b border-border p-2">
            <label className="relative block">
              <span className="sr-only">{t("Xidmət axtar")}</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Xidmətin adı")}
                className="pl-9"
                autoFocus
              />
            </label>
          </div>
          <ul
            className={cn("max-h-72 overflow-y-auto p-1", isFetching ? "opacity-60" : null)}
            aria-label={t("Xidmətlər")}
          >
            {(data?.rows ?? []).map((service) => {
              const added = chosen.has(service.id);
              return (
                <li key={service.id}>
                  <button
                    type="button"
                    disabled={added || full}
                    onClick={() => {
                      onChange([
                        ...value,
                        {
                          id: service.id,
                          name: service.name,
                          thumbnail: service.thumbnail,
                        },
                      ]);
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-sm px-2 py-1 text-left text-meta hover:bg-secondary disabled:opacity-50"
                  >
                    <ServiceThumb service={service} />
                    <span className="min-w-0 flex-1 truncate">{text(service.name)}</span>
                    {added ? (
                      <span className="text-muted-foreground">{t("əlavə olunub")}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {data && data.rows.length === 0 ? (
              <li className="px-2 py-3 text-meta text-muted-foreground">
                {t("Heç nə tapılmadı.")}
              </li>
            ) : null}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
