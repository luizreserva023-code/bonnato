import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const scenarios = {
  "public-web": {
    routes: [
      { name: "home", path: "/", weight: 30, accept: "text/html" },
      { name: "cardapio", path: "/cardapio", weight: 15, accept: "text/html" },
      { name: "categories.list", path: "/api/trpc/categories.list", weight: 20, accept: "application/json" },
      { name: "products.list", path: "/api/trpc/products.list", weight: 20, accept: "application/json" },
      { name: "carousel.list", path: "/api/trpc/carousel.list", weight: 10, accept: "application/json" },
      { name: "storeSettings.get", path: "/api/trpc/storeSettings.get", weight: 5, accept: "application/json" },
    ],
  },
};

const baseUrl = (process.env.LOAD_TEST_BASE_URL ?? "https://bonatto.netlify.app").replace(/\/+$/, "");
const baseOrigin = new URL(`${baseUrl}/`).origin;
const totalRequests = toInt(process.env.LOAD_TEST_TOTAL, 5000);
const concurrency = toInt(process.env.LOAD_TEST_CONCURRENCY, 100);
const uniqueUsers = toInt(process.env.LOAD_TEST_UNIQUE_USERS, totalRequests);
const timeoutMs = toInt(process.env.LOAD_TEST_TIMEOUT_MS, 15000);
const scenarioName = process.env.LOAD_TEST_SCENARIO ?? "public-web";
const progressEvery = Math.max(100, toInt(process.env.LOAD_TEST_PROGRESS_EVERY, 1000));
const spoofIp = process.env.LOAD_TEST_SPOOF_IP !== "false";

const scenario = scenarios[scenarioName];

if (!scenario) {
  console.error(`[load-test] Cenario invalido: ${scenarioName}`);
  console.error(`[load-test] Opcoes: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

if (totalRequests < 1 || concurrency < 1 || uniqueUsers < 1) {
  console.error("[load-test] LOAD_TEST_TOTAL, LOAD_TEST_CONCURRENCY e LOAD_TEST_UNIQUE_USERS precisam ser maiores que zero.");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      scenario: scenarioName,
      totalRequests,
      concurrency,
      uniqueUsers,
      timeoutMs,
      spoofIp,
      routes: scenario.routes.map((route) => ({ name: route.name, path: route.path, weight: route.weight })),
    },
    null,
    2
  )
);

const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  scenario: scenarioName,
  totalRequests,
  concurrency,
  uniqueUsers,
  timeoutMs,
  spoofIp,
  completed: 0,
  failed: 0,
  latencies: [],
  statusCounts: new Map(),
  routeStats: new Map(),
  errors: new Map(),
};

let nextRequestNumber = 0;
const runStartedAt = performance.now();

async function main() {
  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, (_, index) => worker(index + 1));
  await Promise.all(workers);

  const durationMs = performance.now() - runStartedAt;
  const summary = buildSummary(durationMs);
  const outputDir = resolve(process.cwd(), "load-test-results");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = resolve(outputDir, `${scenarioName}-${timestamp}.json`);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(summary, null, 2));

  console.log("");
  console.log("[load-test] Resumo final");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[load-test] Relatorio salvo em ${filePath}`);

  if (summary.failedRequests > 0) {
    process.exitCode = 1;
  }
}

async function worker(workerId) {
  while (true) {
    const requestNumber = nextRequestNumber++;
    if (requestNumber >= totalRequests) {
      return;
    }

    await runRequest(workerId, requestNumber);
  }
}

