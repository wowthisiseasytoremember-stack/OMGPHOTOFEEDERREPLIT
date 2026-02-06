import { z } from 'zod';
import { insertItemSchema, items } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  items: {
    list: {
      method: 'GET' as const,
      path: '/api/items',
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/items/:id',
      responses: {
        200: z.custom<typeof items.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/items',
      input: insertItemSchema,
      responses: {
        201: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/items/:id',
      input: insertItemSchema.partial(),
      responses: {
        200: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/items/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  analyze: {
    upload: {
      method: 'POST' as const,
      path: '/api/analyze/upload',
      // FormData input not strictly typed in Zod for Zod-to-Json schema conversion usually, 
      // but we can imply it. Frontend sends FormData.
      responses: {
        200: z.object({
          name: z.string(),
          brand: z.string().optional(),
          edition: z.string().optional(),
          year: z.string().optional(),
          identifiers: z.string().optional(),
          vibes: z.array(z.string()).optional(),
          ambientData: z.record(z.any()).optional(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      }
    }
  },
  browserPilot: {
    connect: {
      method: 'POST' as const,
      path: '/api/browser-pilot',
      input: z.object({
        wsEndpoint: z.string().url(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
          items: z.array(z.object({
            name: z.string(),
            brand: z.string().optional(),
            year: z.string().optional(),
            // Simplified for the pilot response
          }))
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      }
    }
  },
  export: {
    download: {
      method: 'GET' as const,
      path: '/api/export',
      responses: {
        200: z.any(), // JSON download
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
