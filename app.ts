import "./server/_core/loadEnv.ts";
import express from "express";
import { configureApp } from "./server/_core/app.ts";

const app = express();

await configureApp(app, {
  frontendMode: process.env.NODE_ENV === "development" ? "vite" : "static",
});

export default app;
