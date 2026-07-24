(() => {
  "use strict";

  const namespace = "kit-cuidados-prod-b1e57bac";
  const base = `https://api.counterapi.dev/v1/${namespace}`;
  const params = new URLSearchParams(window.location.search);
  const testPrefix = params.get("analytics_test") === "1" ? "test-" : "";

  function increment(eventName) {
    const safeName = `${testPrefix}${eventName}`.replace(/[^a-z0-9-]/g, "-");
    return fetch(`${base}/${safeName}/up`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    }).catch(() => null);
  }

  increment("page-view");

  const campaignSource = (params.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  if (campaignSource) {
    increment(`source-${campaignSource}`);
    if (campaignSource !== "conteudo") increment("external-view");
  } else if (document.referrer) {
    try {
      if (new URL(document.referrer).origin !== window.location.origin) {
        increment("source-external-referral");
        increment("external-view");
      }
    } catch (_) {
      // Referrers inválidos são ignorados; nenhuma URL completa é enviada.
    }
  }

  try {
    const visitorKey = `kit-cuidados-visitor-${testPrefix || "prod"}`;
    if (!localStorage.getItem(visitorKey)) {
      localStorage.setItem(visitorKey, crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      increment("unique-visitor");
    }
  } catch (_) {
    // Navegadores que bloqueiam localStorage ainda contam visualizações, mas não visitantes aproximados.
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track-download], [data-track-event]");
    if (!target) return;

    const downloadName = target.dataset.trackDownload;
    if (downloadName) increment(`download-click-${downloadName}`);

    const eventName = target.dataset.trackEvent;
    if (eventName) increment(eventName);
  });

  window.KitAnalytics = { increment };
})();
