/*
 * Copy-link behavior for the social-share partial.
 * Replaces the previous inline <script> + inline onclick handlers.
 *
 * Markup contract: <button data-share-copy="<url>"> ... <path d="..."/> ... </button>
 * On click, copy the URL to clipboard and briefly swap the path for a checkmark.
 */
(function () {
  "use strict";

  document.querySelectorAll("[data-share-native]").forEach((button) => {
    if (navigator.share) button.hidden = false;
  });

  const COPY_ICON =
    "M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-1c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 17H5V5h14v14z";
  const CHECK_ICON = "M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4L9 16.2z";

  const swapIcon = (button, ms = 1000) => {
    const path = button.querySelector("svg path");
    if (!path) return;
    path.setAttribute("d", CHECK_ICON);
    setTimeout(() => path.setAttribute("d", COPY_ICON), ms);
  };

  document.addEventListener("click", (e) => {
    const native = e.target.closest("[data-share-native]");
    if (native) {
      const url = native.getAttribute("data-share-url");
      const title = native.getAttribute("data-share-title");
      if (!url || !navigator.share) return;
      navigator.share({ title: title || "", url }).catch(() => {});
      return;
    }

    const button = e.target.closest("[data-share-copy]");
    if (!button) return;
    const url = button.getAttribute("data-share-copy");
    if (!url || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(url)
      .then(() => swapIcon(button))
      .catch(() => {});
  });
})();
