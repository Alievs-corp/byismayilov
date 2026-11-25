import "dotenv/config";

import { createRequire } from "node:module";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// tsx loads lib/ as CommonJS, whose `export *` re-exports are invisible to an ESM namespace import.
const load = createRequire(import.meta.url);
const schema = load("../lib/db/schema") as typeof import("../lib/db/schema");
const { seedDatabase, seedDemoContent } = load("../lib/db/seed") as typeof import("../lib/db/seed");
const remote = load(
  "../lib/cache/remote-revalidate",
) as typeof import("../lib/cache/remote-revalidate");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const demo = process.argv.includes("--demo");
if (demo && process.env.NODE_ENV === "production") {
  throw new Error("Placeholder demo content is for local development only");
}

const client = postgres(url, { max: 1 });

try {
  const db = drizzle(client, { schema });
  const summary = await seedDatabase(db);
  console.log(
    [
      summary.settings ? "settings row created" : "settings row already present",
      `${summary.pages} pages`,
      `${summary.menus} menus added`,
    ].join(", "),
  );
  if (demo) {
    const added = await seedDemoContent(db);
    console.log(
      `placeholder demo content: ${added.categories} categories, ${added.services} services, ${added.masters} masters, ${added.reviews} reviews`,
    );
  }
  console.log(remote.describeRevalidation(await remote.requestPublicRevalidation()));
} finally {
  await client.end();
}
