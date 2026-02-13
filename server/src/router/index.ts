import { type OpenAPIHono } from '@hono/zod-openapi';

import health from './health';
import download from './download';
import sandbox from './sandbox';

const routes = [health, download, sandbox];

const router = (app: OpenAPIHono) => {
  routes.forEach((route) => {
    app.route('/', route);
  });
};

export default router;
