
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

export const createRouter = () => new Hono();

const createApp = () => {
  const app = new Hono();

  app.notFound((c) => {
    c.var.logger.warn("404 Not Found: %o", { url: c.req.url });
    return c.json({ message: "Not Found" }, 404);
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    c.var.logger.error(err.name + ": " + err.message);
    return c.json({ message: err.message ?? "Internal Server Error" }, 500);
  });

  return app;
};

export default createApp;
