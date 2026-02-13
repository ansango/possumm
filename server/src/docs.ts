import type { OpenAPIHono, OpenAPIObjectConfigure } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { Env } from 'hono';
import { name as title, description, version } from 'pkg';
import { URL } from '@/lib/config';
const config: OpenAPIObjectConfigure<Env, '/docs'> = {
  openapi: '3.0.0',
  info: {
    title,
    description,
    version
  },
  servers: [
    {
      url: URL,
      description:
        process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
    }
  ]
};

export default function openapi(app: OpenAPIHono) {
  app.doc('/docs', config);
  app.get(
    '/',
    Scalar({
      url: '/docs',
      pageTitle: 'Documentation',
      defaultOpenAllTags: true,
      defaultHttpClient: {
        targetKey: 'node',
        clientKey: 'fetch'
      }
    })
  );
}
