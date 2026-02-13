import { prettyJSON as prettyJSONMiddleware } from 'hono/pretty-json';
import { pinoLogger } from 'hono-pino';
import { DebugLogOptions } from 'hono-pino/debug-log';

export const prettyJSON = prettyJSONMiddleware();

export const optionsLogger: DebugLogOptions = {
  colorEnabled: true,
  httpLogFormat: '[{time}] {req.method} {req.url} {res.status} - {msg} ({responseTime}ms)'
};

export const logger = pinoLogger({
  pino: {
    level: 'debug',
    transport: {
      target: 'hono-pino/debug-log',
      options: optionsLogger
    }
  }
});
