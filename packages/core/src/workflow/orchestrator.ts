/**
 * Review orchestration engine.
 * Drives the complete review pipeline for a job, handling persistence,
 * resumability, cancellation, and event emission.
 */

import { EventEmitter } from "node:events";
import type { ReviewContext } from "./context.js";
import { createReviewContext, recordUsage } from "./context.js";
import { ReviewStateMachine, MachineState, type MachineSnapshot } from "./machine.js";
import type { StageOutput } from "../types/stage.js";
import type { ReviewStage } from "../types/workflow.js";
import type { WorkflowProvider } from "./types.js";
import type { VenueBundle } from "../types/venue.js";

import { runIntake } from "./stages/intake.js";
import { runGate } from "./stages/gate.js";
import { runBriefing } from "./stages/briefing.js";
import { runRelatedWork } from "./stages/related-work.js";
import { runSpecialists } from "./stages/specialists.js";
import { runScorePrior } from "./stages/score-prior.js";
import { runScoreCandidates } from "./stages/score-candidates.js";
import { runCandidateSelection } from "./stages/candidate-selection.js";
import { runSynthesis } from "./stages/synthesis.js";
import { runCalibration } from "./stages/calibration.js";
import { runImprovements } from "./stages/improvements.js";

// ─── Event Types ────────────────────────────────────────────────────────────

export interface OrchestratorEvents {
  stage_start: { jobId: string; stage: MachineState; timestamp: string };
  stage_complete: {
    jobId: string;
    stage: MachineState;
    durationMs: number;
    timestamp: string;
  };
  progress: {
    jobId: string;
    stage: MachineState;
    message: string;
    percent?: number;
  };
  error: { jobId: string; stage: MachineState; error: string; fatal: boolean };
  completed: { jobId: string; timestamp: string; totalDurationMs: number };
  cancelled: { jobId: string; timestamp: string };
}

// ─── Persistence Interface ──────────────────────────────────────────────────

/**
 * Persistence adapter used by the orchestrator to load/save job state.
 * Implement this interface to hook into your database layer.
 */
export interface JobPersistence {
  /** Load job state from storage. Returns null if not found. */
  loadJobState(jobId: string): Promise<{
    machineSnapshot: MachineSnapshot;
    context: ReviewContext;
    venueBundle: VenueBundle;
  } | null>;

  /** Save machine snapshot after each stage transition (commit point). */
  saveMachineSnapshot(jobId: string, snapshot: MachineSnapshot): Promise<void>;

  /** Save stage output to DB after a stage completes. */
  saveStageOutput(
    jobId: string,
    stage: MachineState,
    output: StageOutput,
  ): Promise<void>;

  /** Save the final review context. */
  saveContext(jobId: string, context: ReviewContext): Promise<void>;

  /** Log a job event. */
  logEvent(
    jobId: string,
    type: "stage_start" | "stage_complete" | "stage_error" | "progress" | "info",
    stage: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void>;
}

// ─── Orchestrator Configuration ─────────────────────────────────────────────

export interface OrchestratorConfig {
  provider: WorkflowProvider;
  persistence: JobPersistence;
  /** Optional event emitter; if not provided one is created internally. */
  emitter?: EventEmitter;
}

// ─── Stage Runner Type ──────────────────────────────────────────────────────

type StageRunner = (
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
) => Promise<StageOutput>;

// ─── Stage Registry ─────────────────────────────────────────────────────────

const STAGE_RUNNERS: Partial<Record<MachineState, StageRunner>> = {
  [MachineState.Intake]: runIntake,
  [MachineState.Gate]: runGate,
  [MachineState.Briefing]: runBriefing,
  [MachineState.RelatedWork]: runRelatedWork,
  [MachineState.SpecialistAudits]: runSpecialists,
  [MachineState.ScorePrior]: runScorePrior,
  [MachineState.ScoreCandidates]: runScoreCandidates,
  [MachineState.CandidateSelection]: runCandidateSelection,
  [MachineState.Synthesis]: runSynthesis,
  [MachineState.Calibration]: runCalibration,
  [MachineState.Improvements]: runImprovements,
};

// ─── Review Orchestrator ────────────────────────────────────────────────────

export class ReviewOrchestrator {
  private provider: WorkflowProvider;
  private persistence: JobPersistence;
  private emitter: EventEmitter;

