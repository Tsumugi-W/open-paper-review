import { describe, it, expect } from 'vitest';
import { ReviewStateMachine, MachineState } from '../../workflow/machine.js';

describe('Worker Recovery (State Machine Persistence)', () => {
  it('machine can be serialized and restored mid-pipeline', () => {
    const machine = new ReviewStateMachine('job-123');
    machine.transition(MachineState.Intake);
    machine.transition(MachineState.Gate);
    machine.transition(MachineState.Briefing);

    // Simulate crash: serialize state
    const snapshot = machine.serialize();

    // Simulate restart: restore from snapshot
    const restored = ReviewStateMachine.deserialize(snapshot);
    expect(restored.currentState).toBe(MachineState.Briefing);
    expect(restored.isTerminal).toBe(false);

    // Can continue from restored state
    restored.transition(MachineState.RelatedWork);
    expect(restored.currentState).toBe(MachineState.RelatedWork);
  });

  it('failed machine cannot be resumed', () => {
    const machine = new ReviewStateMachine('job-456');
    machine.transition(MachineState.Intake);
    machine.fail('Out of memory');

    const snapshot = machine.serialize();
    const restored = ReviewStateMachine.deserialize(snapshot);

    expect(restored.isTerminal).toBe(true);
    expect(restored.error).toBe('Out of memory');
    expect(() => restored.transition(MachineState.Gate)).toThrow();
  });

  it('preserves full history across serialization', () => {
    const machine = new ReviewStateMachine('job-789');
    machine.transition(MachineState.Intake);
    machine.transition(MachineState.Gate);
    machine.transition(MachineState.GateConfirm);
    machine.transition(MachineState.Briefing);

    const snapshot = machine.serialize();
    const restored = ReviewStateMachine.deserialize(snapshot);

    // History should include: Pending -> Intake -> Gate -> GateConfirm -> Briefing
    expect(restored.history.length).toBe(5);
    expect(restored.history[0].state).toBe(MachineState.Pending);
    expect(restored.history[4].state).toBe(MachineState.Briefing);
  });

  it('cancelled state is recoverable from snapshot but not resumable', () => {
    const machine = new ReviewStateMachine('job-cancel');
    machine.transition(MachineState.Intake);
    machine.transition(MachineState.Gate);
    machine.cancel();

    const snapshot = machine.serialize();
    const restored = ReviewStateMachine.deserialize(snapshot);

    expect(restored.currentState).toBe(MachineState.Cancelled);
    expect(restored.isTerminal).toBe(true);
  });
});
