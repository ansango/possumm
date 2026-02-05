
import middleware  from "@/middleware";
import router from "@/router";
import createApp from "./server";

const main = () => {
  const app = createApp();
  middleware(app);
  router(app);
  return app;
};

export default main();
