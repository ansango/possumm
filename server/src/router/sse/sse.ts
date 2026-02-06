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
    //   if (lastEventId > 0) {
    //     const missedEvents = eventEmitter.getEventsSince(lastEventId);
    //     for (const event of missedEvents) {
    //       await stream.writeSSE({
    //         id: event.id.toString(),
    //         event: event.type,
    //         data: JSON.stringify(event.data),
    //       });
    //     }
    //   }

      // Register event listener for new events
    //   const eventListener = (event: any) => {
    //     stream.writeSSE({
    //       id: event.id.toString(),
    //       event: event.type,
    //       data: JSON.stringify(event.data),
    //     }).catch((error) => {
    //       // Connection may be closed, ignore write errors
    //       console.error("SSE write error:", error);
    //     });
    //   };

      // Listen to all event types
    //   const eventTypes = [
    //     "download:enqueued",
    //     "download:started",
    //     "download:progress",
    //     "download:completed",
    //     "download:failed",
    //     "download:cancelled",
    //     "download:stalled",
    //     "storage:low",
    //   ];

    //   eventTypes.forEach((type) => {
    //     eventEmitter.on(type, eventListener);
    //   });

      // Send keepalive comments every 30 seconds
    //   const keepaliveInterval = setInterval(async () => {
    //     try {
    //       await stream.writeSSE({
    //         data: "keepalive",
    //       });
    //     } catch (error) {
    //       // Connection closed, stop keepalive
    //       clearInterval(keepaliveInterval);
    //     }
    //   }, 30000);

      // Cleanup on connection close
    //   stream.onAbort(() => {
    //     clearInterval(keepaliveInterval);
    //     eventTypes.forEach((type) => {
    //       eventEmitter.off(type, eventListener);
    //     });
    //   });

      // Keep connection open indefinitely
      // Using a promise that never resolves to keep the stream alive
    //   await new Promise(() => {});
    });
  };
}
