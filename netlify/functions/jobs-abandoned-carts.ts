import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runAbandonedCartJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runAbandonedCartJob();
  return new Response("ok");
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
