import "dotenv/config";

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, asc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import sharp from "sharp";
import { z } from "zod";

const load = createRequire(import.meta.url);
const schema = load("../lib/db/schema") as typeof import("../lib/db/schema");
const remote = load(
  "../lib/cache/remote-revalidate",
) as typeof import("../lib/cache/remote-revalidate");

type Localized = { az: string; ru?: string; en?: string };

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    LOCAL_MEDIA_DIR: z.string().min(1).default("C:\\dev\\byismayilov-brief\\ig-media-hd"),
    NODE_ENV: z.string().optional(),
  })
  .parse(process.env);

if (env.NODE_ENV === "production") {
  throw new Error("Local media seeding is for local development only");
}

const alts: Record<string, Localized> = {
  balayage: { az: "Balayaj rəngləmə", ru: "Окрашивание балаяж", en: "Balayage colouring" },
  blonde: { az: "Blond rəng keçidi", ru: "Блонд с плавным переходом", en: "Blonde colour blend" },
  ombre: { az: "Ombre rəngləmə", ru: "Окрашивание омбре", en: "Ombre colouring" },
  cut: { az: "Saç kəsimi və düzüm", ru: "Стрижка и укладка", en: "Haircut and styling" },
  interior: { az: "Salonda iş prosesi", ru: "Работа в салоне", en: "At work in the salon" },
  master: {
    az: "Elməddin İsmayılov salonda",
    ru: "Эльмеддин Исмайылов в салоне",
    en: "Elmeddin Ismayilov in the salon",
  },
};

const galleryFiles = [
  "color-balayage-09",
  "color-blonde-05",
  "color-balayage-14",
  "color-ombre-04",
  "color-blonde-07",
  "cut-04",
  "color-balayage-08",
  "color-blonde-09",
  "color-ombre-01",
  "color-balayage-11",
  "cut-02",
  "color-blonde-03",
];

const serviceCoverFiles = [
  "color-balayage-03",
  "color-blonde-06",
  "cut-05",
  "color-ombre-03",
  "color-balayage-05",
  "color-blonde-10",
  "interior-04",
  "color-balayage-01",
  "color-ombre-05",
];

const masterFile = "color-blonde-01";

const master = {
  name: { az: "Elməddin İsmayılov", ru: "Эльмеддин Исмайылов", en: "Elmeddin Ismayilov" },
  role: {
    az: "Təbii görünüşlü rəngləmə və təravətli saç kəsimi",
    ru: "Естественное окрашивание и свежие стрижки",
    en: "Natural Looking Coloring and Fresh Hair Cutting",
  },
  bio: {
    az: "Kaaral-ın Bodrumda keçirilən beynəlxalq tədbirinin (K.I'M Turkey 2026) iştirakçısı.",
    ru: "Участник международного мероприятия Kaaral в Бодруме (K.I'M Turkey 2026).",
    en: "Took part in Kaaral's international event in Bodrum (K.I'M Turkey 2026).",
  },
  instagramUrl: "https://www.instagram.com/byismayilov22/",
};

const contact = {
  phone: { label: { az: "Telefon", ru: "Телефон", en: "Phone" }, number: "+994776170606" },
  address: { az: "28-may Rəşid Behbudov küç 25, Kapital bankın yanı" },
  instagram: "https://www.instagram.com/byismayilov22/",
};

