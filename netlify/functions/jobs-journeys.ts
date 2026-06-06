import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runJourneyExecutionsJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runJourneyExecutionsJob();
  return new Response("ok");
};

export const config: Config = {
  schedule: "*/2 * * * *",
};
