import { eq, sql, and, gte, lte } from "drizzle-orm";
import type { Database } from "../index.js";
import { modelProfiles, providerUsage } from "../schema.js";

export async function createModelProfile(
  db: Database,
  data: {
    name: string;
    provider: "openai" | "anthropic" | "gemini" | "openrouter";
    model: string;
    apiKeyEncrypted: string;
    config?: unknown;
    isDefault?: boolean;
  }
) {
  // If this profile is set as default, unset all others
  if (data.isDefault) {
    await db
      .update(modelProfiles)
      .set({ isDefault: false })
      .where(eq(modelProfiles.isDefault, true));
  }

  const [profile] = await db.insert(modelProfiles).values(data).returning();
  return profile;
}

export async function listModelProfiles(db: Database) {
  return db.select().from(modelProfiles);
}

export async function getDefaultModelProfile(db: Database) {
  const [profile] = await db
    .select()
    .from(modelProfiles)
    .where(eq(modelProfiles.isDefault, true));
  return profile ?? null;
}

export async function deleteModelProfile(db: Database, id: string) {
  await db.delete(modelProfiles).where(eq(modelProfiles.id, id));
}

export async function recordProviderUsage(
  db: Database,
  data: {
    modelProfileId: string;
    reviewJobId: string;
    stage: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    costUsd: string;
    durationMs?: number | null;
  }
) {
  const [usage] = await db
    .insert(providerUsage)
    .values({
      ...data,
      cachedTokens: data.cachedTokens ?? 0,
    })
    .returning();
  return usage;
}

export async function getUsageByJob(db: Database, reviewJobId: string) {
  return db
    .select()
    .from(providerUsage)
    .where(eq(providerUsage.reviewJobId, reviewJobId));
}

export async function getUsageSummary(
  db: Database,
  opts: { startDate: Date; endDate: Date }
) {
  const { startDate, endDate } = opts;

  const dateCondition = and(
    gte(providerUsage.createdAt, startDate),
    lte(providerUsage.createdAt, endDate)
  );

  // Overall totals
  const [totals] = await db
    .select({
      totalCost: sql<string>`coalesce(sum(${providerUsage.costUsd}), '0')`,
      totalInputTokens: sql<number>`coalesce(sum(${providerUsage.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${providerUsage.outputTokens}), 0)::int`,
      totalCachedTokens: sql<number>`coalesce(sum(${providerUsage.cachedTokens}), 0)::int`,
    })
    .from(providerUsage)
    .where(dateCondition);

  // By provider (via model profile join)
  const byProvider = await db
    .select({
      provider: sql<string>`mp.provider`,
      totalCost: sql<string>`coalesce(sum(${providerUsage.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${providerUsage.inputTokens} + ${providerUsage.outputTokens}), 0)::int`,
    })
    .from(providerUsage)
    .innerJoin(
      sql`model_profiles mp`,
      sql`mp.id = ${providerUsage.modelProfileId}`
    )
    .where(dateCondition)
    .groupBy(sql`mp.provider`);

  // By stage
  const byStage = await db
    .select({
      stage: providerUsage.stage,
      totalCost: sql<string>`coalesce(sum(${providerUsage.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${providerUsage.inputTokens} + ${providerUsage.outputTokens}), 0)::int`,
    })
    .from(providerUsage)
    .where(dateCondition)
    .groupBy(providerUsage.stage);

  return {
    totalCost: totals.totalCost,
    totalTokens:
      totals.totalInputTokens +
      totals.totalOutputTokens +
      totals.totalCachedTokens,
    byProvider,
    byStage,
  };
}