function altFor(file: string): Localized {
  if (file === masterFile) return alts.master!;
  const kind = Object.keys(alts).find((key) => file.includes(key));
  return alts[kind ?? "balayage"]!;
}

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function upload(name: string): Promise<string | null> {
  const source = path.join(env.LOCAL_MEDIA_DIR, `${name}.jpg`);
  if (!(await exists(source))) {
    console.warn(`skip ${name}: not found in ${env.LOCAL_MEDIA_DIR}`);
    return null;
  }
  const body = await sharp(await readFile(source))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  const sha256 = createHash("sha256").update(body).digest("hex");
  const [known] = await db
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(eq(schema.media.sha256, sha256));
  if (known) return known.id;

  const meta = await sharp(body).metadata();
  const tiny = await sharp(body).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  const key = `uploads/local/${name}-${sha256.slice(0, 8)}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  const [row] = await db
    .insert(schema.media)
    .values({
      key,
      mimeType: "image/jpeg",
      width: meta.width ?? null,
      height: meta.height ?? null,
      size: body.length,
      sha256,
      lqip: `data:image/webp;base64,${tiny.toString("base64")}`,
      alt: altFor(name),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error(`media row for ${name} was not created`);
  return row.id;
}

async function seedGallery(masterId: string | null): Promise<number> {
  let added = 0;
  for (const [index, name] of galleryFiles.entries()) {
    const mediaId = await upload(name);
    if (!mediaId) continue;
    const [existing] = await db
      .select({ id: schema.galleryItems.id })
      .from(schema.galleryItems)
      .where(eq(schema.galleryItems.mediaId, mediaId));
    if (existing) continue;
    await db.insert(schema.galleryItems).values({ mediaId, masterId, sortOrder: index });
    added += 1;
  }
  return added;
}

async function seedMaster(): Promise<string | null> {
  const photoId = await upload(masterFile);
  const [existing] = await db
    .select({ id: schema.masters.id, photoId: schema.masters.photoId })
    .from(schema.masters)
    .where(sql`${schema.masters.name} ->> 'az' = ${master.name.az}`);
  if (existing) {
    if (!existing.photoId && photoId) {
      await db.update(schema.masters).set({ photoId }).where(eq(schema.masters.id, existing.id));
    }
    return existing.id;
  }
  const [row] = await db
    .insert(schema.masters)
    .values({ ...master, photoId, sortOrder: 0 })
    .returning({ id: schema.masters.id });
  return row?.id ?? null;
}

async function linkMasterServices(masterId: string): Promise<void> {
  const rows = await db
    .select({ id: schema.services.id })
    .from(schema.services)
    .where(and(eq(schema.services.status, "published"), isNull(schema.services.deletedAt)));
  if (!rows.length) return;
  await db
    .insert(schema.masterServices)
    .values(rows.slice(0, 6).map((row) => ({ masterId, serviceId: row.id })))
    .onConflictDoNothing();
}

async function seedServiceCovers(): Promise<number> {
  const rows = await db
    .select({ id: schema.services.id })
    .from(schema.services)
    .where(and(eq(schema.services.status, "published"), isNull(schema.services.deletedAt)))
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.createdAt));
  let covered = 0;
  for (const [index, service] of rows.entries()) {
    const name = serviceCoverFiles[index % serviceCoverFiles.length]!;
    const [cover] = await db
      .select({ mediaId: schema.serviceImages.mediaId })
      .from(schema.serviceImages)
      .where(eq(schema.serviceImages.serviceId, service.id));
    if (cover) continue;
    const mediaId = await upload(name);
    if (!mediaId) continue;
    await db.insert(schema.serviceImages).values({ serviceId: service.id, mediaId, position: 0 });
    if (index < 6) {
      await db
        .update(schema.services)
        .set({ isFeatured: true })
        .where(eq(schema.services.id, service.id));
    }
    covered += 1;
  }
  return covered;
}

async function seedContact(): Promise<boolean> {
  const [row] = await db
    .select({
      phones: schema.settings.phones,
      address: schema.settings.address,
      socials: schema.settings.socials,
    })
    .from(schema.settings)
    .where(eq(schema.settings.id, 1));
  if (!row) return false;
  const patch: Partial<typeof schema.settings.$inferInsert> = {};
  if (!row.phones.length) patch.phones = [contact.phone];
  if (!row.address) patch.address = contact.address;
  if (!row.socials.length) patch.socials = [{ network: "instagram", url: contact.instagram }];
  if (!Object.keys(patch).length) return false;
  await db.update(schema.settings).set(patch).where(eq(schema.settings.id, 1));
  return true;
}

async function hidePlaceholders(): Promise<void> {
  await db
    .update(schema.masters)
    .set({ isActive: false })
    .where(sql`${schema.masters.name} ->> 'az' like '[%'`);
  await db
    .update(schema.reviews)
    .set({ isActive: false })
    .where(like(schema.reviews.authorName, "[%"));
}

try {
  const masterId = await seedMaster();
  if (masterId) await linkMasterServices(masterId);
  const gallery = await seedGallery(masterId);
  const covers = await seedServiceCovers();
  const contactAdded = await seedContact();
  if (!process.argv.includes("--keep-placeholders")) await hidePlaceholders();
  const media = await db
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(
      inArray(
        schema.media.id,
        db.select({ id: schema.galleryItems.mediaId }).from(schema.galleryItems),
      ),
    );
  console.log(
    `local media: master ${masterId ? "ready" : "skipped"}, ${gallery} gallery items added (${media.length} total), ${covers} service covers, contact ${contactAdded ? "filled" : "unchanged"}`,
  );
  console.log(remote.describeRevalidation(await remote.requestPublicRevalidation()));
} finally {
  await client.end();
}
