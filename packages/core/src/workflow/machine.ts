/**
 * Review job state machine.
 * Defines all possible states, transitions, and serialization for persistence.
 */

// ─── Machine States ─────────────────────────────────────────────────────────

export enum MachineState {
  Pending = "pending",
  Intake = "intake",
  Gate = "gate",
  GateConfirm = "gate_confirm",
  Briefing = "briefing",
  RelatedWork = "related_work",
  SpecialistAudits = "specialist_audits",
  ScorePrior = "score_prior",
  ScoreCandidates = "score_candidates",
  CandidateSelection = "candidate_selection",
  Synthesis = "synthesis",
  Calibration = "calibration",
  Improvements = "improvements",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

// ─── Terminal States ────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set<MachineState>([
  MachineState.Completed,
  MachineState.Failed,
  MachineState.Cancelled,
]);

// ─── Transition Map ─────────────────────────────────────────────────────────

/**
 * Defines valid transitions from each state.
 * Every non-terminal state can also transition to Failed or Cancelled.
 */
const TRANSITIONS: Record<MachineState, MachineState[]> = {
  [MachineState.Pending]: [
    MachineState.Intake,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Intake]: [
    MachineState.Gate,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Gate]: [
    MachineState.GateConfirm,
    MachineState.Briefing,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.GateConfirm]: [
    MachineState.Briefing,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Briefing]: [
    MachineState.RelatedWork,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.RelatedWork]: [
    MachineState.SpecialistAudits,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.SpecialistAudits]: [
    MachineState.ScorePrior,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.ScorePrior]: [
    MachineState.ScoreCandidates,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.ScoreCandidates]: [
    MachineState.CandidateSelection,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.CandidateSelection]: [
    MachineState.Synthesis,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Synthesis]: [
    MachineState.Calibration,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Calibration]: [
    MachineState.Improvements,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Improvements]: [
    MachineState.Completed,
    MachineState.Failed,
    MachineState.Cancelled,
  ],
  [MachineState.Completed]: [],
  [MachineState.Failed]: [],
  [MachineState.Cancelled]: [],
};

// ─── Ordered Pipeline Stages ────────────────────────────────────────────────

/**
 * The normal (happy path) ordered sequence of stages.
 * GateConfirm is conditional and not part of the default flow.
 */
export const PIPELINE_ORDER: MachineState[] = [
  MachineState.Pending,
  MachineState.Intake,
  MachineState.Gate,
  MachineState.Briefing,
  MachineState.RelatedWork,
  MachineState.SpecialistAudits,
  MachineState.ScorePrior,
  MachineState.ScoreCandidates,
  MachineState.CandidateSelection,
  MachineState.Synthesis,
  MachineState.Calibration,
  MachineState.Improvements,
  MachineState.Completed,
];

// ─── State Entry Record ─────────────────────────────────────────────────────

export interface StateEntry {
  state: MachineState;
  enteredAt: string; // ISO 8601 timestamp
  exitedAt?: string;
}

// ─── Serializable Machine Snapshot ──────────────────────────────────────────

export interface MachineSnapshot {
  jobId: string;
  currentState: MachineState;
  history: StateEntry[];
  error?: string;
}

// ─── Review State Machine ───────────────────────────────────────────────────

export class ReviewStateMachine {
  private _currentState: MachineState;
  private _history: StateEntry[];
  private _jobId: string;
  private _error?: string;

  constructor(jobId: string, initialState: MachineState = MachineState.Pending) {
    this._jobId = jobId;
    this._currentState = initialState;
    this._history = [
      {
        state: initialState,
        enteredAt: new Date().toISOString(),
      },
    ];
  }

  // ─── Accessors ────────────────────────────────────────────────────────

  get currentState(): MachineState {
    return this._currentState;
  }

  get jobId(): string {
    return this._jobId;
  }

  get history(): readonly StateEntry[] {
    return this._history;
  }

  get error(): string | undefined {
    return this._error;
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this._currentState);
  }

  // ─── Transition ───────────────────────────────────────────────────────

  /**
   * Attempt to transition to a new state.
   * Throws if the transition is invalid.
   */
  transition(to: MachineState): void {
    if (this.isTerminal) {
      throw new Error(
        `Cannot transition from terminal state "${this._currentState}"`,
      );
    }

    const allowed = TRANSITIONS[this._currentState];
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid transition: "${this._currentState}" -> "${to}". ` +
          `Allowed: [${allowed.join(", ")}]`,
      );
    }

    const now = new Date().toISOString();

    // Mark exit time on current state
    const currentEntry = this._history[this._history.length - 1];
    if (currentEntry) {
      currentEntry.exitedAt = now;
    }

    // Enter new state
    this._currentState = to;
    this._history.push({
      state: to,
      enteredAt: now,
    });
  }

  /**
   * Transition to Failed state with an error message.
   */
  fail(error: string): void {
    this._error = error;
    if (!this.isTerminal) {
      this.transition(MachineState.Failed);
    }
  }

  /**
   * Transition to Cancelled state.
   */
  cancel(): void {
    if (!this.isTerminal) {
      this.transition(MachineState.Cancelled);
    }
  }

  // ─── Query ────────────────────────────────────────────────────────────

  /**
   * Check if a given transition is valid from the current state.
   */
  canTransition(to: MachineState): boolean {
    if (this.isTerminal) return false;
    return TRANSITIONS[this._currentState].includes(to);
  }

  /**
   * Get the next state in the normal pipeline order.
   * Returns null if at the end or in a non-pipeline state.
   */
  getNextPipelineState(): MachineState | null {
    const idx = PIPELINE_ORDER.indexOf(this._currentState);
    if (idx === -1 || idx >= PIPELINE_ORDER.length - 1) return null;
    return PIPELINE_ORDER[idx + 1];
  }

  // ─── Serialization ────────────────────────────────────────────────────

  /**
   * Serialize the machine state for persistence.
   */
  serialize(): MachineSnapshot {
    return {
      jobId: this._jobId,
      currentState: this._currentState,
      history: [...this._history],
      error: this._error,
    };
  }

  /**
   * Restore a machine from a serialized snapshot.
   */
  static deserialize(snapshot: MachineSnapshot): ReviewStateMachine {
    const machine = new ReviewStateMachine(snapshot.jobId, snapshot.currentState);
    machine._history = [...snapshot.history];
    machine._error = snapshot.error;
    return machine;
  }
}
