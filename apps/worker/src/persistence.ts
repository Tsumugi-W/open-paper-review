/**
 * Job persistence implementation for the orchestrator.
 * Bridges @opr/core/workflow's JobPersistence interface with the @opr/db layer.
 */

import type {
  JobPersistence,
  MachineSnapshot,
  ReviewContext,
} from "@opr/core/workflow";
import { MachineState } from "@opr/core/workflow";
import type { VenueBundle } from "@opr/core";
import { getDb, reviewJobs, jobEvents } from "@opr/db";
import { eq } from "drizzle-orm";

// ─── Persistence Factory ──────────────────────────────────────────────────────

/**
 * Creates a JobPersistence implementation backed by the database.
 * This replaces the inline implementation in processor.ts for better separation.
 */
export function createPersistence(jobId: string): JobPersistence {
  return {
    async loadJobState(
      id: string,
    ): Promise<{
      machineSnapshot: MachineSnapshot;
      context: ReviewContext;
      venueBundle: VenueBundle;
    } | null> {
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      if (!job || !job.config) return null;

      const config = job.config as Record<string, unknown>;
      const savedState = config.__machineSnapshot as
        | MachineSnapshot
        | undefined;
      if (!savedState) return null;

      const context = config.__context as ReviewContext | undefined;
      const venueBundle = config.__venueBundle as VenueBundle | undefined;

      if (!context || !venueBundle) return null;

      return {
        machineSnapshot: savedState,
        context,
        venueBundle,
      };
    },

    async saveMachineSnapshot(
      id: string,
      snapshot: MachineSnapshot,
    ): Promise<void> {
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      const existingConfig = (job?.config as Record<string, unknown>) ?? {};

      await db
        .update(reviewJobs)
        .set({
          currentStage: snapshot.currentState,
          config: { ...existingConfig, __machineSnapshot: snapshot },
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, id));
    },

    async saveStageOutput(
      id: string,
      stage: MachineState,
      output: {
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        model?: string;
      },
    ): Promise<void> {
      const db = getDb();
      await db.insert(jobEvents).values({
        reviewJobId: id,
        stage,
        type: "stage_complete",
        message: `Stage output saved: ${stage}`,
        data: {
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          costUsd: output.costUsd,
          model: output.model,
        },
      });
    },

    async saveContext(id: string, context: ReviewContext): Promise<void> {
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      const existingConfig = (job?.config as Record<string, unknown>) ?? {};

      await db
        .update(reviewJobs)
        .set({
          config: { ...existingConfig, __context: context },
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, id));
    },

    async logEvent(
      id: string,
      type:
        | "stage_start"
        | "stage_complete"
        | "stage_error"
        | "progress"
        | "info",
      stage: string,
      message: string,
      data?: Record<string, unknown>,
    ): Promise<void> {
      const db = getDb();
      await db.insert(jobEvents).values({
        reviewJobId: id,
        stage,
        type,
        message,
        data: data ?? null,
      });
    },
  };
}
