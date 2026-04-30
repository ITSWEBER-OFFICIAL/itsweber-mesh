import pLimit from "p-limit";
import { readConfig } from "../config/store";
import { pingService, type PingResult } from "./pinger";
import { logger } from "../logger";

type PingMap = Record<string, PingResult>;

declare global {
  // eslint-disable-next-line no-var
  var __meshScheduler: {
    interval: ReturnType<typeof setInterval> | null;
    results: PingMap;
    /** True while a sweep is in progress — prevents overlapping sweeps. */
    running: boolean;
  } | undefined;
}

function getSchedulerState() {
  if (!globalThis.__meshScheduler) {
    globalThis.__meshScheduler = { interval: null, results: {}, running: false };
  }
  return globalThis.__meshScheduler;
}

const limit = pLimit(8);

async function runSweep() {
  const state = getSchedulerState();
  if (state.running) {
    logger.warn("Sweep skipped — previous sweep still in progress");
    return;
  }
  state.running = true;
  const sweepStart = Date.now();
  try {
    const config = readConfig();
    const enabledServices = config.services.filter((s) => s.enabled);

    const tasks = enabledServices.map((service) =>
      limit(async () => {
        try {
          const result = await pingService(service);
          state.results[service.id] = result;
        } catch (err) {
          logger.error({ serviceId: service.id, err }, "Ping sweep error");
          state.results[service.id] = {
            status: "offline",
            latencyMs: null,
            checkedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : "unknown",
          };
        }
      })
    );

    await Promise.allSettled(tasks);
    const durationMs = Date.now() - sweepStart;
    logger.debug({ count: enabledServices.length, durationMs }, "Ping sweep complete");
  } finally {
    state.running = false;
  }
}

export function startScheduler() {
  const state = getSchedulerState();
  if (state.interval !== null) return;

  void runSweep();

  state.interval = setInterval(() => {
    void runSweep();
  }, 10_000);

  logger.info("Healthcheck scheduler started (10s interval, overlap-protected)");
}

export function getPingResults(): PingMap {
  return getSchedulerState().results;
}

export { pingService };
