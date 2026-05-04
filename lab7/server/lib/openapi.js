export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'AniLog Lab7 API',
    version: '1.0.0',
    description: 'JWT-protected CRUD API for AniLog saved anime and manga entries.',
  },
  servers: [{ url: 'http://localhost:3001' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      TokenRequest: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['VISITOR', 'WRITER', 'ADMIN'] },
          permissions: {
            type: 'array',
            items: { type: 'string', enum: ['READ', 'WRITE', 'DELETE'] },
          },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          expiresIn: { type: 'integer', example: 60 },
          role: { type: 'string' },
          permissions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      Entry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          kind: { type: 'string', enum: ['anime', 'manga'] },
          image: { type: 'string' },
          synopsis: { type: 'string' },
          score: { type: 'number', nullable: true },
          mediaType: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string' },
          liked: { type: 'boolean' },
          note: { type: 'string' },
          url: { type: 'string' },
          malId: { type: 'number', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PagedEntries: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Entry' },
          },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          hasMore: { type: 'boolean' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          200: {
            description: 'API status',
          },
        },
      },
    },
    '/token': {
      post: {
        summary: 'Issue a JWT for protected endpoints',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TokenRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'JWT created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenResponse' },
              },
            },
          },
        },
      },
    },
    '/api/entries': {
      get: {
        summary: 'List saved entries with pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          { name: 'kind', in: 'query', schema: { type: 'string' } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'liked', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Entry list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PagedEntries' },
              },
            },
          },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Missing READ permission' },
        },
      },
      post: {
        summary: 'Create a saved entry',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Entry' },
            },
          },
        },
        responses: {
          201: {
            description: 'Entry created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Entry' },
              },
            },
          },
          400: { description: 'Invalid payload' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Missing WRITE permission' },
        },
      },
    },
    '/api/entries/{entryId}': {
      get: {
        summary: 'Read one saved entry',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'entryId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Entry found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Entry' },
              },
            },
          },
          404: { description: 'Entry not found' },
        },
      },
      put: {
        summary: 'Update a saved entry',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'entryId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Entry' },
            },
          },
        },
        responses: {
          200: {
            description: 'Entry updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Entry' },
              },
            },
          },
          404: { description: 'Entry not found' },
        },
      },
      delete: {
        summary: 'Delete a saved entry',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'entryId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Entry deleted' },
          404: { description: 'Entry not found' },
        },
      },
    },
  },
}
