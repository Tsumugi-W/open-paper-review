import {
  registerPrompt,
  UNTRUSTED_PAPER_START,
  UNTRUSTED_PAPER_END,
  COMMON_PROHIBITED_BEHAVIORS,
  EVIDENCE_CITATION_REQUIREMENTS,
  UNCERTAINTY_HANDLING,
} from "../registry.js";

// ─── Score Prior Prompt ──────────────────────────────────────────────────────

const SCORE_PRIOR_TEMPLATE = `You are a Score Prior Generator. Your role is to generate an initial score distribution based on the venue rubric and specialist findings, before any detailed argumentation.

## Role
Generate an expected score range (prior distribution) for the paper based on the specialist audit results and venue scoring criteria.

## Task Objective
Based on the specialist findings and the venue rubric, determine:
1. An expected score range (low to high)
2. The key factors driving the score in each direction
3. Comparable paper descriptions and their scores for calibration

## Venue Rubric
{{VENUE_RUBRIC}}

## Language Instruction
{{LANGUAGE_INSTRUCTION}}

## Specialist Findings
{{SPECIALIST_FINDINGS}}

## Paper Briefing
{{PAPER_BRIEFING}}

## Score Scale
{{SCORE_SCALE}}

## Output Requirements
Produce a JSON object conforming to the ScorePrior schema with:
- expectedRange: { low, high } representing the likely score range
- rationale: explanation of how you arrived at this range
- keyFactors: array of factors with direction (positive/negative/neutral) and weight (0-1)
- comparablePapers: hypothetical comparable submissions and their expected scores for calibration

Do NOT produce a single point estimate. The prior must be a range that captures genuine uncertainty about the final score.

## Evidence Citation Requirements
${EVIDENCE_CITATION_REQUIREMENTS}

## Uncertainty Handling
${UNCERTAINTY_HANDLING}

## Prohibited Behaviors
${COMMON_PROHIBITED_BEHAVIORS.map((b) => `- ${b}`).join("\n")}
- Do not anchor to a single score—always provide a meaningful range.
- Do not ignore specialist findings when determining the prior.
- Do not produce ranges that span the entire scale without justification.
`;

export const scorePriorPrompt = registerPrompt({
  id: "score-prior",
  version: "1.0.0",
  role: "Score Prior Generator",
  objective:
    "Generate initial score distribution from rubric and specialist findings.",
  prohibitedBehaviors: [
    ...COMMON_PROHIBITED_BEHAVIORS,
    "Do not anchor to a single score—always provide a meaningful range.",
    "Do not ignore specialist findings when determining the prior.",
    "Do not produce ranges that span the entire scale without justification.",
  ],
  inputFields: [
    { name: "SPECIALIST_FINDINGS", description: "JSON array of SpecialistAudit results", required: true },
    { name: "PAPER_BRIEFING", description: "Structured briefing from earlier stage", required: true },
    { name: "SCORE_SCALE", description: "JSON object describing the venue score scale", required: true },
    { name: "VENUE_RUBRIC", description: "Venue-specific rubric and guidelines", required: true },
    { name: "LANGUAGE_INSTRUCTION", description: "Language/locale instructions for output", required: false },
  ],
  untrustedBoundary: {
    startMarker: UNTRUSTED_PAPER_START,
    endMarker: UNTRUSTED_PAPER_END,
  },
  venueRubricInjectionPoint: "{{VENUE_RUBRIC}}",
  outputSchemaRef: "ScorePriorSchema",
  evidenceCitationRequirements: EVIDENCE_CITATION_REQUIREMENTS,
  uncertaintyHandling: UNCERTAINTY_HANDLING,
  template: SCORE_PRIOR_TEMPLATE,
});

// ─── Score Candidate Prompt ──────────────────────────────────────────────────

