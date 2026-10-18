/**
 * Flip cards: click or Enter/Space toggles front/back.
 */
(function () {
  function toggle(card, btn) {
    var flipped = card.classList.toggle("is-flipped");
    btn.setAttribute("aria-pressed", flipped ? "true" : "false");
  }

  function bindFlipButtons() {
    var bindTap = window.jorapBindTouchClick || function (el, fn) {
      el.addEventListener("click", fn);
    };

    document.querySelectorAll("[data-flashcard-flip]").forEach(function (btn) {
      if (btn.dataset.flashcardBound === "true") return;
      btn.dataset.flashcardBound = "true";

      bindTap(btn, function () {
        var card = btn.closest(".notes-flashcard");
        if (!card) return;
        toggle(card, btn);
      });

      btn.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        var card = btn.closest(".notes-flashcard");
        if (!card) return;
        toggle(card, btn);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindFlipButtons);
  } else {
    bindFlipButtons();
  }
})();
