/**
 * Copy embedded text (markdown, issue reports, hub clusters) for agent copy.
 */
(function () {
  function readSource(dataEl) {
    try {
      return JSON.parse(dataEl.textContent).source || "";
    } catch (e) {
      return "";
    }
  }

  function wire(btn) {
    var wrap = btn.closest(".notes-copy-wrap");
    var dataEl = wrap ? wrap.querySelector(".notes-copy-data") : null;
    if (!dataEl) return;

    var copiedLabel = btn.getAttribute("data-copied-label") || "Copied";
    var defaultLabel = btn.textContent;

    function flash() {
      btn.textContent = copiedLabel;
      window.setTimeout(function () {
        btn.textContent = defaultLabel;
      }, 1600);
    }

    var handler = function (event) {
      event.preventDefault();
      if (!navigator.clipboard) return;
      var source = readSource(dataEl);
      if (!source) return;
      navigator.clipboard.writeText(source).then(flash);
    };

    var bind = window.jorapBindTouchClickIf;
    if (bind) bind(btn, handler);
    else btn.addEventListener("click", handler);
  }

  var btns = document.querySelectorAll("[data-notes-copy]");
  Array.prototype.forEach.call(btns, wire);

  // ponytail: self-check - fails if first embed regresses
  if (typeof console !== "undefined" && console.assert && btns.length) {
    var firstWrap = btns[0].closest(".notes-copy-wrap");
    var firstData = firstWrap && firstWrap.querySelector(".notes-copy-data");
    if (firstData) {
      console.assert(readSource(firstData).length > 0, "notes-copy embed must be non-empty");
    }
  }
})();
