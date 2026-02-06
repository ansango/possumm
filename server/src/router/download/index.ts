export * from "./handlers";
export * from "./routes";
export * from "./sse";

// Import configured router
export { downloadRouter as default } from "@/core/config/app-setup";
