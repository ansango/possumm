
import { Hono } from "hono";

import health from "./health";
import download from "./download";

const routes = [health, download];

const router = (app: Hono) => {
  routes.forEach((route) => {
    app.route("/", route);
  });
};

export default router;
