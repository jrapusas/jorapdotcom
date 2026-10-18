/**
 * Bookmarklet for cursor.com/dashboard/spending → JoRap spending forecast.
 * ponytail: text/DOM heuristics — breaks when Cursor renames layout; manual fields still work.
 */
(function () {
  var O = "https://jorap.com",
    P = "/projects/cursor-spending-forecast/";

  function toast(msg, err) {
    var el = document.getElementById("jcu-bm");
    if (!el) {
      el = document.createElement("div");
      el.id = "jcu-bm";
      el.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:2147483647;padding:12px 16px;border-radius:8px;font:14px system-ui,sans-serif;color:#fff";
      document.body.appendChild(el);
    }
    el.style.background = err ? "#5c1a1a" : "#1a3d24";
    el.textContent = msg;
    setTimeout(function () {
      el.remove();
    }, err ? 6000 : 2800);
  }

  function ct(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function pct(chunk) {
    var m = chunk && chunk.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Math.min(100, Math.max(0, Math.ceil(+m[1]))) : null;
  }

  function monIdx(n) {
    var i = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(
      (n || "").slice(0, 3).toLowerCase()
    );
    return i < 0 ? null : i / 3;
  }

  function iso(y, mo, d) {
    return (
      y +
      "-" +
      String(mo + 1).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }

  function dateFrom(mon, day) {
    var m = monIdx(mon),
      y = new Date().getFullYear(),
      c,
      t;
    if (m == null || !day) return null;
    c = new Date(y, m, day);
    t = new Date();
    t.setHours(0, 0, 0, 0);
    if (c < t) c = new Date(y + 1, m, day);
    return iso(c.getFullYear(), c.getMonth(), c.getDate());
  }

  function dateFromDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n - 1);
    return iso(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseReset(t) {
    t = ct(t);
    var m = t.match(/reset[s]?(?:\s+on)?\s+([a-z]{3,9})\s+(\d{1,2})/i);
    if (m) return dateFrom(m[1], +m[2]);
    m = t.match(/(\d+)\s+days?\s+left/i);
    return m ? dateFromDays(+m[1]) : null;
  }

  function monthlyReset(t) {
    t = ct(t);
    var m = t.match(/usage limits reset on\s+([a-z]{3,9})\s+(\d{1,2})/i);
    if (m) return dateFrom(m[1], +m[2]);
    var g = t.toLowerCase().indexOf("grok bot");
    return parseReset(g >= 0 ? t.slice(0, g) : t);
  }

  var path = (location.pathname || "").replace(/\/+$/, "");
  if (path.indexOf("/dashboard/spending") < 0 && path !== "/spending") {
    toast("Open cursor.com/dashboard/spending first.", 1);
    return;
  }

  var text = ct(document.body.innerText || ""),
    lower = text.toLowerCase(),
    resetDate = monthlyReset(text),
    cIdx = lower.indexOf("cursor models"),
    oIdx = lower.lastIndexOf("other models"),
    cursorPct = cIdx < 0 ? null : pct(text.slice(cIdx, cIdx + 80)),
    otherPct = oIdx < 0 ? null : pct(text.slice(oIdx, oIdx + 80)),
    grokResetDate = null,
    grokPct = null,
    wIdx = lower.indexOf("weekly usage");

  // ponytail: parse from "weekly usage" — early "Grok Bot" nav links sit above Current Plan reset
  if (wIdx >= 0) {
    var weeklyChunk = text.slice(wIdx, wIdx + 120);
    grokPct = pct(weeklyChunk);
    grokResetDate = parseReset(weeklyChunk);
  }

  var missing = [];
  if (!resetDate) missing.push("reset date");
  if (cursorPct == null) missing.push("Cursor Models %");
  if (otherPct == null) missing.push("Other Models %");

  var parts = [];
  function qp(k, v) {
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  }

  if (missing.length) {
    toast(
      "Spending layout may have changed. Could not read: " + missing.join(", ") + ".",
      1
    );
    qp("tpl", "changed");
    if (resetDate) qp("reset", resetDate);
    if (cursorPct != null) qp("cursor", cursorPct);
    if (otherPct != null) qp("other", otherPct);
    if (grokResetDate) qp("grokReset", grokResetDate);
    if (grokPct != null) qp("grok", grokPct);
  } else {
    qp("reset", resetDate);
    qp("cursor", cursorPct);
    qp("other", otherPct);
    if (grokResetDate) qp("grokReset", grokResetDate);
    if (grokPct != null) qp("grok", grokPct);
    if (grokPct == null || !grokResetDate) qp("tpl", "grok");
  }

  var url = O + P + "?" + parts.join("&"),
    summary = missing.length
      ? "Layout changed — type fields by hand."
      : "Cursor " +
        cursorPct +
        "% · Other " +
        otherPct +
        "% · resets " +
        resetDate;

  if (!missing.length && grokPct != null && grokResetDate) {
    summary += " · Grok " + grokPct + "% weekly · resets " + grokResetDate;
  }

  var clip = navigator.clipboard && navigator.clipboard.writeText;
  if (clip) clip(summary).catch(function () {});
  var win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) toast("Synced. Calculator opened.");
  else if (clip) {
    clip(url).then(function () {
      toast("Popup blocked. URL copied.", 1);
    });
  } else toast("Popup blocked.", 1);
})();
