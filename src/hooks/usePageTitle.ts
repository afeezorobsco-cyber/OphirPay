"use client";
// SPDX-License-Identifier: MIT

import { useEffect } from "react";

/**
 * Title suffix mirroring the `"%s | OphirPay"` metadata template declared in
 * `src/app/layout.tsx`. Client components cannot export Next.js `metadata`,
 * so this hook keeps the browser tab (document.title) in sync with the
 * server-rendered template for every client route.
 */
const TITLE_SUFFIX = " | OphirPay";

/**
 * Set the document title to `${title} | OphirPay` (matching the layout's
 * metadata template). Pass a key from `PAGE_TITLES` in `@/lib/page-titles`
 * or any short page-specific label, e.g. `usePageTitle(PAGE_TITLES.BATCHES)`.
 *
 * Passing `null`/`undefined` leaves the title untouched (useful for pages
 * that intentionally keep the default).
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const next = title.includes("OphirPay") ? title : `${title}${TITLE_SUFFIX}`;
    if (document.title !== next) {
      document.title = next;
    }
  }, [title]);
}
