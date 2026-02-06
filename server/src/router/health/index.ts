import { createRouter } from "@/server";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check endpoint",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.string(),
          }),
        },
      },
      description: "Service is healthy",
    },
  },
});

const health = createRouter().openapi(healthRoute, (c) => {
  return c.json({ status: "ok" });
});

export default health;