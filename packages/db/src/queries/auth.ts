import { eq, lt, sql } from "drizzle-orm";
import type { Database } from "../index.js";
import { sessions, apiTokens, users } from "../schema.js";

export async function createSession(
  db: Database,
  userId: string,
  token: string,
  expiresAt: Date
) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, token, expiresAt })
    .returning();
  return session;
}

export async function getSessionByToken(db: Database, token: string) {
  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token));

  if (!row) return null;
  return { ...row.session, user: row.user };
}

export async function deleteSession(db: Database, id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function deleteExpiredSessions(db: Database) {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return result.length;
}

export async function createApiToken(
  db: Database,
  userId: string,
  name: string,
  tokenHash: string
) {
  const [token] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash })
    .returning();
  return token;
}

export async function getApiTokenByHash(db: Database, hash: string) {
  const [row] = await db
    .select({
      token: apiTokens,
      user: users,
    })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, hash));

  if (!row) return null;
  return { ...row.token, user: row.user };
}

export async function listApiTokens(db: Database, userId: string) {
  return db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
}

export async function deleteApiToken(db: Database, id: string) {
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
}

export async function updateApiTokenLastUsed(db: Database, id: string) {
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, id));
}
