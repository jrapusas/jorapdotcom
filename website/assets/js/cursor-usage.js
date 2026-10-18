/**
 * Cursor spending forecast (/projects/cursor-spending-forecast/)
 */
(function () {
  var root = document.querySelector("[data-cursor-usage]");
  if (!root) return;

  var STORAGE_KEY = "jorap-cursor-usage";

  var form = document.getElementById("cursor-usage-form");
  var resetDateEl = document.getElementById("resetDate");
  var cursorPctEl = document.getElementById("cursorPct");
  var otherPctEl = document.getElementById("otherPct");
  var resultsEl = document.getElementById("results");
  var summaryOutEl = document.getElementById("summaryOut");
  var cursorOutEl = document.getElementById("cursorOut");
  var otherOutEl = document.getElementById("otherOut");
  var warnEl = document.getElementById("warn");
  var templateNoteEl = document.getElementById("templateNote");
  var resetDaysLeftEl = document.getElementById("resetDaysLeft");
  var savedNoteEl = document.getElementById("savedNote");
  var lastUpdatedEl = document.getElementById("lastUpdated");
  var lastUpdatedTimeEl = document.getElementById("lastUpdatedTime");
  var copyBtn = document.getElementById("copySummary");
  var copyToastEl = document.getElementById("copyToast");

  if (!form || !resetDateEl || !cursorPctEl || !otherPctEl) return;

  var state = {
    lastSummary: "",
    cycle: null,
    templateNotice: null,
  };

  function monthlyFieldsReady() {
    return (
      !!resetDateEl.value &&
      cursorPctEl.value !== "" &&
      otherPctEl.value !== ""
    );
  }

  function grokFieldsReady() {
    var grokResetDateEl = document.getElementById("grokResetDate");
    var grokPctEl = document.getElementById("grokPct");
    return (
      grokResetDateEl &&
      grokPctEl &&
      !!grokResetDateEl.value &&
      grokPctEl.value !== ""
    );
  }

  function showTemplateNotice(kind) {
    state.templateNotice = kind || null;
    if (!templateNoteEl) return;
    if (!kind) {
      templateNoteEl.hidden = true;
      templateNoteEl.textContent = "";
      templateNoteEl.removeAttribute("data-tpl");
      return;
    }
    templateNoteEl.setAttribute("data-tpl", kind);
    if (kind === "changed") {
      templateNoteEl.textContent =
        "Cursor’s spending page layout may have changed. The bookmarklet could not read every field. Type them by hand.";
    } else if (kind === "grok") {
      templateNoteEl.textContent =
        "Grok Bot was not found on the spending page (layout may have changed). Enter weekly usage and reset by hand.";
    }
    templateNoteEl.hidden = false;
  }

  function maybeDismissTemplateNotice() {
    if (state.templateNotice === "changed" && monthlyFieldsReady()) {
      showTemplateNotice(null);
    } else if (state.templateNotice === "grok" && grokFieldsReady()) {
      showTemplateNotice(null);
    }
  }

  function formatDaysLeft(resetDateIso) {
    var diff = daysBetween(todayIso(), resetDateIso);
    if (diff < 0) return "Reset date passed";
    var left = diff + 1;
    return left + (left === 1 ? " day left" : " days left");
  }

  function updateResetDaysLeft(el, resetDateIso) {
    if (!el) return;
    if (!resetDateIso) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = formatDaysLeft(resetDateIso);
    el.hidden = false;
  }

  function parseDate(iso) {
    var parts = iso.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toIso(d) {
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function daysBetween(start, end) {
    var ms = parseDate(end).getTime() - parseDate(start).getTime();
    return Math.round(ms / 86400000);
  }

  function addDays(iso, n) {
    var d = parseDate(iso);
    d.setDate(d.getDate() + n);
    return toIso(d);
  }

  function addMonths(iso, months) {
    var d = parseDate(iso);
    return toIso(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
  }

  function todayIso() {
    return toIso(new Date());
  }

  function formatShort(iso) {
    return parseDate(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function round(n) {
    return Math.round(Number(n) || 0);
  }

  function formatRate(n) {
    var v = Math.round(Number(n) * 10) / 10;
    return (v % 1 === 0 ? String(v) : v.toFixed(1)) + "%";
  }

  function clampPct(value) {
    return Math.min(100, Math.max(0, round(value)));
  }

  function normalizePctInputs() {
    if (cursorPctEl.value !== "") {
      cursorPctEl.value = String(clampPct(cursorPctEl.value));
    }
    if (otherPctEl.value !== "") {
      otherPctEl.value = String(clampPct(otherPctEl.value));
    }
  }

  /** ponytail: cycle starts same calendar day, previous month (Sep 19 → Aug 19) */
  function getCycleInfo(resetDateIso) {
    return getCycleInfoFromStart(resetDateIso, addMonths(resetDateIso, -1));
  }

  var GROK_CYCLE_DAYS = 7;

  /** ponytail: 7 inclusive days ending on reset (Sep 3 → Aug 28) */
  function getWeeklyCycleInfo(resetDateIso) {
    var cycleStart = addDays(resetDateIso, -(GROK_CYCLE_DAYS - 1));
    return getCycleInfoFromStart(resetDateIso, cycleStart, GROK_CYCLE_DAYS);
  }

  function getCycleInfoFromStart(resetDateIso, cycleStart, cycleDaysOverride) {
    var today = todayIso();
    var cycleDays =
      cycleDaysOverride != null
        ? cycleDaysOverride
        : daysBetween(cycleStart, resetDateIso);
    var daysLeft = daysBetween(today, resetDateIso) + 1;
    var elapsedInclusive = Math.max(daysBetween(cycleStart, today) + 1, 1);
    var daysAfterToday = Math.max(daysLeft - 1, 0);

    return {
      cycleStart: cycleStart,
      cycleDays: cycleDays,
      daysLeft: daysLeft,
      elapsedInclusive: elapsedInclusive,
      daysAfterToday: daysAfterToday,
      resetLabel: formatShort(resetDateIso),
      cycleStartLabel: formatShort(cycleStart),
      isWeekly: cycleDaysOverride === GROK_CYCLE_DAYS,
    };
  }

  function stopAtFromRaw(stopAtRaw, isWeekly) {
    if (isWeekly) {
      return Math.round(stopAtRaw);
    }
    return Math.max(0, Math.floor(stopAtRaw) - 1);
  }

  function usageMath(usedPct, cycle) {
    var used = Number(usedPct) || 0;
    var elapsed = cycle.elapsedInclusive;
    var daysAfterToday = cycle.daysAfterToday;
    var cycleDays = cycle.cycleDays;
    var elapsedForRate = cycle.isWeekly
      ? Math.max(cycleDays - cycle.daysLeft, 1)
      : elapsed;

    var dailyRate = used / elapsedForRate;
    var projected = used + dailyRate * daysAfterToday;
    var stopAtRaw = cycle.isWeekly
      ? Math.min(
          100,
          (100 * elapsedForRate) / (elapsedForRate + daysAfterToday)
        )
      : Math.min(100, (100 * elapsed) / cycleDays);
    var stopAt = stopAtFromRaw(stopAtRaw, cycle.isWeekly);
    var overPace = used > stopAt;
    var underUsing = projected < 100;
    var overflowRisk = projected > 100;

    return {
      used: round(used),
      daysLeft: cycle.daysLeft,
      elapsed: elapsed,
      dailyRate: dailyRate,
      projected: round(projected),
      stopAt: stopAt,
      overPace: overPace,
      underUsing: underUsing,
      overflowRisk: overflowRisk,
    };
  }

  function row(label, value, valueClass) {
    var cls = valueClass ? ' class="' + valueClass + '"' : "";
    return "<dt>" + label + "</dt><dd" + cls + ">" + value + "</dd>";
  }

  function progressBar(used, stopAt) {
    return (
      '<div class="cursor-usage-bar" role="presentation">' +
      '<div class="cursor-usage-bar__used" style="width:' +
      Math.min(used, 100) +
      '%"></div>' +
      '<div class="cursor-usage-bar__stop" style="left:' +
      Math.min(stopAt, 100) +
      '%" title="Stop at ' +
      stopAt +
      '%"></div>' +
      "</div>"
    );
  }

  function renderBucket(el, stats) {
    var stopClass = stats.overPace
      ? "cursor-usage-stats__over cursor-usage-stats__stop"
      : "cursor-usage-stats__ok cursor-usage-stats__stop";

    el.innerHTML =
      progressBar(stats.used, stats.stopAt) +
      '<dl class="cursor-usage-stats">' +
      row("Usage", stats.used + "%") +
      row("Daily rate", formatRate(stats.dailyRate)) +
      row("Forecast", stats.projected + "%") +
      row("Stop at", stats.stopAt + "%", stopClass) +
      "</dl>";
  }

  function summaryLine(cursor, other, cycle) {
    return (
      "Stop Cursor ≤" +
      cursor.stopAt +
      "% · Stop Other ≤" +
      other.stopAt +
      "% · resets " +
      cycle.resetLabel
    );
  }

  function renderSummary(cursor, other, cycle) {
    if (!summaryOutEl) return;

    state.lastSummary = summaryLine(cursor, other, cycle);

    var html = "";

    if (cursor.overflowRisk) {
      html +=
        "<p>Cursor Models may spill into <strong>Other Models</strong> before reset.</p>";
    }

    if (cursor.overPace || other.overPace) {
      html += "<p>Too fast. Stay under stop.</p>";
    } else if (cursor.underUsing || other.underUsing) {
      html +=
        "<p>" +
        cycle.daysLeft +
        " days left. Under pace. Room to use more today.</p>";
    }

    if (!html) {
      summaryOutEl.hidden = true;
      summaryOutEl.innerHTML = "";
      return;
    }

    summaryOutEl.innerHTML = html;
    summaryOutEl.classList.toggle(
      "cursor-usage-summary--warn",
      cursor.overPace || other.overPace || cursor.overflowRisk
    );
    summaryOutEl.hidden = false;
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
  }

  function formatUpdatedAt(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function renderLastUpdated(iso) {
    if (!lastUpdatedEl || !lastUpdatedTimeEl) return;
    var label = formatUpdatedAt(iso);
    if (!label) {
      lastUpdatedEl.hidden = true;
      lastUpdatedTimeEl.textContent = "";
      lastUpdatedTimeEl.removeAttribute("datetime");
      return;
    }
    lastUpdatedTimeEl.dateTime = iso;
    lastUpdatedTimeEl.textContent = label;
    lastUpdatedEl.hidden = false;
  }

  function writeStore(data) {
    data.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderLastUpdated(data.lastUpdated);
    return data;
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  /** Bookmarklet opens calculator with ?reset=&cursor=&other=&grokReset=&grok= */
  function importFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var reset = params.get("reset");
    var cursor = params.get("cursor");
    var other = params.get("other");
    var grokReset = params.get("grokReset");
    var grok = params.get("grok");
    var tpl = params.get("tpl");
    if (
      !reset &&
      cursor == null &&
      other == null &&
      !grokReset &&
      grok == null &&
      tpl !== "changed" &&
      tpl !== "grok"
    ) {
      return null;
    }

    resetDateEl.value = "";
    cursorPctEl.value = "";
    otherPctEl.value = "";

    if (reset && isIsoDate(reset)) {
      resetDateEl.value = reset;
    }
    if (cursor != null && cursor !== "") {
      cursorPctEl.value = String(clampPct(cursor));
    }
    if (other != null && other !== "") {
      otherPctEl.value = String(clampPct(other));
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    return {
      grokReset: grokReset && isIsoDate(grokReset) ? grokReset : null,
      grok: grok != null && grok !== "" ? String(clampPct(grok)) : null,
      tpl: tpl === "changed" || tpl === "grok" ? tpl : null,
    };
  }

  function grokInputs() {
    return {
      reset: document.getElementById("grokResetDate"),
      pct: document.getElementById("grokPct"),
    };
  }

  function snapshotFromDom() {
    var grok = grokInputs();
    return {
      resetDate: resetDateEl.value,
      cursorPct: cursorPctEl.value,
      otherPct: otherPctEl.value,
      grokResetDate: grok.reset ? grok.reset.value : "",
      grokPct: grok.pct ? grok.pct.value : "",
    };
  }

  function hasStoredPct(value) {
    return value != null && value !== "";
  }

  function applyGrokFields(data, replace) {
    var grok = grokInputs();
    if (!grok.reset || !grok.pct) return;
    if (replace || data.grokResetDate) {
      grok.reset.value = data.grokResetDate || "";
    }
    if (replace || hasStoredPct(data.grokPct)) {
      grok.pct.value = hasStoredPct(data.grokPct)
        ? String(clampPct(data.grokPct))
        : "";
    }
  }

  function loadAll() {
    var data = readStore();
    if (data.resetDate) resetDateEl.value = data.resetDate;
    if (hasStoredPct(data.cursorPct)) {
      cursorPctEl.value = String(clampPct(data.cursorPct));
    }
    if (hasStoredPct(data.otherPct)) {
      otherPctEl.value = String(clampPct(data.otherPct));
    }
    applyGrokFields(data);
  }

  function hasAnyStoredData(data) {
    return !!(
      data.resetDate ||
      hasStoredPct(data.cursorPct) ||
      hasStoredPct(data.otherPct) ||
      data.grokResetDate ||
      hasStoredPct(data.grokPct)
    );
  }

  function normalizeGrokPct() {
    var grok = grokInputs();
    if (grok.pct && grok.pct.value !== "") {
      grok.pct.value = String(clampPct(grok.pct.value));
    }
  }

  function persistFromDom() {
    writeStore(snapshotFromDom());
    savedNoteEl.hidden = false;
    var grokSavedNoteEl = document.getElementById("grokSavedNote");
    var grok = grokInputs();
    if (
      grokSavedNoteEl &&
      grok.reset &&
      grok.pct &&
      (grok.reset.value || grok.pct.value)
    ) {
      grokSavedNoteEl.hidden = false;
    }
  }

  function save() {
    persistFromDom();
  }

  function updateMonthlyPeek(cursor, other, cycle, overdue) {
    var el = document.getElementById("monthlyPeek");
    if (!el) return;
    if (!monthlyFieldsReady()) {
      el.textContent = "Enter reset date and model usage";
      return;
    }
    if (overdue) {
      el.textContent =
        "Resets " +
        formatShort(resetDateEl.value) +
        " · passed · update from Cursor";
      return;
    }
    if (!cycle || !cursor || !other) {
      el.textContent =
        "Resets " +
        formatShort(resetDateEl.value) +
        " · Cursor " +
        (cursorPctEl.value || "—") +
        "% · Other " +
        (otherPctEl.value || "—") +
        "%";
      return;
    }
    el.textContent =
      "Resets " +
      cycle.resetLabel +
      " · Cursor " +
      cursor.used +
      "% · Other " +
      other.used +
      "% · Stop ≤" +
      cursor.stopAt +
      " / ≤" +
      other.stopAt;
  }

  var dashboardState = {
    monthlyShow: false,
    grokShow: false,
  };

  function syncDashboardVisibility() {
    var cursorSection =
      cursorOutEl && cursorOutEl.closest
        ? cursorOutEl.closest(".cursor-usage-bucket")
        : null;
    var otherSection =
      otherOutEl && otherOutEl.closest
        ? otherOutEl.closest(".cursor-usage-bucket")
        : null;
    var grokSection = document.getElementById("grokResults");
    var visible = 0;

    if (cursorSection) {
      cursorSection.hidden = !dashboardState.monthlyShow;
      if (!cursorSection.hidden) visible++;
    }
    if (otherSection) {
      otherSection.hidden = !dashboardState.monthlyShow;
      if (!otherSection.hidden) visible++;
    }
    if (grokSection) {
      grokSection.hidden = !dashboardState.grokShow;
      if (!grokSection.hidden) visible++;
    }
    if (resultsEl) {
      resultsEl.hidden = visible === 0;
      resultsEl.dataset.visibleBuckets = String(visible);
    }
  }

  function syncPanelOpenState() {
    var monthlyPanel = document.getElementById("monthly-panel");
    var grokPanel = document.getElementById("grok-panel");
    if (monthlyPanel) monthlyPanel.open = !monthlyFieldsReady();
    if (grokPanel) grokPanel.open = !grokFieldsReady();
  }

  function run() {
    warnEl.hidden = true;
    updateResetDaysLeft(resetDaysLeftEl, resetDateEl.value);
    dashboardState.monthlyShow = false;
    if (!monthlyFieldsReady()) {
      if (summaryOutEl) summaryOutEl.hidden = true;
      syncDashboardVisibility();
      updateMonthlyPeek();
      return;
    }
    var resetDate = resetDateEl.value;
    if (!resetDate) {
      syncDashboardVisibility();
      updateMonthlyPeek();
      return;
    }

    if (daysBetween(todayIso(), resetDate) < 0) {
      warnEl.textContent = "Reset date passed. Pick the new date in Cursor.";
      warnEl.hidden = false;
      if (summaryOutEl) summaryOutEl.hidden = true;
      syncDashboardVisibility();
      updateMonthlyPeek(null, null, null, true);
      return;
    }

    state.cycle = getCycleInfo(resetDate);
    var cursor = usageMath(cursorPctEl.value || 0, state.cycle);
    var other = usageMath(otherPctEl.value || 0, state.cycle);

    renderSummary(cursor, other, state.cycle);
    renderBucket(cursorOutEl, cursor);
    renderBucket(otherOutEl, other);
    dashboardState.monthlyShow = true;
    syncDashboardVisibility();
    updateMonthlyPeek(cursor, other, state.cycle, false);
  }

  function onChange() {
    normalizePctInputs();
    maybeDismissTemplateNotice();
    save();
    run();
  }

  function copySummary() {
    if (!state.lastSummary) return;
    copyToClipboard(state.lastSummary, showCopyToast);
  }

  function showCopyToast(message) {
    if (!copyToastEl) return;
    copyToastEl.textContent = message || "Copied.";
    copyToastEl.hidden = false;
    window.setTimeout(function () {
      copyToastEl.hidden = true;
      copyToastEl.textContent = "Copied.";
    }, 2500);
  }

  function bookmarkletHref() {
    return globalThis.JORAP_CURSOR_USAGE_BOOKMARKLET_HREF || "";
  }

  function wireBookmarkletDragLink() {
    var drag = document.getElementById("bookmarkletDrag");
    var href = bookmarkletHref();
    if (!drag || !href) return;
    drag.href = href;
    drag.addEventListener("click", function (e) {
      e.preventDefault();
    });
  }

  function copyBookmarklet() {
    var href = bookmarkletHref();
    if (!href) {
      showCopyToast(
        "Bookmarklet missing. Run node scripts/cursor-usage-bookmarklet.mjs, then refresh.",
      );
      return;
    }
    copyToClipboard(href, function () {
      showCopyToast("Bookmarklet copied. Paste into a new bookmark URL.");
    });
  }

  form.addEventListener("input", onChange);
  if (copyBtn) copyBtn.addEventListener("click", copySummary);
  var copyBookmarkletBtn = document.getElementById("copyBookmarklet");
  if (copyBookmarkletBtn) copyBookmarkletBtn.addEventListener("click", copyBookmarklet);
  wireBookmarkletDragLink();

  var syncedFromBookmarklet = importFromQuery();
  if (syncedFromBookmarklet) {
    if (syncedFromBookmarklet.tpl) showTemplateNotice(syncedFromBookmarklet.tpl);
    applyGrokFields(
      {
        grokResetDate: syncedFromBookmarklet.grokReset || "",
        grokPct: syncedFromBookmarklet.grok,
      },
      true
    );
  } else {
    var stored = readStore();
    loadAll();
    renderLastUpdated(stored.lastUpdated);
    if (hasAnyStoredData(stored)) {
      savedNoteEl.hidden = false;
      var grokSavedNoteEl = document.getElementById("grokSavedNote");
      if (grokSavedNoteEl && (stored.grokResetDate || hasStoredPct(stored.grokPct))) {
        grokSavedNoteEl.hidden = false;
      }
    }
  }

  normalizePctInputs();
  normalizeGrokPct();

  var runGrok = initGrokSection({
    daysBetween: daysBetween,
    todayIso: todayIso,
    formatShort: formatShort,
    clampPct: clampPct,
    getWeeklyCycleInfo: getWeeklyCycleInfo,
    usageMath: usageMath,
    renderBucket: renderBucket,
    persistFromDom: persistFromDom,
    copyToClipboard: copyToClipboard,
    maybeDismissTemplateNotice: maybeDismissTemplateNotice,
    grokFieldsReady: grokFieldsReady,
    updateResetDaysLeft: updateResetDaysLeft,
    dashboardState: dashboardState,
    syncDashboardVisibility: syncDashboardVisibility,
  });

  run();
  runGrok();
  if (syncedFromBookmarklet) {
    persistFromDom();
  }
  updateMonthlyPeek();
  syncPanelOpenState();
})();

function copyToClipboard(text, onDone) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone).catch(fallback);
  } else {
    fallback();
  }

  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      onDone();
    } catch (e) {
      /* ignore */
    }
    document.body.removeChild(ta);
  }
}

function initGrokSection(deps) {
  var grokForm = document.getElementById("grok-usage-form");
  var grokResetDateEl = document.getElementById("grokResetDate");
  var grokPctEl = document.getElementById("grokPct");
  var grokOutEl = document.getElementById("grokOut");
  var grokSummaryOutEl = document.getElementById("grokSummaryOut");
  var grokWarnEl = document.getElementById("grokWarn");
  var grokResetDaysLeftEl = document.getElementById("grokResetDaysLeft");
  var grokSavedNoteEl = document.getElementById("grokSavedNote");
  var grokCopyBtn = document.getElementById("copyGrokSummary");
  var copyToastEl = document.getElementById("copyToast");

  if (!grokForm || !grokResetDateEl || !grokPctEl) {
    return function () {};
  }

  var grokState = {
    lastSummary: "",
    cycle: null,
  };

  function normalizeGrokPct() {
    if (grokPctEl.value !== "") {
      grokPctEl.value = String(deps.clampPct(grokPctEl.value));
    }
  }

  function grokSummaryLine(stats, cycle) {
    return "Stop Grok ≤" + stats.stopAt + "% · resets " + cycle.resetLabel;
  }

  function renderGrokSummary(stats, cycle) {
    if (!grokSummaryOutEl) return;

    grokState.lastSummary = grokSummaryLine(stats, cycle);

    var html = "";

    if (stats.overflowRisk) {
      html += "<p>Weekly Grok usage may hit 100% before reset.</p>";
    }

    if (stats.overPace) {
      html += "<p>Too fast. Stay under stop.</p>";
    } else if (stats.underUsing) {
      html +=
        "<p>" +
        cycle.daysLeft +
        " days left. Under pace. Room to use more today.</p>";
    }

    if (!html) {
      grokSummaryOutEl.hidden = true;
      grokSummaryOutEl.innerHTML = "";
      return;
    }

    grokSummaryOutEl.innerHTML = html;
    grokSummaryOutEl.classList.toggle(
      "cursor-usage-summary--warn",
      stats.overPace || stats.overflowRisk
    );
    grokSummaryOutEl.hidden = false;
  }

  function updateGrokPeek() {
    var el = document.getElementById("grokPeek");
    if (!el) return;
    if (!deps.grokFieldsReady()) {
      el.textContent = "Weekly reset date · usage %";
      return;
    }
    el.textContent =
      deps.formatShort(grokResetDateEl.value) +
      " · " +
      grokPctEl.value +
      "% weekly";
  }

  function saveGrok() {
    deps.persistFromDom();
    grokSavedNoteEl.hidden = false;
  }

  function runGrok() {
    deps.dashboardState.grokShow = false;
    grokWarnEl.hidden = true;
    deps.updateResetDaysLeft(grokResetDaysLeftEl, grokResetDateEl.value);
    if (!deps.grokFieldsReady()) {
      if (grokSummaryOutEl) grokSummaryOutEl.hidden = true;
      if (deps.syncDashboardVisibility) deps.syncDashboardVisibility();
      updateGrokPeek();
      return;
    }
    var resetDate = grokResetDateEl.value;
    if (!resetDate) {
      if (deps.syncDashboardVisibility) deps.syncDashboardVisibility();
      updateGrokPeek();
      return;
    }

    if (deps.daysBetween(deps.todayIso(), resetDate) < 0) {
      grokWarnEl.textContent = "Reset date passed. Pick the new date in Cursor.";
      grokWarnEl.hidden = false;
      if (grokSummaryOutEl) grokSummaryOutEl.hidden = true;
      if (deps.syncDashboardVisibility) deps.syncDashboardVisibility();
      updateGrokPeek();
      return;
    }

    grokState.cycle = deps.getWeeklyCycleInfo(resetDate);
    var grok = deps.usageMath(grokPctEl.value || 0, grokState.cycle);

    renderGrokSummary(grok, grokState.cycle);
    if (grokOutEl) deps.renderBucket(grokOutEl, grok);
    deps.dashboardState.grokShow = true;
    if (deps.syncDashboardVisibility) deps.syncDashboardVisibility();
    updateGrokPeek();
  }

  function onGrokChange() {
    normalizeGrokPct();
    deps.maybeDismissTemplateNotice();
    saveGrok();
    runGrok();
  }

  function copyGrokSummary() {
    if (!grokState.lastSummary) return;

    deps.copyToClipboard(grokState.lastSummary, function () {
      if (!copyToastEl) return;
      copyToastEl.hidden = false;
      window.setTimeout(function () {
        copyToastEl.hidden = true;
      }, 2000);
    });
  }

  grokForm.addEventListener("input", onGrokChange);
  if (grokCopyBtn) grokCopyBtn.addEventListener("click", copyGrokSummary);

  return runGrok;
}