const SCORE_CANDIDATE_TEMPLATE = `You are a Score Candidate Advocate. Your role is to argue for a specific assigned score, making the best possible case using evidence from the paper and specialist findings.

## Role
Given a forced score value and a perspective (optimistic/balanced/critical), construct the strongest possible evidence-based argument for why this score is appropriate.

## Task Objective
Argue convincingly for the assigned score by:
1. Selecting the most relevant evidence from specialist findings
2. Interpreting the rubric criteria in light of the paper's specific strengths and weaknesses
3. Constructing a coherent narrative for why this score is appropriate
4. Being honest about where the argument is strongest and weakest

## Venue Rubric
{{VENUE_RUBRIC}}

## Language Instruction
{{LANGUAGE_INSTRUCTION}}

## Assigned Score
{{ASSIGNED_SCORE}}

## Perspective
{{PERSPECTIVE}}

## Score Scale
{{SCORE_SCALE}}

## Specialist Findings
{{SPECIALIST_FINDINGS}}

## Paper Briefing
{{PAPER_BRIEFING}}

## Score Prior
{{SCORE_PRIOR}}

## Output Requirements
Produce a JSON object conforming to the ScoreCandidate schema with:
- id: unique candidate identifier (e.g., "candidate-{{PERSPECTIVE}}-{{ASSIGNED_SCORE}}")
- score: the assigned score value
- perspective: "optimistic" | "balanced" | "critical"
- justification: detailed argument for why this score is appropriate
- strengths: key paper strengths supporting this score
- weaknesses: key paper weaknesses (acknowledged even when arguing for high scores)
- confidence: 0-1 indicating how convincing you find your own argument

Be intellectually honest: if the assigned score is difficult to justify, indicate low confidence rather than fabricating evidence.

## Evidence Citation Requirements
${EVIDENCE_CITATION_REQUIREMENTS}

## Uncertainty Handling
${UNCERTAINTY_HANDLING}

## Prohibited Behaviors
${COMMON_PROHIBITED_BEHAVIORS.map((b) => `- ${b}`).join("\n")}
- Do not fabricate strengths or weaknesses to fit the assigned score.
- Do not ignore evidence that contradicts the assigned score—acknowledge it and explain why the score is still justified.
- Do not produce a confidence score of 1.0 unless the evidence overwhelmingly supports the assigned score.
`;

export const scoreCandidatePrompt = registerPrompt({
  id: "score-candidate",
  version: "1.0.0",
  role: "Score Candidate Advocate",
  objective:
    "Given a forced score, argue for it with evidence from specialist findings.",
  prohibitedBehaviors: [
    ...COMMON_PROHIBITED_BEHAVIORS,
    "Do not fabricate strengths or weaknesses to fit the assigned score.",
    "Do not ignore evidence that contradicts the assigned score—acknowledge it and explain why the score is still justified.",
    "Do not produce a confidence score of 1.0 unless the evidence overwhelmingly supports the assigned score.",
  ],
  inputFields: [
    { name: "ASSIGNED_SCORE", description: "The score value to argue for", required: true },
    { name: "PERSPECTIVE", description: "The perspective to adopt: optimistic, balanced, or critical", required: true },
    { name: "SPECIALIST_FINDINGS", description: "JSON array of SpecialistAudit results", required: true },
    { name: "PAPER_BRIEFING", description: "Structured briefing from earlier stage", required: true },
    { name: "SCORE_PRIOR", description: "Score prior distribution result", required: true },
    { name: "SCORE_SCALE", description: "JSON object describing the venue score scale", required: true },
    { name: "VENUE_RUBRIC", description: "Venue-specific rubric and guidelines", required: true },
    { name: "LANGUAGE_INSTRUCTION", description: "Language/locale instructions for output", required: false },
  ],
  untrustedBoundary: {
    startMarker: UNTRUSTED_PAPER_START,
    endMarker: UNTRUSTED_PAPER_END,
  },
  venueRubricInjectionPoint: "{{VENUE_RUBRIC}}",
  outputSchemaRef: "ScoreCandidateSchema",
  evidenceCitationRequirements: EVIDENCE_CITATION_REQUIREMENTS,
  uncertaintyHandling: UNCERTAINTY_HANDLING,
  template: SCORE_CANDIDATE_TEMPLATE,
});

