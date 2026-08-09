# Contributing to OpenPaperReview

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork and install dependencies: `pnpm install`
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Make your changes
5. Run tests: `pnpm test`
6. Submit a pull request

## Development Setup

- Node.js >= 22
- pnpm >= 9
- Docker (for PostgreSQL and Redis)

```bash
docker compose up postgres redis -d
cp .env.example .env
pnpm install
pnpm dev
```

## Code Style

- TypeScript strict mode
- ESM modules throughout
- Functional style preferred over classes where practical
- All agent outputs validated with Zod schemas

## Prompts Contribution

All prompts live in `packages/prompts/src/templates/`. When modifying prompts:

1. Bump the semantic version in the prompt definition
2. Update the changelog comment
3. Ensure the output schema is updated if the structure changes
4. Never hide prompts in databases or external services
5. Test that structured outputs still validate

## Venue Bundles

Conference rules live in `packages/venues/data/`. When adding or updating:

1. Source all rules from official conference guidelines
2. Document the source URL and access date
3. Use immutable versioned IDs (e.g., `neurips/main/2027/v1`)
4. Include only structured definitions, not verbatim copyrighted text
5. All bundles must pass schema validation

## Security

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
