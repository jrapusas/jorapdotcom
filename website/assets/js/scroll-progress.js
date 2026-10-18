/*
 * Header-bottom scroll progress bar.
 * Safe no-op if the bar element is absent.
 */
(function () {
  "use strict";

  const bar = document.querySelector(".scroll-progress__bar");
  if (!bar) return;

  let ticking = false;
  const update = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      bar.style.width = `${pct}%`;
      ticking = false;
    });
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
})();
