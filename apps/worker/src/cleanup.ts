/**
 * Cleanup utilities for provider artifacts.
 * Ensures uploaded files and remote resources are cleaned up on all exit paths.
 */

import type { WorkflowProvider } from "@opr/core/workflow";
import { getDb, reviewJobs } from "@opr/db";
import { eq } from "drizzle-orm";

// ─── Artifact Tracking ─────────────────────────────────────────────────────

/**
 * In-memory tracker of remote artifact IDs per job.
 * Used to ensure cleanup even if context is lost.
 */
const trackedArtifacts = new Map<string, string[]>();

/**
 * Register a remote artifact for a job (for crash-recovery cleanup).
 */
export function trackArtifact(jobId: string, artifactId: string): void {
  const existing = trackedArtifacts.get(jobId) ?? [];
  existing.push(artifactId);
  trackedArtifacts.set(jobId, existing);
}

/**
 * Get all tracked artifact IDs for a job.
 */
export function getTrackedArtifacts(jobId: string): string[] {
  return trackedArtifacts.get(jobId) ?? [];
}

/**
 * Clear tracked artifacts for a job (after successful cleanup).
 */
export function clearTrackedArtifacts(jobId: string): void {
  trackedArtifacts.delete(jobId);
}

// ─── Cleanup Functions ─────────────────────────────────────────────────────

/**
 * Delete all remote provider artifacts associated with a job.
 * Best-effort: logs errors but does not throw.
 */
export async function deleteProviderArtifacts(
  jobId: string,
  provider: WorkflowProvider,
): Promise<void> {
  const artifactIds = getTrackedArtifacts(jobId);
  if (artifactIds.length === 0) return;

  for (const artifactId of artifactIds) {
    try {
      await provider.deleteRemoteArtifact(artifactId);
    } catch {
      // Best-effort cleanup - do not expose paper content in logs
      console.error(`[worker] Failed to delete artifact for job ${jobId}`);
    }
  }

  clearTrackedArtifacts(jobId);
}

/**
 * Mark a job as cancelled in the database and clean up artifacts.
 * Used when a job is cancelled via signal or admin action.
 */
export async function cleanupOnCancel(
  jobId: string,
  provider: WorkflowProvider,
): Promise<void> {
  const db = getDb();

  try {
    await db
      .update(reviewJobs)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(reviewJobs.id, jobId));
  } catch {
    console.error(`[worker] Failed to mark job ${jobId} as cancelled in DB`);
  }

  await deleteProviderArtifacts(jobId, provider);
}

/**
 * Cleanup handler to run in finally blocks.
 * Ensures artifacts are cleaned regardless of success/failure/cancellation.
 */
export async function finalCleanup(
  jobId: string,
  provider: WorkflowProvider,
): Promise<void> {
  await deleteProviderArtifacts(jobId, provider);
}
