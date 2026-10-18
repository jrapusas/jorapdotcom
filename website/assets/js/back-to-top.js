/*
 * Back-to-top button + internal scroll fill.
 * Used by themes/jorap/layouts/partials/components/back-to-top.html.
 * Safe no-op if either element is absent.
 */
(function () {
  "use strict";

  const button = document.getElementById("back-to-top");
  const fill = button?.querySelector(".back-to-top__fill");
  if (!button || !fill) return;

  const trigger = button.querySelector("[data-back-to-top]");
  trigger?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  let ticking = false;
  const update = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? window.scrollY / scrollable : 0;
      fill.style.height = `${pct * 100}%`;
      button.classList.toggle("hidden", window.scrollY <= 300);
      ticking = false;
    });
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
})();
