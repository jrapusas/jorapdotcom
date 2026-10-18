/**
 * Reliable tap/click binding for touch devices (iOS Safari, sticky toolbars).
 */
(function (global) {
  function bindTouchClick(el, handler) {
    if (!el || typeof handler !== "function") return;
    var lastAt = 0;

    function invoke(evt) {
      var now = Date.now();
      if (now - lastAt < 300) return;
      lastAt = now;
      handler.call(el, evt);
    }

    el.addEventListener("click", invoke);
    el.addEventListener(
      "touchend",
      function (evt) {
        evt.preventDefault();
        invoke(evt);
      },
      { passive: false }
    );
  }

  function bindTouchClickIf(el, handler) {
    if (el) bindTouchClick(el, handler);
  }

  global.jorapBindTouchClick = bindTouchClick;
  global.jorapBindTouchClickIf = bindTouchClickIf;
})(typeof window !== "undefined" ? window : this);
