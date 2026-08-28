import "@testing-library/jest-dom/vitest";

// ── jsdom polyfills ──────────────────────────────────────────
// jsdom's File/Blob do not implement .text() which the browser API
// provides. This polyfill lets csv-import.ts (and similar code that
// calls file.text()) run in the vitest/jsdom environment.
if (typeof File !== "undefined" && !File.prototype.text) {
  File.prototype.text = function text(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// URL.createObjectURL / revokeObjectURL are not implemented by jsdom.
// They are used by csv-import.ts (downloadCsvTemplate) and similar
// browser-only utilities. Stub them so tests don't throw.
if (typeof URL.createObjectURL === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (URL as any).createObjectURL = (_obj: unknown) => "blob:mock-url";
}
if (typeof URL.revokeObjectURL === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (URL as any).revokeObjectURL = (_url: string) => {};
}

