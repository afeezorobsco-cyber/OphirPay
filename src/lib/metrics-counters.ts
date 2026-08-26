// SPDX-License-Identifier: MIT

/**
 * Shared Prometheus counter state.
 * Imported by both the metrics API route (for scraping) and by lib/route
 * handlers (for incrementing).
 *
 * These are in-process counters — resets on deploy. For persistent metrics,
 * swap to a Redis-backed counter store.
 */

const counters = {
  http_requests_total: 0,
  payments_created_total: 0,
  payments_failed_total: 0,
  batches_processed_total: 0,
  webhooks_delivered_total: 0,
  webhooks_failed_total: 0,
  db_query_duration_seconds_sum: 0,
  db_query_duration_seconds_count: 0,
};

export type MetricName = keyof typeof counters;

/** Increment a named counter. */
export function incMetric(name: MetricName, delta = 1): void {
  counters[name] += delta;
}

/** Record a duration observation in seconds. */
export function observeDbQuery(durationSeconds: number): void {
  counters.db_query_duration_seconds_sum += durationSeconds;
  counters.db_query_duration_seconds_count += 1;
}

/** Read current counter values (for scraping). */
export function getMetricsSnapshot(): typeof counters {
  return { ...counters };
}

// ── Per-endpoint latency histograms and error counts ──────────
//
// Latency is recorded per (method + endpoint + status class) so operators
// can see, for every route, how slow it is and how often it fails. The
// "endpoint" key keeps dynamic segments literal (e.g. `/api/payments/[id]`)
// so each route produces a stable, bounded set of time series.

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

/** Histogram bucket upper bounds (seconds). A trailing +Inf bound is implied. */
export const LATENCY_BUCKET_BOUNDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export interface EndpointObservation {
  requests: number;
  errors: number;
  latencySum: number;
  latencyCount: number;
  /** Cumulative counts per bucket; length = LATENCY_BUCKET_BOUNDS.length + 1 (+Inf). */
  buckets: number[];
}

const endpointMetrics = new Map<string, EndpointObservation>();

function statusClassOf(status: number): StatusClass {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

/**
 * Record a single request's latency keyed by endpoint + status class.
 * `status` may be 0 when the handler didn't return a Response we can read;
 * it is treated as a successful (2xx) request in that case.
 */
export function recordEndpointLatency(
  method: string,
  endpoint: string,
  status: number,
  durationSeconds: number
): void {
  const statusClass = statusClassOf(status || 200);
  const key = `${method} ${endpoint}|${statusClass}`;

  let obs = endpointMetrics.get(key);
  if (!obs) {
    obs = {
      requests: 0,
      errors: 0,
      latencySum: 0,
      latencyCount: 0,
      buckets: new Array(LATENCY_BUCKET_BOUNDS.length + 1).fill(0),
    };
    endpointMetrics.set(key, obs);
  }

  obs.requests += 1;
  obs.latencySum += durationSeconds;
  obs.latencyCount += 1;
  if (statusClass === "4xx" || statusClass === "5xx") obs.errors += 1;

  for (let i = 0; i < LATENCY_BUCKET_BOUNDS.length; i++) {
    if (durationSeconds <= LATENCY_BUCKET_BOUNDS[i]) obs.buckets[i] += 1;
  }
  // +Inf bucket always counts the observation.
  obs.buckets[LATENCY_BUCKET_BOUNDS.length] += 1;
}

export interface EndpointMetricEntry {
  method: string;
  endpoint: string;
  statusClass: StatusClass;
  observation: EndpointObservation;
}

/** Read all collected per-endpoint observations (for scraping/serialization). */
export function getEndpointMetrics(): EndpointMetricEntry[] {
  const entries: EndpointMetricEntry[] = [];
  for (const [key, observation] of endpointMetrics.entries()) {
    const [methodAndEndpoint, statusClass] = key.split("|");
    const [method, ...rest] = methodAndEndpoint.split(" ");
    entries.push({
      method,
      endpoint: rest.join(" "),
      statusClass: statusClass as StatusClass,
      observation,
    });
  }
  return entries;
}

/** Reset per-endpoint metrics. Intended for tests. */
export function resetEndpointMetrics(): void {
  endpointMetrics.clear();
}
