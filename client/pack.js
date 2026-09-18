/**
 * Odyssey recipe floor — drop into any Sprint / biome / citadel Live.
 * Boot + 30s heartbeat + visibility flush. Fail soft. No wallet / player keys.
 *
 * REQUIRED: window.BOLTVERSE_PACK_ORIGIN = Pack API host
 *   StarBoltSprint/boltverse-pack on Vercel
 *   placeholder until real URL: "https://YOUR-PACK.vercel.app"
 *
 * HARD BAN: do not point this at https://boltverse-odysseyyyy.grok.me
 *   (game play URL stays odysseyyyy; Pack API does not).
 *
 * Load /client/pack.js from that origin, or ship this local file and POST there.
 * Never invent a sub. Never player API keys.
 */
(function packClient(global) {
  if (!global || global.__BOLTVERSE_PACK__) return;
  global.__BOLTVERSE_PACK__ = true;

  var LOG = "[pack]";
  var INTERVAL_MS = 30000;
  var ticket = null;
  var sub = null;
  var startedAt = new Date().toISOString();
  var startedMs = Date.now();
  var timer = null;
  var inflight = false;
  var retriedTicket = false;

  function normalizeOrigin(raw) {
    if (!raw) return "";
    var origin = String(raw).replace(/\/$/, "");
    try {
      var host = new URL(origin).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
    if (host === "grok.me" || /\.grok\.me$/.test(host)) return "";
    return origin;
  }

  function apiOrigin() {
    if (global.BOLTVERSE_PACK_ORIGIN) {
      return normalizeOrigin(global.BOLTVERSE_PACK_ORIGIN);
    }
    var el = document.currentScript;
    if (el && el.src) {
      try {
        return normalizeOrigin(new URL(el.src).origin);
      } catch (e) {}
    }
    return "";
  }

  function endpoint(path) {
    return apiOrigin() + path;
  }

  function findIdentity() {
    if (global.__GROK_IDENTITY__) return String(global.__GROK_IDENTITY__);
    if (global.grokIdentity) return String(global.grokIdentity);
    try {
      var meta = document.querySelector(
        'meta[name="x-grok-identity"], meta[name="grok-identity"]',
      );
      if (meta && meta.content) return meta.content;
    } catch (e) {}
    try {
      var match = document.cookie.match(
        /(?:^|; )(?:grok_identity|x-grok-identity)=([^;]+)/,
      );
      if (match) return decodeURIComponent(match[1]);
    } catch (e) {}
    return null;
  }

  function headers() {
    var h = { "content-type": "application/json" };
    var identity = findIdentity();
    if (identity) h["x-grok-identity"] = identity;
    if (ticket) h.authorization = "Bearer " + ticket;
    return h;
  }

  function playTimeSec() {
    return Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  }

  function body() {
    return {
      playUrl: global.location && global.location.origin,
      displayName: undefined,
      client: "odyssey-pack-1",
      playTimeSec: playTimeSec(),
      sessionStartedAt: startedAt,
    };
  }

  function send(path, keepalive) {
    if (!apiOrigin()) return Promise.resolve(null);
    return fetch(endpoint(path), {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: headers(),
      body: JSON.stringify(body()),
      keepalive: !!keepalive,
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      });
    });
  }

  function heartbeat(keepalive) {
    if (!ticket || inflight) return Promise.resolve();
    inflight = true;
    return send("/v1/pack/heartbeat", keepalive)
      .catch(function () {
        return null;
      })
      .then(function () {
        inflight = false;
      });
  }

  function startHeartbeat() {
    if (ticket && !timer) {
      timer = global.setInterval(function () {
        heartbeat(false);
      }, INTERVAL_MS);
    }
  }

  function useInjectedTicket() {
    if (!global.__PACK_TICKET__) return false;
    ticket = global.__PACK_TICKET__;
    sub = global.__PACK_SUB__ || null;
    console.info(
      LOG,
      sub,
      "github write",
      global.__PACK_GITHUB__ === "ok" ? "ok" : global.__PACK_GITHUB__ || "skip",
    );
    startHeartbeat();
    return true;
  }

  function boot() {
    if (!apiOrigin()) {
      console.info(LOG, "fail soft");
      return Promise.resolve();
    }
    if (useInjectedTicket()) return Promise.resolve();
    // Ticket is injected into <head> during the document GET. If pack.js ran
    // before that inline script, retry once on the next turn.
    if (!retriedTicket) {
      retriedTicket = true;
      global.setTimeout(boot, 0);
      return Promise.resolve();
    }
    return send("/v1/pack/boot", false)
      .then(function (data) {
        if (!data || !data.ok) {
          console.info(LOG, "skip no-sub");
          return;
        }
        sub = data.sub;
        ticket = data.ticket || null;
        console.info(
          LOG,
          sub,
          "github write",
          data.github === "ok" ? "ok" : data.github || "skip",
        );
        startHeartbeat();
      })
      .catch(function () {
        console.info(LOG, "fail soft");
      });
  }

  function onHidden() {
    if (global.document && global.document.visibilityState === "hidden") {
      heartbeat(true);
    }
  }

  if (global.document) {
    global.document.addEventListener("visibilitychange", onHidden);
  }
  global.addEventListener("pagehide", function () {
    heartbeat(true);
  });

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
