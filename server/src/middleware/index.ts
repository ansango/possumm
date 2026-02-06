
export * from "./logger";
import { type OpenAPIHono } from "@hono/zod-openapi";
import { logger, prettyJSON } from "./logger";

const middleware = (app: OpenAPIHono) => {
  app.use(logger).use(prettyJSON);
};

export default middleware;
