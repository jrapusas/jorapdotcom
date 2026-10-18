/**
 * Game prompt randomizer: ranked prompts, personal icebreakers, concept spectrums,
 * either-or dilemmas, and conversation starters.
 */
(function () {
  var root = document.querySelector("[data-randomizer]");
  var dataEl = document.getElementById("randomizer-data");
  if (!root || !dataEl) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent);
    if (typeof data === "string") data = JSON.parse(data);
  } catch (e) {
    return;
  }

  var collections = (data && data.collections) || [];
  var byCollection = Object.create(null);
  collections.forEach(function (col) {
    byCollection[col.id] = col;
  });

  var views = {
    home: root.querySelector('[data-randomizer-view="home"]'),
    categories: root.querySelector('[data-randomizer-view="categories"]'),
    play: root.querySelector('[data-randomizer-view="play"]'),
  };

  var els = {
    lede: root.querySelector("[data-randomizer-lede]"),
    collections: root.querySelector("[data-randomizer-collections]"),
    collectionTitle: root.querySelector("[data-randomizer-collection-title]"),
    collectionTagline: root.querySelector("[data-randomizer-collection-tagline]"),
    categories: root.querySelector("[data-randomizer-categories]"),
    playMeta: root.querySelector("[data-randomizer-play-meta]"),
    hint: root.querySelector("[data-randomizer-hint]"),
    poles: root.querySelector("[data-randomizer-poles]"),
    scale: root.querySelector("[data-randomizer-scale]"),
    poleLeft: root.querySelector("[data-randomizer-pole-left]"),
    poleRight: root.querySelector("[data-randomizer-pole-right]"),
    prompt: root.querySelector("[data-randomizer-prompt]"),
    answerHint: root.querySelector("[data-randomizer-answer-hint]"),
    answer: root.querySelector("[data-randomizer-answer]"),
    card: root.querySelector("[data-randomizer-card]"),
    counter: root.querySelector("[data-randomizer-counter]"),
    shuffle: root.querySelector("[data-randomizer-shuffle]"),
    reveal: root.querySelector("[data-randomizer-reveal]"),
    saveOffline: root.querySelector("[data-randomizer-save-offline]"),
    back: root.querySelector("[data-randomizer-back]"),
  };

  var state = {
    collectionId: "",
    categoryId: "",
    mode: "",
    items: [],
    index: -1,
    revealed: false,
  };

  var escapeHtml = window.jorapEscapeHtml;

  function collectionMode(col) {
    return col.mode || "ranked-prompts";
  }

  function isQuizMode(mode) {
    return mode === "quiz";
  }

  function isDirectPlay(col) {
    if (col.categories && col.categories.length) return false;
    var mode = collectionMode(col);
    return (
      mode === "spectrum" ||
      mode === "personal" ||
      mode === "ranked-prompts" ||
      mode === "quiz"
    );
  }

  function isSpectrumMode(mode) {
    return mode === "spectrum";
  }

  function isPersonalMode(mode) {
    return mode === "personal";
  }

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = key !== name;
    });
    document.body.classList.toggle("randomizer-focus", name === "play");
  }

  function playUrl(collectionId, categoryId) {
    var url = new URL(window.location.href);
    url.search = "";
    if (collectionId) url.searchParams.set("set", collectionId);
    if (categoryId) url.searchParams.set("cat", categoryId);
    return url;
  }

  function pushRoute(collectionId, categoryId) {
    var url = playUrl(collectionId, categoryId);
    window.history.pushState(null, "", url.pathname + url.search);
  }

  function findCategory(collectionId, categoryId) {
    var col = byCollection[collectionId];
    if (!col || !col.categories) return null;
    for (var i = 0; i < col.categories.length; i += 1) {
      if (col.categories[i].id === categoryId) return col.categories[i];
    }
    return null;
  }

  function spectrumItems(col) {
    return (col.spectrums || []).map(function (pair) {
      return { left: pair.left || "", right: pair.right || "" };
    });
  }

  function flatItems(col) {
    var mode = collectionMode(col);
    if (mode === "spectrum") return spectrumItems(col);
    if (mode === "personal" || mode === "ranked-prompts") return (col.items || []).slice();
    if (mode === "quiz") return (col.items || []).slice();
    return [];
  }

  function collectionCardHtml(col) {
    var mode = collectionMode(col);
    var count;
    var countLabel;
    if (mode === "spectrum") {
      count = (col.spectrums || []).length;
      countLabel = count + " spectrum" + (count === 1 ? "" : "s");
    } else if (mode === "personal" || mode === "ranked-prompts") {
      count = (col.items || []).length;
      countLabel = count + " prompt" + (count === 1 ? "" : "s");
    } else if (mode === "quiz") {
      count = (col.items || []).length;
      countLabel = count + " question" + (count === 1 ? "" : "s");
    } else {
      count = (col.categories || []).length;
      countLabel = count + " categor" + (count === 1 ? "y" : "ies");
    }
    return (
      '<button type="button" class="randomizer-tile" data-randomizer-pick-collection="' +
      escapeHtml(col.id) +
      '">' +
      '<span class="randomizer-tile__title">' +
      escapeHtml(col.title) +
      "</span>" +
      '<span class="randomizer-tile__meta">' +
      escapeHtml(col.tagline) +
      "</span>" +
      '<span class="randomizer-tile__count">' +
      countLabel +
      "</span>" +
      "</button>"
    );
  }

  function categoryCardHtml(cat) {
    var count = (cat.items || []).length;
    return (
      '<a class="randomizer-tile randomizer-tile--link" href="' +
      escapeHtml(
        playUrl(state.collectionId, cat.id).pathname +
          playUrl(state.collectionId, cat.id).search
      ) +
      '" data-randomizer-pick-category="' +
      escapeHtml(cat.id) +
      '">' +
      '<span class="randomizer-tile__title">' +
      escapeHtml(cat.title) +
      "</span>" +
      '<span class="randomizer-tile__meta">' +
      count +
      " prompt" +
      (count === 1 ? "" : "s") +
      "</span>" +
      "</a>"
    );
  }

  function renderHome() {
    if (els.lede) {
      els.lede.textContent =
        "Six decks for table time. Pick one, shuffle, pass the phone.";
    }
    if (els.collections) {
      els.collections.innerHTML = collections.map(collectionCardHtml).join("");
    }
    showView("home");
  }

  function renderCategories(collectionId) {
    var col = byCollection[collectionId];
    if (!col || isDirectPlay(col)) {
      renderHome();
      return;
    }
    state.collectionId = collectionId;
    if (els.collectionTitle) els.collectionTitle.textContent = col.title;
    if (els.collectionTagline) els.collectionTagline.textContent = col.tagline || "";
    if (els.categories) {
      els.categories.innerHTML = (col.categories || []).map(categoryCardHtml).join("");
    }
    showView("categories");
  }

  function setPlayChrome(col, meta) {
    if (els.playMeta) els.playMeta.textContent = meta || col.title;
    if (els.hint) els.hint.textContent = col.play_hint || "";
    if (els.back) {
      els.back.setAttribute(
        "aria-label",
        isDirectPlay(col) ? "Back to all collections" : "Back to categories"
      );
    }
  }

  function fillAnswerHint(el, answer) {
    if (!el) return;
    el.textContent = "";
    var len = String(answer || "").trim().length;
    for (var i = 0; i < len; i++) {
      var span = document.createElement("span");
      span.className = "randomizer-card__answer-slot";
      span.setAttribute("aria-hidden", "true");
      span.appendChild(document.createTextNode("\u200b"));
      el.appendChild(span);
    }
  }

  function setQuizChrome(quizMode) {
    if (els.reveal) {
      els.reveal.hidden = !quizMode;
      els.reveal.textContent = "Show answer";
      els.reveal.disabled = !quizMode || state.revealed;
    }
  }

  function renderPrompt() {
    var col = byCollection[state.collectionId];
    if (!col) return;

    var spectrumMode = isSpectrumMode(state.mode);
    var personalMode = isPersonalMode(state.mode);
    var quizMode = isQuizMode(state.mode);
    if (els.card) {
      els.card.classList.toggle("randomizer-card--grade-1", quizMode);
    }
    if (els.poles) els.poles.hidden = !spectrumMode;
    if (els.prompt) els.prompt.hidden = spectrumMode;
    if (els.answerHint) {
      els.answerHint.hidden = !quizMode || state.revealed;
      if (!quizMode || state.revealed) els.answerHint.textContent = "";
    }
    if (els.answer) els.answer.hidden = !quizMode || !state.revealed;
    setQuizChrome(quizMode);
    if (els.scale) {
      if (personalMode) {
        els.scale.hidden = false;
        els.scale.textContent = col.scale_label || "On a scale of 1 to 100";
      } else {
        els.scale.hidden = true;
        els.scale.textContent = "";
      }
    }

    if (spectrumMode) {
      var pair = state.items[state.index] || { left: "", right: "" };
      if (els.poleLeft) els.poleLeft.textContent = pair.left;
      if (els.poleRight) els.poleRight.textContent = pair.right;
    } else {
      var text = "";
      var item = state.index >= 0 ? state.items[state.index] : null;
      if (quizMode && item && typeof item === "object") {
        text = item.q || "";
        if (els.answerHint && !state.revealed) fillAnswerHint(els.answerHint, item.a);
        if (els.answer) {
          els.answer.textContent = state.revealed ? item.a || "" : "";
        }
      } else if (item) {
        text = typeof item === "string" ? item : item.q || "";
      }
      if (els.prompt) els.prompt.textContent = text || "No prompts in this set yet.";
    }

    if (els.counter) {
      if (!state.items.length) {
        els.counter.textContent = "";
      } else {
        var label = spectrumMode ? "Spectrum" : quizMode ? "Question" : "Prompt";
        els.counter.textContent =
          label + " " + (state.index + 1) + " of " + state.items.length;
      }
    }
  }

  function startPlay(collectionId, categoryId) {
    var col = byCollection[collectionId];
    var cat = findCategory(collectionId, categoryId);
    if (!col || !cat) {
      renderHome();
      return;
    }

    state.collectionId = collectionId;
    state.categoryId = categoryId;
    state.mode = collectionMode(col);
    state.items = (cat.items || []).slice();
    state.index = -1;
    state.revealed = false;

    setPlayChrome(col, col.title + " · " + cat.title);
    showView("play");
    if (state.items.length) shuffleNext();
    else renderPrompt();
  }

  function startFlatPlay(collectionId) {
    var col = byCollection[collectionId];
    if (!col || !isDirectPlay(col)) {
      renderHome();
      return;
    }

    state.collectionId = collectionId;
    state.categoryId = "";
    state.mode = collectionMode(col);
    state.items = flatItems(col);
    state.index = -1;
    state.revealed = false;

    setPlayChrome(col, col.title);
    showView("play");
    if (state.items.length) shuffleNext();
    else renderPrompt();
  }

  function revealAnswer() {
    if (!isQuizMode(state.mode) || state.revealed) return;
    state.revealed = true;
    renderPrompt();
  }

  function shuffleNext() {
    if (!state.items.length) return;

    state.revealed = false;

    if (state.items.length === 1) {
      state.index = 0;
      renderPrompt();
      return;
    }

    var nextIndex = state.index;
    var guard = 0;
    while (nextIndex === state.index && guard < 20) {
      nextIndex = Math.floor(Math.random() * state.items.length);
      guard += 1;
    }
    state.index = nextIndex;
    renderPrompt();
  }

  function offlineCss() {
    return [
    "*,*::before,*::after{box-sizing:border-box}",
    "html{height:100%}",
    "body{margin:0;min-height:100dvh;display:flex;flex-direction:column;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;",
    "background:#f5f3f0;color:#161412;line-height:1.5;-webkit-font-smoothing:antialiased}",
    ".randomizer-play{display:flex;flex:1;flex-direction:column;min-height:0;width:100%}",
    ".randomizer-play__stage{align-items:center;display:flex;flex:1;justify-content:center;min-height:0;",
    "padding:max(.75rem,env(safe-area-inset-top)) max(1rem,env(safe-area-inset-left)) .75rem max(1rem,env(safe-area-inset-right))}",
    ".randomizer-card{align-items:center;background:#eeebe6;border-radius:.75rem;display:flex;flex:1;flex-direction:column;justify-content:center;margin-inline:auto;",
    "max-width:48rem;min-height:min(52vh,28rem);padding:clamp(1.5rem,4vw,3rem);text-align:center;width:min(100%,48rem)}",
    ".randomizer-card__scale{color:#3d3a37;font-size:clamp(.875rem,2vw,1rem);font-weight:600;letter-spacing:.02em;margin:0 0 .75rem}",
    ".randomizer-card__poles{align-items:center;display:flex;flex-wrap:wrap;gap:.75rem 1rem;justify-content:center;width:100%}",
    ".randomizer-card__pole{flex:1 1 8rem;font-size:clamp(1.375rem,3.5vw,2rem);font-weight:600;line-height:1.35;min-width:0}",
    ".randomizer-card__bridge{color:#3d3a37;flex:0 0 auto;font-size:1.25rem}",
    ".randomizer-card__prompt{font-size:clamp(1.375rem,3.5vw,2rem);font-weight:600;line-height:1.35;margin:0;text-wrap:balance}",
    ".randomizer-card__answer,.randomizer-card__answer-hint{font-size:clamp(1.25rem,3vw,1.75rem);font-weight:700;",
    "letter-spacing:.04em;line-height:1.35;margin:1rem 0 0;text-transform:uppercase}",
    ".randomizer-card__answer{color:#5c4a2a}",
    ".randomizer-card__answer-hint{color:#6b6358;user-select:none;display:flex;align-items:flex-end;justify-content:center;",
    "gap:.1em;width:100%;min-height:1em}",
    ".randomizer-card__answer-slot{display:inline-block;flex-shrink:0;width:1ch;min-width:.65em;height:1em;overflow:hidden;",
    "background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;",
    "background-position:left bottom .08em;background-size:100% .14em}",
    ".randomizer-card--grade-1 .randomizer-card__answer,.randomizer-card--grade-1 .randomizer-card__answer-hint{",
    "font-size:clamp(2.75rem,11vw,5rem);font-weight:800;letter-spacing:.1em;margin-top:1.25rem}",
    ".randomizer-card--grade-1 .randomizer-card__answer{color:#121110}",
    ".randomizer-card--grade-1 .randomizer-card__answer-slot{background-size:100% .12em}",
    ".randomizer-play-actions{align-items:center;display:flex;flex:0 0 auto;flex-direction:column;gap:.75rem;justify-content:center;",
    "padding:0 max(1rem,env(safe-area-inset-left)) max(1.25rem,env(safe-area-inset-bottom)) max(1rem,env(safe-area-inset-right))}",
    ".btn{display:inline-flex;align-items:center;justify-content:center;font:inherit;font-weight:600;cursor:pointer;",
    "border:1px solid transparent;touch-action:manipulation}",
    ".btn-primary{background:#181614;border-color:#181614;color:#fff;border-radius:.25rem;",
    "font-size:1.0625rem;min-height:3.25rem;min-width:12rem;padding:.625rem 2rem}",
    ".btn-primary:hover,.btn-primary:focus-visible{opacity:.92;outline:none}",
    ".randomizer-play__counter{color:#3d3a37;font-size:.875rem;margin:0}",
    "@media (min-width:768px){.randomizer-play-actions{padding-inline:max(1.5rem,env(safe-area-inset-left)) max(1.5rem,env(safe-area-inset-right))}}",
    "@media (prefers-color-scheme:dark){",
    "body{background:#121110;color:#f5f2ed}",
    ".randomizer-card{background:#2a2824}",
    ".randomizer-card__scale,.randomizer-card__bridge,.randomizer-play__counter{color:#d9d4cd}",
    ".randomizer-card--grade-1 .randomizer-card__answer-hint{color:#a39e96}",
    ".randomizer-card--grade-1 .randomizer-card__answer{color:#f5f2ed}",
    ".btn-primary{background:#f2efe9;border-color:#f2efe9;color:#121110}",
    "}",
    ].join("");
  }

  function offlineHtml() {
    var col = byCollection[state.collectionId];
    if (!col) return "";

    var directPlay = isDirectPlay(col);
    var cat = directPlay ? null : findCategory(state.collectionId, state.categoryId);
    if (!directPlay && !cat) return "";

    var payload = {
      title: directPlay ? col.title : cat.title,
      mode: state.mode,
      scale_label: col.scale_label || "",
      large_answer: isQuizMode(state.mode),
      items: directPlay ? state.items : cat.items || [],
    };

    return (
      "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n" +
      "<title>" +
      escapeHtml(payload.title) +
      " - randomizer</title>\n<style>" +
      offlineCss() +
      "</style>\n</head>\n<body>\n" +
      '<div class="randomizer-play">\n' +
      '<div class="randomizer-play__stage"><div class="randomizer-card' +
      (payload.large_answer ? " randomizer-card--grade-1" : "") +
      '" id="card"></div></div>\n' +
      '<div class="randomizer-play-actions">\n' +
      '<button type="button" class="btn btn-outline-primary" id="reveal" hidden>Show answer</button>\n' +
      '<button type="button" class="btn btn-primary randomizer-play__shuffle" id="shuffle">Shuffle</button>\n' +
      '<p class="randomizer-play__counter" id="counter"></p>\n' +
      "</div>\n</div>\n<script>\n" +
      "(function(){\n" +
      "var data=" +
      JSON.stringify(payload) +
      ";\n" +
      "var items=data.items||[];\n" +
      "var spectrum=data.mode==='spectrum';\n" +
      "var personal=data.mode==='personal';\n" +
      "var quiz=data.mode==='quiz';\n" +
      "var index=-1;\n" +
      "var revealed=false;\n" +
      "var card=document.getElementById('card');\n" +
      "var counter=document.getElementById('counter');\n" +
      "var revealBtn=document.getElementById('reveal');\n" +
      "var shuffleBtn=document.getElementById('shuffle');\n" +
      "function el(tag,cls,text){\n" +
      "var node=document.createElement(tag);\n" +
      "if(cls)node.className=cls;\n" +
      "if(text!=null)node.textContent=text;\n" +
      "return node;\n" +
      "}\n" +
      "function fillAnswerHint(node,answer){\n" +
      "node.textContent='';\n" +
      "var len=String(answer||'').trim().length;\n" +
      "for(var i=0;i<len;i++){\n" +
      "var span=document.createElement('span');\n" +
      "span.className='randomizer-card__answer-slot';\n" +
      "span.setAttribute('aria-hidden','true');\n" +
      "span.appendChild(document.createTextNode('\\u200b'));\n" +
      "node.appendChild(span);\n" +
      "}\n" +
      "}\n" +
      "function render(){\n" +
      "card.textContent='';\n" +
      "if(!items.length){card.appendChild(el('p','randomizer-card__prompt','No prompts.'));counter.textContent='';return;}\n" +
      "if(spectrum){\n" +
      "var p=items[index];\n" +
      "var poles=el('div','randomizer-card__poles');\n" +
      "poles.appendChild(el('span','randomizer-card__pole',p.left));\n" +
      "poles.appendChild(el('span','randomizer-card__bridge','\\u2194'));\n" +
      "poles.appendChild(el('span','randomizer-card__pole',p.right));\n" +
      "card.appendChild(poles);\n" +
      "counter.textContent='Spectrum '+(index+1)+' of '+items.length;\n" +
      "}else{\n" +
      "var item=items[index];\n" +
      "var text=quiz&&item&&typeof item==='object'?item.q:item;\n" +
      "if(personal&&data.scale_label){card.appendChild(el('p','randomizer-card__scale',data.scale_label));}\n" +
      "card.appendChild(el('p','randomizer-card__prompt',text));\n" +
      "if(quiz){\n" +
      "if(revealed&&item&&item.a){card.appendChild(el('p','randomizer-card__answer',item.a));}\n" +
      "else if(item&&item.a){var hint=el('p','randomizer-card__answer-hint');fillAnswerHint(hint,item.a);card.appendChild(hint);}\n" +
      "}\n" +
      "counter.textContent=(quiz?'Question ':'Prompt ')+(index+1)+' of '+items.length;\n" +
      "}\n" +
      "if(revealBtn){revealBtn.hidden=!quiz;revealBtn.disabled=!quiz||revealed;}\n" +
      "}\n" +
      "function shuffle(){\n" +
      "if(!items.length)return;\n" +
      "revealed=false;\n" +
      "if(items.length===1){index=0;render();return;}\n" +
      "var next=index,g=0;\n" +
      "while(next===index&&g<20){next=Math.floor(Math.random()*items.length);g++;}\n" +
      "index=next;render();\n" +
      "}\n" +
      "function showAnswer(){\n" +
      "if(!quiz||revealed)return;\n" +
      "revealed=true;render();\n" +
      "}\n" +
      "document.getElementById('shuffle').addEventListener('click',shuffle);\n" +
      "if(revealBtn){revealBtn.addEventListener('click',showAnswer);}\n" +
      "shuffle();\n" +
      "})();\n" +
      "</scr" +
      "ipt>\n</body>\n</html>"
    );
  }

  function downloadOffline() {
    var col = byCollection[state.collectionId];
    if (!col) return;
    if (!isDirectPlay(col) && !findCategory(state.collectionId, state.categoryId)) return;

    var html = offlineHtml();
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var link = document.createElement("a");
    var slug = (state.categoryId || state.collectionId || "randomizer").replace(
      /[^a-z0-9-]+/gi,
      "-"
    );
    link.download = "randomizer-" + slug + ".html";
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  function routeFromLocation() {
    var params = new URLSearchParams(window.location.search);
    var setId = params.get("set") || "";
    var catId = params.get("cat") || "";
    var col = byCollection[setId];

    if (!setId || !col) {
      renderHome();
      return;
    }

    if (isDirectPlay(col)) {
      startFlatPlay(setId);
      return;
    }

    if (catId && findCategory(setId, catId)) {
      startPlay(setId, catId);
      return;
    }

    renderCategories(setId);
  }

  root.addEventListener("click", function (event) {
    var target = event.target.closest("[data-randomizer-pick-collection]");
    if (target) {
      event.preventDefault();
      var colId = target.getAttribute("data-randomizer-pick-collection");
      var col = byCollection[colId];
      if (col && isDirectPlay(col)) {
        pushRoute(colId, "");
        startFlatPlay(colId);
        return;
      }
      pushRoute(colId, "");
      renderCategories(colId);
      return;
    }

    target = event.target.closest("[data-randomizer-pick-category]");
    if (target) {
      event.preventDefault();
      var catId = target.getAttribute("data-randomizer-pick-category");
      pushRoute(state.collectionId, catId);
      startPlay(state.collectionId, catId);
    }
  });

  if (els.back) {
    els.back.addEventListener("click", function () {
      var col = byCollection[state.collectionId];
      if (col && isDirectPlay(col)) {
        pushRoute("", "");
        renderHome();
        return;
      }
      pushRoute(state.collectionId, "");
      renderCategories(state.collectionId);
    });
  }

  if (els.shuffle) {
    els.shuffle.addEventListener("click", shuffleNext);
  }

  if (els.reveal) {
    els.reveal.addEventListener("click", revealAnswer);
  }

  if (els.saveOffline) {
    els.saveOffline.addEventListener("click", downloadOffline);
  }

  window.addEventListener("popstate", routeFromLocation);
  routeFromLocation();
})();
