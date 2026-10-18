/**
 * Obsidian-style hover previews for wikilinks in the notes garden.
 */
(function () {
  var indexEl = document.getElementById("notes-preview-index");
  if (!indexEl) return;

  var index = {};
  try {
    JSON.parse(indexEl.textContent).forEach(function (entry) {
      index[entry.url] = entry;
    });
  } catch (e) {
    return;
  }

  var tooltip = document.createElement("div");
  tooltip.className = "wikilink-preview";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  var activeLink = null;
  var showTimer = 0;
  var hideTimer = 0;

  function hide() {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    tooltip.hidden = true;
    activeLink = null;
  }

  function position(link) {
    var rect = link.getBoundingClientRect();
    var top = rect.bottom + window.scrollY + 8;
    var left = rect.left + window.scrollX;
    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";

    requestAnimationFrame(function () {
      var tRect = tooltip.getBoundingClientRect();
      var maxLeft = window.scrollX + window.innerWidth - tRect.width - 12;
      if (left > maxLeft) {
        tooltip.style.left = Math.max(window.scrollX + 12, maxLeft) + "px";
      }
      if (rect.bottom + tRect.height + 12 > window.innerHeight) {
        tooltip.style.top = rect.top + window.scrollY - tRect.height - 8 + "px";
      }
    });
  }

  function show(link) {
    var key = link.getAttribute("data-wikilink-preview");
    if (!key || !index[key]) return;

    var entry = index[key];
    tooltip.innerHTML =
      '<p class="wikilink-preview__title">' +
      escapeHtml(entry.title) +
      "</p>" +
      (entry.description
        ? '<p class="wikilink-preview__desc">' + escapeHtml(entry.description) + "</p>"
        : "");

    tooltip.hidden = false;
    activeLink = link;
    position(link);
  }

  var escapeHtml = window.jorapEscapeHtml;

  document.addEventListener(
    "mouseover",
    function (evt) {
      var link = evt.target.closest("[data-wikilink-preview]");
      if (!link || !document.querySelector(".notes-content, .notes-see-also, .notes-outgoing, .notes-backlinks")) {
        return;
      }
      if (activeLink === link) return;

      window.clearTimeout(hideTimer);
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(function () {
        show(link);
      }, 280);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    function (evt) {
      var link = evt.target.closest("[data-wikilink-preview]");
      if (!link) return;
      var related = evt.relatedTarget;
      if (related && (link.contains(related) || tooltip.contains(related))) return;

      window.clearTimeout(showTimer);
      hideTimer = window.setTimeout(hide, 120);
    },
    true
  );

  window.addEventListener("scroll", function () {
    if (activeLink && !tooltip.hidden) position(activeLink);
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (activeLink && !tooltip.hidden) position(activeLink);
  });
})();
