import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);

export const providerEnum = pgEnum("provider", [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
]);

export const venueBundleStatusEnum = pgEnum("venue_bundle_status", [
  "rubric_only",
  "calibrated",
  "deprecated",
]);

export const reviewJobStatusEnum = pgEnum("review_job_status", [
  "pending",
  "gate",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const reviewLanguageEnum = pgEnum("review_language", ["en", "zh"]);

export const jobEventTypeEnum = pgEnum("job_event_type", [
  "stage_start",
  "stage_complete",
  "stage_error",
  "progress",
  "info",
]);

export const gateFindingTypeEnum = pgEnum("gate_finding_type", [
  "hard_stop",
  "needs_confirmation",
]);

export const specialistDimensionEnum = pgEnum("specialist_dimension", [
  "methodology",
  "novelty",
  "experiments",
  "writing",
  "ethics",
]);

export const exportFormatEnum = pgEnum("export_format", [
  "json",
  "markdown",
  "pdf",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

// 1. users
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// 2. sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    uniqueIndex("sessions_token_idx").on(table.token),
  ]
);

// 3. apiTokens
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash),
  ]
);

// 4. modelProfiles
export const modelProfiles = pgTable(
  "model_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    provider: providerEnum("provider").notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    config: jsonb("config"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("model_profiles_provider_idx").on(table.provider),
  ]
);

// 5. providerUsage (forward reference to reviewJobs - callback is evaluated lazily)
export const providerUsage = pgTable(
  "provider_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelProfileId: uuid("model_profile_id")
      .notNull()
      .references(() => modelProfiles.id, { onDelete: "cascade" }),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    stage: varchar("stage", { length: 100 }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("provider_usage_model_profile_id_idx").on(table.modelProfileId),
    index("provider_usage_review_job_id_idx").on(table.reviewJobId),
  ]
);

// 6. venueBundles
export const venueBundles = pgTable(
  "venue_bundles",
  {
    id: text("id").primaryKey(), // e.g. "neurips/main/2026/v1"
    conferenceId: varchar("conference_id", { length: 100 }).notNull(),
    track: varchar("track", { length: 100 }).notNull(),
    year: integer("year").notNull(),
    version: integer("version").notNull(),
    status: venueBundleStatusEnum("status").notNull().default("rubric_only"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("venue_bundles_conference_id_idx").on(table.conferenceId),
    index("venue_bundles_year_idx").on(table.year),
  ]
);

// 7. papers
export const papers = pgTable(
  "papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    authors: jsonb("authors").notNull(), // JSON array of author objects
    abstract: text("abstract"),
    arxivId: varchar("arxiv_id", { length: 50 }),
    fileHash: varchar("file_hash", { length: 64 }).notNull(), // sha256
    filePath: text("file_path").notNull(),
    pageCount: integer("page_count"),
    fileSize: integer("file_size"),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("papers_uploaded_by_id_idx").on(table.uploadedById),
    uniqueIndex("papers_file_hash_idx").on(table.fileHash),
    index("papers_arxiv_id_idx").on(table.arxivId),
  ]
);

// 8. paperPages
export const paperPages = pgTable(
  "paper_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    textContent: text("text_content"),
    ocrContent: text("ocr_content"),
    imagePath: text("image_path"),
    coordinates: jsonb("coordinates"),
  },
  (table) => [
    index("paper_pages_paper_id_idx").on(table.paperId),
    uniqueIndex("paper_pages_paper_id_page_number_idx").on(
      table.paperId,
      table.pageNumber
    ),
  ]
);

// 9. paperChunks
export const paperChunks = pgTable(
  "paper_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => paperPages.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    sectionTitle: varchar("section_title", { length: 500 }),
    content: text("content").notNull(),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
  },
  (table) => [
    index("paper_chunks_paper_id_idx").on(table.paperId),
    index("paper_chunks_page_id_idx").on(table.pageId),
    uniqueIndex("paper_chunks_paper_id_chunk_index_idx").on(
      table.paperId,
      table.chunkIndex
    ),
  ]
);

