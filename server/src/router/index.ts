
import { type OpenAPIHono } from "@hono/zod-openapi";

import health from "./health";
import download from "./download";

const routes = [health, download];

const router = (app: OpenAPIHono) => {
  routes.forEach((route) => {
    app.route("/", route);
  });
};

export default router;
