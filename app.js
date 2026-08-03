/* ============================================================
   Microsoft Copilot Quiz — application logic
   Pure static, no framework. State lives in memory only.
   ============================================================ */
(function () {
  "use strict";

  // ---- state (in-memory only; nothing persisted or sent anywhere) ----
  var state = {
    manifest: null,
    moduleMeta: null,   // { number, title, icon, file, count }
    module: null,       // loaded module JSON { module, title, icon, questions[] }
    userName: "",
    current: 0,
    answers: []         // per question: { picked:[], correct:[], isRight:bool }
  };

  var GOOD_BADGES = ["✅ Correct", "🎯 Nailed it", "💡 Exactly right", "⚡ Sharp"];
  var BAD_BADGES = ["❌ Not quite", "🔍 Close — look again"];
  var LETTERS = ["A", "B", "C", "D", "E"];

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- tiny DOM helpers ----
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(screenId) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("is-active");
    $("#" + screenId).classList.add("is-active");
    // move focus to the main region for screen-reader/keyboard users
    var main = $("#main");
    if (main) { main.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  // ============================================================
  //  Landing: load manifest, render module cards
  // ============================================================
  function loadManifest() {
    fetch("data/modules.json")
      .then(function (r) { if (!r.ok) throw new Error("manifest"); return r.json(); })
      .then(function (data) {
        state.manifest = data;
        renderModules(data);
        applyDeepLink(data);
      })
      .catch(function () {
        $("#landing-error").hidden = false;
      });
  }

  // Independent per-quiz links: ?m=3 (or ?module=3) opens that module directly.
  function applyDeepLink(data) {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get("m") || params.get("module");
    if (!raw) return;
    var num = parseInt(raw, 10);
    if (isNaN(num)) return;
    var meta = null;
    for (var i = 0; i < data.modules.length; i++) {
      if (data.modules[i].number === num) { meta = data.modules[i]; break; }
    }
    if (meta) chooseModule(meta);
  }

  function renderModules(data) {
    var grid = $("#module-grid");
    grid.innerHTML = "";
    data.modules.forEach(function (m) {
      var card = el("button", "module-card");
      card.type = "button";
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label",
        "Module " + m.number + ": " + m.title + ", " + m.count + " questions");

      var top = el("div", "m-top");
      var icon = el("span", "m-icon");
      icon.setAttribute("role", "img");
      icon.setAttribute("aria-label", m.title);
      icon.textContent = m.icon;
      var num = el("span", "m-num", "Module " + m.number);
      top.appendChild(icon);
      top.appendChild(num);

      var title = el("div", "m-title", m.title);
      var count = el("div", "m-count", m.count + " questions");

      card.appendChild(top);
      card.appendChild(title);
      card.appendChild(count);
      card.addEventListener("click", function () { chooseModule(m); });
      grid.appendChild(card);
    });
  }

  // ============================================================
  //  Name entry
  // ============================================================
  function chooseModule(meta) {
    state.moduleMeta = meta;
    var icon = $("#name-module-icon");
    icon.textContent = meta.icon;
    icon.setAttribute("aria-label", meta.title);
    $("#name-module-title").textContent = "Module " + meta.number + " · " + meta.title;
    $("#name-input").value = "";
    $("#name-error").hidden = true;
    show("screen-name");
    setTimeout(function () { $("#name-input").focus(); }, 60);
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    var name = $("#name-input").value.trim();
    if (!name) {
      $("#name-error").hidden = false;
      $("#name-input").setAttribute("aria-invalid", "true");
      $("#name-input").focus();
      return;
    }
    $("#name-input").removeAttribute("aria-invalid");
    state.userName = name;
    loadModuleQuestions(state.moduleMeta);
  }

  // ============================================================
  //  Load a module's questions and start the quiz
  // ============================================================
  function loadModuleQuestions(meta) {
    fetch(meta.file)
      .then(function (r) { if (!r.ok) throw new Error("module"); return r.json(); })
      .then(function (data) {
        state.module = data;
        state.current = 0;
        state.answers = [];
        startQuiz();
      })
      .catch(function () {
        alert("Sorry — this module's questions could not be loaded. Please try again.");
      });
  }

  function startQuiz() {
    var m = state.module;
    var icon = $("#quiz-module-icon");
    icon.textContent = m.icon;
    icon.setAttribute("aria-label", m.title);
    $("#quiz-module-title").textContent = m.title;
    $("#q-total").textContent = m.questions.length;
    var pb = $(".progress");
    pb.setAttribute("aria-valuemax", m.questions.length);
    show("screen-quiz");
    renderQuestion();
  }

  // ============================================================
  //  Render one question
  // ============================================================
  function renderQuestion() {
    var m = state.module;
    var q = m.questions[state.current];
    var total = m.questions.length;

    $("#q-current").textContent = state.current + 1;
    var pct = Math.round((state.current) / total * 100);
    $("#progress-fill").style.width = pct + "%";
    $(".progress").setAttribute("aria-valuenow", state.current);

    // reset panels
    var reaction = $("#reaction");
    reaction.hidden = true;
    $("#reaction-badge").className = "reaction-badge";
    $("#reaction-badge").textContent = "";
    var typeTag = $("#question-type");

    $("#question-text").textContent = q.question;

    var options = $("#options");
    options.innerHTML = "";
    var submitRow = $("#submit-row");

    if (q.type === "multi") {
      typeTag.hidden = false;
      typeTag.textContent = "Select all that apply";
      submitRow.hidden = false;
      $("#submit-answer").disabled = false;
      q.options.forEach(function (opt, i) {
        var li = el("li");
        var label = el("label", "option-check");
        var input = document.createElement("input");
        input.type = "checkbox";
        input.value = String(i);
        input.name = "opt";
        var key = el("span", "option-key", LETTERS[i]);
        var text = el("span", "option-text", opt);
        label.appendChild(input);
        label.appendChild(key);
        label.appendChild(text);
        li.appendChild(label);
        options.appendChild(li);
      });
    } else {
      // single or truefalse: click submits
      typeTag.hidden = q.type !== "truefalse";
      if (q.type === "truefalse") { typeTag.textContent = "True or false"; }
      submitRow.hidden = true;
      q.options.forEach(function (opt, i) {
        var li = el("li");
        var btn = el("button", "option-btn");
        btn.type = "button";
        var key = el("span", "option-key", LETTERS[i]);
        var text = el("span", "option-text", opt);
        var mark = el("span", "option-mark");
        mark.setAttribute("aria-hidden", "true");
        btn.appendChild(key);
        btn.appendChild(text);
        btn.appendChild(mark);
        btn.addEventListener("click", function () { submitAnswer([i]); });
        li.appendChild(btn);
        options.appendChild(li);
      });
    }
  }

  // ============================================================
  //  Submit / grade an answer
  // ============================================================
  function collectMulti() {
    var picked = [];
    var boxes = document.querySelectorAll('#options input[type="checkbox"]');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) picked.push(parseInt(boxes[i].value, 10));
    }
    return picked;
  }

  function arraysEqualAsSets(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort(function (x, y) { return x - y; });
    var sb = b.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  function submitAnswer(pickedFromClick) {
    var q = state.module.questions[state.current];
    var picked = pickedFromClick || collectMulti();
    if (q.type === "multi" && picked.length === 0) {
      // require at least one selection
      var badge = $("#reaction-badge");
      return; // do nothing; keep waiting
    }
    var isRight = arraysEqualAsSets(picked, q.correct);
    state.answers[state.current] = {
      picked: picked, correct: q.correct.slice(), isRight: isRight, type: q.type
    };
    revealAnswer(q, picked, isRight);
  }

  function markOption(node, kind, tagText) {
    node.classList.add(kind);
    var mark = node.querySelector(".option-mark");
    if (mark) mark.textContent = (kind === "correct") ? "✅" : "❌";
    var tag = el("span", "state-tag", tagText);
    node.appendChild(tag);
  }

  function revealAnswer(q, picked, isRight) {
    var correctSet = q.correct;

    if (q.type === "multi") {
      var labels = document.querySelectorAll("#options .option-check");
      labels.forEach(function (label, i) {
        var input = label.querySelector("input");
        input.disabled = true;
        var isCorrect = correctSet.indexOf(i) !== -1;
        var wasPicked = picked.indexOf(i) !== -1;
        if (isCorrect) {
          markOption(label, "correct", wasPicked ? "Correct ✓" : "Correct answer");
          var m1 = el("span", "option-mark"); // ensure a check visible
        } else if (wasPicked) {
          markOption(label, "incorrect", "Your pick");
        }
      });
      $("#submit-row").hidden = true;
    } else {
      var btns = document.querySelectorAll("#options .option-btn");
      btns.forEach(function (btn, i) {
        btn.disabled = true;
        var isCorrect = correctSet.indexOf(i) !== -1;
        var wasPicked = picked.indexOf(i) !== -1;
        if (isCorrect) {
          markOption(btn, "correct", wasPicked ? "Correct" : "Correct answer");
        } else if (wasPicked) {
          markOption(btn, "incorrect", "Your pick");
        }
      });
    }

    // reaction badge
    var badge = $("#reaction-badge");
    badge.textContent = isRight
      ? GOOD_BADGES[Math.floor(pseudoRandom() * GOOD_BADGES.length)]
      : BAD_BADGES[Math.floor(pseudoRandom() * BAD_BADGES.length)];
    badge.classList.add(isRight ? "good" : "bad");
    if (!reduceMotion) badge.classList.add("pop");

    // explanation
    $("#explanation-text").textContent = q.explanation || "";
    var link = $("#source-link");
    if (q.source) {
      link.href = q.source;
      link.style.display = "";
    } else {
      link.style.display = "none";
    }

    $("#reaction").hidden = false;
    $("#next-btn").focus();

    if (isRight && !reduceMotion) confettiBurst(0.35);
  }

  // simple in-memory pseudo-random (Math.random is fine at runtime in the browser)
  function pseudoRandom() { return Math.random(); }

  function nextQuestion() {
    state.current++;
    if (state.current >= state.module.questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  }

  // ============================================================
  //  Result
  // ============================================================
  function scoreBand(pct) {
    if (pct === 100) return { emoji: "🏆", label: "Perfect Score", line: "Flawless — you have really mastered this module.", confetti: true };
    if (pct >= 80) return { emoji: "🌟", label: "Excellent", line: "Outstanding work. You clearly know this material well.", confetti: false };
    if (pct >= 60) return { emoji: "👍", label: "Good Progress", line: "Nice job. A quick review and you will have it locked in.", confetti: false };
    if (pct >= 40) return { emoji: "📚", label: "Keep Going", line: "You are getting there. Revisit the explanations and try again.", confetti: false };
    return { emoji: "🔄", label: "Worth a Retake", line: "A solid starting point. Review the module and give it another go.", confetti: false };
  }

  function formatDate() {
    var d = new Date();
    try {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return d.toDateString();
    }
  }

  function showResult() {
    var m = state.module;
    var total = m.questions.length;
    var score = 0;
    state.answers.forEach(function (a) { if (a && a.isRight) score++; });
    var pct = Math.round(score / total * 100);
    var band = scoreBand(pct);

    var emoji = $("#result-emoji");
    emoji.textContent = band.emoji;
    emoji.setAttribute("aria-label", band.label);
    $("#result-headline").textContent = band.label;
    $("#result-line").textContent = band.line;
    $("#result-name").textContent = state.userName;
    var micon = $("#result-module-icon");
    micon.textContent = m.icon;
    micon.setAttribute("aria-label", m.title);
    $("#result-module-title").textContent = "Module " + state.moduleMeta.number + " · " + m.title;
    $("#result-date").textContent = formatDate();
    $("#ring-score").textContent = score + "/" + total;

    // per-question strip
    var strip = $("#result-strip");
    strip.innerHTML = "";
    state.answers.forEach(function (a, i) {
      var chip = el("span", "strip-chip " + (a && a.isRight ? "ok" : "no"));
      chip.setAttribute("role", "img");
      chip.setAttribute("aria-label", "Question " + (i + 1) + ": " + (a && a.isRight ? "correct" : "incorrect"));
      chip.textContent = (a && a.isRight) ? "✅" : "❌";
      strip.appendChild(chip);
    });

    buildReview();
    show("screen-result");
    $("#download-note").textContent = "";
    animateRing(pct, score, total);
    if (band.confetti && !reduceMotion) confettiBurst(1);
  }

  function animateRing(pct, score, total) {
    var circle = $("#ring-value");
    var r = 52;
    var circumference = 2 * Math.PI * r;
    circle.style.strokeDasharray = circumference.toFixed(2);
    var pctEl = $("#ring-pct");

    if (reduceMotion) {
      circle.style.strokeDashoffset = (circumference * (1 - pct / 100)).toFixed(2);
      pctEl.textContent = pct + "%";
      return;
    }

    var duration = 900;
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      var cur = pct * eased;
      circle.style.strokeDashoffset = (circumference * (1 - cur / 100)).toFixed(2);
      pctEl.textContent = Math.round(cur) + "%";
      if (t < 1) requestAnimationFrame(frame);
      else pctEl.textContent = pct + "%";
    }
    requestAnimationFrame(frame);
  }

  function answerText(q, indices) {
    if (!indices || indices.length === 0) return "No answer";
    return indices.map(function (i) { return q.options[i]; }).join("; ");
  }

  function buildReview() {
    var m = state.module;
    var list = $("#review-list");
    list.innerHTML = "";
    m.questions.forEach(function (q, i) {
      var a = state.answers[i] || { picked: [], correct: q.correct, isRight: false };
      var li = el("li", "review-item " + (a.isRight ? "ok" : "no"));

      var qRow = el("div", "review-q");
      var status = el("span", "review-status");
      status.setAttribute("role", "img");
      status.setAttribute("aria-label", a.isRight ? "Correct" : "Incorrect");
      status.textContent = a.isRight ? "✅" : "❌";
      var qtext = el("span", "review-qtext", (i + 1) + ". " + q.question);
      qRow.appendChild(status);
      qRow.appendChild(qtext);
      li.appendChild(qRow);

      var yours = el("p", "review-ans yours" + (a.isRight ? " correct" : " wrong"));
      yours.appendChild(el("span", "lbl", "Your answer: "));
      yours.appendChild(el("span", "val", answerText(q, a.picked)));
      li.appendChild(yours);

      if (!a.isRight) {
        var corr = el("p", "review-ans correct");
        corr.appendChild(el("span", "lbl", "Correct answer: "));
        corr.appendChild(el("span", "val", answerText(q, q.correct)));
        li.appendChild(corr);
      }

      var exp = el("p", "review-exp", q.explanation || "");
      li.appendChild(exp);
      list.appendChild(li);
    });
  }

  // ============================================================
  //  Download result as image (html2canvas)
  // ============================================================
  function sanitizeName(name) {
    return name.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "") || "result";
  }

  function buildExportCard() {
    var m = state.module;
    var total = m.questions.length;
    var score = 0;
    state.answers.forEach(function (a) { if (a && a.isRight) score++; });
    var pct = Math.round(score / total * 100);
    var band = scoreBand(pct);

    var card = el("div", "export-card");

    var emoji = el("div", "ec-emoji", band.emoji);
    var label = el("div", "ec-label", band.label);
    var name = el("div", "ec-name", state.userName);
    var mod = el("div", "ec-module", m.icon + "  Module " + state.moduleMeta.number + " · " + m.title);

    var scoreRow = el("div", "ec-score");
    scoreRow.appendChild(el("span", "ec-pct", pct + "%"));
    scoreRow.appendChild(el("span", "ec-frac", score + " / " + total + " correct"));

    var strip = el("div", "ec-strip");
    state.answers.forEach(function (a) {
      var chip = el("span", "ec-chip " + (a && a.isRight ? "ok" : "no"), (a && a.isRight) ? "✅" : "❌");
      strip.appendChild(chip);
    });

    var date = el("div", "ec-date", "📅  " + formatDate());
    var brand = el("div", "ec-brand", "Microsoft Copilot Quiz");

    card.appendChild(emoji);
    card.appendChild(label);
    card.appendChild(name);
    card.appendChild(mod);
    card.appendChild(scoreRow);
    card.appendChild(strip);
    card.appendChild(date);
    card.appendChild(brand);
    return card;
  }

  function downloadResult() {
    var note = $("#download-note");
    if (typeof window.html2canvas !== "function") {
      note.textContent = "Image download is unavailable right now (the capture library did not load). Please check your connection and retry.";
      return;
    }
    note.textContent = "Preparing your image…";

    // Off-screen, fixed-width container so viewport width / scroll never clips it.
    var holder = el("div", "export-holder");
    var card = buildExportCard();
    holder.appendChild(card);
    document.body.appendChild(holder);

    window.html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      width: card.offsetWidth,
      height: card.offsetHeight,
      windowWidth: card.offsetWidth
    }).then(function (canvas) {
      var url = canvas.toDataURL("image/png");
      // debug handle so automated tests can inspect the exported pixels
      try { window.__lastResultImageURL = url; } catch (e) {}
      var a = document.createElement("a");
      a.href = url;
      a.download = sanitizeName(state.userName) + "-module" + state.moduleMeta.number + "-result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      note.textContent = "Saved. Check your downloads folder.";
    }).catch(function () {
      note.textContent = "Sorry — the image could not be generated. Please try again.";
    }).then(function () {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
    });
  }

  // ============================================================
  //  Confetti (small, tasteful, canvas-based)
  // ============================================================
  var confettiCanvas, confettiCtx, confettiParticles = [], confettiRAF = null;
  function confettiBurst(intensity) {
    if (reduceMotion) return;
    confettiCanvas = confettiCanvas || $("#confetti");
    if (!confettiCanvas) return;
    confettiCtx = confettiCtx || confettiCanvas.getContext("2d");
    resizeConfetti();
    confettiCanvas.classList.add("on");

    var colors = ["#2f5bd0", "#4f7ff0", "#1a7a43", "#f2b705", "#d8582f", "#7b61ff"];
    var count = Math.round(70 * intensity);
    var cx = confettiCanvas.width / (window.devicePixelRatio || 1) / 2;
    for (var i = 0; i < count; i++) {
      confettiParticles.push({
        x: cx + (Math.random() - 0.5) * 160,
        y: -20 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 90 + Math.random() * 40
      });
    }
    if (!confettiRAF) confettiRAF = requestAnimationFrame(stepConfetti);
  }

  function resizeConfetti() {
    var dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stepConfetti() {
    var w = window.innerWidth, h = window.innerHeight;
    confettiCtx.clearRect(0, 0, w, h);
    var alive = false;
    for (var i = 0; i < confettiParticles.length; i++) {
      var p = confettiParticles[i];
      if (p.life <= 0) continue;
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vr; p.life--;
      if (p.y < h + 20) alive = true;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    }
    if (alive) {
      confettiRAF = requestAnimationFrame(stepConfetti);
    } else {
      confettiCtx.clearRect(0, 0, w, h);
      confettiParticles = [];
      confettiCanvas.classList.remove("on");
      confettiRAF = null;
    }
  }

  // ============================================================
  //  Wire up events
  // ============================================================
  function init() {
    loadManifest();
    $("#name-form").addEventListener("submit", handleNameSubmit);
    $("#answer-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submitAnswer(null);
    });
    $("#next-btn").addEventListener("click", nextQuestion);
    $("#download-btn").addEventListener("click", downloadResult);

    // delegated actions (back to modules / retake)
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "back-to-modules") { show("screen-landing"); }
      else if (action === "retake") {
        state.current = 0;
        state.answers = [];
        loadModuleQuestions(state.moduleMeta);
      }
    });

    window.addEventListener("resize", function () {
      if (confettiCanvas && confettiCanvas.classList.contains("on")) resizeConfetti();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
