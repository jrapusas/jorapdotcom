window.initOkfViz = function () {
  const bundle = window.BUNDLE;
  const bundleName = window.BUNDLE_NAME;
  const THEME_KEY = "okf-viz-theme";
  const SITE_THEME_KEY = "theme";

  if (!bundle || !bundle.nodes) {
    throw new Error("initOkfViz: window.BUNDLE missing");
  }

  if (typeof cytoscapeFcose !== "undefined") cytoscape.use(cytoscapeFcose);

  document.title = `${bundleName} - OKF Viewer`;
  document.getElementById("bundle-name").textContent = bundleName;

  const graphThemes = {
    light: {
      label: "#0f172a",
      border: "#0f172a",
      edge: "#94a3b8",
      core: "#ffffff",
      textOutline: "#ffffff",
      textBackground: "#ffffff",
    },
    dark: {
      label: "#f1f5f9",
      border: "#f1f5f9",
      edge: "#64748b",
      core: "#1e293b",
      textOutline: "#0f172a",
      textBackground: "#1e293b",
    },
  };

  let cy;

  function systemDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function resolvedTheme(mode) {
    return mode === "auto" ? (systemDark() ? "dark" : "light") : mode;
  }

  function applyTheme(mode) {
    const resolved = resolvedTheme(mode);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    if (cy) applyGraphTheme(resolved);
  }

  function applyGraphTheme(resolved) {
    const t = graphThemes[resolved];
    cy.style().selector("core").style("background-color", t.core).update();
    cy.nodes().style({
      color: t.label,
      "border-color": t.border,
      "text-outline-color": t.textOutline,
      "text-background-color": t.textBackground,
    });
    cy.edges().style({ "line-color": t.edge, "target-arrow-color": t.edge });
  }

  function savedThemeMode() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return stored;
    } catch (_) {}
    try {
      const site = localStorage.getItem(SITE_THEME_KEY);
      if (site === "dark" || site === "light") return site;
    } catch (_) {}
    return "auto";
  }

  const themeSelect = document.getElementById("theme");
  const savedTheme = savedThemeMode();
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);

  themeSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (_) {}
    applyTheme(mode);
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themeSelect.value === "auto") applyTheme("auto");
  });

  const typeSelect = document.getElementById("filter-type");
  for (const t of bundle.types) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  }

  const backlinks = {};
  for (const edge of bundle.edges) {
    const { source, target } = edge.data;
    (backlinks[target] ||= []).push(source);
  }

  const nodeIndex = {};
  for (const n of bundle.nodes) nodeIndex[n.data.id] = n.data;

  const spacingUnit =
    bundle.nodes.reduce(
      (max, n) => Math.max(max, Number(n.data.size) || 30),
      30,
    ) + 120;

  function layoutOpts(name) {
    const unit = spacingUnit;
    const padding = Math.round(unit * 0.5);
    const base = { name, animate: false, padding, fit: true };
    if (name === "random") {
      return { name, animate: false, padding: 30, fit: true };
    }
    if (name === "cose") {
      const repulsion = Math.round(unit * unit * 0.45);
      const edgeLen = unit * 2;
      return {
        ...base,
        randomize: false,
        nodeDimensionsIncludeLabels: true,
        componentSpacing: unit,
        nodeRepulsion: () => repulsion,
        idealEdgeLength: () => edgeLen,
        edgeElasticity: () => edgeLen,
      };
    }
    if (name === "fcose") {
      return {
        ...base,
        quality: "default",
        randomize: true,
        nodeSeparation: unit * 2,
        idealEdgeLength: unit * 2,
        nodeRepulsion: Math.round(unit * unit * 0.45),
        tilingPaddingVertical: Math.round(unit * 0.25),
        tilingPaddingHorizontal: Math.round(unit * 0.25),
      };
    }
    return base;
  }

  const initialGraphTheme = graphThemes[resolvedTheme(savedTheme)];

  cy = cytoscape({
    container: document.getElementById("graph"),
    elements: [...bundle.nodes, ...bundle.edges],
    style: [
      {
        selector: "core",
        style: { "background-color": initialGraphTheme.core },
      },
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "label": "data(label)",
          "color": initialGraphTheme.label,
          "font-size": 12,
          "font-weight": 500,
          "text-outline-color": initialGraphTheme.textOutline,
          "text-outline-width": 2,
          "text-outline-opacity": 1,
          "text-background-color": initialGraphTheme.textBackground,
          "text-background-opacity": 0.92,
          "text-background-padding": "3px",
          "text-background-shape": "roundrectangle",
          "text-valign": "bottom",
          "text-margin-y": 4,
          "text-wrap": "wrap",
          "text-max-width": 120,
          "width": "data(size)",
          "height": "data(size)",
          "border-width": 1,
          "border-color": initialGraphTheme.border,
        },
      },
      {
        selector: "node:selected",
        style: {
          "border-width": 3,
          "border-color": "#f59e0b",
        },
      },
      {
        selector: "edge",
        style: {
          "width": 1.5,
          "line-color": initialGraphTheme.edge,
          "target-arrow-color": initialGraphTheme.edge,
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 0.9,
        },
      },
      {
        selector: "edge:selected",
        style: {
          "line-color": "#f59e0b",
          "target-arrow-color": "#f59e0b",
          "width": 2.5,
        },
      },
      {
        selector: "edge.focus",
        style: {
          "width": 2.5,
          "line-color": "#f59e0b",
          "target-arrow-color": "#f59e0b",
          "z-index": 1,
        },
      },
      {
        selector: "node.focus",
        style: {
          "z-index": 1,
        },
      },
      {
        selector: ".dim",
        style: { "opacity": 0.2 },
      },
      {
        selector: "node.dim",
        style: { "text-opacity": 0.35 },
      },
    ],
    layout: layoutOpts("fcose"),
    wheelSensitivity: 0.2,
  });

  cy.on("tap", "node", (evt) => showDetail(evt.target.id()));
  cy.on("tap", (evt) => {
    if (evt.target === cy) clearSelection();
  });

  function applyCircularGridLayout(padding = Math.round(spacingUnit * 0.5)) {
    const spacing = spacingUnit;
    const nodes = cy.nodes().toArray().sort((a, b) => b.degree() - a.degree());
    let i = 0;
    let ring = 0;
    while (i < nodes.length) {
      const r = ring * spacing * 1.75;
      const cap =
        ring === 0
          ? Math.min(1, nodes.length - i)
          : Math.max(6, Math.round((2 * Math.PI * r) / spacing));
      const count = Math.min(cap, nodes.length - i);
      for (let j = 0; j < count; j++) {
        const node = nodes[i + j];
        if (ring === 0 && count === 1) {
          node.position({ x: 0, y: 0 });
        } else {
          const a = (2 * Math.PI * j) / count - Math.PI / 2;
          node.position({ x: r * Math.cos(a), y: r * Math.sin(a) });
        }
      }
      i += count;
      ring++;
    }
    cy.fit(padding);
  }

  document.getElementById("layout").addEventListener("change", (e) => {
    const name = e.target.value;
    if (name === "circular-grid") {
      applyCircularGridLayout();
      return;
    }
    cy.layout(layoutOpts(name)).run();
  });

  document.getElementById("reset").addEventListener("click", () => {
    cy.fit(null, 30);
    clearSelection();
  });

  function applyGraphDim() {
    const q = document.getElementById("search").value.trim().toLowerCase();
    const type = document.getElementById("filter-type").value;
    const selected = cy.$("node:selected");

    cy.elements().removeClass("dim focus");

    if (selected.nonempty()) {
      selected.closedNeighborhood().addClass("focus");
      cy.elements().not(".focus").addClass("dim");
      return;
    }

    if (q) {
      cy.nodes().forEach((n) => {
        const d = n.data();
        const hay =
          (d.label || "").toLowerCase() + " " +
          d.id.toLowerCase() + " " +
          (d.tags || []).join(" ").toLowerCase();
        n.toggleClass("dim", !hay.includes(q));
      });
      cy.edges().forEach((edge) => {
        const src = edge.source();
        const tgt = edge.target();
        edge.toggleClass("dim", src.hasClass("dim") || tgt.hasClass("dim"));
      });
      return;
    }

    if (type) {
      cy.nodes().forEach((n) => {
        n.toggleClass("dim", n.data("type") !== type);
      });
      cy.edges().forEach((edge) => {
        edge.toggleClass("dim", edge.source().hasClass("dim") || edge.target().hasClass("dim"));
      });
    }
  }

  document.getElementById("search").addEventListener("input", () => applyGraphDim());

  document.getElementById("filter-type").addEventListener("change", () => applyGraphDim());

  function clearSelection() {
    cy.elements().unselect();
    applyGraphDim();
    document.getElementById("detail-empty").hidden = false;
    document.getElementById("detail-content").hidden = true;
  }

  function showDetail(conceptId) {
    const data = nodeIndex[conceptId];
    if (!data) return;
    cy.elements().unselect();
    const node = cy.getElementById(conceptId);
    if (node) node.select();
    applyGraphDim();

    document.getElementById("detail-empty").hidden = true;
    const content = document.getElementById("detail-content");
    content.hidden = false;

    const chip = document.getElementById("detail-type");
    chip.textContent = data.type;
    chip.style.background = data.color;

    document.getElementById("detail-title").textContent = data.label;
    document.getElementById("detail-id").textContent = conceptId;
    document.getElementById("detail-description").textContent = data.description || "-";

    const resourceEl = document.getElementById("detail-resource");
    resourceEl.innerHTML = "";
    if (data.resource) {
      const a = document.createElement("a");
      a.href = data.resource;
      a.textContent = data.resource;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "external";
      resourceEl.appendChild(a);
    } else {
      resourceEl.textContent = "-";
    }

    const tagsEl = document.getElementById("detail-tags");
    tagsEl.innerHTML = "";
    if (data.tags && data.tags.length) {
      for (const t of data.tags) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsEl.appendChild(span);
      }
    } else {
      tagsEl.textContent = "-";
    }

    const body = bundle.bodies[conceptId] || "";
    const html = marked.parse(body, { breaks: false, gfm: true });
    const bodyEl = document.getElementById("detail-body");
    bodyEl.innerHTML = html;
    rewriteInternalLinks(bodyEl);

    const bl = backlinks[conceptId] || [];
    const blSection = document.getElementById("detail-backlinks");
    const blList = document.getElementById("backlinks-list");
    blList.innerHTML = "";
    if (bl.length) {
      blSection.hidden = false;
      for (const src of bl) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = nodeIndex[src]?.label || src;
        a.dataset.target = src;
        a.addEventListener("click", () => showDetail(src));
        li.appendChild(a);
        const muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = ` (${src})`;
        li.appendChild(muted);
        blList.appendChild(li);
      }
    } else {
      blSection.hidden = true;
    }

    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1.0) }, { duration: 200 });
  }

  function rewriteInternalLinks(root) {
    root.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("/") && href.endsWith(".md")) {
        const target = href.slice(1, -3);
        if (nodeIndex[target]) {
          a.className = "internal";
          a.setAttribute("href", "javascript:void(0)");
          a.addEventListener("click", (e) => {
            e.preventDefault();
            showDetail(target);
          });
          return;
        }
      }
      a.className = "external";
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  const initial =
    bundle.nodes.find((n) => n.data.id === "hubs/maps-of-content/index") ||
    bundle.nodes[0];
  if (initial) showDetail(initial.data.id);
};
