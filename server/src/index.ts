
import app from './app';
import { closeCacheDb } from '@/lib/db/cache/database';
import { closeDownloadsDb } from '@/lib/db/downloads/database';
import { log } from '@/lib/logger';

process.on("SIGINT", () => {
  
  closeCacheDb();
  closeDownloadsDb();
  log.info("Server shut down complete.");
  process.exit(0);
});

process.on("SIGTERM", () => {

  closeCacheDb();
  closeDownloadsDb();
  log.info("Server shut down complete.");
  process.exit(0);
});

export default {
  port: 3000,
  hostname: "0.0.0.0",
  idleTimeout: 20,
  fetch: app.fetch,
};
