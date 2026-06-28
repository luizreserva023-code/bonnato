import "../server/_core/loadEnv.ts";
import express from "express";
import { configureApiApp } from "../server/_core/apiApp.ts";

const appPromise = (async () => {
  const app = express();
  await configureApiApp(app);
  return app;
})();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
