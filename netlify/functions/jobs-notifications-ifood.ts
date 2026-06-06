import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runIfoodPollingJob, runScheduledNotificationJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runScheduledNotificationJob();
  await runIfoodPollingJob();

  return new Response("ok");
};

export const config: Config = {
  schedule: "* * * * *",
};
