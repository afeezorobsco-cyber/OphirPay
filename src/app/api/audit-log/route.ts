// SPDX-License-Identifier: MIT

import { withApiAuth } from "@/lib/api-auth";
import { successResponse, handleApiError, badRequestError } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { withRequestLogging } from "@/lib/request-logging";
import {
  auditLogQuerySchema,
  toAuditLogFilters,
  iterateAuditLogEntries,
  type AuditLogEntry,
} from "@/lib/audit-log";
import { z } from "zod";

const routeSchema = auditLogQuerySchema.extend({
  source: z.enum(["contract", "db", "all"]).optional().default("contract"),
});

/**
 * GET /api/audit-log
 *
 * Returns contract audit log entries. Requires API-key authentication with the
 * `admin` scope. Supports offset pagination (`page` / `limit`) and combined
 * filters: `actor`, `action`, `resource` (matches `target_id`), a `since` /
 * `until` date range (Unix seconds or ISO 8601), and `order` (asc | desc).
 *
 * Filtering is applied server-side across the full on-chain ledger, so the
 * `total` in `meta` reflects the filtered set, not the raw contract count.
 */
async function _GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = routeSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequestError(
        parsed.error.issues.map((e) => e.message).join("; ")
      );
    }

    const { page, limit, source } = parsed.data;

    // Persisted (DB) audit entries — refund lifecycle history with record
    // ids, queryable by action/target (issue #365).
    const dbEntries = source === "db" || source === "all"
      ? await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          ...(parsed.data.action ? { where: { action: parsed.data.action } } : {}),
        })
      : [];

    if (source === "db") {
      return successResponse(
        dbEntries.map((e) => ({
          id: e.id,
          timestamp: new Date(e.createdAt).getTime(),
          action: e.action,
          actor: e.actor ?? "",
          target_id: e.target ?? "",
          details: e.details ?? null,
        })),
        { page, limit, total: 0 }
      );
    }

    // Contract (on-chain) audit entries
    const filters = toAuditLogFilters(parsed.data);
    const all: AuditLogEntry[] = [];
    for await (const entry of iterateAuditLogEntries(filters)) {
      all.push(entry);
    }
    const total = all.length;
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);

    return successResponse(items, {
      page,
      limit,
      total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(withApiAuth(_GET, "admin"));