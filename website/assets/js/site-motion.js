import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

(function initSiteMotion() {
  "use strict";

  const root = document.querySelector("[data-site-motion]");
  if (!root) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    root.classList.add("is-motion-reduced");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const cleanups = [];

  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const splitWords = (el) => {
    const text = el.textContent.trim();
    if (!text) return [];

    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    el.appendChild(sr);

    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "site-split";
    const words = text.split(/\s+/);

    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "site-split__word";
      span.textContent = word;
      wrap.appendChild(span);
      if (index < words.length - 1) {
        wrap.appendChild(document.createTextNode(" "));
      }
    });

    el.appendChild(wrap);
    return wrap.querySelectorAll(".site-split__word");
  };

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  const header = document.querySelector(".header");
  if (header) {
    gsap.set(header, { y: -16, opacity: 0 });
    intro.to(header, { y: 0, opacity: 1, duration: 0.7 }, 0.05);
  }

  root.querySelectorAll("[data-site-split]").forEach((el) => {
    const words = splitWords(el);
    if (!words.length) return;
    gsap.set(words, { yPercent: 115, opacity: 0 });
    intro.to(
      words,
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.055,
      },
      0.12,
    );
  });

  root.querySelectorAll("[data-site-intro-item]").forEach((el, index) => {
    gsap.set(el, { y: 24, opacity: 0 });
    intro.to(el, { y: 0, opacity: 1, duration: 0.65 }, 0.35 + index * 0.08);
  });

  const heroCtas = root.querySelector("[data-site-hero-ctas]");
  if (heroCtas) {
    gsap.set(heroCtas, { y: 18, opacity: 0 });
    intro.to(heroCtas, { y: 0, opacity: 1, duration: 0.6 }, 0.72);
  }

  root.querySelectorAll("[data-site-reveal]").forEach((section) => {
    const label = section.querySelector("[data-site-reveal-label]");
    const title = section.querySelector("[data-site-split-section]");
    const body = section.querySelectorAll("[data-site-reveal-body]");
    const cards = section.querySelectorAll("[data-site-reveal-card]");

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 78%",
        once: true,
      },
    });

    if (label) {
      gsap.set(label, { y: 16, opacity: 0 });
      tl.to(label, { y: 0, opacity: 1, duration: 0.5 }, 0);
    }

    if (title) {
      const words = splitWords(title);
      gsap.set(words, { yPercent: 100, opacity: 0 });
      tl.to(
        words,
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.04,
        },
        0.05,
      );
    }

    if (body.length) {
      gsap.set(body, { y: 22, opacity: 0 });
      tl.to(body, { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 }, 0.15);
    }

    if (cards.length) {
      gsap.set(cards, { y: 36, opacity: 0 });
      tl.to(
        cards,
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          stagger: 0.1,
          ease: "power2.out",
        },
        0.2,
      );
    }
  });

  const refresh = () => {
    ScrollTrigger.refresh();
  };
  on(window, "load", refresh);
  if (document.fonts?.ready) {
    document.fonts.ready.then(refresh).catch(() => {});
  }

  const destroy = () => {
    cleanups.forEach((fn) => fn());
    ScrollTrigger.getAll().forEach((st) => st.kill());
    intro.kill();
  };

  on(window, "pagehide", destroy);
})();
