# ADR-002: PostgreSQL + Redis as Required Infrastructure

## Status
Accepted

## Context
The system needs durable storage for review artifacts and a job queue for long-running review tasks. Considered SQLite (simpler) vs PostgreSQL (more capable).

## Decision
- PostgreSQL 17: primary data store for all entities, JSONB for flexible schemas
- Redis 7: BullMQ job queue, rate limiting, SSE event distribution
- No SQLite mode in first release

## Consequences
- Docker Compose is the standard deployment method
- More operational complexity than SQLite but supports concurrent workers
- BullMQ provides reliable job processing with retry, priority, and rate limiting
- Redis pub/sub enables real-time SSE without polling