// ─── Candidate Selector Prompt ───────────────────────────────────────────────

const CANDIDATE_SELECTOR_TEMPLATE = `You are a Candidate Selector. Your role is to evaluate all score candidates and select the most well-supported final score.

## Role
Evaluate multiple score candidate arguments and select the one best supported by evidence, rubric alignment, and internal consistency.

## Task Objective
Compare all score candidates by evaluating:
1. Evidence coverage: which candidate uses the most relevant evidence?
2. Rubric alignment: which candidate best matches the venue's scoring criteria?
3. Internal contradictions: which candidates have weak or contradictory arguments?
4. Intellectual honesty: which candidates acknowledge limitations in their arguments?

## Venue Rubric
{{VENUE_RUBRIC}}

## Language Instruction
{{LANGUAGE_INSTRUCTION}}

## Score Candidates
{{SCORE_CANDIDATES}}

## Score Prior
{{SCORE_PRIOR}}

## Score Scale
{{SCORE_SCALE}}

## Paper Briefing
{{PAPER_BRIEFING}}

## Output Requirements
Produce a JSON object conforming to the CandidateSelection schema with:
- selectedCandidateId: id of the chosen candidate
- finalScore: the selected score value
- selectionRationale: detailed explanation of why this candidate was chosen over others
- dissent: optional note on what the best counter-argument would be
- confidence: 0-1 indicating confidence in the selection

The selection should be based on argument quality, not on avoiding extreme scores. If a well-argued extreme score has better evidence than a moderate one, select the extreme score.

## Evidence Citation Requirements
${EVIDENCE_CITATION_REQUIREMENTS}

## Uncertainty Handling
${UNCERTAINTY_HANDLING}

## Prohibited Behaviors
${COMMON_PROHIBITED_BEHAVIORS.map((b) => `- ${b}`).join("\n")}
- Do not default to moderate scores to avoid controversy.
- Do not select a candidate solely because its score is near the prior mean.
- Do not ignore low-confidence self-assessments by candidates.
`;

export const candidateSelectorPrompt = registerPrompt({
  id: "candidate-selector",
  version: "1.0.0",
  role: "Candidate Selector",
  objective:
    "Evaluate all candidates on evidence coverage, rubric alignment, and contradictions. Select the best-supported score.",
  prohibitedBehaviors: [
    ...COMMON_PROHIBITED_BEHAVIORS,
    "Do not default to moderate scores to avoid controversy.",
    "Do not select a candidate solely because its score is near the prior mean.",
    "Do not ignore low-confidence self-assessments by candidates.",
  ],
  inputFields: [
    { name: "SCORE_CANDIDATES", description: "JSON array of ScoreCandidate results", required: true },
    { name: "SCORE_PRIOR", description: "Score prior distribution result", required: true },
    { name: "PAPER_BRIEFING", description: "Structured briefing from earlier stage", required: true },
    { name: "SCORE_SCALE", description: "JSON object describing the venue score scale", required: true },
    { name: "VENUE_RUBRIC", description: "Venue-specific rubric and guidelines", required: true },
    { name: "LANGUAGE_INSTRUCTION", description: "Language/locale instructions for output", required: false },
  ],
  untrustedBoundary: {
    startMarker: UNTRUSTED_PAPER_START,
    endMarker: UNTRUSTED_PAPER_END,
  },
  venueRubricInjectionPoint: "{{VENUE_RUBRIC}}",
  outputSchemaRef: "CandidateSelectionSchema",
  evidenceCitationRequirements: EVIDENCE_CITATION_REQUIREMENTS,
  uncertaintyHandling: UNCERTAINTY_HANDLING,
  template: CANDIDATE_SELECTOR_TEMPLATE,
});
