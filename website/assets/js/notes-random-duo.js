/**
 * Random Duo page: two garden notes side by side + AI prompt.
 */
(function () {
  var core = window.jorapNotesRandomCore;
  if (!core) return;

  var root = document.querySelector("[data-notes-random-duo]");
  var dataEl = document.querySelector(".notes-random-duo-data");
  var graphEl = document.querySelector(".notes-random-duo-graph-data");
  var shuffleBtn = document.querySelector("[data-random-duo-shuffle]");
  var shuffleLeftBtn = document.querySelector("[data-random-duo-shuffle-left]");
  var shuffleRightBtn = document.querySelector("[data-random-duo-shuffle-right]");
  var selectEls = document.querySelectorAll("[data-random-duo-select]");
  var copyPromptBtn = document.querySelector("[data-random-duo-copy-prompt]");
  var promptEl = document.querySelector("[data-random-duo-prompt]");
  var emptyPageEl = document.querySelector(".notes-random-empty-page");
  var pathResultEl = document.querySelector("[data-random-duo-path]");
  var pathChainEl = document.querySelector("[data-random-duo-path-chain]");
  if (!root || !dataEl) return;

  var slots = root.querySelectorAll("[data-random-duo-slot]");
  var currentNotes = [null, null];
  var currentPath = null;
  var pool = [];
  var adj = Object.create(null);
  var titleByUrl = Object.create(null);
  try {
    pool = JSON.parse(dataEl.textContent);
  } catch (e) {
    pool = [];
  }

  pool.forEach(function (item) {
    titleByUrl[item.url] = item.title;
  });

  if (graphEl) {
    try {
      adj = core.buildAdjacency(JSON.parse(graphEl.textContent) || []);
    } catch (e) {
      adj = Object.create(null);
    }
  }

  var ai = core.createAiHelpers({
    promptEl: promptEl,
    copyPromptBtn: copyPromptBtn,
    openedLabel: "Opened",
    copiedLabel: "Copied - paste in chat",
  });

  function pickTwo() {
    if (!pool.length) return [];
    if (pool.length === 1) return [pool[0], null];
    var first = core.pickOne(pool, []);
    var second = core.pickOne(pool, first ? [first.url] : []);
    return [first, second];
  }

  function buildPrompt(notes) {
    var usable = notes.filter(function (note) {
      return note && note.title;
    });

    if (!usable.length) {
      return "Shuffle to load two notes, then paste this prompt into your AI chat.";
    }

    var origin = window.location.origin;
    var lines = [core.connectionPromptIntro(), ""];

    usable.forEach(function (note, index) {
      lines.push.apply(lines, core.formatPromptNote(index + 1, note, origin));
      lines.push("");
    });

    if (currentPath && currentPath.length > 1) {
      lines.push(core.pathPromptLine(currentPath, titleByUrl));
      lines.push("");
    }

    lines.push.apply(lines, core.connectionPromptTail());

    return lines.join("\n");
  }

  function updatePath() {
    var left = currentNotes[0];
    var right = currentNotes[1];
    currentPath = core.renderPathBetween({
      resultEl: pathResultEl,
      chainEl: pathChainEl,
      adj: adj,
      titleByUrl: titleByUrl,
      start: left && left.url,
      end: right && right.url,
    });
  }

  function refreshPrompt() {
    if (promptEl) promptEl.value = buildPrompt(currentNotes);
  }

  function equalizePanelHeights() {
    var panels = root.querySelectorAll(".notes-random-panel");
    if (panels.length < 2) return;

    panels.forEach(function (panel) {
      panel.style.minHeight = "";
    });

    // Side-by-side only (md+); stacked columns should use natural height.
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    var maxHeight = 0;
    panels.forEach(function (panel) {
      maxHeight = Math.max(maxHeight, panel.offsetHeight);
    });

    if (maxHeight > 0) {
      panels.forEach(function (panel) {
        panel.style.minHeight = maxHeight + "px";
      });
    }
  }

  function syncSelect(index, url) {
    if (!window.jorapNotesRandomSelect || !selectEls[index]) return;
    window.jorapNotesRandomSelect.setValue(selectEls[index], url);
  }

  function syncAllSelects() {
    currentNotes.forEach(function (note, index) {
      syncSelect(index, note && note.url ? note.url : "");
    });
  }

  function loadSlot(index, pick) {
    if (promptEl) promptEl.value = "Loading notes…";

    return core
      .renderNoteIntoSlot(slots[index], pick, {
        headingTag: "h2",
        bodyMode: "content",
        emptyMessage: "Not enough notes to fill this column.",
      })
      .then(function (note) {
        currentNotes[index] = note;
        syncSelect(index, note && note.url ? note.url : "");
        updatePath();
        refreshPrompt();
        window.requestAnimationFrame(equalizePanelHeights);
        return note;
      });
  }

  function shuffleBoth() {
    if (!pool.length) {
      if (emptyPageEl) emptyPageEl.classList.remove("hidden");
      slots.forEach(function (slot) {
        core.setSlotEmpty(slot, "Not enough notes to fill this column.");
      });
      currentNotes = [null, null];
      syncAllSelects();
      updatePath();
      refreshPrompt();
      return;
    }

    if (emptyPageEl) emptyPageEl.classList.add("hidden");
    if (promptEl) promptEl.value = "Loading notes…";

    var picks = pickTwo();
    Promise.all(
      Array.prototype.map.call(slots, function (slot, index) {
        return core.renderNoteIntoSlot(slot, picks[index], {
          headingTag: "h2",
          bodyMode: "content",
          emptyMessage: "Not enough notes to fill this column.",
        });
      })
    ).then(function (notes) {
      currentNotes = notes;
      syncAllSelects();
      updatePath();
      refreshPrompt();
      window.requestAnimationFrame(equalizePanelHeights);
    });
  }

  function shuffleSide(index) {
    if (!pool.length) return;

    var otherIndex = index === 0 ? 1 : 0;
    var exclude = [];
    var otherNote = currentNotes[otherIndex];
    if (otherNote && otherNote.url) exclude.push(otherNote.url);

    var pick = core.pickOne(pool, exclude);
    if (!pick) return;

    loadSlot(index, pick);
  }

  function wireSelects() {
    if (!window.jorapNotesRandomSelect) return;

    Array.prototype.forEach.call(selectEls, function (selectEl) {
      var index = parseInt(selectEl.getAttribute("data-random-duo-select"), 10);
      if (isNaN(index)) return;

      window.jorapNotesRandomSelect.wire(selectEl, pool, {
        getCurrentUrl: function () {
          var note = currentNotes[index];
          return note && note.url ? note.url : "";
        },
        getBlockedUrls: function () {
          var blocked = [];
          currentNotes.forEach(function (note, i) {
            if (i !== index && note && note.url) blocked.push(note.url);
          });
          return blocked;
        },
        onPick: function (pick) {
          loadSlot(index, pick);
        },
      });
    });
  }

  core.bindTapIf(shuffleBtn, shuffleBoth);
  core.bindTapIf(shuffleLeftBtn, function () {
    shuffleSide(0);
  });
  core.bindTapIf(shuffleRightBtn, function () {
    shuffleSide(1);
  });
  core.bindTapIf(copyPromptBtn, function (event) {
    event.preventDefault();
    event.stopPropagation();
    ai.copyPrompt();
  });
  core.wireSendPromptButtons("random-duo", ai);

  window.addEventListener("resize", equalizePanelHeights, { passive: true });

  wireSelects();
  shuffleBoth();
})();
