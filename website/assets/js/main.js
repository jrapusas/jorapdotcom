// main script (project override - nav keyboard + dropdown a11y)
(function () {
  "use strict";

  const dropdownTriggers = document.querySelectorAll(".nav-dropdown-trigger");

  const setDropdownExpanded = (navItem, expanded) => {
    const btn = navItem?.querySelector(".nav-dropdown-trigger");
    if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  };

  const closeAllDropdowns = () => {
    document.querySelectorAll(".nav-dropdown.active").forEach((item) => {
      item.classList.remove("active");
      setDropdownExpanded(item, false);
    });
  };

  const openDropdown = (navItem) => {
    document.querySelectorAll(".nav-dropdown.active").forEach((item) => {
      if (item !== navItem) {
        item.classList.remove("active");
        setDropdownExpanded(item, false);
      }
    });
    navItem.classList.add("active");
    setDropdownExpanded(navItem, true);
  };

  const dropdownLinks = (navItem) =>
    Array.from(navItem?.querySelectorAll(".nav-dropdown-link") || []);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-dropdown")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });

  dropdownTriggers.forEach((toggler) => {
    const navItem = toggler.closest(".nav-item");
    if (!navItem) return;

    toggler.addEventListener("click", (e) => {
      e.preventDefault();
      if (navItem.classList.contains("active")) {
        navItem.classList.remove("active");
        setDropdownExpanded(navItem, false);
        return;
      }
      openDropdown(navItem);
    });

    toggler.addEventListener("keydown", (e) => {
      const links = dropdownLinks(navItem);
      const open = navItem.classList.contains("active");

      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        if (e.key !== "ArrowDown" || !open) {
          e.preventDefault();
          if (!open) openDropdown(navItem);
          if (links.length) links[0].focus();
        } else if (links.length) {
          e.preventDefault();
          links[0].focus();
        }
        return;
      }

      if (e.key === "ArrowUp" && open && links.length) {
        e.preventDefault();
        links[links.length - 1].focus();
      }
    });

    dropdownLinks(navItem).forEach((link, index, links) => {
      link.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeAllDropdowns();
          toggler.focus();
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          links[(index + 1) % links.length].focus();
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (index === 0) {
            closeAllDropdowns();
            toggler.focus();
          } else {
            links[index - 1].focus();
          }
          return;
        }

        if (e.key === "Home") {
          e.preventDefault();
          links[0].focus();
          return;
        }

        if (e.key === "End") {
          e.preventDefault();
          links[links.length - 1].focus();
        }
      });
    });
  });
})();

window.jorapEscapeHtml = function (str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
