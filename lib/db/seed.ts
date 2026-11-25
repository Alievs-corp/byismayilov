import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { Localized } from "../i18n/localized";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

export const seedHero = {
  headline: {
    az: "Saç rəngləmə və kəsim",
    ru: "Окрашивание и стрижки",
    en: "Hair colouring and cuts",
  },
  subline: null,
  ctaLabel: { az: "Onlayn qeydiyyat", ru: "Онлайн-запись", en: "Book online" },
  ctaHref: "/qeydiyyat",
  filmId: null,
};

export const seedMainMenu: { label: Localized; url: string }[] = [
  { label: { az: "Xidmətlər", ru: "Услуги", en: "Services" }, url: "/xidmetler" },
  { label: { az: "Ustalar", ru: "Мастера", en: "Masters" }, url: "/ustalar" },
  { label: { az: "İşlərimiz", ru: "Наши работы", en: "Our work" }, url: "/islerimiz" },
  { label: { az: "Bloq", ru: "Блог", en: "Blog" }, url: "/bloq" },
  { label: { az: "Əlaqə", ru: "Контакты", en: "Contact" }, url: "/elaqe" },
];

export const seedAboutPage = {
  kind: "about" as const,
  title: { az: "Haqqımızda", ru: "О нас", en: "About us" },
  slug: { az: "haqqimizda", ru: "o-nas", en: "about" },
};

export type SeedSummary = {
  settings: boolean;
  pages: number;
  menus: number;
};

export async function seedDatabase(db: Database): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    const settingsRows = await tx
      .insert(schema.settings)
      .values({ id: 1, legalName: "byismayilov", hero: seedHero })
      .onConflictDoNothing()
      .returning({ id: schema.settings.id });

    const pageRows = await tx
      .insert(schema.pages)
      .values({ ...seedAboutPage, status: "draft" })
      .onConflictDoNothing()
      .returning({ id: schema.pages.id });

    const [menu] = await tx
      .insert(schema.menus)
      .values({ key: "main", title: { az: "Əsas menyu", ru: "Главное меню", en: "Main menu" } })
      .onConflictDoNothing()
      .returning({ id: schema.menus.id });
    if (menu) {
      await tx.insert(schema.menuItems).values(
        seedMainMenu.map((item, sortOrder) => ({
          menuId: menu.id,
          label: item.label,
          target: "url" as const,
          url: item.url,
          sortOrder,
        })),
      );
    }

    return {
      settings: settingsRows.length > 0,
      pages: pageRows.length,
      menus: menu ? 1 : 0,
    };
  });
}

export const demoCounts = {
  categories: 3,
  servicesPerCategory: 3,
  masters: 3,
  reviews: 2,
} as const;

export function demoCategory(n: number): { name: Localized; slug: Localized } {
  return {
    name: { az: `[Kateqoriya ${n}]`, ru: `[Категория ${n}]`, en: `[Category ${n}]` },
    slug: { az: `kateqoriya-${n}`, ru: `kategoriya-${n}`, en: `category-${n}` },
  };
}

export function demoService(n: number): { name: Localized; slug: Localized } {
  return {
    name: { az: `[Xidmət adı ${n}]`, ru: `[Название услуги ${n}]`, en: `[Service name ${n}]` },
    slug: { az: `xidmet-${n}`, ru: `usluga-${n}`, en: `service-${n}` },
  };
}

export function demoMaster(n: number): Localized {
  return { az: `[Usta adı ${n}]`, ru: `[Имя мастера ${n}]`, en: `[Master name ${n}]` };
}

export type DemoSeedSummary = {
  categories: number;
  services: number;
  masters: number;
  reviews: number;
};

export async function seedDemoContent(db: Database): Promise<DemoSeedSummary> {
  return db.transaction(async (tx) => {
    const summary: DemoSeedSummary = { categories: 0, services: 0, masters: 0, reviews: 0 };
    const serviceIds: string[] = [];

    for (let c = 1; c <= demoCounts.categories; c += 1) {
      const category = demoCategory(c);
      let [row] = await tx
        .select({ id: schema.serviceCategories.id })
        .from(schema.serviceCategories)
        .where(sql`${schema.serviceCategories.slug} ->> 'az' = ${category.slug.az}`);
      if (!row) {
        [row] = await tx
          .insert(schema.serviceCategories)
          .values({ ...category, sortOrder: c })
          .returning({ id: schema.serviceCategories.id });
        summary.categories += 1;
      }
      if (!row) continue;

      for (let s = 1; s <= demoCounts.servicesPerCategory; s += 1) {
        const n = (c - 1) * demoCounts.servicesPerCategory + s;
        const service = demoService(n);
        let [existing] = await tx
          .select({ id: schema.services.id })
          .from(schema.services)
          .where(sql`${schema.services.slug} ->> 'az' = ${service.slug.az}`);
        if (!existing) {
          [existing] = await tx
            .insert(schema.services)
            .values({
              ...service,
              priceKind: "on_request",
              status: "published",
              publishedAt: new Date(),
              sortOrder: n,
              isFeatured: s === 1,
            })
            .returning({ id: schema.services.id });
          if (existing) {
            await tx
              .insert(schema.serviceCategoryLinks)
              .values({ serviceId: existing.id, categoryId: row.id });
            summary.services += 1;
          }
        }
        if (existing) serviceIds.push(existing.id);
      }
    }

    for (let m = 1; m <= demoCounts.masters; m += 1) {
      const name = demoMaster(m);
      const [existing] = await tx
        .select({ id: schema.masters.id })
        .from(schema.masters)
        .where(sql`${schema.masters.name} ->> 'az' = ${name.az}`);
      if (existing) continue;
      const [row] = await tx
        .insert(schema.masters)
        .values({
          name,
          role: { az: "[İxtisas]", ru: "[Специализация]", en: "[Speciality]" },
          sortOrder: m,
        })
        .returning({ id: schema.masters.id });
      if (!row) continue;
      const own = serviceIds.filter((_, index) => index % demoCounts.masters === m - 1);
      if (own.length) {
        await tx
          .insert(schema.masterServices)
          .values(own.map((serviceId) => ({ masterId: row.id, serviceId })));
      }
      summary.masters += 1;
    }

    for (let r = 1; r <= demoCounts.reviews; r += 1) {
      const authorName = `[Müştəri adı ${r}]`;
      const [existing] = await tx
        .select({ id: schema.reviews.id })
        .from(schema.reviews)
        .where(eq(schema.reviews.authorName, authorName));
      if (existing) continue;
      await tx.insert(schema.reviews).values({ authorName, body: "[Rəy mətni]", sortOrder: r });
      summary.reviews += 1;
    }

    return summary;
  });
}
