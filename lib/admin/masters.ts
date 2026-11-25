import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DomainError } from "@/lib/api/server";
import { getDb } from "@/lib/db";
import { masterServices, masters, media, services } from "@/lib/db/schema";
import { localeKey } from "@/lib/db/schema/columns";
import type { MasterDto, MasterServiceOptionDto, MasterValues } from "@/lib/validation/masters";

import { checkImage, invalidField } from "./content";
import { toMediaDto } from "./media";
import { nextSortOrder } from "./ordering";

const missing: DomainError = { status: 404, message: "Usta tapılmadı." };

export async function listMasters(): Promise<MasterDto[]> {
  const db = getDb();
  const [rows, links] = await Promise.all([
    db
      .select({ master: masters, photo: media })
      .from(masters)
      .leftJoin(media, eq(media.id, masters.photoId))
      .orderBy(asc(masters.sortOrder), asc(masters.createdAt)),
    db
      .select({ masterId: masterServices.masterId, serviceId: masterServices.serviceId })
      .from(masterServices),
  ]);
  const byMaster = new Map<string, string[]>();
  for (const link of links) {
    byMaster.set(link.masterId, [...(byMaster.get(link.masterId) ?? []), link.serviceId]);
  }
  return rows.map(({ master, photo }) => ({
    id: master.id,
    name: master.name,
    role: master.role,
    bio: master.bio,
    instagramUrl: master.instagramUrl,
    serviceIds: byMaster.get(master.id) ?? [],
    photo: photo ? toMediaDto(photo) : null,
    sortOrder: master.sortOrder,
    isActive: master.isActive,
  }));
}

export async function listMasterServiceOptions(): Promise<MasterServiceOptionDto[]> {
  const rows = await getDb()
    .select({ id: services.id, name: services.name, status: services.status })
    .from(services)
    .where(isNull(services.deletedAt))
    .orderBy(asc(services.sortOrder), asc(localeKey(services.name, "az")));
  return rows.map((row) => ({ id: row.id, name: row.name.az, status: row.status }));
}

async function checkMaster(values: MasterValues): Promise<DomainError | null> {
  const imageError = await checkImage("photoId", values.photoId);
  if (imageError) return imageError;
  if (!values.serviceIds.length) return null;
  const found = await getDb()
    .select({ id: services.id })
    .from(services)
    .where(and(inArray(services.id, values.serviceIds), isNull(services.deletedAt)));
  return found.length === values.serviceIds.length
    ? null
    : invalidField("serviceIds", "Xidmət tapılmadı.");
}

function columns(values: MasterValues) {
  return {
    name: values.name,
    role: values.role,
    bio: values.bio,
    photoId: values.photoId,
    instagramUrl: values.instagramUrl,
    isActive: values.isActive,
  };
}

export async function createMaster(
  values: MasterValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkMaster(values);
  if (error) return { error };
  const id = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(masters)
      .values({ ...columns(values), sortOrder: nextSortOrder(masters) })
      .returning({ id: masters.id });
    if (!row) throw new Error("Master was not created");
    if (values.serviceIds.length) {
      await tx
        .insert(masterServices)
        .values(values.serviceIds.map((serviceId) => ({ masterId: row.id, serviceId })));
    }
    return row.id;
  });
  return { id };
}

export async function updateMaster(
  id: string,
  values: MasterValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkMaster(values);
  if (error) return { error };
  const found = await getDb().transaction(async (tx) => {
    const updated = await tx
      .update(masters)
      .set(columns(values))
      .where(eq(masters.id, id))
      .returning({ id: masters.id });
    if (!updated.length) return false;
    await tx.delete(masterServices).where(eq(masterServices.masterId, id));
    if (values.serviceIds.length) {
      await tx
        .insert(masterServices)
        .values(values.serviceIds.map((serviceId) => ({ masterId: id, serviceId })));
    }
    return true;
  });
  return found ? { id } : { error: missing };
}
