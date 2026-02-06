import { Hono } from "hono";
import { createDownloadHandlers } from "./handlers";
import { createSSEHandler } from "./sse";

export function createDownloadRouter(handlers: ReturnType<typeof createDownloadHandlers>, sseHandler: ReturnType<typeof createSSEHandler>) {
  const router = new Hono();

  // Download operations
  router.post("/", handlers.enqueue);
  router.get("/", handlers.list);
  router.get("/:id", handlers.getStatus);
  router.post("/:id/cancel", handlers.cancel);
  router.post("/:id/retry", handlers.retry);
  router.post("/:id/move", handlers.move);

  // Media operations
  router.get("/media/:id", handlers.getMedia);
  router.patch("/media/:id", handlers.updateMedia);

  // SSE events
  router.get("/events", sseHandler);

  return router;
}