  constructor(config: OrchestratorConfig) {
    this.provider = config.provider;
    this.persistence = config.persistence;
    this.emitter = config.emitter ?? new EventEmitter();
  }

  /**
   * Access the event emitter for subscribing to orchestrator events.
   */
  get events(): EventEmitter {
    return this.emitter;
  }

  /**
   * Runs the complete review pipeline for a job from the beginning.
   * Creates a fresh machine state and context.
   */
  async execute(
    jobId: string,
    paperId: string,
    venueBundle: VenueBundle,
    signal: AbortSignal,
  ): Promise<void> {
    const machine = new ReviewStateMachine(jobId);
    const context = createReviewContext(jobId, paperId);

    // Set venue context
    context.venue = {
      venueId: venueBundle.id,
      conferenceId: venueBundle.conferenceId,
      track: venueBundle.track,
      year: venueBundle.year,
      scoreScale: venueBundle.scoreScale,
      precheckRules: venueBundle.precheckRules,
      rubric: venueBundle,
    };

    await this.persistence.saveMachineSnapshot(jobId, machine.serialize());
    await this.runPipeline(machine, context, signal);
  }

  /**
   * Resumes from the last committed stage after worker restart.
   * Loads job state from DB and continues the pipeline.
   */
  async resume(jobId: string, signal: AbortSignal): Promise<void> {
    const saved = await this.persistence.loadJobState(jobId);
    if (!saved) {
      throw new Error(`Job ${jobId} not found in persistence layer`);
    }

    const machine = ReviewStateMachine.deserialize(saved.machineSnapshot);

    if (machine.isTerminal) {
      throw new Error(
        `Job ${jobId} is in terminal state "${machine.currentState}" and cannot be resumed`,
      );
    }

    const context = saved.context;
    await this.runPipeline(machine, context, signal);
  }

  // ─── Pipeline Execution ───────────────────────────────────────────────

