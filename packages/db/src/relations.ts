import { relations } from "drizzle-orm";
import {
  users,
  sessions,
  apiTokens,
  modelProfiles,
  providerUsage,
  venueBundles,
  papers,
  paperPages,
  paperChunks,
  references,
  reviewJobs,
  jobEvents,
  gateFindings,
  specialistAudits,
  scoreCandidates,
  reviewResults,
  annotations,
  exports_,
} from "./schema.js";

// ─── User Relations ──────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  apiTokens: many(apiTokens),
  papers: many(papers),
  reviewJobs: many(reviewJobs),
}));

// ─── Session Relations ───────────────────────────────────────────────────────

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ─── API Token Relations ─────────────────────────────────────────────────────

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));

// ─── Model Profile Relations ─────────────────────────────────────────────────

export const modelProfilesRelations = relations(modelProfiles, ({ many }) => ({
  providerUsage: many(providerUsage),
}));

// ─── Provider Usage Relations ────────────────────────────────────────────────

export const providerUsageRelations = relations(providerUsage, ({ one }) => ({
  modelProfile: one(modelProfiles, {
    fields: [providerUsage.modelProfileId],
    references: [modelProfiles.id],
  }),
  reviewJob: one(reviewJobs, {
    fields: [providerUsage.reviewJobId],
    references: [reviewJobs.id],
  }),
}));

// ─── Venue Bundle Relations ──────────────────────────────────────────────────

export const venueBundlesRelations = relations(venueBundles, ({ many }) => ({
  reviewJobs: many(reviewJobs),
}));

// ─── Paper Relations ─────────────────────────────────────────────────────────

export const papersRelations = relations(papers, ({ one, many }) => ({
  uploadedBy: one(users, {
    fields: [papers.uploadedById],
    references: [users.id],
  }),
  pages: many(paperPages),
  chunks: many(paperChunks),
  references: many(references),
  reviewJobs: many(reviewJobs),
  annotations: many(annotations),
}));

// ─── Paper Page Relations ────────────────────────────────────────────────────

export const paperPagesRelations = relations(paperPages, ({ one, many }) => ({
  paper: one(papers, {
    fields: [paperPages.paperId],
    references: [papers.id],
  }),
  chunks: many(paperChunks),
}));

// ─── Paper Chunk Relations ───────────────────────────────────────────────────

export const paperChunksRelations = relations(paperChunks, ({ one }) => ({
  paper: one(papers, {
    fields: [paperChunks.paperId],
    references: [papers.id],
  }),
  page: one(paperPages, {
    fields: [paperChunks.pageId],
    references: [paperPages.id],
  }),
}));

// ─── Reference Relations ─────────────────────────────────────────────────────

export const referencesRelations = relations(references, ({ one }) => ({
  paper: one(papers, {
    fields: [references.paperId],
    references: [papers.id],
  }),
}));

// ─── Review Job Relations ────────────────────────────────────────────────────

export const reviewJobsRelations = relations(reviewJobs, ({ one, many }) => ({
  paper: one(papers, {
    fields: [reviewJobs.paperId],
    references: [papers.id],
  }),
  venueBundle: one(venueBundles, {
    fields: [reviewJobs.venueBundleId],
    references: [venueBundles.id],
  }),
  createdByUser: one(users, {
    fields: [reviewJobs.createdBy],
    references: [users.id],
  }),
  events: many(jobEvents),
  gateFindings: many(gateFindings),
  specialistAudits: many(specialistAudits),
  scoreCandidates: many(scoreCandidates),
  providerUsage: many(providerUsage),
  result: one(reviewResults),
}));

// ─── Job Event Relations ─────────────────────────────────────────────────────

export const jobEventsRelations = relations(jobEvents, ({ one }) => ({
  reviewJob: one(reviewJobs, {
    fields: [jobEvents.reviewJobId],
    references: [reviewJobs.id],
  }),
}));

// ─── Gate Finding Relations ──────────────────────────────────────────────────

export const gateFindingsRelations = relations(gateFindings, ({ one }) => ({
  reviewJob: one(reviewJobs, {
    fields: [gateFindings.reviewJobId],
    references: [reviewJobs.id],
  }),
}));

// ─── Specialist Audit Relations ──────────────────────────────────────────────

export const specialistAuditsRelations = relations(
  specialistAudits,
  ({ one }) => ({
    reviewJob: one(reviewJobs, {
      fields: [specialistAudits.reviewJobId],
      references: [reviewJobs.id],
    }),
  })
);

// ─── Score Candidate Relations ───────────────────────────────────────────────

export const scoreCandidatesRelations = relations(
  scoreCandidates,
  ({ one }) => ({
    reviewJob: one(reviewJobs, {
      fields: [scoreCandidates.reviewJobId],
      references: [reviewJobs.id],
    }),
  })
);

// ─── Review Result Relations ─────────────────────────────────────────────────

export const reviewResultsRelations = relations(
  reviewResults,
  ({ one, many }) => ({
    reviewJob: one(reviewJobs, {
      fields: [reviewResults.reviewJobId],
      references: [reviewJobs.id],
    }),
    annotations: many(annotations),
    exports: many(exports_),
  })
);

// ─── Annotation Relations ────────────────────────────────────────────────────

export const annotationsRelations = relations(annotations, ({ one }) => ({
  reviewResult: one(reviewResults, {
    fields: [annotations.reviewResultId],
    references: [reviewResults.id],
  }),
  paper: one(papers, {
    fields: [annotations.paperId],
    references: [papers.id],
  }),
}));

// ─── Export Relations ────────────────────────────────────────────────────────

export const exportsRelations = relations(exports_, ({ one }) => ({
  reviewResult: one(reviewResults, {
    fields: [exports_.reviewResultId],
    references: [reviewResults.id],
  }),
}));
