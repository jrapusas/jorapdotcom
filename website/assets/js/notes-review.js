/**
 * Flashcard review: quiz flow + spaced repetition in localStorage.
 */
(function () {
  var root = document.querySelector("[data-notes-review]");
  var dataEl = document.querySelector(".notes-review__data");
  if (!root || !dataEl) return;

  var STORAGE_KEY = "jorap-notes-review-v1";
  var DAY_MS = 86400000;

  var startPanel = root.querySelector("[data-notes-review-start]");
  var sessionPanel = root.querySelector("[data-notes-review-session]");
  var donePanel = root.querySelector("[data-notes-review-done]");
  var statsEl = root.querySelector("[data-notes-review-stats]");
  var progressEl = root.querySelector("[data-notes-review-progress]");
  var frontEl = root.querySelector("[data-notes-review-front]");
  var backEl = root.querySelector("[data-notes-review-back]");
  var sourceEl = root.querySelector("[data-notes-review-source]");
  var answerBlock = root.querySelector("[data-notes-review-answer]");
  var actionsEl = root.querySelector("[data-notes-review-actions]");
  var ratingsEl = root.querySelector("[data-notes-review-ratings]");
  var summaryEl = root.querySelector("[data-notes-review-summary]");

  var allCards = [];
  var selectedSet = "all";
  var queue = [];
  var sessionIndex = 0;
  var sessionTotal = 0;
  var sessionStats = { reviewed: 0, again: 0 };
  var cramMode = false;
  var revealed = false;
  var currentCard = null;

  try {
    allCards = JSON.parse(dataEl.textContent) || [];
  } catch (e) {
    allCards = [];
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { cards: {}, deckHash: deckHash() };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { cards: {}, deckHash: deckHash() };
      if (parsed.deckHash !== deckHash()) {
        return { cards: parsed.cards || {}, deckHash: deckHash() };
      }
      return parsed;
    } catch (err) {
      return { cards: {}, deckHash: deckHash() };
    }
  }

  function saveState(state) {
    state.deckHash = deckHash();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function deckHash() {
    return allCards
      .map(function (c) {
        return c.id;
      })
      .sort()
      .join("|");
  }

  function defaultCardState() {
    return { due: 0, interval: 0, ease: 2.5, reps: 0 };
  }

  function getCardState(state, id) {
    return state.cards[id] || null;
  }

  function isDue(state, id, now) {
    if (cramMode) return true;
    var card = getCardState(state, id);
    if (!card || !card.reps) return true;
    return card.due <= now;
  }

  function filterBySet(cards) {
    if (selectedSet === "all") return cards;
    return cards.filter(function (card) {
      return (card.sets || []).indexOf(selectedSet) !== -1;
    });
  }

  function countDue(cards, state) {
    var now = Date.now();
    var due = 0;
    var newCount = 0;
    cards.forEach(function (card) {
      var cs = getCardState(state, card.id);
      if (!cs || !cs.reps) {
        newCount += 1;
        due += 1;
      } else if (cs.due <= now) {
        due += 1;
      }
    });
    return { due: due, newCount: newCount, total: cards.length };
  }

  function updateStats() {
    var cards = filterBySet(allCards);
    var state = loadState();
    var counts = countDue(cards, state);
    if (!cards.length) {
      statsEl.textContent = "No cards match this filter.";
      return;
    }
    statsEl.textContent =
      counts.due +
      " due · " +
      counts.newCount +
      " new · " +
      counts.total +
      " total in deck";
  }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function buildQueue(cram) {
    cramMode = !!cram;
    var cards = filterBySet(allCards);
    var state = loadState();
    var now = Date.now();

    if (cramMode) {
      queue = shuffle(cards);
      sessionTotal = queue.length;
      sessionIndex = 0;
      return queue.length > 0;
    }

    var due = [];
    var later = [];
    cards.forEach(function (card) {
      if (isDue(state, card.id, now)) {
        due.push(card);
      } else {
        later.push(card);
      }
    });

    queue = shuffle(due);
    sessionTotal = queue.length;
    sessionIndex = 0;
    return queue.length > 0;
  }

  function showPanel(name) {
    startPanel.classList.toggle("hidden", name !== "start");
    sessionPanel.classList.toggle("hidden", name !== "session");
    donePanel.classList.toggle("hidden", name !== "done");
  }

  function renderCurrentCard() {
    currentCard = queue[sessionIndex] || null;
    revealed = false;

    if (!currentCard) {
      finishSession();
      return;
    }

    frontEl.textContent = currentCard.front;
    backEl.textContent = currentCard.back;
    answerBlock.classList.add("hidden");
    actionsEl.classList.remove("hidden");
    ratingsEl.classList.add("hidden");

    if (currentCard.sourceUrl && currentCard.sourceTitle) {
      sourceEl.innerHTML =
        'From <a class="text-accent no-underline hover:underline" href="' +
        escapeAttr(currentCard.sourceUrl) +
        '">' +
        escapeHtml(currentCard.sourceTitle) +
        "</a>";
      sourceEl.classList.remove("hidden");
    } else {
      sourceEl.textContent = "";
      sourceEl.classList.add("hidden");
    }

    progressEl.textContent = sessionIndex + 1 + " / " + sessionTotal;
  }

  function revealAnswer() {
    if (!currentCard || revealed) return;
    revealed = true;
    answerBlock.classList.remove("hidden");
    actionsEl.classList.add("hidden");
    ratingsEl.classList.remove("hidden");
  }

  function scheduleRating(rating) {
    if (!currentCard) return;

    var state = loadState();
    var card = state.cards[currentCard.id] || defaultCardState();
    var now = Date.now();
    var requeue = false;

    if (rating === "again") {
      card.interval = 0;
      card.due = now;
      card.lapses = (card.lapses || 0) + 1;
      requeue = true;
      sessionStats.again += 1;
    } else if (rating === "hard") {
      card.interval = card.interval > 0 ? Math.max(1, Math.round(card.interval * 1.2)) : 1;
      card.due = now + card.interval * DAY_MS;
      card.ease = Math.max(1.3, card.ease - 0.15);
      card.reps = (card.reps || 0) + 1;
    } else if (rating === "good") {
      card.interval = card.interval > 0 ? Math.max(1, Math.round(card.interval * card.ease)) : 1;
      card.due = now + card.interval * DAY_MS;
      card.reps = (card.reps || 0) + 1;
    } else if (rating === "easy") {
      card.interval = card.interval > 0 ? Math.max(4, Math.round(card.interval * card.ease * 1.3)) : 4;
      card.due = now + card.interval * DAY_MS;
      card.ease = Math.min(3, card.ease + 0.15);
      card.reps = (card.reps || 0) + 1;
    }

    state.cards[currentCard.id] = card;
    saveState(state);
    sessionStats.reviewed += 1;

    if (requeue && !cramMode) {
      queue.push(currentCard);
      sessionTotal += 1;
    }

    sessionIndex += 1;
    renderCurrentCard();
  }

  function finishSession() {
    summaryEl.textContent =
      "Reviewed " +
      sessionStats.reviewed +
      " card" +
      (sessionStats.reviewed === 1 ? "" : "s") +
      (sessionStats.again ? " · " + sessionStats.again + " marked Again" : "") +
      ".";
    showPanel("done");
    updateStats();
  }

  function startSession(cram) {
    sessionStats = { reviewed: 0, again: 0 };
    if (!buildQueue(cram)) {
      statsEl.textContent = cram
        ? "No cards match this filter."
        : "Nothing due right now. Try Cram all or come back later.";
      return;
    }
    showPanel("session");
    renderCurrentCard();
  }

  var escapeHtml = window.jorapEscapeHtml;
  var escapeAttr = escapeHtml;

  var bindTap = window.jorapBindTouchClick || function (el, fn) {
    el.addEventListener("click", fn);
  };
  var bindTapIf = window.jorapBindTouchClickIf || function (el, fn) {
    if (el) bindTap(el, fn);
  };

  root.querySelectorAll("[data-notes-review-set]").forEach(function (btn) {
    bindTap(btn, function () {
      selectedSet = btn.getAttribute("data-notes-review-set") || "all";
      root.querySelectorAll("[data-notes-review-set]").forEach(function (el) {
        var active = el.getAttribute("data-notes-review-set") === selectedSet;
        el.classList.toggle("is-active", active);
        el.setAttribute("aria-pressed", active ? "true" : "false");
      });
      updateStats();
    });
  });

  bindTapIf(root.querySelector("[data-notes-review-begin]"), function () {
    startSession(false);
  });

  bindTapIf(root.querySelector("[data-notes-review-cram]"), function () {
    startSession(true);
  });

  bindTapIf(root.querySelector("[data-notes-review-reset]"), function () {
    if (
      window.confirm(
        "Clear all review progress for this deck in this browser? This cannot be undone."
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      updateStats();
    }
  });

  bindTapIf(root.querySelector("[data-notes-review-reveal]"), revealAnswer);

  root.querySelectorAll("[data-notes-review-rate]").forEach(function (btn) {
    bindTap(btn, function () {
      scheduleRating(btn.getAttribute("data-notes-review-rate"));
    });
  });

  bindTapIf(root.querySelector("[data-notes-review-exit]"), function () {
    if (sessionStats.reviewed > 0) {
      finishSession();
    } else {
      showPanel("start");
      updateStats();
    }
  });

  bindTapIf(root.querySelector("[data-notes-review-restart]"), function () {
    showPanel("start");
    updateStats();
  });

  document.addEventListener("keydown", function (event) {
    if (sessionPanel.classList.contains("hidden")) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (!revealed) revealAnswer();
      return;
    }

    if (!revealed) return;

    var map = { Digit1: "again", Digit2: "hard", Digit3: "good", Digit4: "easy" };
    var rating = map[event.code];
    if (rating) {
      event.preventDefault();
      scheduleRating(rating);
    }
  });

  updateStats();
})();
