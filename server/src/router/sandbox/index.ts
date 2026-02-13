import * as sandboxHandlers from './handlers';
import * as sandboxRoutes from './routes';
import { createRouter } from '@/server';
import { dependencies } from '@/core/config/app-setup';

// Create handlers with use cases
const handlers = sandboxHandlers.createSandboxHandlers({
  executeYtDlpCommand: dependencies.useCases.executeYtDlpCommand
});

// Create router
const router = createRouter()
  .basePath('/api/sandbox')
  .openapi(
    sandboxRoutes.executeYtDlpCommandRoute,
    handlers.executeYtDlp,
    sandboxHandlers.sandboxValidationHook
  );

export default router;
