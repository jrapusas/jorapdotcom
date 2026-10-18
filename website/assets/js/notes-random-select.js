/**
 * Shared note picker: wire <select> elements to random note / duo slots.
 */
(function () {
  function findInPool(pool, url) {
    if (!url) return null;
    for (var i = 0; i < pool.length; i += 1) {
      if (pool[i].url === url) return pool[i];
    }
    return null;
  }

  window.jorapNotesRandomSelect = {
    findInPool: findInPool,

    setValue: function (select, url) {
      if (!select) return;
      select.value = url || "";
    },

    wire: function (select, pool, callbacks) {
      if (!select) return;

      select.addEventListener("change", function () {
        var url = select.value;
        if (!url) {
          select.value = callbacks.getCurrentUrl ? callbacks.getCurrentUrl() || "" : "";
          return;
        }

        var blocked = callbacks.getBlockedUrls ? callbacks.getBlockedUrls() : [];
        if (blocked.indexOf(url) !== -1) {
          select.value = callbacks.getCurrentUrl ? callbacks.getCurrentUrl() || "" : "";
          return;
        }

        var pick = findInPool(pool, url);
        if (pick && callbacks.onPick) {
          callbacks.onPick(pick);
        }
      });
    },
  };
})();
