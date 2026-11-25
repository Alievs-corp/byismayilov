import "dotenv/config";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../lib/db/schema";
import { seedDatabase, seedDemoContent } from "../lib/db/seed";

import { e2eOwner } from "./owner";

export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    await seedDatabase(db);
    await seedDemoContent(db);

    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, e2eOwner.email));
    if (existing) {
      await db.delete(schema.users).where(eq(schema.users.id, existing.id));
    }
    const id = randomUUID();
    await db.insert(schema.users).values({
      id,
      name: e2eOwner.name,
      email: e2eOwner.email,
      role: "owner",
      emailVerified: true,
    });
    await db.insert(schema.accounts).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(e2eOwner.password),
    });
  } finally {
    await client.end();
  }
}
