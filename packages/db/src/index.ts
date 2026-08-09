import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";
import * as relations from "./relations.js";

export * from "./schema.js";
export * from "./relations.js";
export * from "./queries/index.js";

let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Set it to a valid PostgreSQL connection string."
    );
  }

  const client = postgres(connectionString);
  return drizzle(client, { schema: { ...schema, ...relations } });
}

/**
 * Returns a singleton Drizzle ORM database instance.
 * Reads the connection string from the DATABASE_URL environment variable.
 */
export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
