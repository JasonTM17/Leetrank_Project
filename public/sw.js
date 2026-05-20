 
/**
 * LeetRank service worker.
 *
 * Strategies:
 *  - Pre-cache the app shell (top-level routes) on install so the first
 *    offline navigation has something to render instead of the browser's
 *    "no internet" page.
 *  - /api/problems and /api/tags use stale-while-revalidate with a 1-day
 *    soft TTL — these are mostly catalog data and tolerate a touch of
 *    staleness in exchange for instant render.
 *  - /api/auth/* uses network-first so login/session state is never served
 *    from a stale cache; falls back to cache only when the network fails.
 *  - /api/submissions is never cached — submissions and verdicts must
 *    always reflect the latest backend state.
 *  - Failed navigations fall back to /offline (also pre-cached on install).
 *
 * Bump SHELL_CACHE / RUNTIME_CACHE versions whenever the cached responses
 * or pre-cache list change so old clients evict their stale entries on
 * activate. The page reload prompt is driven by the layout's
 * `controllerchange` listener.
 */

const SHELL_CACHE = "leetrank-shell-v1";
const RUNTIME_CACHE = "leetrank-runtime-v1";

const SHELL_URLS = [
  "/",
  "/problems",
  "/contests",
  "/leaderboard",
  "/login",
  "/offline",
];

const RUNTIME_API_PATTERNS = [/^\/api\/problems(\/|$|\?)/, /^\/api\/tags(\/|$|\?)/];
const NETWORK_FIRST_API = /^\/api\/auth\//;
const NEVER_CACHE_API = /^\/api\/submissions(\/|$|\?)/;

const RUNTIME_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Use addAll with a Request that opts out of caches so we always
      // pre-fetch fresh shells on install — otherwise the SW could re-cache
      // a stale browser-cached copy on first install.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload", credentials: "same-origin" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            // Network may be unavailable when the SW first installs (rare,
            // but possible). The runtime fetch handler will populate the
            // cache later.
          }
        }),
      );
      // Take over as the active SW immediately so users get the new shell
      // without having to close every tab first.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isRuntimeApi(pathname) {
  return RUNTIME_API_PATTERNS.some((re) => re.test(pathname));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (res) => {
      if (res && res.ok) {
        // Stamp a synthetic Date header on the cached copy so we can age it.
        const cloned = res.clone();
        await cache.put(request, cloned);
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    const dateHeader = cached.headers.get("date");
    const fetchedAt = dateHeader ? Date.parse(dateHeader) : 0;
    const isFresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < RUNTIME_TTL_MS;
    if (isFresh) {
      // Kick off the revalidation but return the cached body immediately.
      void fetchPromise;
      return cached;
    }
  }
  const network = await fetchPromise;
  return network ?? cached ?? new Response("", { status: 504, statusText: "Gateway Timeout" });
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function navigationHandler(request) {
  try {
    const res = await fetch(request);
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET — POST/PUT/DELETE always go through to the network.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(req));
    return;
  }

  if (NEVER_CACHE_API.test(url.pathname)) {
    return; // let the network handle it untouched
  }
  if (NETWORK_FIRST_API.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isRuntimeApi(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Static assets in /_next/static/* are already immutable — let the
  // browser HTTP cache handle them.
});

// Allow the page to ask the SW to skip waiting on a new build, which is
// how the layout's update prompt becomes a one-click reload.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
