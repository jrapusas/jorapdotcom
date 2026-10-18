/**
 * Shared helpers for random note / duo UIs.
 */
(function () {
  var SKIP_ARTICLE =
    ".notes-graph-panel, .notes-toolbar, .notes-article-header, .article-title, .notes-copy-md, .toc-wrapper, .notes-outgoing, .notes-see-also, .notes-backlinks, .notes-note-flashcards";
  var PROMPT_PREFILL_MAX_URL = 1800;
  var escapeHtml = window.jorapEscapeHtml;

  function normalizeText(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cloneArticleBody(article) {
    var body = document.createElement("div");
    body.className = "notes-random-body";
    var children = article.children;

    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (child.matches(SKIP_ARTICLE)) continue;
      body.appendChild(child.cloneNode(true));
    }

    return body;
  }

  function cloneNoteContent(article) {
    var body = document.createElement("div");
    body.className = "notes-random-body";
    var contentEl = article.querySelector(".notes-content");
    if (!contentEl) return body;

    var clone = contentEl.cloneNode(true);
    clone.querySelectorAll(".notes-flashcard, .notes-note-flashcards").forEach(function (node) {
      node.remove();
    });
    body.appendChild(clone);
    return body;
  }

  function setSlotLoading(slot) {
    slot.innerHTML = '<p class="notes-random-loading text-ink-muted text-sm">Loading…</p>';
    slot.classList.remove("notes-random-panel--empty");
  }

  function setSlotEmpty(slot, message) {
    slot.innerHTML = '<p class="notes-random-empty text-ink-muted text-sm">' + message + "</p>";
    slot.classList.add("notes-random-panel--empty");
  }

  function renderNoteIntoSlot(slot, pick, opts) {
    opts = opts || {};

    if (!pick) {
      setSlotEmpty(slot, opts.emptyMessage || "No notes in the garden yet.");
      return Promise.resolve(null);
    }

    setSlotLoading(slot);

    var headingTag = opts.headingTag || "h3";
    var panelClass =
      "notes-random-panel border-divider rounded border p-5" + (opts.panelExtraClass ? " " + opts.panelExtraClass : "");
    var bodyFn = opts.bodyMode === "content" ? cloneNoteContent : cloneArticleBody;

    return fetch(pick.url)
      .then(function (res) {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var article = doc.querySelector("article");
        var titleEl = doc.querySelector(".article-title");
        var contentEl = doc.querySelector(".notes-content");
        if (!article || !titleEl || !contentEl) throw new Error("parse failed");

        var panel = document.createElement("article");
        panel.className = panelClass;

        var heading = document.createElement(headingTag);
        heading.className = opts.headingClass || "h5 mb-3";
        var link = document.createElement("a");
        link.className = "text-accent no-underline hover:underline";
        link.href = pick.url;
        link.textContent = titleEl.textContent.trim();
        heading.appendChild(link);
        panel.appendChild(heading);
        panel.appendChild(bodyFn(article));

        slot.innerHTML = "";
        slot.appendChild(panel);
        slot.classList.remove("notes-random-panel--empty");

        return {
          title: titleEl.textContent.trim(),
          url: pick.url,
          bodyText: normalizeText(contentEl.textContent),
        };
      })
      .catch(function () {
        slot.innerHTML =
          "<article class=\"" +
          panelClass +
          '">' +
          "<" +
          headingTag +
          ' class="' +
          (opts.headingClass || "h5 mb-3") +
          '"><a class="text-accent no-underline hover:underline" href="' +
          escapeHtml(pick.url) +
          '">' +
          escapeHtml(pick.title) +
          "</a></" +
          headingTag +
          ">" +
          '<p class="text-ink-muted text-sm">Could not load this note. <a href="' +
          escapeHtml(pick.url) +
          '">Open it directly</a>.</p></article>';

        return {
          title: pick.title,
          url: pick.url,
          bodyText: "",
        };
      });
  }

  function pickOne(pool, excludeUrls) {
    if (!pool.length) return null;

    var exclude = excludeUrls || [];
    var candidates = pool.filter(function (entry) {
      return exclude.indexOf(entry.url) === -1;
    });

    if (!candidates.length) candidates = pool.slice();
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function connectionPromptIntro() {
    return "I'm exploring connections between two ideas in my notes garden (PKM, faith, ethics, systems). Note text is assembled from frontmatter: description, key_concept, examples, relationships.";
  }

  function formatPromptNote(index, note, origin) {
    var lines = ["Note " + index + ":"];
    if (!note || !note.title) return lines;
    lines.push('"' + note.title + '"');
    if (note.url) lines.push("URL: " + origin + note.url);
    if (note.bodyText) lines.push(note.bodyText);
    return lines;
  }

  function connectionPromptTail() {
    return [
      "---",
      "",
      "## TASK",
      "",
      "Analyze how these notes relate. Generate outputs that are:",
      "- Concrete and actionable (what to do next time the situation shows up)",
      "- Atomic (one claim per note title or relationship row)",
      "- Multi-scale (immediate move → short experiment → longer habit)",
      "",
      "Topics span PKM, gospel, ethics, and systems - not workflow-only.",
      "Avoid abstract theory unless tied to a move I'd make this week.",
      "",
      "Voice: plain words, first person where natural, specific scenes. No AI filler (\"crucial\", \"delve\", \"leverage\", \"Furthermore\"). Read like JoRap typed it mid-life.",
      "",
      "---",
      "",
      "## OUTPUT FORMAT",
      "",
      "### 1. Core Relationship",
      "1–2 sentences explaining the deepest connection between the notes.",
      "",
      "---",
      "",
      "### 2. 3 Unexpected Links (Insight → Mechanism → Action)",
      "Each must include:",
      "- Insight (what is connected)",
      "- Mechanism (why/how it connects)",
      "- Action (what I can do immediately)",
      "",
      "---",
      "",
      "### 3. 3 Sibling Atomic Note Stubs",
      "Notes missing from the garden that would strengthen this connection. Each:",
      "- title (3–7 words, reusable [[wikilink]] target)",
      "- one-line claim (description-ready)",
      "- suggested relationships rows (type + [[wikilink]] + reason) tying it to notes above",
      "",
      "---",
      "",
      "### 4. 3 Relationship Rows to Add",
      "YAML-ready rows I could paste into frontmatter on an existing note:",
      "- type: extends | contradicts | implements | alternative",
      "- wikilink: \"[[Note Title]]\"",
      "- reason: one short clause",
      "",
      "---",
      "",
      "### 5. 3 Quick Wins (2–15 minutes)",
      "- Action",
      "- Why it matters",
      "- Immediate effect",
      "",
      "---",
      "",
      "### 6. 3 Experiments (Validation Layer)",
      "Each includes:",
      "- Name",
      "- Steps (simple, executable)",
      "- Time required (5–15 min / daily / weekly)",
      "- Expected outcome",
      "- Success indicator",
      "",
      "---",
      "",
      "### 7. 3 Quotable One-Liners",
      "Self-contained truths I'd say aloud - paradox, tension, or practical shift. No hashtags, no thread setup.",
      "",
      "---",
      "",
      "## RULES",
      "",
      "- Prefer usefulness over creativity",
      "- If uncertain, default to a simpler action or experiment",
      "- Every insight must connect to at least one action or relationship row",
      "- New note stubs use frontmatter shape (empty body) - not body ## sections",
      "- Do not [[wikilink]] utility/meta pages (Graph, Issues, Flashcards, Review) - use URLs",
      "- Keep outputs minimal but high-signal",
    ];
  }

  function createAiHelpers(opts) {
    var promptEl = opts.promptEl;
    var copyPromptBtn = opts.copyPromptBtn;
    var openedLabel = opts.openedLabel;
    var copiedLabel = opts.copiedLabel;

    function flashButton(btn, message) {
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = message;
      window.setTimeout(function () {
        btn.textContent = original;
      }, 1600);
    }

    function promptIsReady() {
      if (!promptEl) return false;
      var prompt = promptEl.value;
      if (!prompt) return false;
      if (prompt === "Loading note…" || prompt === "Loading notes…") return false;
      if (prompt.indexOf("Shuffle to load") === 0) return false;
      return true;
    }

    function aiChatFallbackUrl(template) {
      var qIndex = template.indexOf("?q=");
      if (qIndex !== -1) return template.slice(0, qIndex);
      var queryIndex = template.indexOf("?");
      if (queryIndex !== -1) return template.slice(0, queryIndex);
      return template;
    }

    function copyPrompt() {
      if (!promptEl || !navigator.clipboard || !promptIsReady()) return;

      navigator.clipboard.writeText(promptEl.value).then(function () {
        flashButton(copyPromptBtn, "Copied");
      });
    }

    function sendPromptToChat(chatUrl, sendBtn, prefill) {
      if (!promptEl || !promptIsReady()) return;

      var prompt = promptEl.value;

      function openChat(url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      if (prefill && chatUrl.indexOf("?q=") !== -1) {
        var prefillUrl = chatUrl + encodeURIComponent(prompt);
        if (prefillUrl.length <= PROMPT_PREFILL_MAX_URL) {
          openChat(prefillUrl);
          flashButton(sendBtn, openedLabel);
          return;
        }
      }

      if (!navigator.clipboard) {
        openChat(aiChatFallbackUrl(chatUrl));
        return;
      }

      navigator.clipboard.writeText(prompt).then(function () {
        openChat(aiChatFallbackUrl(chatUrl));
        flashButton(sendBtn, copiedLabel);
      });
    }

    return {
      flashButton: flashButton,
      promptIsReady: promptIsReady,
      copyPrompt: copyPrompt,
      sendPromptToChat: sendPromptToChat,
    };
  }

  function wireSendPromptButtons(prefix, ai) {
    var btns = document.querySelectorAll("[data-" + prefix + "-send-prompt]");
    Array.prototype.forEach.call(btns, function (btn) {
      bindTapIf(btn, function (event) {
        event.preventDefault();
        event.stopPropagation();
        var chatUrl = btn.getAttribute("data-ai-chat-url") || "https://chatgpt.com/?q=";
        var prefill = btn.getAttribute("data-ai-prefill") === "true";
        ai.sendPromptToChat(chatUrl, btn, prefill);
      });
    });
  }

  function bindTapIf(el, fn) {
    var bind = window.jorapBindTouchClickIf;
    if (bind) {
      bind(el, fn);
      return;
    }
    if (el) el.addEventListener("click", fn);
  }

  function buildAdjacency(edges) {
    var adj = Object.create(null);
    (edges || []).forEach(function (edge) {
      var s = edge.source;
      var t = edge.target;
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push(t);
      adj[t].push(s);
    });
    return adj;
  }

  function shortestPath(adj, start, end) {
    if (!start || !end || start === end) return [start];
    if (!adj[start] || !adj[end]) return null;

    var queue = [start];
    var prev = Object.create(null);
    prev[start] = null;

    while (queue.length) {
      var node = queue.shift();
      if (node === end) break;
      (adj[node] || []).forEach(function (next) {
        if (prev[next] !== undefined) return;
        prev[next] = node;
        queue.push(next);
      });
    }

    if (prev[end] === undefined) return null;

    var path = [];
    var cur = end;
    while (cur) {
      path.unshift(cur);
      cur = prev[cur];
    }
    return path;
  }

  function pathHopLabel(path) {
    if (!path || path.length < 2) return "";
    var hops = path.length - 1;
    return hops + " hop" + (hops === 1 ? "" : "s");
  }

  function renderPathChain(chainEl, path, titleByUrl) {
    if (!chainEl) return;
    var horizontal = chainEl.classList.contains("notes-path-chain--row");
    var items = (path || []).map(function (url) {
      var title = (titleByUrl && titleByUrl[url]) || url;
      return (
        '<a class="text-accent no-underline hover:underline" href="' +
        escapeHtml(url) +
        '">' +
        escapeHtml(title) +
        "</a>"
      );
    });

    if (horizontal) {
      chainEl.innerHTML = items.join(
        '<span class="text-ink-muted px-1" aria-hidden="true">→</span>'
      );
      return;
    }

    chainEl.innerHTML = items
      .map(function (link) {
        return "<li>" + link + "</li>";
      })
      .join("");
  }

  function renderPathBetween(opts) {
    opts = opts || {};
    var resultEl = opts.resultEl;
    var chainEl = opts.chainEl;
    var emptyEl = opts.emptyEl;
    var start = opts.start;
    var end = opts.end;
    var sameNoteMsg = opts.sameNoteMsg || "Pick two different notes.";
    var noPathMsg = opts.noPathMsg || "No path found through wikilinks.";

    if (!resultEl) return null;

    if (!start || !end) {
      resultEl.classList.add("hidden");
      if (emptyEl) emptyEl.classList.add("hidden");
      return null;
    }

    if (start === end) {
      resultEl.classList.add("hidden");
      if (emptyEl) {
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = sameNoteMsg;
      }
      return [start];
    }

    var path = shortestPath(opts.adj, start, end);
    if (!path || path.length < 2) {
      resultEl.classList.add("hidden");
      if (emptyEl) {
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = noPathMsg;
      }
      return null;
    }

    if (emptyEl) emptyEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    renderPathChain(chainEl, path, opts.titleByUrl);
    return path;
  }

  function pathPromptLine(path, titleByUrl) {
    if (!path || path.length < 2) return "";
    return (
      "A shortest wikilink path between these notes (others may exist):\n" +
      path
        .map(function (url) {
          return titleByUrl[url] || url;
        })
        .join(" → ")
    );
  }

  window.jorapNotesRandomCore = {
    buildAdjacency: buildAdjacency,
    cloneArticleBody: cloneArticleBody,
    connectionPromptIntro: connectionPromptIntro,
    connectionPromptTail: connectionPromptTail,
    formatPromptNote: formatPromptNote,
    createAiHelpers: createAiHelpers,
    wireSendPromptButtons: wireSendPromptButtons,
    bindTapIf: bindTapIf,
    normalizeText: normalizeText,
    pathHopLabel: pathHopLabel,
    pathPromptLine: pathPromptLine,
    pickOne: pickOne,
    renderNoteIntoSlot: renderNoteIntoSlot,
    renderPathBetween: renderPathBetween,
    renderPathChain: renderPathChain,
    setSlotEmpty: setSlotEmpty,
    setSlotLoading: setSlotLoading,
    shortestPath: shortestPath,
  };
})();
