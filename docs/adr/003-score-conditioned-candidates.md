# ADR-003: Score-Conditioned Candidate Generation

## Status
Accepted

## Context
Traditional AI review systems either average multiple reviews or use free-form debate. Both have issues: averaging loses nuance, debate has unpredictable token costs.

## Decision
Generate one complete review per possible score point on the venue's scale. Each candidate agent is forced to argue for its assigned score using evidence from the paper. A separate selector then evaluates candidates on evidence quality, not popularity.

## Consequences
- Eliminates anchoring bias (no single score proposed first)
- Token cost is predictable: proportional to venue score scale size
- Selection is evidence-based, not vote-based
- Replaces the three-round debate from AIReviewer
- Main + optimistic + critical views emerge from the selection, not from separate agents with different temperatures
