import app from "./app";


export default {
  port: 3000,
  hostname: "0.0.0.0",
  idleTimeout: 20,
  fetch: app.fetch,
  timeout: 0,
  keepAliveTimeout: 0,
};
