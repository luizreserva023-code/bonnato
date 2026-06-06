import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runStaleOrderCleanupJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runStaleOrderCleanupJob();
  return new Response("ok");
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
