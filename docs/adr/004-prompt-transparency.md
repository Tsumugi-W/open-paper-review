# ADR-004: Full Prompt Transparency

## Status
Accepted

## Context
Many AI review systems keep their prompts proprietary, making it impossible to audit, reproduce, or improve their review logic.

## Decision
All system prompts are versioned source code in `packages/prompts/`. Every review job records which prompt versions and content hashes were used, enabling full reproducibility.

## Consequences
- Anyone can audit the review logic
- Results are reproducible given the same prompt version + model + paper
- Prompt improvements are tracked via semver
- No competitive moat from hidden prompts (our value is in the orchestration and calibration)
