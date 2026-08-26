// SPDX-License-Identifier: MIT
import { withMetrics } from "@/lib/metrics-middleware";

import { NextResponse } from "next/server";
import {
  getMetricsSnapshot,
  getEndpointMetrics,
  LATENCY_BUCKET_BOUNDS,
} from "@/lib/metrics-counters";

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMetrics(): string {
  const c = getMetricsSnapshot();

  const lines: string[] = [
    "# HELP ophirpay_http_requests_total Total HTTP requests served",
    "# TYPE ophirpay_http_requests_total counter",
    `ophirpay_http_requests_total ${c.http_requests_total}`,
    "",
    "# HELP ophirpay_payments_created_total Total payments created",
    "# TYPE ophirpay_payments_created_total counter",
    `ophirpay_payments_created_total ${c.payments_created_total}`,
    "",
    "# HELP ophirpay_payments_failed_total Total failed payment attempts",
    "# TYPE ophirpay_payments_failed_total counter",
    `ophirpay_payments_failed_total ${c.payments_failed_total}`,
    "",
    "# HELP ophirpay_batches_processed_total Total batch payments processed",
    "# TYPE ophirpay_batches_processed_total counter",
    `ophirpay_batches_processed_total ${c.batches_processed_total}`,
    "",
    "# HELP ophirpay_webhooks_delivered_total Total webhooks delivered",
    "# TYPE ophirpay_webhooks_delivered_total counter",
    `ophirpay_webhooks_delivered_total ${c.webhooks_delivered_total}`,
    "",
    "# HELP ophirpay_webhooks_failed_total Total webhooks that failed delivery",
    "# TYPE ophirpay_webhooks_failed_total counter",
    `ophirpay_webhooks_failed_total ${c.webhooks_failed_total}`,
    "",
    "# HELP ophirpay_db_query_duration_seconds_sum Database query duration sum",
    "# TYPE ophirpay_db_query_duration_seconds_sum summary",
    `ophirpay_db_query_duration_seconds_sum ${c.db_query_duration_seconds_sum}`,
    `ophirpay_db_query_duration_seconds_count ${c.db_query_duration_seconds_count}`,
    "",
  ];

  // ── Per-endpoint latency histograms + error counts ──────────
  lines.push(
    "# HELP ophirpay_endpoint_request_duration_seconds Request latency histogram per endpoint and status class",
    "# TYPE ophirpay_endpoint_request_duration_seconds histogram"
  );

  for (const entry of getEndpointMetrics()) {
    const { method, endpoint, statusClass, observation } = entry;
    const baseLabels = `method="${escapeLabelValue(
      method
    )}",endpoint="${escapeLabelValue(endpoint)}",status_class="${statusClass}"`;

    for (let i = 0; i < LATENCY_BUCKET_BOUNDS.length; i++) {
      const le = LATENCY_BUCKET_BOUNDS[i];
      lines.push(
        `ophirpay_endpoint_request_duration_seconds_bucket{${baseLabels},le="${le}"} ${observation.buckets[i]}`
      );
    }
    const infLe = "+Inf";
    lines.push(
      `ophirpay_endpoint_request_duration_seconds_bucket{${baseLabels},le="${infLe}"} ${observation.buckets[LATENCY_BUCKET_BOUNDS.length]}`
    );
    lines.push(
      `ophirpay_endpoint_request_duration_seconds_sum{${baseLabels}} ${observation.latencySum}`
    );
    lines.push(
      `ophirpay_endpoint_request_duration_seconds_count{${baseLabels}} ${observation.latencyCount}`
    );
  }

  lines.push(
    "",
    "# HELP ophirpay_endpoint_errors_total Error counts per endpoint and status class",
    "# TYPE ophirpay_endpoint_errors_total counter"
  );
  for (const entry of getEndpointMetrics()) {
    const { method, endpoint, statusClass, observation } = entry;
    const baseLabels = `method="${escapeLabelValue(
      method
    )}",endpoint="${escapeLabelValue(endpoint)}",status_class="${statusClass}"`;
    lines.push(`ophirpay_endpoint_errors_total{${baseLabels}} ${observation.errors}`);
  }

  lines.push(
    "",
    "# HELP ophirpay_info OphirPay build information",
    "# TYPE ophirpay_info gauge",
    'ophirpay_info{version="1.0.0"} 1'
  );

  return lines.join("\n") + "\n";
}

export const GET = withMetrics("GET /api/metrics", async function GET() {
  return new NextResponse(buildMetrics(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
