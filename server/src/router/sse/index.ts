import { createRouter } from "@/server";
import { dependencies } from "@/core/config/app-setup";
import { createSSEHandler } from "../download/sse";

// Create SSE handler
const sseHandler = createSSEHandler(dependencies.eventEmitter);

// Create dedicated SSE router at /api/events
const router = createRouter()
  .get("/api/events", sseHandler);

export default router;
