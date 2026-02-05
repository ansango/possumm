
import { type Hono } from "hono";
import { logger, prettyJSON } from "./logger";

const middleware = (app: Hono) => {
  app.use(logger).use(prettyJSON);
};

export default middleware;
