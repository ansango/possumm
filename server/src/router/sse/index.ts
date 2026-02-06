import { createRouter } from "@/server";
import { dependencies } from "@/core/config/app-setup";
import { createSSEHandler } from "./sse";

// Create SSE handler
const sseHandler = createSSEHandler(dependencies.eventEmitter);

// Create dedicated SSE router at /api/events
const router = createRouter()
  .use("/api/events", async (c, next) => {
    // Set SSE headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    c.header("Access-Control-Allow-Origin", "*"); // Adjust for production
  })
  .get("/api/events", sseHandler);

export default router;
