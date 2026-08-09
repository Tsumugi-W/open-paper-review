# ADR-005: Four-Layer Prompt Injection Defense

## Status
Accepted

## Context
Academic papers are untrusted input that may contain adversarial content designed to manipulate the review process.

## Decision
Four complementary detection layers:
1. Pattern scan: regex for instruction-like phrases and role-switching patterns
2. Visual anomaly detection: tiny fonts, transparent text, off-page content
3. OCR vs text-layer diff: hidden text not visible in rendered pages
4. LLM classifier: independent agent that classifies risk without executing instructions

Suspicious content is replaced with placeholders before entering review agent context.

## Consequences
- Defense in depth: no single layer is a single point of failure
- False positives result in user confirmation, not silent rejection
- Original suspicious content is preserved for evidence UI but excluded from agent instructions
- Paper is always treated as untrusted data with explicit boundary markers
