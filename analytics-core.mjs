export const INTERNAL_KEY = "kit-cuidados-analytics-internal-v2";
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const BOT_PATTERN = /(bot|crawler|spider|slurp|headless|lighthouse|pagespeed|internetarchive|archive\.org|wayback|wget|curl|python-requests|facebookexternalhit|whatsapp|telegrambot|discordbot|preview)/i;
const INTERNAL_SOURCES = new Set(["conteudo", "site", "interno"]);

export function isLikelyBot({ webdriver = false, userAgent = "" } = {}) {
  return Boolean(webdriver) || BOT_PATTERN.test(userAgent);
}

export function classifySource({ search = "", referrer = "", origin = "" } = {}) {
  const params = new URLSearchParams(search);
  const campaignSource = (params.get("utm_source") || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 40);
  if (campaignSource) {
    return { source: campaignSource, external: !INTERNAL_SOURCES.has(campaignSource) };
  }
  if (referrer) {
    try {
      const referrerOrigin = new URL(referrer).origin;
      if (referrerOrigin !== origin) return { source: "external-referral", external: true };
      return { source: "internal", external: false };
    } catch (_) {
      return { source: "direct-or-unknown", external: false };
    }
  }
  return { source: "direct-or-unknown", external: false };
}

export function isNewSession(lastActivity, now = Date.now()) {
  const previous = Number(lastActivity);
  return !Number.isFinite(previous) || previous <= 0 || now - previous > SESSION_TIMEOUT_MS;
}

export function trackingMode(params, internalStored) {
  if (params.get("analytics_test") === "1") return "test";
  if (params.get("analytics_internal") === "0") return "production";
  if (params.get("analytics_internal") === "1" || internalStored) return "internal";
  return "production";
}