  private async runPipeline(
    machine: ReviewStateMachine,
    context: ReviewContext,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      while (!machine.isTerminal) {
        // Check for cancellation between stages
        if (signal.aborted) {
          machine.cancel();
          await this.persistence.saveMachineSnapshot(context.jobId, machine.serialize());
          this.emitter.emit("cancelled", {
            jobId: context.jobId,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const nextState = machine.getNextPipelineState();
        if (!nextState) {
          // At the end of the pipeline, transition to Completed
          if (machine.canTransition(MachineState.Completed)) {
            machine.transition(MachineState.Completed);
            await this.persistence.saveMachineSnapshot(
              context.jobId,
              machine.serialize(),
            );
            await this.persistence.saveContext(context.jobId, context);
            this.emitter.emit("completed", {
              jobId: context.jobId,
              timestamp: new Date().toISOString(),
              totalDurationMs: context.totalDurationMs,
            });
          }
          return;
        }

        // Skip GateConfirm in the normal flow (handled specially in Gate)
        if (nextState === MachineState.GateConfirm) {
          continue;
        }

        await this.runStage(nextState, machine, context, signal);
      }
    } catch (err: unknown) {
      // Unexpected error - fail the machine
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      if (!machine.isTerminal) {
        machine.fail(errorMessage);
        await this.persistence.saveMachineSnapshot(
          context.jobId,
          machine.serialize(),
        );
      }

      this.emitter.emit("error", {
        jobId: context.jobId,
        stage: machine.currentState,
        error: errorMessage,
        fatal: true,
      });

      throw err;
    } finally {
      // Clean up any remote artifacts
      await this.cleanupArtifacts(context);
    }
  }

  // ─── Stage Execution ──────────────────────────────────────────────────

  /**
   * Run a single stage. Each stage is idempotent - checks if already completed.
   */
  private async runStage(
    stage: MachineState,
    machine: ReviewStateMachine,
    context: ReviewContext,
    signal: AbortSignal,
  ): Promise<StageOutput | null> {
    // Check if this stage output already exists (idempotency)
    if (this.isStageComplete(stage, context)) {
      // Already done - advance the machine state if needed
      if (machine.currentState !== stage && machine.canTransition(stage)) {
        machine.transition(stage);
      }
      // Advance past the completed stage
      const nextAfter = machine.getNextPipelineState();
      if (nextAfter && machine.canTransition(nextAfter)) {
        machine.transition(nextAfter);
      }
      return null;
    }

    const runner = STAGE_RUNNERS[stage];
    if (!runner) {
      throw new Error(`No runner registered for stage "${stage}"`);
    }

    // Transition machine to this stage
    if (machine.currentState !== stage) {
      machine.transition(stage);
      await this.persistence.saveMachineSnapshot(
        context.jobId,
        machine.serialize(),
      );
    }

    const stageStartTime = Date.now();
    const timestamp = new Date().toISOString();

    this.emitter.emit("stage_start", {
      jobId: context.jobId,
      stage,
      timestamp,
    });

    await this.persistence.logEvent(
      context.jobId,
      "stage_start",
      stage,
      `Starting stage: ${stage}`,
    );

    try {
      const output = await runner(context, this.provider, signal);
      const durationMs = Date.now() - stageStartTime;

      // Record usage
      if (output.inputTokens > 0 || output.outputTokens > 0) {
        recordUsage(context, {
          stage,
          provider: output.model,
          model: output.model,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: output.costUsd,
          durationMs,
          timestamp: new Date().toISOString(),
        });
      }

      // Save stage output (commit point)
      await this.persistence.saveStageOutput(context.jobId, stage, output);
      await this.persistence.saveContext(context.jobId, context);

      // Handle Gate -> GateConfirm transition
      if (stage === MachineState.Gate && this.needsGateConfirmation(context)) {
        machine.transition(MachineState.GateConfirm);
        await this.persistence.saveMachineSnapshot(
          context.jobId,
          machine.serialize(),
        );
        await this.persistence.logEvent(
          context.jobId,
          "info",
          stage,
          "Gate requires confirmation - pausing for user input",
        );
        // Pipeline will pause here until resume is called with confirmation
        return output;
      }

      this.emitter.emit("stage_complete", {
        jobId: context.jobId,
        stage,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      await this.persistence.logEvent(
        context.jobId,
        "stage_complete",
        stage,
        `Stage completed in ${durationMs}ms`,
        { durationMs, inputTokens: output.inputTokens, outputTokens: output.outputTokens },
      );

      return output;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      this.emitter.emit("error", {
        jobId: context.jobId,
        stage,
        error: errorMessage,
        fatal: false,
      });

      await this.persistence.logEvent(
        context.jobId,
        "stage_error",
        stage,
        errorMessage,
      );

      throw err;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Check if a stage has already been completed (idempotency check).
   */
  private isStageComplete(stage: MachineState, context: ReviewContext): boolean {
    switch (stage) {
      case MachineState.Intake:
        return context.paper != null;
      case MachineState.Gate:
        return context.gateResult != null;
      case MachineState.GateConfirm:
        return context.gateConfirmation != null;
      case MachineState.Briefing:
        return context.briefing != null;
      case MachineState.RelatedWork:
        return context.relatedWork != null;
      case MachineState.SpecialistAudits:
        return context.specialistAudits != null && context.specialistAudits.length > 0;
      case MachineState.ScorePrior:
        return context.scorePrior != null;
      case MachineState.ScoreCandidates:
        return context.scoreCandidates != null && context.scoreCandidates.length > 0;
      case MachineState.CandidateSelection:
        return context.candidateSelection != null;
      case MachineState.Synthesis:
        return context.synthesis != null;
      case MachineState.Calibration:
        return context.calibration != null;
      case MachineState.Improvements:
        return context.improvements != null;
      default:
        return false;
    }
  }

  /**
   * Check if gate results require user confirmation.
   */
  private needsGateConfirmation(context: ReviewContext): boolean {
    if (!context.gateResult) return false;
    // If the gate failed and there are findings that need confirmation
    // (not outright rejections but warnings/needs_confirmation)
    return (
      !context.gateResult.passed &&
      context.gateResult.findings.some(
        (f) => !f.passed && f.severity === "warn",
      )
    );
  }

  /**
   * Clean up any remote artifacts (uploaded files, etc.) in finally blocks.
   */
  private async cleanupArtifacts(context: ReviewContext): Promise<void> {
    if (!context.paper?.remoteArtifactIds.length) return;

    for (const artifactId of context.paper.remoteArtifactIds) {
      try {
        await this.provider.deleteRemoteArtifact(artifactId);
      } catch {
        // Best-effort cleanup - log but don't throw
        this.emitter.emit("error", {
          jobId: context.jobId,
          stage: MachineState.Completed,
          error: `Failed to delete remote artifact: ${artifactId}`,
          fatal: false,
        });
      }
    }
  }
}
