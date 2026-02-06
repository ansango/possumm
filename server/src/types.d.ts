

import type { PinoLogger } from "hono-pino";
import type { Hook, RouteConfig, RouteHandler } from "@hono/zod-openapi";

declare module "hono" {
  interface ContextVariableMap {
    logger: PinoLogger;
  }
}

declare type AppRouteHandler<R extends RouteConfig> = RouteHandler<R>;
declare type AppRouteHook = Hook<any, any, any, any>;
