/**
 * Backlinks index: filter, sort, expand/collapse, hash deep-links.
 */
(function () {
  var root = document.querySelector("[data-notes-backlinks]");
  if (!root) return;

  var searchEl = document.querySelector("[data-backlinks-search]");
  var sortEl = document.querySelector("[data-backlinks-sort]");
  var clearEl = document.querySelector("[data-backlinks-clear]");
  var expandEl = document.querySelector("[data-backlinks-expand]");
  var collapseEl = document.querySelector("[data-backlinks-collapse]");
  var countEl = document.querySelector("[data-backlinks-count]");
  var emptyEl = document.querySelector("[data-backlinks-empty]");
  var total = countEl
    ? parseInt(countEl.getAttribute("data-backlinks-total") || "0", 10)
    : 0;
  var search = "";
  var sortMode = "count";

  function groups() {
    return root.querySelectorAll("[data-backlinks-group]");
  }

  function readUrlState() {
    var params = new URLSearchParams(window.location.search);
    var q = params.get("q");
    if (q) search = q;
    var sort = params.get("sort");
    if (sort === "title" || sort === "count") sortMode = sort;
  }

  function syncControls() {
    if (searchEl) searchEl.value = search;
    if (sortEl) sortEl.value = sortMode;
    if (clearEl) {
      var active = Boolean(search);
      clearEl.hidden = !active;
      clearEl.classList.toggle("hidden", !active);
    }
  }

  function sortGroups() {
    var items = Array.prototype.slice.call(groups());
    items.sort(function (a, b) {
      if (sortMode === "title") {
        return (a.getAttribute("data-backlinks-title") || "").localeCompare(
          b.getAttribute("data-backlinks-title") || ""
        );
      }
      return (
        parseInt(b.getAttribute("data-backlinks-count") || "0", 10) -
        parseInt(a.getAttribute("data-backlinks-count") || "0", 10)
      );
    });
    items.forEach(function (el) {
      root.appendChild(el);
    });
  }

  function applyFilters() {
    var visible = 0;
    groups().forEach(function (group) {
      var hay = group.getAttribute("data-backlinks-search") || "";
      var show = !search || hay.indexOf(search) !== -1;
      group.classList.toggle("hidden", !show);
      if (show) {
        visible += 1;
        if (search) group.open = true;
      }
    });
    if (emptyEl) emptyEl.classList.toggle("hidden", visible > 0);
    if (countEl) countEl.textContent = visible + " / " + (total || groups().length);
  }

  function setAllOpen(open) {
    groups().forEach(function (group) {
      if (!group.classList.contains("hidden")) group.open = open;
    });
  }

  function updateUrl() {
    var params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sortMode !== "count") params.set("sort", sortMode);
    var qs = params.toString();
    var next = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    var current = window.location.pathname + window.location.search + window.location.hash;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }

  function openHashTarget() {
    var id = window.location.hash.slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (target && target.tagName === "DETAILS") {
      target.open = true;
      var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
  }

  if (searchEl) {
    searchEl.addEventListener("input", function () {
      search = searchEl.value.trim().toLowerCase();
      applyFilters();
      updateUrl();
      syncControls();
    });
  }

  if (sortEl) {
    sortEl.addEventListener("change", function () {
      sortMode = sortEl.value || "count";
      sortGroups();
      updateUrl();
    });
  }

  if (clearEl) {
    clearEl.addEventListener("click", function () {
      search = "";
      syncControls();
      applyFilters();
      updateUrl();
    });
  }

  if (expandEl) expandEl.addEventListener("click", function () {
    setAllOpen(true);
  });

  if (collapseEl) collapseEl.addEventListener("click", function () {
    setAllOpen(false);
  });

  readUrlState();
  syncControls();
  sortGroups();
  applyFilters();
  openHashTarget();
  window.addEventListener("hashchange", openHashTarget);
})();
