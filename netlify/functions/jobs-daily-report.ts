import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runDailyReportDeliveryJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runDailyReportDeliveryJob();
  return new Response("ok");
};

export const config: Config = {
  schedule: "30 2 * * *",
};
