export * from './logger';
import { type OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger, prettyJSON } from './logger';
import { ALLOWED_ORIGINS } from '@/lib/config';

const middleware = (app: OpenAPIHono) => {
	app.use(
		cors({
			origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : '*',
			credentials: true
		})
	);
	app.use(logger).use(prettyJSON);
};

export default middleware;
