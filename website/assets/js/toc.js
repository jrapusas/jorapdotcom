/*
 * Unified TOC + on-page anchor handling.
 *
 * Responsibilities (previously split across this file and an inline <script>
 * in themes/jorap/layouts/blog/single.html):
 *   1. Smooth-scroll for in-page `#anchor` links, offset by the sticky header.
 *   2. Mobile TOC collapse/expand toggle on blog posts.
 *   3. Scroll-spy: bold the TOC entry whose heading is currently in view.
 *
 * Header height is measured from the rendered sticky header, falling back to the
 * `--header-offset` CSS custom property (see themes/jorap/assets/css/base.css).
 */
(function () {
  "use strict";

  const ANCHOR_GAP = 12;

  /* Measure the live sticky header rather than trusting `--header-offset`: the
     rendered height moves with the logo, brand text wrapping, and an open mobile
     nav menu, and the breakpoint values are only approximations of it. */
  const getHeaderOffset = () => {
    const header = document.querySelector(".header");
    if (header) {
      const { position } = getComputedStyle(header);
      const height = header.getBoundingClientRect().height;
      if ((position === "sticky" || position === "fixed") && height > 0) {
        return Math.round(height) + ANCHOR_GAP;
      }
    }
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-offset")
      .trim();
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 100;
  };

  const scrollToElement = (el) => {
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - getHeaderOffset(),
      behavior: "smooth",
    });
  };

  /* Collapsing the mobile panel shortens the flow above the target, so it has to
     happen before the target position is measured. */
  let collapseMobileToc = () => {};

  const initAnchorLinks = () => {
    const links = document.querySelectorAll('a[href^="#"]:not([href="#"])');
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        collapseMobileToc();
        scrollToElement(target);
        if (history.pushState) {
          history.pushState(null, "", `#${id}`);
        } else {
          location.hash = `#${id}`;
        }
      });
    });
  };

  const initMobileToc = () => {
    const toggle = document.getElementById("mobile-toc-toggle");
    const panel = document.getElementById("mobile-toc-panel");
    const chevron = document.getElementById("toc-chevron");
    if (!toggle || !panel) return;

    const setExpanded = (expanded) => {
      panel.classList.toggle("hidden", !expanded);
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (chevron) chevron.classList.toggle("rotate-180", expanded);
    };

    toggle.addEventListener("click", () => {
      setExpanded(panel.classList.contains("hidden"));
    });

    collapseMobileToc = () => setExpanded(false);
  };

  const initScrollSpy = () => {
    const tocLinks = document.querySelectorAll(".table-of-content a");
    if (tocLinks.length === 0) return;

    const content = document.querySelector(".content");
    if (!content) return;

    const headings = Array.from(
      content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ).filter((h) => h.id);
    if (headings.length === 0) return;

    const linksById = {};
    tocLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) linksById[href.slice(1)] = link;
      link.classList.add("transition-all", "duration-200", "ease-out");
    });

    const setActive = (heading) => {
      if (!heading) return;
      tocLinks.forEach((l) => l.classList.remove("font-bold"));
      const active = linksById[heading.id];
      if (active) active.classList.add("font-bold");
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offset = getHeaderOffset();
        const scrollTop = window.scrollY + offset + 1;
        let current = headings[0];
        for (const h of headings) {
          if (h.offsetTop <= scrollTop) current = h;
          else break;
        }
        if (
          window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 100
        ) {
          current = headings[headings.length - 1];
        }
        setActive(current);
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  };

  document.addEventListener("DOMContentLoaded", () => {
    initAnchorLinks();
    initMobileToc();
    initScrollSpy();

    if (window.location.hash) {
      setTimeout(() => {
        scrollToElement(document.getElementById(window.location.hash.slice(1)));
      }, 100);
    }
  });
})();
