import "dotenv/config";
import type { Config } from "@netlify/functions";
import { runCustomerTagRefreshJob } from "../../server/_core/backgroundJobs";

export default async () => {
  await runCustomerTagRefreshJob();
  return new Response("ok");
};

export const config: Config = {
  schedule: "@hourly",
};
