import { afterEach } from "vitest";

/**
 * Vitest setup for jsdom v29 on Node v25.
 *
 * Two compatibility patches:
 *
 * 1. localStorage polyfill
 *    jsdom v29 provides window.localStorage as a bare object whose methods
 *    (clear, getItem, setItem, removeItem) are undefined unless a
 *    localStorageFile path is configured.  This patches in a working
 *    in-memory Storage so tests can read/write localStorage.
 *
 * 2. Request proxy for AbortSignal compatibility
 *    jsdom v29 provides its own AbortController/AbortSignal on globalThis,
 *    but Node v25's undici (used as the global Request constructor) requires
 *    a native AbortSignal.  When React Router's createClientSideRequest
 *    passes a jsdom AbortSignal to new Request(), undici throws:
 *      "TypeError: RequestInit: Expected signal to be an instance of AbortSignal"
 *
 *    The native AbortController is unreachable once jsdom has overridden
 *    globalThis.AbortController.  Instead we wrap globalThis.Request via
 *    Proxy to catch the TypeError and retry without the non-native signal.
 *    React Router uses the signal to cancel in-flight navigations, which
 *    does not happen during unit tests, so omitting it is safe.
 */

if (typeof window !== "undefined") {
  /* ======================================================
   * 1. localStorage polyfill
   * ====================================================== */

  const store = new Map<string, string>();

  const storage: Storage = {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    writable: false,
    configurable: true,
  });

  // Defense-in-depth: clear localStorage between every test to prevent
  // cross-test contamination if a test author forgets to do so.
  afterEach(() => {
    store.clear();
  });

  /* ======================================================
   * 2. Request proxy for AbortSignal compatibility
   * ====================================================== */

  const NativeRequest = globalThis.Request;

  globalThis.Request = new Proxy(NativeRequest, {
    construct(_target, args: ConstructorParameters<typeof NativeRequest>) {
      const [url, init] = args;

      // Fast path: no init or no signal – native works fine
      if (!init || !init.signal) {
        return Reflect.construct(NativeRequest, args);
      }

      try {
        return Reflect.construct(NativeRequest, args);
      } catch (err) {
        if (
          !(err instanceof TypeError)
          || !String(err).includes("instance of AbortSignal")
        ) {
          throw err;
        }

        // Signal is non-native (jsdom) – retry without it.
        // Tests never perform concurrent navigations that would require
        // aborting a previous in-flight Request, so omitting the signal
        // is safe.
        return Reflect.construct(NativeRequest, [
          url,
          { ...init, signal: undefined },
        ]);
      }
    },
  }) as typeof globalThis.Request;

  // Also patch window.Request so DOM-level code uses the same wrapper.
  window.Request = globalThis.Request;
}
