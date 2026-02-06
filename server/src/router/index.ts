
import { type OpenAPIHono } from "@hono/zod-openapi";

import health from "./health";
import download from "./download";
import sse from "./sse";

const routes = [health, download];

const router = (app: OpenAPIHono) => {
  routes.forEach((route) => {
    app.route("/", route);
  });
  app.route("/download/events", sse);
};

export default router;
