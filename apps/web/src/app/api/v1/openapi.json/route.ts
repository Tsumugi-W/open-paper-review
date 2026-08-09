import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'OpenPaperReview API',
    version: '1.0.0',
    description: 'Multi-agent academic paper review system API',
    license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  paths: {
    '/papers': {
      get: {
        summary: 'List papers',
        tags: ['Papers'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Paginated paper list' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        summary: 'Upload a paper',
        tags: ['Papers'],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'PDF file (max 50MiB)' },
                  title: { type: 'string' },
                  authors: { type: 'string', description: 'JSON array of author names' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Paper created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/papers/{id}': {
      get: {
        summary: 'Get paper details',
        tags: ['Papers'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Paper details' }, '404': { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete paper and all derived data',
        tags: ['Papers'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Deleted' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
      },
    },
    '/papers/arxiv': {
      post: {
        summary: 'Import paper from arXiv',
        tags: ['Papers'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { arxivId: { type: 'string', description: 'arXiv paper ID (e.g., 2301.00001)' } },
                required: ['arxivId'],
              },
            },
          },
        },
        responses: { '201': { description: 'Paper imported' }, '400': { description: 'Invalid arXiv ID' } },
      },
    },
    '/reviews': {
      post: {
        summary: 'Create a new review job',
        tags: ['Reviews'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  paperId: { type: 'string', format: 'uuid' },
                  venueBundleId: { type: 'string', description: 'Venue bundle ID (e.g., neurips/main/2026/v1)' },
                  language: { type: 'string', enum: ['en', 'zh'], default: 'en' },
                },
                required: ['paperId', 'venueBundleId'],
              },
            },
          },
        },
        responses: { '201': { description: 'Review job created' }, '400': { description: 'Invalid input' } },
      },
    },
    '/reviews/{id}': {
      get: {
        summary: 'Get review job status and result',
        tags: ['Reviews'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Review details' }, '404': { description: 'Not found' } },
      },
    },
    '/reviews/{id}/events': {
      get: {
        summary: 'Subscribe to review progress (SSE)',
        tags: ['Reviews'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'SSE stream', content: { 'text/event-stream': {} } } },
      },
    },
    '/reviews/{id}/cancel': {
      post: {
        summary: 'Cancel a running review',
        tags: ['Reviews'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Cancelled' }, '409': { description: 'Already completed' } },
      },
    },
    '/reviews/{id}/export': {
      get: {
        summary: 'Export review result',
        tags: ['Reviews'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'format', in: 'query', required: true, schema: { type: 'string', enum: ['json', 'markdown', 'pdf'] } },
        ],
        responses: { '200': { description: 'Exported review' }, '404': { description: 'No result yet' } },
      },
    },
    '/venues': {
      get: {
        summary: 'List available venue bundles',
        tags: ['Venues'],
        responses: { '200': { description: 'List of venues with score scales and review sections' } },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'opr_session' },
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
