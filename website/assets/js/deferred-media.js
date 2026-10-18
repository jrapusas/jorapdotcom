// Swap `data-swap-media` links from media="print" once loaded; delegated img fallback.
(function () {
  var links = document.querySelectorAll("link[data-swap-media]");
  for (var i = 0; i < links.length; i++) {
    (function (l) {
      var swap = function () {
        l.media = l.getAttribute("data-swap-media") || "all";
      };
      if (l.sheet) swap();
      else l.addEventListener("load", swap, { once: true });
    })(links[i]);
  }

  document.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      if (!t || t.tagName !== "IMG") return;
      var fb = t.getAttribute("data-fallback-src");
      if (!fb || t.dataset.fallbackApplied === "1") return;
      t.dataset.fallbackApplied = "1";
      t.src = fb;
    },
    true,
  );
})();
