import {
  INTERNAL_KEY,
  classifySource,
  isLikelyBot,
  isNewSession,
  trackingMode,
} from "./analytics-core.mjs";

const namespace = "kit-cuidados-prod-b1e57bac";
const base = `https://api.counterapi.dev/v1/${namespace}`;
const params = new URLSearchParams(window.location.search);

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function removeLocal(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

if (params.get("analytics_internal") === "1") writeLocal(INTERNAL_KEY, "1");
if (params.get("analytics_internal") === "0") removeLocal(INTERNAL_KEY);

const mode = trackingMode(params, readLocal(INTERNAL_KEY) === "1");
const bot = mode !== "test" && isLikelyBot({
  webdriver: navigator.webdriver,
  userAgent: navigator.userAgent,
});
const shouldTrack = mode === "test" || (mode === "production" && !bot);
const eventPrefix = mode === "test" ? "test-v2-" : "v2-";

function increment(eventName) {
  if (!shouldTrack) return Promise.resolve(null);
  const safeName = `${eventPrefix}${eventName}`.replace(/[^a-z0-9-]/g, "-");
  return fetch(`${base}/${safeName}/up`, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    keepalive: true,
    credentials: "omit",
    referrerPolicy: "strict-origin-when-cross-origin",
  }).catch(() => null);
}

if (shouldTrack) {
  increment("page-view");

  const storageSuffix = mode === "test" ? "test" : "prod";
  const uniqueKey = `kit-cuidados-v2-unique-${storageSuffix}`;
  if (!readLocal(uniqueKey) && writeLocal(uniqueKey, "1")) increment("unique-browser");

  const sessionKey = `kit-cuidados-v2-session-last-${storageSuffix}`;
  const now = Date.now();
  const previousSession = readLocal(sessionKey);
  if (writeLocal(sessionKey, String(now)) && isNewSession(previousSession, now)) increment("session");

  const source = classifySource({
    search: window.location.search,
    referrer: document.referrer,
    origin: window.location.origin,
  });
  increment(`source-${source.source}`);
  if (source.external) increment("external-view");
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-track-download], [data-track-event]");
  if (!target) return;

  const downloadName = target.dataset.trackDownload;
  if (downloadName) increment(`download-click-${downloadName}`);

  const eventName = target.dataset.trackEvent;
  if (eventName) increment(eventName);
});

window.KitAnalytics = {
  increment,
  status: Object.freeze({ mode, bot, tracking: shouldTrack }),
};
