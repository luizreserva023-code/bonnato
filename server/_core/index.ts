import "./loadEnv.ts";
import express from "express";
import { createServer } from "http";
import { configureApp } from "./app.ts";
import { startPersistentBackgroundJobs } from "./backgroundJobs.ts";
import { findAvailablePort } from "./ports.ts";

async function startServer() {
  const app = express();
  const server = createServer(app);

  await configureApp(app, {
    frontendMode: process.env.NODE_ENV === "development" ? "vite" : "static",
    server,
  });

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startPersistentBackgroundJobs();
  });
}

startServer().catch(console.error);
