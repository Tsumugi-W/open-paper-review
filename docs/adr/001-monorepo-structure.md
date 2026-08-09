# ADR-001: TypeScript Monorepo with Turborepo

## Status
Accepted

## Context
We need a project structure that supports multiple deployment targets (web, worker) sharing core logic while keeping prompts, venue rules, and provider adapters independently versioned and testable.

## Decision
Use a pnpm workspaces monorepo with Turborepo for build orchestration:
- `apps/web` - Next.js 15 frontend and API
- `apps/worker` - BullMQ job processor
- `packages/*` - Shared libraries (core, providers, prompts, venues, db)

## Consequences
- Single repo, atomic commits across packages
- Turborepo handles build ordering and caching
- Packages reference each other via `workspace:*`
- Docker builds use multi-stage with selective COPY
