/**
 * Notes home: featured block shows two random garden notes per visit.
 */
(function () {
  var core = window.jorapNotesRandomCore;
  if (!core) return;

  var root = document.querySelector("[data-notes-featured-random]");
  var dataEl = document.querySelector(".notes-featured-random-data");
  var slot = document.querySelector("[data-notes-featured-random-slot]");
  if (!root || !dataEl || !slot) return;

  var PICK_COUNT = 2;

  var pool = [];
  try {
    pool = JSON.parse(dataEl.textContent);
  } catch (e) {
    pool = [];
  }

  var escapeHtml = window.jorapEscapeHtml;

  function pickMany(count) {
    var picks = [];
    var exclude = [];
    var n = Math.min(count, pool.length);

    for (var i = 0; i < n; i += 1) {
      var pick = core.pickOne(pool, exclude);
      if (!pick) break;
      picks.push(pick);
      exclude.push(pick.url);
    }

    return picks;
  }

  function cardHtml(pick) {
    var desc = pick.description
      ? '<p class="notes-card__body text-ink-muted relative z-[1] mb-0 flex-1 text-sm leading-snug pointer-events-none">' +
        escapeHtml(pick.description) +
        "</p>"
      : '<div class="notes-card__spacer relative z-[1] flex-1 pointer-events-none" aria-hidden="true"></div>';

    return (
      '<article class="notes-card notes-card--interactive border-divider relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-elevated p-5 shadow-sm transition-[box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none">' +
      '<a class="notes-card__overlay" href="' +
      escapeHtml(pick.url) +
      '" data-wikilink-preview="' +
      escapeHtml(pick.url) +
      '" aria-label="' +
      escapeHtml(pick.title) +
      '"></a>' +
      '<h3 class="h6 notes-card__title relative z-[1] mb-2 font-medium pointer-events-none">' +
      escapeHtml(pick.title) +
      "</h3>" +
      desc +
      "</article>"
    );
  }

  function render() {
    if (!pool.length) {
      slot.innerHTML =
        '<p class="notes-featured-random-empty text-ink-muted col-span-full text-sm">No notes in the garden yet.</p>';
      return;
    }

    slot.innerHTML = pickMany(PICK_COUNT)
      .map(cardHtml)
      .join("");
  }

  render();
})();
