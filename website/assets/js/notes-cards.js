/**
 * Cards index: filter by card set chip.
 */
(function () {
  var root = document.querySelector("[data-notes-cards]");
  if (!root) return;

  var filters = root.querySelectorAll("[data-notes-cards-filter]");
  var items = root.querySelectorAll("[data-notes-cards-item]");
  var emptyEl = root.querySelector("[data-notes-cards-empty]");

  function applyFilter(setName) {
    var visible = 0;

    items.forEach(function (item) {
      var sets = (item.getAttribute("data-notes-cards-sets") || "").split(",").filter(Boolean);
      var show = setName === "all" || sets.indexOf(setName) !== -1;
      item.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });

    filters.forEach(function (btn) {
      var active = btn.getAttribute("data-notes-cards-filter") === setName;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (emptyEl) {
      emptyEl.classList.toggle("hidden", visible > 0);
    }
  }

  var bindTap = window.jorapBindTouchClick || function (el, fn) {
    el.addEventListener("click", fn);
  };

  filters.forEach(function (btn) {
    bindTap(btn, function () {
      applyFilter(btn.getAttribute("data-notes-cards-filter") || "all");
    });
  });
})();
