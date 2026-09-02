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

if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.clear !== "function") {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
}

// Polyfill File.prototype.text() for jsdom (used by csv-import)
if (typeof File !== "undefined" && typeof File.prototype.text === "undefined") {
  File.prototype.text = async function text(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// Polyfill File.prototype.arrayBuffer() for jsdom
if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer === "undefined") {
  File.prototype.arrayBuffer = async function arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error("Expected ArrayBuffer result"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill URL.createObjectURL / revokeObjectURL for jsdom
if (typeof URL.createObjectURL === "undefined") {
  let objectURLCounter = 0;
  URL.createObjectURL = function createObjectURL(_blob: Blob): string {
    return `blob:mock/${++objectURLCounter}`;
  };
  URL.revokeObjectURL = function revokeObjectURL(_url: string): void {
    // no-op in test environment
  };
}
