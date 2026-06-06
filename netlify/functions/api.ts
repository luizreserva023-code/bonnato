import "dotenv/config";
import express from "express";
import serverless from "serverless-http";
import { configureApiApp } from "../../server/_core/apiApp";

const handlerPromise = (async () => {
  const app = express();
  await configureApiApp(app);
  return serverless(app);
})();

export const handler = async (...args: Parameters<Awaited<typeof handlerPromise>>) => {
  const resolvedHandler = await handlerPromise;
  return resolvedHandler(...args);
};
