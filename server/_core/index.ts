import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { configureApp } from "./app";
import { startPersistentBackgroundJobs } from "./backgroundJobs";
import { findAvailablePort } from "./ports";

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
