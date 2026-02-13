import {
	createAppDependencies,
	ensureDirectoriesExist,
	getDefaultConfig
} from '@/core/config/dependencies';
import { log } from '@/lib/logger';
import type { PinoLogger } from 'hono-pino';

// Create app dependencies
const config = getDefaultConfig();

// Ensure directories exist before starting
await ensureDirectoriesExist(config).catch((error) => {
	log.error({ error }, 'Failed to create required directories');
	process.exit(1);
});

const dependencies = createAppDependencies(config, log as unknown as PinoLogger);

// Start worker
dependencies.worker.start().catch((error) => {
	log.error({ error }, 'Failed to start download worker');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
	log.info('SIGTERM received, shutting down gracefully');
	await dependencies.worker.stop();
	process.exit(0);
});

process.on('SIGINT', async () => {
	log.info('SIGINT received, shutting down gracefully');
	await dependencies.worker.stop();
	process.exit(0);
});

export { dependencies };
