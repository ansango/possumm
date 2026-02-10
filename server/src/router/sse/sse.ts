import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";

export function createSSEHandler(eventEmitter: DownloadEventEmitter) {
  return async (c: Context) => {
    // Get lastEventId from query parameter for recovery
    const lastEventIdParam = c.req.query("since");
    const lastEventId = lastEventIdParam ? parseInt(lastEventIdParam, 10) : 0;

    return streamSSE(c, async (stream) => {
      stream.writeSSE({
        data: "connected",
      });
      // Send recovery events first
      if (lastEventId > 0) {
        const missedEvents = eventEmitter.getEventsSince(lastEventId);
        for (const event of missedEvents) {
          await stream.writeSSE({
            id: event.id.toString(),
            event: event.type,
            data: JSON.stringify(event.data),
          });
        }
      }

      // Register event listener for new events
      const eventListener = (event: any) => {
        stream
          .writeSSE({
            id: event.id.toString(),
            event: event.type,
            data: JSON.stringify(event.data),
          })
          .catch((error) => {
            // Connection may be closed, ignore write errors
            console.error("SSE write error:", error);
          });
      };

      // Listen to all event types
      const eventTypes = [
        "download:enqueued",
        "download:started",
        "download:progress",
        "download:completed",
        "download:failed",
        "download:cancelled",
        "download:stalled",
        "storage:low",
      ];
      const listeners = new Map();
      eventTypes.forEach((type) => {
        eventEmitter.on(type, eventListener);
      });

      stream.onAbort(() => {
        console.log("SSE connection closed, cleaning up listeners");
        eventTypes.forEach((type) => {
          eventEmitter.off(type, eventListener);
        });
      });

      while (true) {
        await stream.sleep(10000);
        await stream.writeSSE({
          data: "keepalive",
        });
      }
    });
  };
}
