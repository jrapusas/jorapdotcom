/**
 * Obsidian Publish-style force-directed note graph (PixiJS WebGL renderer).
 */
import "pixi.js/unsafe-eval";
import "pixi.js";
import { Application, Color, Container, Graphics, Text } from "pixi.js";

var PRESENT_LOCAL_KEY = "jorap.notesGraph.presentLocal";
var LAYOUT_KEY = "jorap.notesGraph.layout";

function markPresentLocalNavigation() {
  try {
    sessionStorage.setItem(PRESENT_LOCAL_KEY, "1");
  } catch (e) {
    /* ignore */
  }
}

function consumePresentLocalNavigation() {
  try {
    if (sessionStorage.getItem(PRESENT_LOCAL_KEY) === "1") {
      sessionStorage.removeItem(PRESENT_LOCAL_KEY);
      return true;
    }
  } catch (e) {
    /* ignore */
  }
  return false;
}

function uiFontFamily() {
  try {
    var value = getComputedStyle(document.documentElement).getPropertyValue("--font-primary");
    if (value && value.trim()) return value.trim();
  } catch (e) {
    /* ignore */
  }
  return "Inter, sans-serif";
}

var MAX_GLOBAL_GRAPH_NODES = 240;
// ponytail: splits crowded hop rings into sub-rings; raise if depth-1 hubs still feel tight
var MAX_RADIAL_NODES_PER_RING = 10;

async function bootGraphs() {
  var panels = document.querySelectorAll("[data-notes-graph]");
  if (!panels.length) return;

  if (typeof IntersectionObserver === "undefined") {
    for (var i = 0; i < panels.length; i++) {
      await initGraph(panels[i]);
    }
    return;
  }

  var observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        initGraph(entry.target).catch(function (err) {
          console.error("[notes-graph] init failed:", err);
        });
      });
    },
    { rootMargin: "200px 0px" },
  );

  for (var j = 0; j < panels.length; j++) {
    observer.observe(panels[j]);
  }
}

