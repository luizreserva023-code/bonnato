import { processJourneyExecutions, processAbandonedCarts, refreshCustomerTags } from "../automation.ts";
import { cancelStaleUnpaidOrders } from "../db.ts";
import { sendDailyReport, startDailyReportJob } from "../dailyReport.ts";
import { pollIfoodEventsOnce, startIfoodPolling } from "../ifood.ts";
import { processScheduledNotifications } from "../scheduledNotificationJob.ts";
import { ENV } from "./env.ts";

let persistentJobsStarted = false;

async function runNamedJob(name: string, job: () => Promise<void>): Promise<void> {
  try {
    await job();
  } catch (error) {
    console.error(`[Jobs] ${name} error:`, error);
  }
}

export async function runJourneyExecutionsJob(): Promise<void> {
  await runNamedJob("processJourneyExecutions", processJourneyExecutions);
}

export async function runAbandonedCartJob(): Promise<void> {
  await runNamedJob("processAbandonedCarts", processAbandonedCarts);
}

export async function runCustomerTagRefreshJob(): Promise<void> {
  await runNamedJob("refreshCustomerTags", refreshCustomerTags);
}

export async function runScheduledNotificationJob(): Promise<void> {
  await runNamedJob("processScheduledNotifications", processScheduledNotifications);
}

export async function runIfoodPollingJob(): Promise<void> {
  await runNamedJob("pollIfoodEventsOnce", pollIfoodEventsOnce);
}

export async function runStaleOrderCleanupJob(): Promise<void> {
  await runNamedJob("cancelStaleUnpaidOrders", async () => {
    const cancelled = await cancelStaleUnpaidOrders(120);
    if (cancelled.length) {
      console.log(`[Jobs] Cancelled ${cancelled.length} stale unpaid orders: ${cancelled.join(", ")}`);
    }
  });
}

export async function runDailyReportDeliveryJob(): Promise<void> {
  await runNamedJob("sendDailyReport", sendDailyReport);
}

export function startPersistentBackgroundJobs(): void {
  if (persistentJobsStarted) {
    return;
  }

  if (!ENV.enablePersistentJobs) {
    console.log("[Jobs] Persistent background jobs disabled for this runtime");
    return;
  }

  persistentJobsStarted = true;

  setInterval(() => {
    void runJourneyExecutionsJob();
  }, 2 * 60 * 1000);

  setInterval(() => {
    void runAbandonedCartJob();
  }, 5 * 60 * 1000);

  setInterval(() => {
    void runCustomerTagRefreshJob();
  }, 60 * 60 * 1000);

  setInterval(() => {
    void runScheduledNotificationJob();
  }, 60 * 1000);

  startDailyReportJob();
  startIfoodPolling();

  setInterval(() => {
    void runStaleOrderCleanupJob();
  }, 10 * 60 * 1000);

  console.log("[Jobs] Persistent background jobs started");
}
