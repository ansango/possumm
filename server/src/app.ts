import middleware from '@/middleware';
import router from '@/router';
import createApp from './server';
import openapi from './docs';

const main = () => {
  const app = createApp();
  middleware(app);
  openapi(app);
  router(app);
  return app;
};

export default main();