async function initGraph(panel) {
  var dataEl = panel.querySelector(".notes-graph-data");
  var container = panel.querySelector(".graph-view") || panel.querySelector(".notes-graph");
  var graphShell = panel.querySelector(".graph-view-container");
  var emptyEl =
    panel.closest(".container, .row, section, article")?.querySelector(".notes-graph-empty") ||
    document.querySelector(".notes-graph-empty");
  var searchEl = panel.querySelector(".notes-graph-search");
  var resetEl = panel.querySelector(".notes-graph-reset");
  var expandEls = panel.querySelectorAll(".graph-expand, .notes-graph-expand");
  var zoomInEl = panel.querySelector(".notes-graph-zoom-in");
  var zoomOutEl = panel.querySelector(".notes-graph-zoom-out");
  var filterEls = panel.querySelectorAll("[data-graph-filter]");
  var colorEls = panel.querySelectorAll("[data-graph-color]");
  var layoutEls = panel.querySelectorAll("[data-graph-layout]");
  if (!dataEl || !container) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  if (!data.nodes || !data.nodes.length) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  var tapSlop = isCoarsePointer ? 12 : 4;
  var isLocalGraph = data.mode === "local";
  var focusId = isLocalGraph ? data.focus || null : null;
  var resumePresentLocal = isLocalGraph && consumePresentLocalNavigation();

  var nodes = data.nodes.map(function (n) {
    return {
      id: n.id,
      title: n.title,
      url: n.url,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
        degree: 0,
      inDegree: n.inDegree || 0,
      outDegree: n.outDegree || 0,
      orphan: Boolean(n.orphan),
      top: Boolean(n.top),
      middle: Boolean(n.middle),
      bottom: Boolean(n.bottom),
      deadEnd: Boolean(n.deadEnd),
      hub: Boolean(n.hub),
      primaryTag: n.primaryTag || "",
      relExtends: Boolean(n.relExtends),
      relContradicts: Boolean(n.relContradicts),
      relImplements: Boolean(n.relImplements),
      relAlternative: Boolean(n.relAlternative),
      relIndex: Boolean(n.relIndex),
      label: null,
    };
  });

  if (!isLocalGraph && nodes.length > MAX_GLOBAL_GRAPH_NODES) {
    var totalNodes = nodes.length;
    var keptIds = Object.create(null);
    var cappedNodes = [];

    function keepNode(n) {
      if (keptIds[n.id]) return;
      keptIds[n.id] = true;
      cappedNodes.push(n);
    }

    // ponytail: rank tails + structural outliers must survive the cap; upgrade: raise cap in notes-graph.js
    nodes.forEach(function (n) {
      if (n.top || n.bottom || n.orphan || n.hub || n.deadEnd) keepNode(n);
    });

    var middlePool = nodes.filter(function (n) {
      return !keptIds[n.id];
    });
    middlePool.sort(function (a, b) {
      return b.inDegree + b.outDegree - (a.inDegree + a.outDegree);
    });

    var slotsLeft = MAX_GLOBAL_GRAPH_NODES - cappedNodes.length;
    for (var capIdx = 0; capIdx < middlePool.length && capIdx < slotsLeft; capIdx++) {
      keepNode(middlePool[capIdx]);
    }

    nodes = cappedNodes;
    var hintEl = panel.closest(".container, section")?.querySelector(".notes-graph-hint");
    if (hintEl) {
      hintEl.textContent =
        "Showing " +
        nodes.length +
        " of " +
        totalNodes +
        " notes (top/bottom tails always included). " +
        hintEl.textContent;
    }
  }

  var nodeById = {};
  nodes.forEach(function (n) {
    nodeById[n.id] = n;
  });

  var focusNode = focusId ? nodeById[focusId] : null;

  var edgeKeys = {};
  var edges = (data.edges || [])
    .map(function (e) {
      var source = nodeById[e.source];
      var target = nodeById[e.target];
      if (!source || !target || source === target) return null;
      var key = source.id < target.id ? source.id + "\0" + target.id : target.id + "\0" + source.id;
      if (edgeKeys[key]) return null;
      edgeKeys[key] = true;
      return { source: source, target: target };
    })
    .filter(Boolean);

  edges.forEach(function (e) {
    e.source.degree += 1;
    e.target.degree += 1;
  });

  var width = 0;
  var height = 0;
  var transform = { x: 0, y: 0, k: 1 };
  var defaultTransform = { x: 0, y: 0, k: 1 };
  var hovered = focusNode || null;
  var searchQuery = "";
  var graphFilter = "all";
  var graphColorMode = "rank";
  var graphLayout = "force";
  try {
    var savedLayout = localStorage.getItem(LAYOUT_KEY);
    if (savedLayout === "radial" || savedLayout === "force") graphLayout = savedLayout;
  } catch (e) {
    /* ignore */
  }
  var tagPalette = ["#2563eb", "#15803d", "#b45309", "#be123c", "#7c3aed", "#0f766e", "#c27803", "#4b5563"];
  var draggingNode = null;
  var dragMoved = false;
  var dragStart = null;
  var panning = false;
  var panStart = null;
  var simAlpha = prefersReducedMotion ? 0 : 1;
  var savedSimAlpha = simAlpha;
  var isPresentMode = false;
  var presentIntroRaf = 0;
  var frame = 0;
  var needsFrame = true;
  var rafId = 0;
  var lastWidth = 0;
  var lastHeight = 0;
  var fullscreenRoot = graphShell || panel;
  var presentHintEl = null;
  var presentHome = null;
  var presentHomeNext = null;
  var activePointers = Object.create(null);
  var pinchState = null;

  function resolveToken(token, fallback) {
    var probe = document.createElement("span");
    probe.style.display = "none";
    probe.style.color = fallback;
    document.body.appendChild(probe);
    probe.style.color = "var(" + token + ")";
    var resolved = window.getComputedStyle(probe).color;
    document.body.removeChild(probe);
    return resolved || fallback;
  }

  function pixiColor(value) {
    return Color.shared.setValue(value).toNumber();
  }

  function readColors() {
    return {
      edge: pixiColor(resolveToken("--color-ink-faint", "#6b6762")),
      edgeActive: pixiColor(resolveToken("--color-ink-muted", "#6b6762")),
      node: pixiColor(resolveToken("--color-ink-faint", "#6b6762")),
      nodeActive: pixiColor(resolveToken("--color-accent", "#181614")),
      nodeHover: pixiColor(resolveToken("--color-ink", "#161412")),
      nodeFocus: pixiColor(resolveToken("--color-accent", "#181614")),
      nodeCenter: pixiColor(resolveToken("--color-graph-center", "#eab308")),
      nodeOrphan: pixiColor(resolveToken("--color-graph-tail", "#dc2626")),
      nodeTop: pixiColor(resolveToken("--color-graph-hub", "#15803d")),
      nodeMiddle: pixiColor(resolveToken("--color-ink-muted", "#6b6762")),
      nodeBottom: pixiColor(resolveToken("--color-graph-tail", "#dc2626")),
      nodeDeadEnd: pixiColor(resolveToken("--color-ink-muted", "#6b6762")),
      surface: pixiColor(resolveToken("--color-surface", "#f5f3f0")),
      label: pixiColor(resolveToken("--color-ink", "#161412")),
      labelDim: pixiColor(resolveToken("--color-ink-muted", "#3d3a37")),
      labelStroke: pixiColor(resolveToken("--color-surface", "#f5f3f0")),
    };
  }

  var colors = readColors();

  function containerSize() {
    if (isPresentMode) {
      var vv = window.visualViewport;
      var presentW = vv ? vv.width : window.innerWidth;
      var presentH = vv ? vv.height : window.innerHeight;
      return {
        width: Math.max(presentW, 1),
        height: Math.max(presentH, 1),
      };
    }

    var rect = container.getBoundingClientRect();
    var w = rect.width || container.clientWidth || 0;
    var h = rect.height || container.clientHeight || 0;
    if (!Number.isFinite(h) || h < 8) {
      h = container.classList.contains("is-expanded")
        ? Math.min(window.innerHeight * 0.78, 768)
        : panel.classList.contains("notes-graph-panel--local")
          ? 250
          : 280;
    }
    if (!Number.isFinite(w) || w < 8) {
      w = 320;
    }
    return { width: Math.max(w, 1), height: Math.max(h, 1) };
  }

  function syncSizeVars() {
    var next = containerSize();
    width = next.width;
    height = next.height;
    return next;
  }

  var size = syncSizeVars();
  lastWidth = width;
  lastHeight = height;

  var app = new Application();
  try {
    await app.init({
      width: Math.max(width, 1),
      height: Math.max(height, 1),
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
    });
  } catch (e) {
    console.error("[notes-graph] Pixi init failed:", e);
    return;
  }

  container.appendChild(app.canvas);
  app.canvas.className = "notes-graph__canvas";
  app.canvas.setAttribute("aria-hidden", "true");

  var canvas = app.canvas;
  var world = new Container();
  var edgesGfx = new Graphics();
  var nodesGfx = new Graphics();
  var labelsLayer = new Container();
  var labelResolution = Math.max(2, window.devicePixelRatio || 1);

  app.stage.addChild(world);
  app.stage.addChild(labelsLayer);
  world.addChild(edgesGfx, nodesGfx);

  nodes.forEach(function (n) {
    var text = new Text({
      text: n.title,
      resolution: labelResolution,
      style: {
        fontFamily: uiFontFamily(),
        fontSize: 12,
        fontWeight: "500",
        fill: colors.label,
        align: "center",
        stroke: { color: colors.labelStroke, width: 4, join: "round" },
      },
    });
    text.anchor.set(0.5, 0);
    text.roundPixels = true;
    labelsLayer.addChild(text);
    n.label = text;
  });

  function labelScreenSize(isFocus) {
    return isFocus ? 13 : 12;
  }

  function labelWorldHeight() {
    return 18 / Math.max(transform.k, 0.18);
  }

  function labelTextColor(isFocus, isHover, dimmed) {
    if (dimmed) return colors.labelDim;
    if (isFocus || isHover) return colors.label;
    return colors.label;
  }

  function labelTextAlpha(isFocus, isHover, dimmed, inHighlight, highlight) {
    if (dimmed) return 0.4;
    if (isFocus || isHover) return 1;
    if (inHighlight && highlight) return 0.98;
    return 0.96;
  }

  function labelOffset(node) {
    return nodeRadius(node) + 4;
  }

  function nodeRadiusBase(node) {
    var links = node.degree || 0;
    var base = 1.5 + Math.sqrt(links) * 1.05;
    return Math.min(14, Math.max(1.5, base));
  }

  function spacingUnit() {
    var maxSize = 3;
    nodes.forEach(function (n) {
      maxSize = Math.max(maxSize, nodeRadiusBase(n) * 2);
    });
    // ponytail: largest node diameter + label column; upgrade: raise if OKF fcose spacing drifts
    return maxSize + 120;
  }

  function nodeRadius(node) {
    var r = nodeRadiusBase(node);
    return focusNode && node === focusNode ? Math.max(r, 3.5) : r;
  }

  function syncCanvasSize() {
    var next = syncSizeVars();
    var sizeChanged = next.width !== lastWidth || next.height !== lastHeight;
    lastWidth = width;
    lastHeight = height;
    app.renderer.resize(width, height);
    needsFrame = true;
    return sizeChanged;
  }

  function relayoutGraph() {
    initPositions();
    if (graphLayout === "radial") {
      simAlpha = 0;
      needsFrame = true;
      return;
    }
    settleLayout();
    needsFrame = true;
  }

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  function settleLayout() {
    simAlpha = 1;
    var iterations = prefersReducedMotion ? 400 : 320;
    for (var i = 0; i < iterations; i++) {
      simulate(true);
    }
    simAlpha = prefersReducedMotion ? 0 : 0.22;
  }

  function settlePresentLayout() {
    simAlpha = 1;
    var iterations = prefersReducedMotion ? 360 : 520;
    for (var i = 0; i < iterations; i++) {
      simulate(true);
    }
    simAlpha = 0;
  }

  function animatePresentIntro() {
    if (prefersReducedMotion) {
      transform.x = defaultTransform.x;
      transform.y = defaultTransform.y;
      transform.k = defaultTransform.k;
      return;
    }

    var cx = width / 2;
    var cy = height / 2;
    var worldX = (cx - defaultTransform.x) / defaultTransform.k;
    var worldY = (cy - defaultTransform.y) / defaultTransform.k;
    var fromK = defaultTransform.k * 0.76;
    var from = {
      k: fromK,
      x: cx - worldX * fromK,
      y: cy - worldY * fromK,
    };
    transform.x = from.x;
    transform.y = from.y;
    transform.k = from.k;

    var t0 = performance.now();
    var duration = 850;

    function step(now) {
      if (!isPresentMode) {
        presentIntroRaf = 0;
        return;
      }
      var t = Math.min(1, (now - t0) / duration);
      var ease = 1 - Math.pow(1 - t, 3);
      transform.k = from.k + (defaultTransform.k - from.k) * ease;
      transform.x = from.x + (defaultTransform.x - from.x) * ease;
      transform.y = from.y + (defaultTransform.y - from.y) * ease;
      draw();
      if (t < 1) {
        presentIntroRaf = window.requestAnimationFrame(step);
      } else {
        presentIntroRaf = 0;
        transform.x = defaultTransform.x;
        transform.y = defaultTransform.y;
        transform.k = defaultTransform.k;
        draw();
      }
    }

    presentIntroRaf = window.requestAnimationFrame(step);
  }

  function updatePresentUi() {
    expandEls.forEach(function (el) {
      el.setAttribute("aria-pressed", isPresentMode ? "true" : "false");
      el.title = isPresentMode ? "Exit present mode" : "Present graph";
      el.setAttribute("aria-label", el.title);
    });
  }

  function attachPresentRoot() {
    if (!presentHome) {
      presentHome = fullscreenRoot.parentNode;
      presentHomeNext = fullscreenRoot.nextSibling;
    }
    if (fullscreenRoot.parentNode !== document.body) {
      document.body.appendChild(fullscreenRoot);
    }
  }

  function detachPresentRoot() {
    if (presentHome && fullscreenRoot.parentNode === document.body) {
      presentHome.insertBefore(fullscreenRoot, presentHomeNext);
    }
  }

  function resetGraphView(inPresent) {
    if (searchEl) searchEl.value = "";
    searchQuery = "";
    hovered = focusNode || null;
    initPositions();
    if (graphLayout === "radial") {
      simAlpha = 0;
    } else if (inPresent) {
      settlePresentLayout();
    } else {
      settleLayout();
      simAlpha = prefersReducedMotion ? 0 : 0.85;
    }
    fitToView();
    if (inPresent) animatePresentIntro();
  }

  function refocusLocalGraph() {
    hovered = focusNode || null;
    initPositions();
    if (graphLayout === "radial") {
      simAlpha = 0;
    } else {
      settleLayout();
      simAlpha = prefersReducedMotion ? 0 : 0.22;
    }
    fitToView();
  }

  function setPresentMode(on) {
    if (on === isPresentMode) return;

    if (presentIntroRaf) {
      window.cancelAnimationFrame(presentIntroRaf);
      presentIntroRaf = 0;
    }

    isPresentMode = on;

    if (on) {
      savedSimAlpha = simAlpha;
      container.classList.remove("is-expanded");
      if (graphShell) graphShell.classList.remove("is-expanded");
      attachPresentRoot();
      fullscreenRoot.classList.add("is-present", "graph-icons-top");
      container.classList.add("is-present");

      if (!presentHintEl) {
        presentHintEl = document.createElement("p");
        presentHintEl.className = "graph-present-hint";
        presentHintEl.textContent = "Escape to exit present mode";
        fullscreenRoot.appendChild(presentHintEl);
      }
      presentHintEl.hidden = false;
      document.body.classList.add("notes-graph-present-open");

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          syncCanvasSize();
          initPositions();
          settlePresentLayout();
          fitToView();
          animatePresentIntro();
          draw();
          wake();
        });
      });
    } else {
      fullscreenRoot.classList.remove("is-present");
      container.classList.remove("is-present");
      if (graphShell) graphShell.classList.add("graph-icons-top");
      detachPresentRoot();
      document.body.classList.remove("notes-graph-present-open");
      if (presentHintEl) presentHintEl.hidden = true;
      simAlpha = prefersReducedMotion ? 0 : savedSimAlpha || 0.22;

      window.requestAnimationFrame(function () {
        syncCanvasSize();
        if (!isLocalGraph) {
          resetGraphView(false);
        } else {
          refocusLocalGraph();
        }
        draw();
        wake();
      });
    }

    updatePresentUi();
  }

  function initRadialPositions() {
    var cx = width / 2;
    var cy = height / 2;
    var unit = spacingUnit();
    var root = focusNode;
    if (!root) {
      nodes.forEach(function (n) {
        if (!root || n.inDegree + n.outDegree > root.inDegree + root.outDegree) root = n;
      });
    }
    if (!root && nodes.length) root = nodes[0];
    if (!root) return;

    nodes.forEach(function (n) {
      n.isCenter = false;
    });

    var depth = Object.create(null);
    var queue = [root];
    depth[root.id] = 0;
    var head = 0;
    while (head < queue.length) {
      var cur = queue[head++];
      var d = depth[cur.id];
      edges.forEach(function (e) {
        var other = e.source === cur ? e.target : e.target === cur ? e.source : null;
        if (!other || depth[other.id] !== undefined) return;
        depth[other.id] = d + 1;
        queue.push(other);
      });
    }

    var rings = Object.create(null);
    var maxDepth = 0;
    var disconnected = [];
    nodes.forEach(function (n) {
      var d = depth[n.id];
      if (d === undefined) {
        disconnected.push(n);
        return;
      }
      maxDepth = Math.max(maxDepth, d);
      if (!rings[d]) rings[d] = [];
      rings[d].push(n);
    });

    nodes.forEach(function (n) {
      n.vx = 0;
      n.vy = 0;
    });

    root.x = cx;
    root.y = cy;
    root.isCenter = true;

    var ringGap = unit * 1.35;
    var outerLayoutRadius = 0;

    for (var ringDepth = 1; ringDepth <= maxDepth; ringDepth++) {
      var ring = (rings[ringDepth] || []).slice();
      ring.sort(function (a, b) {
        return (a.title || "").localeCompare(b.title || "");
      });
      var numSubRings = Math.max(1, Math.ceil(ring.length / MAX_RADIAL_NODES_PER_RING));
      for (var sub = 0; sub < numSubRings; sub++) {
        var start = sub * MAX_RADIAL_NODES_PER_RING;
        var chunk = ring.slice(start, start + MAX_RADIAL_NODES_PER_RING);
        var radius = (ringDepth - 1 + (sub + 1) / numSubRings) * ringGap;
        outerLayoutRadius = Math.max(outerLayoutRadius, radius);
        chunk.forEach(function (n, i) {
          var angle = (2 * Math.PI * i) / Math.max(chunk.length, 1) - Math.PI / 2;
          n.x = cx + Math.cos(angle) * radius;
          n.y = cy + Math.sin(angle) * radius;
        });
      }
    }

    if (disconnected.length) {
      var outer = (outerLayoutRadius || ringGap) + ringGap;
      disconnected.forEach(function (n, i) {
        var angle = (2 * Math.PI * i) / Math.max(disconnected.length, 1);
        n.x = cx + Math.cos(angle) * outer;
        n.y = cy + Math.sin(angle) * outer;
      });
    }
  }

  function initPositions() {
    if (graphLayout === "radial") {
      initRadialPositions();
      return;
    }

    var unit = spacingUnit();
    var pad = Math.round(unit * 0.5);
    var w = Math.max(width - pad * 2, 1);
    var h = Math.max(height - pad * 2, 1);

    nodes.forEach(function (n) {
      n.x = pad + hashSeed(n.id + ":x") * w;
      n.y = pad + hashSeed(n.id + ":y") * h;
      n.vx = 0;
      n.vy = 0;
      n.isCenter = false;
    });
  }

  function screenToWorld(x, y) {
    return {
      x: (x - transform.x) / transform.k,
      y: (y - transform.y) / transform.k,
    };
  }

  function worldToScreen(x, y) {
    return {
      x: x * transform.k + transform.x,
      y: y * transform.k + transform.y,
    };
  }

  function viewNodes() {
    var visible;
    if (typeFilterActive() || !focusNode) {
      visible = nodes;
    } else {
      var set = neighborsOf(focusNode);
      visible = nodes.filter(function (n) {
        return set[n.id];
      });
    }
    if (graphFilter === "all") return visible;
    return visible.filter(passesFilter);
  }

  function fitToView() {
    var visible = viewNodes();
    if (!visible.length || !width || !height) return;

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    visible.forEach(function (n) {
      var r = nodeRadius(n) + 10;
      var labelH = labelWorldHeight();
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r + labelH);
    });

    var useFocusCenter = focusNode && !typeFilterActive() && !isPresentMode;
    var pad = isPresentMode ? 72 : useFocusCenter ? 44 : 56;
    var graphW = Math.max(maxX - minX, 1);
    var graphH = Math.max(maxY - minY, 1);
    var kFit = Math.min((width - pad * 2) / graphW, (height - pad * 2) / graphH, useFocusCenter ? 2 : 1.8);
    var k = isPresentMode ? Math.max(kFit, 0.25) : Math.max(kFit, 0.25) * 2;

      var cx = useFocusCenter ? focusNode.x : (minX + maxX) / 2;
      var cy = useFocusCenter ? focusNode.y : (minY + maxY) / 2;

      if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(graphW) || !Number.isFinite(graphH)) {
        return;
      }

      defaultTransform = {
      k: k,
      x: width / 2 - cx * k,
      y: height / 2 - cy * k,
    };

    transform = {
      x: defaultTransform.x,
      y: defaultTransform.y,
      k: defaultTransform.k,
    };
    needsFrame = true;
  }

  function neighborsOf(node) {
    var set = Object.create(null);
    set[node.id] = true;
    edges.forEach(function (e) {
      if (e.source === node) set[e.target.id] = true;
      if (e.target === node) set[e.source.id] = true;
    });
    return set;
  }

  function matchesSearch(node) {
    if (!searchQuery) return true;
    return node.title.toLowerCase().indexOf(searchQuery) !== -1;
  }

  function tagColor(tag) {
    if (!tag) return colors.node;
    var h = 0;
    for (var i = 0; i < tag.length; i += 1) {
      h = (h * 31 + tag.charCodeAt(i)) >>> 0;
    }
    return pixiColor(tagPalette[h % tagPalette.length]);
  }

  function passesFilter(node) {
    if (graphFilter === "all") return true;
    if (graphFilter === "orphan") return node.orphan;
    if (graphFilter === "top") return node.top;
    if (graphFilter === "middle") return node.middle;
    if (graphFilter === "bottom") return node.bottom;
    if (graphFilter === "deadEnd") return node.deadEnd;
    if (graphFilter === "hub") return node.hub;
    if (graphFilter === "relExtends") return node.relExtends;
    if (graphFilter === "relContradicts") return node.relContradicts;
    if (graphFilter === "relImplements") return node.relImplements;
    if (graphFilter === "relAlternative") return node.relAlternative;
    if (graphFilter === "relIndex") return node.relIndex;
    return true;
  }

  function typeFilterActive() {
    return graphFilter !== "all";
  }

  function nodeFill(node, isFocus, isHover, inHighlight, highlight) {
    if (graphColorMode === "tag") {
      if (isFocus) return colors.nodeFocus;
      if (isHover) return colors.nodeHover;
      return tagColor(node.primaryTag);
    }
    if (isFocus || node.isCenter) return colors.nodeCenter;
    if (node.orphan && (graphFilter === "all" || graphFilter === "orphan")) return colors.nodeOrphan;
    if (node.top && (graphFilter === "all" || graphFilter === "top")) return colors.nodeTop;
    if (node.bottom && (graphFilter === "all" || graphFilter === "bottom")) return colors.nodeBottom;
    if (node.middle && (graphFilter === "all" || graphFilter === "middle")) return colors.nodeMiddle;
    if (node.deadEnd && (graphFilter === "all" || graphFilter === "deadEnd")) return colors.nodeDeadEnd;
    if (isHover) return colors.nodeHover;
    if (inHighlight && highlight) return colors.nodeActive;
    return colors.node;
  }

  function hitTest(worldPos) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      if (typeFilterActive() && !passesFilter(n)) continue;
      var r = nodeRadius(n) + 5;
      var dx = worldPos.x - n.x;
      var dy = worldPos.y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  function simulate(settling) {
    if (graphLayout === "radial") return false;
    var alpha = settling ? 1 : simAlpha;
    if (alpha <= 0.002) return false;

    var unit = spacingUnit();
    var linkDistance = unit * 2;
    var linkStrength = 0.16 * alpha;
    var repulsion =
      (unit * unit * 0.45 * alpha) / Math.max(1, Math.sqrt(nodes.length / 24));
    var centerStrength = 0.014 * alpha;
    var cx = width / 2;
    var cy = height / 2;

    edges.forEach(function (e) {
      var dx = e.target.x - e.source.x;
      var dy = e.target.y - e.source.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var force = ((dist - linkDistance) / dist) * linkStrength;
      var fx = dx * force;
      var fy = dy * force;
      if (e.source !== draggingNode) {
        e.source.vx += fx;
        e.source.vy += fy;
      }
      if (e.target !== draggingNode) {
        e.target.vx -= fx;
        e.target.vy -= fy;
      }
    });

    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i];
        var b = nodes[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var minDist = nodeRadius(a) + nodeRadius(b) + unit;
        var repel = repulsion / (dist * dist);
        if (dist < minDist) {
          repel += ((minDist - dist) / dist) * 0.65 * alpha;
        }
        var fx = (dx / dist) * repel;
        var fy = (dy / dist) * repel;
        if (a !== draggingNode) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b !== draggingNode) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

      nodes.forEach(function (n) {
        if (n === draggingNode) return;
        n.vx += (cx - n.x) * centerStrength;
        n.vy += (cy - n.y) * centerStrength;
        n.vx *= 0.84;
        n.vy *= 0.84;
        var speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        var maxSpeed = 24;
        if (speed > maxSpeed) {
          n.vx = (n.vx / speed) * maxSpeed;
          n.vy = (n.vy / speed) * maxSpeed;
        }
        n.x += n.vx;
        n.y += n.vy;
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
          n.x = width / 2;
          n.y = height / 2;
          n.vx = 0;
          n.vy = 0;
        }
      });

    if (!settling) {
      simAlpha *= prefersReducedMotion ? 0 : 0.988;
    }
    return true;
  }

  function updateLabelStyle(label, textColor, isFocus, alpha) {
    var size = labelScreenSize(isFocus);
    if (label.style.fontSize !== size) {
      label.style.fontSize = size;
    }
    label.style.fontWeight = isFocus ? "600" : "500";
    label.style.fill = textColor;
    label.style.stroke = { color: colors.labelStroke, width: 4, join: "round" };
    label.alpha = alpha;
    label.resolution = labelResolution;
  }

  function draw() {
    world.position.set(transform.x, transform.y);
    world.scale.set(transform.k);

    var highlight = hovered
      ? neighborsOf(hovered)
      : typeFilterActive() || !focusNode
        ? null
        : neighborsOf(focusNode);
    var hasFilter = Boolean(searchQuery);

    edgesGfx.clear();
    edges.forEach(function (e) {
      if (typeFilterActive() && (!passesFilter(e.source) || !passesFilter(e.target))) return;
      var active = highlight && highlight[e.source.id] && highlight[e.target.id];
      var visible =
        !hasFilter || (matchesSearch(e.source) && matchesSearch(e.target)) || active;
      var dimmed = (highlight && !active) || (hasFilter && !visible);

      edgesGfx
        .moveTo(e.source.x, e.source.y)
        .lineTo(e.target.x, e.target.y)
        .stroke({
          width: (active ? 1.2 : 0.85) / transform.k,
          color: active ? colors.edgeActive : colors.edge,
          alpha: dimmed ? 0.05 : active ? 0.55 : 0.2,
        });
    });

    nodesGfx.clear();
    nodes.forEach(function (n) {
      if (typeFilterActive() && !passesFilter(n)) {
        n.label.visible = false;
        return;
      }

      var r = nodeRadius(n);
      var isFocus = !typeFilterActive() && focusNode && n === focusNode;
      var isCenterNode = graphColorMode === "rank" && (isFocus || n.isCenter);
      var isHover = hovered === n;
      var inHighlight = !highlight || highlight[n.id];
      var matches = matchesSearch(n);
      var dimmed = (highlight && !inHighlight) || (hasFilter && !matches && !isHover);
      var fillColor = nodeFill(n, isFocus, isHover, inHighlight, highlight);
      var nodeAlpha = dimmed ? 0.08 : isFocus || n.isCenter ? 1 : isHover ? 1 : inHighlight && highlight ? 0.95 : 0.65;

      if (isFocus || n.isCenter) {
        var haloColor = graphColorMode === "rank" ? colors.nodeCenter : colors.nodeFocus;
        nodesGfx.circle(n.x, n.y, r + 8).fill({ color: haloColor, alpha: 0.12 });
      }

      nodesGfx.circle(n.x, n.y, r).fill({ color: fillColor, alpha: nodeAlpha });

      if (isFocus || isHover || n.isCenter) {
        var strokeColor =
          graphColorMode === "rank" && (isFocus || n.isCenter) ? colors.nodeCenter : colors.nodeActive;
        nodesGfx.circle(n.x, n.y, r).stroke({
          width: (isFocus || n.isCenter ? 1.6 : 1.25) / transform.k,
          color: strokeColor,
          alpha: 0.95,
        });
      }

      n.label.visible = true;
      var labelPos = worldToScreen(n.x, n.y + labelOffset(n));
      n.label.position.set(labelPos.x, labelPos.y);
      updateLabelStyle(
        n.label,
        labelTextColor(isFocus, isHover, dimmed),
        isFocus,
        labelTextAlpha(isFocus, isHover, dimmed, inHighlight, highlight),
      );
    });

    app.render();
  }

  function setHovered(node) {
    hovered = node;
    container.classList.toggle("notes-graph--hover", Boolean(node));
    wake();
  }

  function zoomAt(factor, clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var cx = typeof clientX === "number" ? clientX - rect.left : width / 2;
    var cy = typeof clientY === "number" ? clientY - rect.top : height / 2;
    var worldBefore = screenToWorld(cx, cy);
    var nextK = Math.min(7, Math.max(0.18, transform.k * factor));
    transform.k = nextK;
    transform.x = cx - worldBefore.x * nextK;
    transform.y = cy - worldBefore.y * nextK;
    wake();
  }

  function activePointerCount() {
    var count = 0;
    for (var id in activePointers) {
      if (Object.prototype.hasOwnProperty.call(activePointers, id)) count += 1;
    }
    return count;
  }

  function trackPointer(evt) {
    activePointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
  }

  function untrackPointer(evt) {
    delete activePointers[evt.pointerId];
  }

  function pointerMidpointCanvas() {
    var rect = canvas.getBoundingClientRect();
    var pts = [];
    for (var id in activePointers) {
      if (Object.prototype.hasOwnProperty.call(activePointers, id)) {
        pts.push(activePointers[id]);
      }
    }
    if (pts.length < 2) return null;
    return {
      x: (pts[0].x + pts[1].x) / 2 - rect.left,
      y: (pts[0].y + pts[1].y) / 2 - rect.top,
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    };
  }

  function releaseAllCapture() {
    if (typeof canvas.releasePointerCapture !== "function") return;
    for (var id in activePointers) {
      if (!Object.prototype.hasOwnProperty.call(activePointers, id)) continue;
      try {
        if (canvas.hasPointerCapture(Number(id))) {
          canvas.releasePointerCapture(Number(id));
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  function beginPinch() {
    var mid = pointerMidpointCanvas();
    if (!mid || mid.dist < 8) return;
    var worldBefore = screenToWorld(mid.x, mid.y);
    pinchState = {
      startDist: mid.dist,
      startK: transform.k,
      worldX: worldBefore.x,
      worldY: worldBefore.y,
      midX: mid.x,
      midY: mid.y,
    };
    panning = false;
    panStart = null;
    draggingNode = null;
    dragMoved = true;
    releaseAllCapture();
  }

  function updatePinch() {
    if (!pinchState) return;
    var mid = pointerMidpointCanvas();
    if (!mid) return;
    var scale = mid.dist / pinchState.startDist;
    var nextK = Math.min(7, Math.max(0.18, pinchState.startK * scale));
    transform.k = nextK;
    transform.x = pinchState.midX - pinchState.worldX * nextK;
    transform.y = pinchState.midY - pinchState.worldY * nextK;
    wake();
  }

  function endPinchIfNeeded() {
    if (activePointerCount() < 2) pinchState = null;
  }

  canvas.addEventListener("pointermove", function (evt) {
    if (activePointers[evt.pointerId]) {
      activePointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
    }
    if (pinchState && activePointerCount() >= 2) {
      updatePinch();
      return;
    }

    var pos = pointerPos(evt);
    if (panning && panStart) {
      transform.x = panStart.transformX + (pos.x - panStart.x);
      transform.y = panStart.transformY + (pos.y - panStart.y);
      if (
        Math.abs(pos.x - panStart.x) > tapSlop ||
        Math.abs(pos.y - panStart.y) > tapSlop
      ) {
        dragMoved = true;
      }
      wake();
      return;
    }
    if (draggingNode) {
      var world = screenToWorld(pos.x, pos.y);
      if (
        dragStart &&
        (Math.abs(world.x - dragStart.x) > tapSlop || Math.abs(world.y - dragStart.y) > tapSlop)
      ) {
        dragMoved = true;
      }
      draggingNode.x = world.x;
      draggingNode.y = world.y;
      draggingNode.vx = 0;
      draggingNode.vy = 0;
      simAlpha = Math.max(simAlpha, 0.3);
      wake();
      return;
    }
    var world = screenToWorld(pos.x, pos.y);
    setHovered(hitTest(world));
  });

  canvas.addEventListener("pointerdown", function (evt) {
    trackPointer(evt);
    if (activePointerCount() >= 2) {
      beginPinch();
      evt.preventDefault();
      return;
    }

    var pos = pointerPos(evt);
    var world = screenToWorld(pos.x, pos.y);
    var node = hitTest(world);
    if (node && node !== focusNode) {
      draggingNode = node;
      dragMoved = false;
      dragStart = { x: world.x, y: world.y };
      simAlpha = Math.max(simAlpha, 0.35);
      canvas.setPointerCapture(evt.pointerId);
      setHovered(node);
      return;
    }
    panning = true;
    dragMoved = false;
    panStart = { x: pos.x, y: pos.y, transformX: transform.x, transformY: transform.y };
    canvas.setPointerCapture(evt.pointerId);
    setHovered(focusNode || null);
    wake();
  });

  function endPointer(evt) {
    releaseCanvasCapture(evt);
    if (pinchState || activePointerCount() > 0) return;
    if (draggingNode && !panning && !dragMoved) {
      var pos = pointerPos(evt);
      var world = screenToWorld(pos.x, pos.y);
      var node = hitTest(world);
      if (node && node.url && node !== focusNode) {
        if (evt.metaKey || evt.ctrlKey) {
          window.open(node.url, "_blank", "noopener");
        } else if (isPresentMode) {
          markPresentLocalNavigation();
          window.location.href = node.url;
        } else {
          window.location.href = node.url;
        }
      }
    }
    draggingNode = null;
    dragMoved = false;
    dragStart = null;
    panning = false;
    panStart = null;
    wake();
  }

  function cancelPointer(evt) {
    untrackPointer(evt);
    endPinchIfNeeded();
    releaseCanvasCapture(evt);
    if (activePointerCount() > 0) return;
    draggingNode = null;
    dragMoved = false;
    dragStart = null;
    panning = false;
    panStart = null;
    wake();
  }

  canvas.addEventListener("pointerup", function (evt) {
    untrackPointer(evt);
    endPinchIfNeeded();
    if (pinchState || activePointerCount() > 0) return;
    endPointer(evt);
  });
  canvas.addEventListener("pointercancel", cancelPointer);

  canvas.addEventListener(
    "wheel",
    function (evt) {
      evt.preventDefault();
      zoomAt(evt.deltaY < 0 ? 1.1 : 1 / 1.1, evt.clientX, evt.clientY);
    },
    { passive: false },
  );

  canvas.addEventListener("pointerleave", function () {
    if (!draggingNode && !panning) setHovered(focusNode || null);
  });

  if (searchEl) {
    searchEl.addEventListener("input", function () {
      searchQuery = searchEl.value.trim().toLowerCase();
      if (searchQuery) {
        var match = null;
        for (var i = 0; i < nodes.length; i++) {
          if (matchesSearch(nodes[i])) {
            match = nodes[i];
            break;
          }
        }
        if (match) {
          hovered = match;
          var screen = worldToScreen(match.x, match.y);
          transform.x += width / 2 - screen.x;
          transform.y += height / 2 - screen.y;
        }
      } else {
        hovered = focusNode || null;
      }
      wake();
    });
  }

  var bindTap =
    window.jorapBindTouchClick ||
    function (el, fn) {
      el.addEventListener("click", fn);
    };

  function bindGraphControl(el, fn) {
    if (!el || typeof fn !== "function") return;
    el.addEventListener("pointerdown", function (evt) {
      evt.stopPropagation();
    });
    bindTap(el, fn);
  }

  if (resetEl) {
    bindGraphControl(resetEl, function () {
      resetGraphView(isPresentMode);
      wake();
    });
  }

  if (zoomInEl) {
    bindGraphControl(zoomInEl, function () {
      zoomAt(1.15);
    });
  }

  if (zoomOutEl) {
    bindGraphControl(zoomOutEl, function () {
      zoomAt(1 / 1.15);
    });
  }

  if (expandEls.length) {
    updatePresentUi();
    expandEls.forEach(function (el) {
      bindGraphControl(el, function () {
        setPresentMode(!isPresentMode);
      });
    });
  }

  panel.querySelectorAll(".graph-global").forEach(function (el) {
    el.addEventListener("pointerdown", function (evt) {
      evt.stopPropagation();
    });
  });

  document.addEventListener("keydown", function onPresentKey(evt) {
    if (evt.key !== "Escape" || !isPresentMode) return;
    evt.preventDefault();
    setPresentMode(false);
  });

  function applyGraphFilter(value, activeBtn) {
    graphFilter = value || "all";
    filterEls.forEach(function (el) {
      var active = el === activeBtn;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var relationshipsDetails = panel.querySelector(".notes-graph-relationships");
    if (relationshipsDetails && /^rel/.test(graphFilter)) {
      relationshipsDetails.open = true;
    }
    hovered = graphFilter === "all" ? focusNode || null : null;
    fitToView();
    draw();
    wake();
  }

  function releaseCanvasCapture(evt) {
    if (!evt || typeof canvas.hasPointerCapture !== "function") return;
    try {
      if (canvas.hasPointerCapture(evt.pointerId)) {
        canvas.releasePointerCapture(evt.pointerId);
      }
    } catch (e) {
      /* ignore */
    }
  }

  if (filterEls.length) {
    filterEls.forEach(function (btn) {
      var value = btn.getAttribute("data-graph-filter") || "all";
      bindGraphControl(btn, function () {
        applyGraphFilter(value, btn);
      });
    });
  }

  function applyLayoutMode(mode, activeBtn) {
    graphLayout = mode === "radial" ? "radial" : "force";
    try {
      localStorage.setItem(LAYOUT_KEY, graphLayout);
    } catch (e) {
      /* ignore */
    }
    layoutEls.forEach(function (el) {
      var active = el === activeBtn;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    relayoutGraph();
    fitToView();
    draw();
    wake();
  }

  function syncLayoutButtons() {
    if (!layoutEls.length) return;
    layoutEls.forEach(function (btn) {
      var mode = btn.getAttribute("data-graph-layout") || "force";
      var active = mode === graphLayout;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (layoutEls.length) {
    syncLayoutButtons();
    layoutEls.forEach(function (btn) {
      var mode = btn.getAttribute("data-graph-layout") || "force";
      bindGraphControl(btn, function () {
        applyLayoutMode(mode, btn);
      });
    });
  }

  if (colorEls.length) {
    colorEls.forEach(function (btn) {
      bindGraphControl(btn, function () {
        graphColorMode = btn.getAttribute("data-graph-color") || "rank";
        colorEls.forEach(function (el) {
          var active = el === btn;
          el.classList.toggle("btn-primary", active);
          el.classList.toggle("btn-outline-primary", !active);
          el.setAttribute("aria-pressed", active ? "true" : "false");
        });
        draw();
        wake();
      });
    });
  }

  function wake() {
    needsFrame = true;
    if (!rafId) {
      rafId = window.requestAnimationFrame(loop);
    }
  }

  function loop() {
    rafId = 0;
    var simulating = !prefersReducedMotion && simulate();
    if (needsFrame || simulating || draggingNode || panning || (hovered && hovered !== focusNode)) {
      draw();
      needsFrame = false;
      frame += 1;
      rafId = window.requestAnimationFrame(loop);
    }
  }

  function pointerPos(evt) {
    var rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function boot() {
    colors = readColors();
    syncCanvasSize();
    relayoutGraph();
    fitToView();
    draw();
    frame = 1;
    wake();
  }

  function bootWhenReady() {
    syncCanvasSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
      requestAnimationFrame(bootWhenReady);
      return;
    }
    if (!isLocalGraph) {
      colors = readColors();
      syncCanvasSize();
      setPresentMode(true);
      return;
    }
    if (resumePresentLocal) {
      colors = readColors();
      syncCanvasSize();
      setPresentMode(true);
      resumePresentLocal = false;
      return;
    }
    boot();
  }

  bootWhenReady();
  if (isLocalGraph) {
    requestAnimationFrame(function () {
      if (isPresentMode) return;
      if (syncCanvasSize()) {
        relayoutGraph();
        fitToView();
        draw();
        wake();
      }
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    var resizeObserver = new ResizeObserver(function () {
      syncCanvasSize();
      if (!isPresentMode) fitToView();
      draw();
      wake();
    });
    resizeObserver.observe(container);
  }

  window.addEventListener("resize", function () {
    if (!isPresentMode) return;
    syncCanvasSize();
    fitToView();
    draw();
    wake();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      if (!isPresentMode) return;
      syncCanvasSize();
      fitToView();
      draw();
      wake();
    });
  }

  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", function () {
      syncCanvasSize();
      fitToView();
      draw();
      wake();
    });
  }

  if (typeof MutationObserver !== "undefined") {
    var themeObserver = new MutationObserver(function () {
      colors = readColors();
      draw();
      wake();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
}

bootGraphs().catch(function (err) {
  console.error("[notes-graph] boot failed:", err);
});