async function runRequest(workerId, requestNumber) {
  const route = pickWeightedRoute(scenario.routes, requestNumber);
  const userNumber = (requestNumber % uniqueUsers) + 1;
  const userIp = toPseudoIp(userNumber);
  const requestUrl = new URL(route.path, `${baseUrl}/`).toString();
  const headers = {
    "user-agent": `BonattoLoadTest/${scenarioName}/worker-${workerId}/user-${userNumber}`,
    "x-load-test-user": `user-${userNumber}`,
    cookie: `bonatto_load_user=user-${userNumber}; bonatto_variant=${requestNumber % 3}`,
    accept: route.accept ?? "*/*",
    origin: baseOrigin,
    referer: `${baseOrigin}/`,
    ...(route.headers ?? {}),
  };

  if (spoofIp) {
    headers["x-forwarded-for"] = userIp;
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(requestUrl, {
      method: route.method ?? "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    await response.arrayBuffer();

    const latencyMs = performance.now() - startedAt;
    recordSuccess(route.name, response.status, latencyMs);
  } catch (error) {
    const latencyMs = performance.now() - startedAt;
    recordFailure(route.name, error, latencyMs);
  }

  if (results.completed % progressEvery === 0 || results.completed === totalRequests) {
    const elapsed = performance.now() - runStartedAt;
    const rps = elapsed > 0 ? Number((results.completed / (elapsed / 1000)).toFixed(2)) : 0;
    console.log(
      `[load-test] progresso ${results.completed}/${totalRequests} | falhas ${results.failed} | throughput ${rps} req/s`
    );
  }
}

function recordSuccess(routeName, status, latencyMs) {
  results.completed += 1;
  if (status >= 400) {
    results.failed += 1;
  }

  results.latencies.push(latencyMs);
  results.statusCounts.set(status, (results.statusCounts.get(status) ?? 0) + 1);

  const routeStat = getRouteStat(routeName);
  routeStat.completed += 1;
  routeStat.latencies.push(latencyMs);
  routeStat.statusCounts.set(status, (routeStat.statusCounts.get(status) ?? 0) + 1);
  if (status >= 400) {
    routeStat.failed += 1;
  }
}

function recordFailure(routeName, error, latencyMs) {
  results.completed += 1;
  results.failed += 1;
  results.latencies.push(latencyMs);

  const key = error instanceof Error ? error.name : "UnknownError";
  results.errors.set(key, (results.errors.get(key) ?? 0) + 1);

  const routeStat = getRouteStat(routeName);
  routeStat.completed += 1;
  routeStat.failed += 1;
  routeStat.latencies.push(latencyMs);
  routeStat.errors.set(key, (routeStat.errors.get(key) ?? 0) + 1);
}

function getRouteStat(routeName) {
  if (!results.routeStats.has(routeName)) {
    results.routeStats.set(routeName, {
      completed: 0,
      failed: 0,
      latencies: [],
      statusCounts: new Map(),
      errors: new Map(),
    });
  }

  return results.routeStats.get(routeName);
}

function buildSummary(durationMs) {
  const totalSeconds = durationMs / 1000;
  const sortedLatencies = [...results.latencies].sort((a, b) => a - b);

  return {
    startedAt: results.startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: results.baseUrl,
    scenario: results.scenario,
    totalRequests: results.totalRequests,
    completedRequests: results.completed,
    failedRequests: results.failed,
    spoofIp: results.spoofIp,
    successRate: percentage(results.completed - results.failed, results.completed),
    durationMs: round(durationMs),
    requestsPerSecond: totalSeconds > 0 ? round(results.completed / totalSeconds) : 0,
    latencyMs: {
      avg: round(average(sortedLatencies)),
      p50: round(percentile(sortedLatencies, 50)),
      p95: round(percentile(sortedLatencies, 95)),
      p99: round(percentile(sortedLatencies, 99)),
      max: round(sortedLatencies[sortedLatencies.length - 1] ?? 0),
    },
    statusCounts: Object.fromEntries([...results.statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    errors: Object.fromEntries([...results.errors.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    routeStats: Object.fromEntries(
      [...results.routeStats.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([routeName, stat]) => [
          routeName,
          (() => {
            const sortedRouteLatencies = [...stat.latencies].sort((a, b) => a - b);
            return {
            completedRequests: stat.completed,
            failedRequests: stat.failed,
            successRate: percentage(stat.completed - stat.failed, stat.completed),
            latencyMs: {
              avg: round(average(sortedRouteLatencies)),
              p50: round(percentile(sortedRouteLatencies, 50)),
              p95: round(percentile(sortedRouteLatencies, 95)),
              p99: round(percentile(sortedRouteLatencies, 99)),
              max: round(sortedRouteLatencies[sortedRouteLatencies.length - 1] ?? 0),
            },
            statusCounts: Object.fromEntries([...stat.statusCounts.entries()].sort((x, y) => Number(x[0]) - Number(y[0]))),
            errors: Object.fromEntries([...stat.errors.entries()].sort((x, y) => x[0].localeCompare(y[0]))),
          };
          })(),
        ])
    ),
  };
}

function pickWeightedRoute(routes, requestNumber) {
  const totalWeight = routes.reduce((sum, route) => sum + route.weight, 0);
  const target = requestNumber % totalWeight;
  let cursor = 0;

  for (const route of routes) {
    cursor += route.weight;
    if (target < cursor) {
      return route;
    }
  }

  return routes[routes.length - 1];
}

function toPseudoIp(userNumber) {
  const a = 10;
  const b = Math.floor(userNumber / 65536) % 256;
  const c = Math.floor(userNumber / 256) % 256;
  const d = userNumber % 256;
  return `${a}.${b}.${c}.${d === 0 ? 1 : d}`;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1)
  );
  return sortedValues[index];
}

function percentage(numerator, denominator) {
  if (denominator === 0) return 0;
  return round((numerator / denominator) * 100);
}

function round(value) {
  return Number(value.toFixed(2));
}

main().catch((error) => {
  console.error("[load-test] erro fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