// 10. references
export const references = pgTable(
  "references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    refIndex: integer("ref_index").notNull(),
    rawText: text("raw_text").notNull(),
    title: text("title"),
    authors: text("authors"),
    year: integer("year"),
    doi: varchar("doi", { length: 255 }),
    openAlexId: varchar("open_alex_id", { length: 255 }),
    semanticScholarId: varchar("semantic_scholar_id", { length: 255 }),
    verified: boolean("verified").notNull().default(false),
  },
  (table) => [
    index("references_paper_id_idx").on(table.paperId),
    index("references_doi_idx").on(table.doi),
    uniqueIndex("references_paper_id_ref_index_idx").on(
      table.paperId,
      table.refIndex
    ),
  ]
);

// 11. reviewJobs
export const reviewJobs = pgTable(
  "review_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    venueBundleId: text("venue_bundle_id")
      .notNull()
      .references(() => venueBundles.id, { onDelete: "restrict" }),
    status: reviewJobStatusEnum("status").notNull().default("pending"),
    currentStage: varchar("current_stage", { length: 100 }),
    language: reviewLanguageEnum("language").notNull().default("en"),
    config: jsonb("config"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("review_jobs_paper_id_idx").on(table.paperId),
    index("review_jobs_venue_bundle_id_idx").on(table.venueBundleId),
    index("review_jobs_status_idx").on(table.status),
    index("review_jobs_created_by_idx").on(table.createdBy),
  ]
);

// 12. jobEvents
export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    stage: varchar("stage", { length: 100 }).notNull(),
    type: jobEventTypeEnum("type").notNull(),
    message: text("message"),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_events_review_job_id_idx").on(table.reviewJobId),
    index("job_events_type_idx").on(table.type),
  ]
);

// 13. gateFindings
export const gateFindings = pgTable(
  "gate_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    type: gateFindingTypeEnum("type").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    message: text("message").notNull(),
    evidence: jsonb("evidence"),
    pageNumbers: integer("page_numbers").array(),
    resolved: boolean("resolved").notNull().default(false),
  },
  (table) => [
    index("gate_findings_review_job_id_idx").on(table.reviewJobId),
  ]
);

// 14. specialistAudits
export const specialistAudits = pgTable(
  "specialist_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    dimension: specialistDimensionEnum("dimension").notNull(),
    findings: jsonb("findings").notNull(),
    promptVersion: varchar("prompt_version", { length: 50 }),
    modelUsed: varchar("model_used", { length: 100 }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("specialist_audits_review_job_id_idx").on(table.reviewJobId),
    index("specialist_audits_dimension_idx").on(table.dimension),
  ]
);

// 15. scoreCandidates
export const scoreCandidates = pgTable(
  "score_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    rationale: text("rationale").notNull(),
    strengths: jsonb("strengths"),
    weaknesses: jsonb("weaknesses"),
    evidence: jsonb("evidence"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    promptVersion: varchar("prompt_version", { length: 50 }),
    modelUsed: varchar("model_used", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("score_candidates_review_job_id_idx").on(table.reviewJobId),
  ]
);

// 16. reviewResults
export const reviewResults = pgTable(
  "review_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewJobId: uuid("review_job_id")
      .notNull()
      .unique()
      .references(() => reviewJobs.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    summary: text("summary").notNull(),
    strengths: jsonb("strengths").notNull(),
    majorIssues: jsonb("major_issues").notNull(),
    minorIssues: jsonb("minor_issues").notNull(),
    questions: jsonb("questions"),
    mainReview: text("main_review").notNull(),
    optimisticView: text("optimistic_view"),
    criticalView: text("critical_view"),
    improvements: jsonb("improvements"),
    calibration: jsonb("calibration"),
    promptVersions: jsonb("prompt_versions"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // .unique() on the column already creates a unique index; no extra needed
  ]
);

// 17. annotations
export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewResultId: uuid("review_result_id")
      .notNull()
      .references(() => reviewResults.id, { onDelete: "cascade" }),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    content: text("content").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
  },
  (table) => [
    index("annotations_review_result_id_idx").on(table.reviewResultId),
    index("annotations_paper_id_idx").on(table.paperId),
  ]
);

// 18. exports
export const exports_ = pgTable(
  "exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewResultId: uuid("review_result_id")
      .notNull()
      .references(() => reviewResults.id, { onDelete: "cascade" }),
    format: exportFormatEnum("format").notNull(),
    filePath: text("file_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exports_review_result_id_idx").on(table.reviewResultId),
  ]
);
