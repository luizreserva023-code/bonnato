import { processJourneyExecutions, processAbandonedCarts, refreshCustomerTags } from "../automation.ts";
import { cancelStaleUnpaidOrders } from "../db.ts";
import { sendDailyReport, startDailyReportJob } from "../dailyReport.ts";
import { pollIfoodEventsOnce, startIfoodPolling } from "../ifood.ts";
import { processScheduledNotifications } from "../scheduledNotificationJob.ts";
import { processOutboxEvents } from "../outbox.ts";
import { completeStaleOutForDeliveryOrders, rebuildCustomerMetrics } from "../orderLifecycle.ts";
import { ENV } from "./env.ts";

let persistentJobsStarted = false;
let outboxJobStarted = false;
let orderLifecycleJobStarted = false;

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
  await runNamedJob("refreshCustomerMetricsAndTags", async () => {
    const rebuilt = await rebuildCustomerMetrics();
    await refreshCustomerTags();
    if (rebuilt > 0) {
      console.log(`[Jobs] Customer metrics rebuilt for ${rebuilt} scope(s)`);
    }
  });
}

export async function runScheduledNotificationJob(): Promise<void> {
  await runNamedJob("processScheduledNotifications", processScheduledNotifications);
}

export async function runIfoodPollingJob(): Promise<void> {
  await runNamedJob("pollIfoodEventsOnce", pollIfoodEventsOnce);
}

export async function runStaleOrderCleanupJob(): Promise<void> {
  await runNamedJob("staleOrderLifecycle", async () => {
    const [cancelled, completed] = await Promise.all([
      cancelStaleUnpaidOrders(120),
      completeStaleOutForDeliveryOrders(12),
    ]);
    if (cancelled.length) {
      console.log(`[Jobs] Cancelled ${cancelled.length} stale unpaid orders: ${cancelled.join(", ")}`);
    }
    if (completed.length) {
      console.log(`[Jobs] Auto-completed ${completed.length} orders after 12h in delivery: ${completed.join(", ")}`);
    }
  });
}

export async function runOutboxJob(): Promise<void> {
  await runNamedJob("processOutboxEvents", async () => {
    const result = await processOutboxEvents(40);
    if (result.processed || result.failed) {
      console.log(`[Jobs] Outbox processed=${result.processed} failed=${result.failed}`);
    }
  });
}

export async function runDailyReportDeliveryJob(): Promise<void> {
  await runNamedJob("sendDailyReport", sendDailyReport);
}

export function startPersistentBackgroundJobs(): void {
  if (!outboxJobStarted && ENV.enableOutboxJobs) {
    outboxJobStarted = true;
    void runOutboxJob();
    setInterval(() => {
      void runOutboxJob();
    }, 5 * 1000);
    console.log("[Jobs] Transactional outbox worker started");
  }

  if (!orderLifecycleJobStarted) {
    orderLifecycleJobStarted = true;
    void runStaleOrderCleanupJob();
    setInterval(() => {
      void runStaleOrderCleanupJob();
    }, 10 * 60 * 1000);
    console.log("[Jobs] Critical order lifecycle worker started");
  }

  if (persistentJobsStarted) {
    return;
  }

  if (!ENV.enablePersistentJobs) {
    console.log("[Jobs] Non-outbox persistent background jobs disabled for this runtime");
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

  console.log("[Jobs] Persistent background jobs started");
}
