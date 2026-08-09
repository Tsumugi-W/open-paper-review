import { describe, it, expect } from 'vitest';
import { ReviewStateMachine } from '../workflow/machine.js';

describe('ReviewStateMachine', () => {
  it('starts in pending state', () => {
    const machine = new ReviewStateMachine();
    expect(machine.currentState).toBe('pending');
  });

  it('transitions through happy path', () => {
    const machine = new ReviewStateMachine();
    const stages = [
      'intake', 'gate', 'briefing', 'related_work',
      'specialist_audits', 'score_prior', 'score_candidates',
      'candidate_selection', 'synthesis', 'calibration',
      'improvements', 'completed',
    ];

    for (const stage of stages) {
      expect(machine.canTransitionTo(stage)).toBe(true);
      machine.transitionTo(stage);
      expect(machine.currentState).toBe(stage);
    }
  });

  it('allows transition to gate_confirm from gate', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    machine.transitionTo('gate');
    expect(machine.canTransitionTo('gate_confirm')).toBe(true);
    machine.transitionTo('gate_confirm');
    expect(machine.currentState).toBe('gate_confirm');
  });

  it('allows cancellation from any active state', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    machine.transitionTo('gate');
    machine.transitionTo('briefing');
    expect(machine.canTransitionTo('cancelled')).toBe(true);
    machine.transitionTo('cancelled');
    expect(machine.currentState).toBe('cancelled');
  });

  it('allows failure from any active state', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    expect(machine.canTransitionTo('failed')).toBe(true);
    machine.transitionTo('failed');
    expect(machine.currentState).toBe('failed');
  });

  it('rejects invalid transitions', () => {
    const machine = new ReviewStateMachine();
    expect(machine.canTransitionTo('synthesis')).toBe(false);
  });

  it('records timestamps for each transition', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    const history = machine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].to).toBe('intake');
    expect(history[0].timestamp).toBeInstanceOf(Date);
  });

  it('is serializable for persistence', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    machine.transitionTo('gate');

    const serialized = machine.serialize();
    const restored = ReviewStateMachine.deserialize(serialized);
    expect(restored.currentState).toBe('gate');
    expect(restored.getHistory().length).toBe(2);
  });

  it('cannot transition from terminal states', () => {
    const machine = new ReviewStateMachine();
    machine.transitionTo('intake');
    machine.transitionTo('failed');
    expect(machine.canTransitionTo('gate')).toBe(false);
    expect(machine.canTransitionTo('cancelled')).toBe(false);
  });
});
