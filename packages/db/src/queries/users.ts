import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../index.js";
import { users, papers, reviewJobs } from "../schema.js";

export async function createUser(
  db: Database,
  email: string,
  name: string,
  passwordHash: string,
  role: "admin" | "member" = "member"
) {
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash, role })
    .returning();
  return user;
}

export async function getUserByEmail(db: Database, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

export async function getUserById(db: Database, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function listUsers(db: Database) {
  return db.select().from(users);
}

export async function updateUserRole(
  db: Database,
  id: string,
  role: "admin" | "member"
) {
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(db: Database, id: string) {
  // Check if user has papers or review jobs referencing them
  const [paperCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(papers)
    .where(eq(papers.uploadedById, id));

  if (paperCount.count > 0) {
    throw new Error(
      "Cannot delete user: they have uploaded papers that reference them"
    );
  }

  const [jobCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewJobs)
    .where(eq(reviewJobs.createdBy, id));

  if (jobCount.count > 0) {
    throw new Error(
      "Cannot delete user: they have review jobs that reference them"
    );
  }

  await db.delete(users).where(eq(users.id, id));
}
