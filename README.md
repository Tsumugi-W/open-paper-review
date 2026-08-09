# OpenPaperReview

Self-hosted, prompt-transparent, multi-agent academic paper review system.

## Features

- PDF upload and arXiv import
- 13 built-in conference venues with versioned rubrics
- Deep multi-agent review pipeline (11 stages)
- Full-text, figure, table, and scanned page understanding
- Format, topic, quality, and prompt injection pre-checks
- Evidence-grounded scoring with calibration
- English and Simplified Chinese interface and reports
- JSON, Markdown, and printable PDF export
- Team collaboration with task queue and progress tracking

## Quick Start

```bash
# Clone and configure
cp .env.example .env
# Edit .env to add at least one model provider API key

# Start all services
docker compose up -d

# Access at http://localhost:3000
# First visit will prompt you to create an admin account
```

## Development

```bash
pnpm install
pnpm dev
```

Requires Node.js >= 22, pnpm >= 9, PostgreSQL 17, and Redis 7.

## Architecture

```
apps/web        - Next.js 15 frontend + REST API
apps/worker     - BullMQ worker for review jobs
packages/core   - Workflow engine, types, schemas
packages/providers - OpenAI, Anthropic, Gemini adapters
packages/prompts   - All public, versioned system prompts
packages/venues    - Conference rules, rubrics, calibration
packages/db        - Drizzle ORM schema and migrations
```

## Limitations

- Review results are **assistive simulated reviews** and cannot replace real program committee decisions.
- Calibration status indicates the existence of conforming calibration data, not equivalence with human reviewers.
- The system does not guarantee detection of all forms of academic misconduct.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

This project includes code derived from [AIReviewer](https://github.com/ai-reviewer/ai-reviewer), originally licensed under Apache-2.0.
