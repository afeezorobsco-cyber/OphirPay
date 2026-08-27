"use client";
// SPDX-License-Identifier: MIT

import { useEffect } from "react";

/**
 * Title suffix mirroring the `"%s | OphirPay"` metadata template declared in
 * `src/app/layout.tsx`. Client components cannot export Next.js `metadata`
 * (route-specific server metadata lives in each route's `layout.tsx`), so
 * this hook keeps the browser tab (document.title) in sync with the template
 * during client-side navigation.
 */
const TITLE_SUFFIX = " | OphirPay";

/** Format a page title like the layout's `"%s | OphirPay"` template. */
function formatTitle(title: string): string {
  return title.includes("OphirPay") ? title : `${title}${TITLE_SUFFIX}`;
}

/**
 * Set the document title to `${title} | OphirPay` (matching the layout's
 * metadata template). Pass a key from `PAGE_TITLES` in `@/lib/page-titles`
 * or any short page-specific label, e.g. `usePageTitle(PAGE_TITLES.BATCHES)`.
 *
 * When the calling route unmounts — for example when an `error.tsx` or
 * `global-error.tsx` boundary takes over during client navigation — the
 * previous document title is restored so the error screen never retains the
 * preceding route's title.
 *
 * Passing `null`/`undefined` leaves the title untouched.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    const next = formatTitle(title);
    if (document.title !== next) {
      document.title = next;
    }
    return () => {
      document.title = previous;
    };
  }, [title]);
}
