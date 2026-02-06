// Server configuration
export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
export const URL = process.env.URL || "";

// CORS configuration
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
