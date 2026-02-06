import { optionsLogger as options } from "@/middleware";
import pino from "pino";

export const log = pino({
  level: "debug",
  transport: {
    target: "hono-pino/debug-log",
    options,
  },
});
