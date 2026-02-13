import { optionsLogger as options } from '@/middleware';
import pino from 'pino';

const pinoInstance = pino({
  level: 'debug',
  transport: {
    target: 'hono-pino/debug-log',
    options
  }
});

export const log = pinoInstance;
export default pinoInstance;
