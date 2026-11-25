import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import {
  masterServices,
  masters,
  menuItems,
  menus,
  pages,
  reviews,
  serviceCategories,
  serviceCategoryLinks,
  services,
  settings,
} from "@/lib/db/schema";
import {
  demoCategory,
  demoCounts,
  demoMaster,
  demoService,
  seedAboutPage,
  seedDatabase,
  seedDemoContent,
  seedMainMenu,
} from "@/lib/db/seed";
import { locales } from "@/lib/i18n/config";

const placeholder = /^\[.+\]$/;

describe("database seed", () => {
  it("fills the base records and can run again without duplicates", async () => {
    const db = getDb();
    await seedDatabase(db);
    expect(await seedDatabase(db)).toMatchObject({ settings: false, pages: 0, menus: 0 });

    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    expect(row).toBeDefined();
    expect(row?.phones ?? []).toBeInstanceOf(Array);

    const [about] = await db
      .select({ slug: pages.slug })
      .from(pages)
      .where(eq(pages.kind, "about"));
    expect(about).toBeDefined();
    if (about?.slug.az === seedAboutPage.slug.az) {
      for (const locale of locales) expect(about.slug[locale], locale).toBeTruthy();
    }

    const items = await db
      .select({ url: menuItems.url })
      .from(menuItems)
      .innerJoin(menus, eq(menus.id, menuItems.menuId))
      .where(eq(menus.key, "main"));
    expect(items.length).toBeGreaterThan(0);
    for (const item of seedMainMenu) {
      expect(item.url).toMatch(/^\/[a-z]+$/);
    }
  });

  it("adds placeholder demo content only, idempotently", async () => {
    const db = getDb();
    await seedDemoContent(db);
    expect(await seedDemoContent(db)).toEqual({
      categories: 0,
      services: 0,
      masters: 0,
      reviews: 0,
    });

    const categorySlugs = Array.from(
      { length: demoCounts.categories },
      (_, index) => demoCategory(index + 1).slug.az,
    );
    const categoryRows = await db
      .select({ id: serviceCategories.id, name: serviceCategories.name })
      .from(serviceCategories)
      .where(inArray(sql`${serviceCategories.slug} ->> 'az'`, categorySlugs));
    expect(categoryRows).toHaveLength(demoCounts.categories);
    for (const row of categoryRows) {
      for (const locale of locales) expect(row.name[locale], locale).toMatch(placeholder);
    }

    const serviceTotal = demoCounts.categories * demoCounts.servicesPerCategory;
    const serviceSlugs = Array.from(
      { length: serviceTotal },
      (_, index) => demoService(index + 1).slug.az,
    );
    const serviceRows = await db
      .select({
        id: services.id,
        name: services.name,
        priceKind: services.priceKind,
        priceAmount: services.priceAmount,
        durationMinutes: services.durationMinutes,
      })
      .from(services)
      .where(inArray(sql`${services.slug} ->> 'az'`, serviceSlugs));
    expect(serviceRows).toHaveLength(serviceTotal);
    for (const row of serviceRows) {
      expect(row.name.az).toMatch(placeholder);
      expect(row.priceKind).toBe("on_request");
      expect(row.priceAmount).toBeNull();
      expect(row.durationMinutes).toBeNull();
    }
    const links = await db
      .select({ serviceId: serviceCategoryLinks.serviceId })
      .from(serviceCategoryLinks)
      .where(
        inArray(
          serviceCategoryLinks.serviceId,
          serviceRows.map((row) => row.id),
        ),
      );
    expect(links).toHaveLength(serviceTotal);

    const masterNames = Array.from({ length: demoCounts.masters }, (_, index) =>
      demoMaster(index + 1),
    );
    const masterRows = await db
      .select({ id: masters.id, role: masters.role })
      .from(masters)
      .where(
        inArray(
          sql`${masters.name} ->> 'az'`,
          masterNames.map((name) => name.az),
        ),
      );
    expect(masterRows).toHaveLength(demoCounts.masters);
    for (const row of masterRows) expect(row.role.az).toMatch(placeholder);
    const assigned = await db
      .select({ masterId: masterServices.masterId })
      .from(masterServices)
      .where(
        inArray(
          masterServices.masterId,
          masterRows.map((row) => row.id),
        ),
      );
    expect(assigned.length).toBeGreaterThan(0);

    const reviewRows = await db
      .select({ authorName: reviews.authorName, body: reviews.body, rating: reviews.rating })
      .from(reviews)
      .where(sql`${reviews.authorName} like '[Müştəri adı %]'`);
    expect(reviewRows).toHaveLength(demoCounts.reviews);
    for (const row of reviewRows) {
      expect(row.body).toMatch(placeholder);
      expect(row.rating).toBeNull();
    }
  });
});
