/**
 * CODTracked storefront attribution
 * Captures utm_* / click IDs from the URL, keeps them in localStorage,
 * and writes them to Shopify cart attributes so they arrive on the order
 * as note_attributes (even when Shopify's conversion summary is empty).
 *
 * Install: Theme → Edit code → theme.liquid (before </head>):
 *   <script src="https://YOUR_APP_HOST/shopify/codtracked-attribution.js" defer></script>
 */
(function () {
  "use strict";

  var STORAGE_KEY = "codtracked_attribution_v1";
  var ATTR_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "ttclid",
    "gclid",
  ];
  var LANDING_KEY = "codtracked_landing";
  var syncTimer = null;
  var syncing = false;

  function analyticsAllowed() {
    // If UTMs are explicitly in the URL, always capture (ad click intent).
    try {
      if (hasSignals(readParamsFromSearch(window.location.search))) return true;
    } catch (_) {
      /* continue */
    }
    try {
      var privacy = window.Shopify && window.Shopify.customerPrivacy;
      if (!privacy || typeof privacy.analyticsProcessingAllowed !== "function") return true;
      return privacy.analyticsProcessingAllowed() !== false;
    } catch (_) {
      return true;
    }
  }

  function readParamsFromSearch(search) {
    var out = {};
    if (!search) return out;
    var params = new URLSearchParams(search.charAt(0) === "?" ? search : "?" + search);
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      var key = ATTR_KEYS[i];
      var value = params.get(key);
      if (value && String(value).trim()) out[key] = String(value).trim().slice(0, 500);
    }
    return out;
  }

  function hasSignals(bag) {
    if (!bag) return false;
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      if (bag[ATTR_KEYS[i]]) return true;
    }
    return false;
  }

  function loadStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function saveStored(bag) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
    } catch (_) {
      /* ignore quota / private mode */
    }
  }

  function captureFromLocation() {
    if (!analyticsAllowed()) return null;
    var fromUrl = readParamsFromSearch(window.location.search);
    if (!hasSignals(fromUrl)) return null;

    var landing =
      window.location.pathname +
      (window.location.search || "") +
      (window.location.hash || "");
    var next = Object.assign({}, fromUrl);
    next[LANDING_KEY] = landing.slice(0, 2000);
    next.captured_at = new Date().toISOString();
    saveStored(next);
    return next;
  }

  function currentBag() {
    return captureFromLocation() || loadStored();
  }

  function scheduleSync(delayMs) {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(function () {
      syncTimer = null;
      syncCartAttributes();
    }, typeof delayMs === "number" ? delayMs : 200);
  }

  function syncCartAttributes() {
    if (syncing || !analyticsAllowed()) return;
    var bag = currentBag();
    if (!bag || !hasSignals(bag)) return;

    syncing = true;
    fetch("/cart.js", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("cart.js " + res.status);
        return res.json();
      })
      .then(function (cart) {
        var existing = (cart && cart.attributes) || {};
        var merged = Object.assign({}, existing);
        for (var i = 0; i < ATTR_KEYS.length; i++) {
          var key = ATTR_KEYS[i];
          if (bag[key]) merged[key] = bag[key];
        }
        if (bag[LANDING_KEY]) merged[LANDING_KEY] = bag[LANDING_KEY];

        var changed = false;
        for (var k in merged) {
          if (Object.prototype.hasOwnProperty.call(merged, k) && String(merged[k] || "") !== String(existing[k] || "")) {
            changed = true;
            break;
          }
        }
        if (!changed) return null;

        return fetch("/cart/update.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ attributes: merged }),
        });
      })
      .catch(function () {
        /* cart APIs unavailable on some surfaces (checkout iframe, password gate) */
      })
      .finally(function () {
        syncing = false;
      });
  }

  function onUserIntent() {
    scheduleSync(0);
  }

  captureFromLocation();
  scheduleSync(0);

  document.addEventListener(
    "click",
    function (event) {
      var el = event.target;
      if (!el || typeof el.closest !== "function") return;
      if (
        el.closest('button[name="add"]') ||
        el.closest('form[action*="/cart"]') ||
        el.closest("[data-shopify-buyitnow]") ||
        el.closest(".shopify-payment-button") ||
        el.closest('a[href*="/checkout"]')
      ) {
        onUserIntent();
      }
    },
    true,
  );

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || !form.action) return;
      if (String(form.action).indexOf("/cart") !== -1 || String(form.action).indexOf("checkout") !== -1) {
        onUserIntent();
      }
    },
    true,
  );

  window.addEventListener("pageshow", function () {
    captureFromLocation();
    scheduleSync(50);
  });

  if (window.Shopify && window.Shopify.customerPrivacy && typeof window.Shopify.customerPrivacy.addEventListener === "function") {
    window.Shopify.customerPrivacy.addEventListener("visitorConsentCollected", function () {
      captureFromLocation();
      scheduleSync(0);
    });
  }
})();
