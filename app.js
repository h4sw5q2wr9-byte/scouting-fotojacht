(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const data = (window.CHALLENGES || []).filter((x) => x.title);
  const CATS = [
    "Alles",
    "Nederlandse memes",
    "Nederlandse tv & film",
    "Memes wereldwijd",
    "Films & series",
    "Iconische foto’s",
  ];
  const STATE_KEY = "fotojacht-state-v2";
  let s = {
    category: "Alles",
    difficulty: "Alle",
    search: "",
    favOnly: false,
    hideDone: false,
    localOnly: false,
    skipped: [],
    awards: {},
    favs: [],
    done: [],
    teams: {
      a: { name: "Team Geel", score: 0 },
      b: { name: "Team Blauw", score: 0 },
    },
  };
  try {
    const old = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    s = { ...s, ...old, teams: old.teams || s.teams };
  } catch (e) {}
  s.favs = Array.isArray(s.favs)
    ? s.favs.filter((id) => data.some((x) => x.id === id))
    : [];
  s.done = Array.isArray(s.done)
    ? s.done.filter((id) => data.some((x) => x.id === id))
    : [];
  s.skipped = Array.isArray(s.skipped) ? s.skipped : [];
  s.awards = s.awards && typeof s.awards === "object" ? s.awards : {};
  for (const [key, name] of [
    ["a", "Team Geel"],
    ["b", "Team Blauw"],
  ]) {
    const t = s.teams?.[key];
    if (!s.teams || typeof s.teams !== "object") s.teams = {};
    s.teams[key] = {
      name: typeof t?.name === "string" ? t.name : name,
      score: Number.isFinite(t?.score) ? Math.max(0, t.score) : 0,
    };
  }
  let selected = 0,
    timer = 300,
    timerInit = 300,
    running = false,
    tick = null,
    currentImageVersion = 0,
    previousFocus = null;
  const localImages = new Map();
  const write = () => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(s));
    } catch (e) {}
  };
  const escapeHtml = (str) =>
    String(str || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const imageCache = new Map();
  const defaultEmoji = (c) =>
    c.startsWith("Nederlandse")
      ? "🇳🇱"
      : c === "Films & series"
        ? "🎬"
        : c === "Iconische foto’s"
          ? "🖼️"
          : "😂";
  const searchLink = (item) =>
    "https://www.google.com/search?tbm=isch&q=" +
    encodeURIComponent(item.query);
  function matches(item) {
    return (
      (s.category === "Alles" || item.category === s.category) &&
      (s.difficulty === "Alle" || item.difficulty === s.difficulty) &&
      (!s.localOnly || item.image) &&
      (!s.favOnly || s.favs.includes(item.id)) &&
      (!s.hideDone || !s.done.includes(item.id)) &&
      (!s.search ||
        [item.title, item.category, item.description, item.query]
          .join(" ")
          .toLowerCase()
          .includes(s.search.toLowerCase()))
    );
  }
  function filtered() {
    return data.filter(matches);
  }
  function renderCategories() {
    $("#categories").innerHTML = CATS.map(
      (c) =>
        `<button class="chip ${s.category === c ? "selected" : ""}" data-category="${escapeHtml(c)}">${c === "Alles" ? "✨ " : c.startsWith("Nederlandse") ? "🇳🇱 " : c === "Films & series" ? "🎬 " : c === "Iconische foto’s" ? "🖼️ " : "😂 "}${escapeHtml(c)}</button>`,
    ).join("");
    document.querySelectorAll("[data-category]").forEach((b) =>
      b.addEventListener("click", () => {
        s.category = b.dataset.category;
        render();
      }),
    );
  }
  function imgCard(item) {
    const file = localImages.get(item.id);
    const src = file || item.image || imageCache.get(item.id);
    return src
      ? `<img data-image="${escapeHtml(item.id)}" src="${escapeHtml(src)}" alt="Voorbeeldfoto: ${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="placeholder" hidden>${defaultEmoji(item.category)}<small>EXTERNE ZOEKREFERENTIE ↗</small></div>`
      : `<div class="placeholder">${defaultEmoji(item.category)}<small>EXTERNE ZOEKREFERENTIE ↗</small></div>`;
  }
  function render() {
    renderCategories();
    $("#search").value = s.search;
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((b) =>
        b.classList.toggle("selected", s.difficulty === b.dataset.difficulty),
      );
    $("#favFilter").classList.toggle("selected", s.favOnly);
    $("#hideDone").classList.toggle("selected", s.hideDone);
    $("#totalCount").textContent = data.length;
    $("#nlCount").textContent = data.filter((x) =>
      x.category.startsWith("Nederlandse"),
    ).length;
    $("#doneCount").textContent = s.done.length;
    $("#favCount").textContent = s.favs.length;
    const items = filtered();
    $("#countLabel").textContent =
      `${items.length} van ${data.length} zichtbaar`;
    $("#cards").innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<article class="challenge ${s.done.includes(item.id) ? "done" : ""}" data-id="${item.id}"><div class="photo">${imgCard(item)}<span class="flag">${s.done.includes(item.id) ? "✓ GEDAAN" : item.category.startsWith("Nederlandse") ? "🇳🇱 NEDERLANDS" : item.difficulty.toUpperCase()}</span><button class="fav ${s.favs.includes(item.id) ? "on" : ""}" aria-label="${s.favs.includes(item.id) ? "Verwijder favoriet" : "Favoriet"}" data-fav="${item.id}">${s.favs.includes(item.id) ? "★" : "☆"}</button></div><div class="contents"><span class="source-kind">${item.image ? "▣ LOKALE REFERENTIE" : "↗ ZOEK DE SCÈNE"}</span><div class="titleline"><h3>${escapeHtml(item.title)}</h3></div><p>${escapeHtml(item.description)}</p><div class="meta"><span>👥 ${escapeHtml(item.people)}</span><span>${escapeHtml(item.difficulty)}</span></div><button class="btn sm openCard" data-open="${item.id}">Bekijk opdracht →</button></div></article>`,
          )
          .join("")
      : '<div class="empty">Geen opdrachten gevonden. Probeer een andere zoekterm of verwijder een filter.</div>';
    document
      .querySelectorAll("[data-open]")
      .forEach((b) =>
        b.addEventListener("click", () => openItem(b.dataset.open)),
      );
    document
      .querySelectorAll("[data-fav]")
      .forEach((b) =>
        b.addEventListener("click", () => toggleFav(b.dataset.fav)),
      );
    $("#localFilter").classList.toggle("selected", s.localOnly);
    write();
  }
  function toggleFav(id) {
    s.favs = s.favs.includes(id)
      ? s.favs.filter((x) => x !== id)
      : [...s.favs, id];
    render();
    if ($("#detailOverlay").classList.contains("open")) syncModal();
  }
  function toast(msg) {
    const e = $("#toast");
    e.textContent = msg;
    e.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => e.classList.remove("show"), 3000);
  }
  function getItem() {
    return data[selected];
  }
  function navigate(diff) {
    const list = filtered();
    let idx = list.findIndex((x) => x.id === getItem().id);
    if (!list.length) {
      toast("Geen opdrachten binnen deze filters.");
      return;
    }
    if (idx < 0) idx = diff > 0 ? -1 : 0;
    openItem(
      list[(idx + diff + list.length) % list.length]?.id || getItem().id,
    );
  }
  function chooseRandom() {
    const all = filtered();
    if (!all.length) {
      toast("Geen foto’s met deze filters.");
      return;
    }
    const available = all.filter(
      (x) =>
        !s.done.includes(x.id) &&
        !s.skipped.includes(x.id) &&
        x.id !== getItem()?.id,
    );
    const pool = available.length ? available : all;
    openItem(pool[Math.floor(Math.random() * pool.length)].id);
  }
  function openItem(id) {
    const idx = data.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (selected !== idx) stopClock();
    selected = idx;
    if (!$("#detailOverlay").classList.contains("open"))
      previousFocus = document.activeElement;
    $("#detailOverlay").classList.add("open");
    $("#detailOverlay").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#closeDetail").focus();
    syncModal();
  }
  function closeDetail() {
    const el = $("#detailOverlay");
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    previousFocus?.focus?.();
  }
  function closeScore() {
    const el = $("#scoreOverlay");
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    previousFocus?.focus?.();
  }
  function syncModal() {
    const item = getItem();
    if (!item) return;
    $("#modalCategory").textContent = item.category;
    $("#modalTitle").textContent = item.title;
    $("#modalDesc").textContent = item.description;
    $("#modalPeople").textContent = "👥 " + item.people + " personen";
    $("#modalDifficulty").textContent = item.difficulty;
    $("#searchOriginal").href = searchLink(item);
    $("#modalFav").textContent = s.favs.includes(item.id)
      ? "★ Uit favorieten halen"
      : "☆ Zet bij favorieten";
    $("#doneButton").textContent = s.done.includes(item.id)
      ? "✓ Gedaan — ongedaan maken"
      : "✓ Markeer als gedaan";
    $("#removeCustom").classList.toggle("hidden", !localImages.has(item.id));
    loadModalImage(item);
    syncRound(item);
  }
  function loadModalImage(item) {
    const ver = ++currentImageVersion,
      src = localImages.get(item.id) || item.image || imageCache.get(item.id);
    const ref = $("#reference");
    if (src) {
      ref.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Voorbeeld " + item.title;
      img.referrerPolicy = "no-referrer";
      img.src = src;
      img.onerror = () => {
        if (ver === currentImageVersion) renderMissing(item);
      };
      ref.append(img);
    } else {
      renderMissing(item);
    }
  }
  function renderMissing(item) {
    $("#reference").innerHTML =
      `<div class="refplaceholder"><div class="em">${defaultEmoji(item.category)}</div><strong>Deze scène staat bij de rechthebbende</strong><p>Open de zoekreferentie en kies de exacte scène. Voeg eventueel een toegestaan eigen voorbeeld toe.</p><a class="btn accent" href="${escapeHtml(searchLink(item))}" target="_blank" rel="noopener noreferrer">🔍 Zoek afbeelding ↗</a></div>`;
  }
  const DB_NAME = "scouting-fotojacht-pictures";
  let dbPromise;
  function db() {
    if (!("indexedDB" in window))
      return Promise.reject(new Error("Geen opslag"));
    return (
      dbPromise ||
      (dbPromise = new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore("images");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }))
    );
  }
  async function saveImage(id, blob) {
    const database = await db();
    return new Promise((res, rej) => {
      const tx = database.transaction("images", "readwrite");
      tx.objectStore("images").put(blob, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  async function deleteImage(id) {
    const database = await db();
    return new Promise((res, rej) => {
      const tx = database.transaction("images", "readwrite");
      tx.objectStore("images").delete(id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  async function loadSavedImages() {
    try {
      const database = await db();
      const tx = database.transaction("images");
      const store = tx.objectStore("images");
      const keys = await new Promise((res, rej) => {
        const q = store.getAllKeys();
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
      await Promise.all(
        keys.map(
          (id) =>
            new Promise((res) => {
              const q = store.get(id);
              q.onsuccess = () => {
                if (q.result instanceof Blob) {
                  localImages.set(id, URL.createObjectURL(q.result));
                }
                res();
              };
              q.onerror = res;
            }),
        ),
      );
      render();
    } catch (e) {}
  }
  $("#imagePicker").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Kies een afbeelding.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("Kies een foto kleiner dan 12 MB.");
      return;
    }
    const item = getItem();
    try {
      await saveImage(item.id, file);
      if (localImages.has(item.id))
        URL.revokeObjectURL(localImages.get(item.id));
      localImages.set(item.id, URL.createObjectURL(file));
      render();
      syncModal();
      toast("Eigen voorbeeld opgeslagen op dit apparaat ✓");
    } catch (err) {
      toast("Opslaan mislukt. Probeer een kleinere afbeelding.");
    }
    e.target.value = "";
  });
  $("#removeCustom").addEventListener("click", async () => {
    const id = getItem().id;
    await deleteImage(id).catch(() => {});
    if (localImages.has(id)) {
      URL.revokeObjectURL(localImages.get(id));
      localImages.delete(id);
    }
    render();
    syncModal();
    toast("Eigen afbeelding verwijderd");
  });
  $("#customImage").addEventListener("click", () => $("#imagePicker").click());
  $("#closeDetail").addEventListener("click", closeDetail);
  $("#detailOverlay").addEventListener("click", (e) => {
    if (e.target === $("#detailOverlay")) closeDetail();
  });
  $("#prev").addEventListener("click", () => navigate(-1));
  $("#next").addEventListener("click", () => navigate(1));
  $("#randomModal").addEventListener("click", chooseRandom);
  $("#modalFav").addEventListener("click", () => toggleFav(getItem().id));
  $("#doneButton").addEventListener("click", () => {
    const id = getItem().id;
    s.done = s.done.includes(id)
      ? s.done.filter((x) => x !== id)
      : [...s.done, id];
    render();
    syncModal();
    toast(
      s.done.includes(id) ? "Opdracht afgerond! 📸" : "Opdracht teruggezet",
    );
  });
  $("#search").addEventListener("input", (e) => {
    s.search = e.target.value;
    render();
  });
  document.querySelectorAll("[data-difficulty]").forEach((b) =>
    b.addEventListener("click", () => {
      s.difficulty = b.dataset.difficulty;
      render();
    }),
  );
  $("#favFilter").addEventListener("click", () => {
    s.favOnly = !s.favOnly;
    render();
  });
  $("#hideDone").addEventListener("click", () => {
    s.hideDone = !s.hideDone;
    render();
  });
  $("#random").addEventListener("click", chooseRandom);
  $("#randomTop").addEventListener("click", chooseRandom);
  function openScore() {
    previousFocus = document.activeElement;
    $("#scoreOverlay").classList.add("open");
    $("#scoreOverlay").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    syncScores();
    $("#closeScore").focus();
  }
  $("#scoreOpen").addEventListener("click", openScore);
  $("#scoreMobile").addEventListener("click", openScore);
  $("#closeScore").addEventListener("click", closeScore);
  $("#scoreOverlay").addEventListener("click", (e) => {
    if (e.target === $("#scoreOverlay")) closeScore();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#detailOverlay").classList.contains("open")) closeDetail();
      else if ($("#scoreOverlay").classList.contains("open")) closeScore();
    } else if (
      !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) &&
      $("#detailOverlay").classList.contains("open") &&
      e.key === "ArrowRight"
    )
      navigate(1);
    else if (
      !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) &&
      $("#detailOverlay").classList.contains("open") &&
      e.key === "ArrowLeft"
    )
      navigate(-1);
  });
  function syncScores() {
    ["a", "b"].forEach((t, i) => {
      $(`#team${t.toUpperCase()}Name`).value = s.teams[t].name;
      $(`#team${t.toUpperCase()}Score`).textContent = s.teams[t].score;
    });
    write();
  }
  document.querySelectorAll("[data-team]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = b.dataset.team;
      s.teams[t].score = Math.max(
        0,
        s.teams[t].score + Number(b.dataset.delta),
      );
      syncScores();
    }),
  );
  ["a", "b"].forEach((t) =>
    $(`#team${t.toUpperCase()}Name`).addEventListener("input", (e) => {
      s.teams[t].name = e.target.value;
      write();
    }),
  );
  $("#resetScore").addEventListener("click", () => {
    if (confirm("Beide teams weer op 0 zetten?")) {
      s.teams.a.score = 0;
      s.teams.b.score = 0;
      s.awards = {};
      syncScores();
    }
  });
  $("#clearProgress").addEventListener("click", () => {
    if (confirm("Alle voltooid-markeringen wissen?")) {
      s.done = [];
      render();
      toast("Afgeronde opdrachten gereset");
    }
  });
  const durations = [3, 5, 10, 15];
  let durationIndex = durations.indexOf(s.duration || 5);
  if (durationIndex < 0) durationIndex = 1;
  timerInit = durations[durationIndex] * 60;
  timer = timerInit;
  let deadline = 0;
  const format = (t) =>
    String(Math.floor(t / 60)).padStart(2, "0") +
    ":" +
    String(t % 60).padStart(2, "0");
  function updateClock() {
    $("#clock").textContent = format(timer);
    $("#roundClock").textContent = format(timer);
    $("#roundPause").textContent = running ? "Ⅱ Pauze" : "▶ Hervat";
    $("#roundDuration").textContent = durations[durationIndex] + " min";
    $("#toggleTimer").textContent = running ? "Ⅱ" : "▶";
    $("#toggleTimer").setAttribute(
      "aria-label",
      running ? "Timer pauzeren" : "Timer starten",
    );
    $("#timerDuration").textContent = durations[durationIndex] + " min";
  }
  function stopClock() {
    if (running) timer = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    running = false;
    clearInterval(tick);
    tick = null;
    delete s.timer;
    write();
    updateClock();
  }
  function clockTick() {
    if (!running) return;
    timer = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    updateClock();
    if (timer === 0) {
      stopClock();
      toast("⏰ Tijd is om! Laat de foto zien!");
      try {
        navigator.vibrate?.([100, 80, 100]);
      } catch (e) {}
    }
  }
  function startClock() {
    if (timer === 0) timer = timerInit;
    deadline = Date.now() + timer * 1000;
    running = true;
    s.timer = { deadline, id: getItem()?.id };
    write();
    clearInterval(tick);
    tick = setInterval(clockTick, 250);
    updateClock();
  }
  $("#toggleTimer").addEventListener("click", () =>
    running ? stopClock() : startClock(),
  );
  $("#timerReset").addEventListener("click", () => {
    stopClock();
    timer = timerInit;
    updateClock();
  });
  $("#timerDuration").addEventListener("click", () => {
    durationIndex = (durationIndex + 1) % durations.length;
    timerInit = durations[durationIndex] * 60;
    stopClock();
    timer = timerInit;
    s.duration = durations[durationIndex];
    write();
    updateClock();
  });
  $("#roundDuration").addEventListener("click", () =>
    $("#timerDuration").click(),
  );
  $("#roundPause").addEventListener("click", () => $("#toggleTimer").click());
  $("#roundReset").addEventListener("click", () => $("#timerReset").click());
  document.addEventListener("visibilitychange", clockTick);
  function syncRound(item) {
    const photo = localImages.get("recreation:" + item.id);
    $("#recreation").innerHTML = photo
      ? '<img alt="Jullie nagemaakte foto" src="' + escapeHtml(photo) + '">'
      : "<p>Jullie moment komt hier.<br>Maak de pose na en voeg je foto toe.</p>";
    $("#deleteRecreation").classList.toggle("hidden", !photo);
    const credit = $("#referenceCredit");
    credit.textContent = "";
    if (localImages.has(item.id))
      credit.textContent = "Eigen voorbeeld · alleen op dit apparaat";
    else if (item.image) {
      credit.append(
        document.createTextNode(item.author + " · " + item.license + " · "),
      );
      const a = document.createElement("a");
      a.href = item.source;
      a.textContent = "Bron & rechten ↗";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      credit.append(a);
    } else
      credit.textContent =
        "Externe zoekreferentie · geen afbeelding meegeleverd. Zoekresultaten vereisen internet.";
    ["a", "b"].forEach(
      (t, i) => ($("#awardTeam").options[i].textContent = s.teams[t].name),
    );
    const award = s.awards[item.id];
    $("#awardStatus").textContent = award
      ? "Toegekend: " +
        award.points +
        " punten aan " +
        s.teams[award.team].name +
        ". Corrigeer zo nodig via het scorebord."
      : "";
    $("#award").disabled = !!award;
  }
  $("#localFilter").addEventListener("click", () => {
    s.localOnly = !s.localOnly;
    render();
  });
  $("#heroRandom").addEventListener("click", chooseRandom);
  $("#startRound").addEventListener("click", () => {
    stopClock();
    timer = timerInit;
    startClock();
    toast("Ronde gestart. Veel plezier!");
  });
  $("#skipRound").addEventListener("click", () => {
    const id = getItem().id;
    if (!s.skipped.includes(id)) s.skipped.push(id);
    stopClock();
    write();
    navigate(1);
    toast("Overgeslagen. Je kunt deze later opnieuw kiezen.");
  });
  $("#award").addEventListener("click", () => {
    const item = getItem(),
      points = Number($("#awardPoints").value),
      team = $("#awardTeam").value;
    if (!Number.isInteger(points) || points < 0 || points > 10) {
      toast("Kies 0 tot en met 10 hele punten.");
      return;
    }
    if (s.awards[item.id]) return;
    s.teams[team].score += points;
    s.awards[item.id] = { team, points };
    if (!s.done.includes(item.id)) s.done.push(item.id);
    stopClock();
    render();
    syncModal();
    toast("+" + points + " punten! Kies Volgende voor de volgende ronde.");
  });
  $("#uploadRecreation").addEventListener("click", () =>
    $("#recreationPicker").click(),
  );
  $("#recreationPicker").addEventListener("change", async (e) => {
    const file = e.target.files?.[0],
      id = getItem().id;
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      toast("Kies een afbeelding kleiner dan 12 MB.");
      return;
    }
    try {
      const image = new Image(),
        url = URL.createObjectURL(file);
      try {
        image.src = url;
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }
      await saveImage("recreation:" + id, file);
      const old = localImages.get("recreation:" + id);
      if (old) URL.revokeObjectURL(old);
      localImages.set("recreation:" + id, URL.createObjectURL(file));
      if (getItem().id === id) syncRound(getItem());
      stopClock();
      toast("Foto opgeslagen op dit apparaat. Tijd om te vergelijken!");
    } catch (e) {
      toast(
        "Deze foto kon niet worden geopend of opgeslagen. Probeer een JPEG of kleinere foto.",
      );
    }
  });
  $("#deleteRecreation").addEventListener("click", async () => {
    const key = "recreation:" + getItem().id;
    try {
      await deleteImage(key);
      URL.revokeObjectURL(localImages.get(key));
      localImages.delete(key);
      syncRound(getItem());
    } catch (e) {
      toast("Verwijderen mislukt. Probeer opnieuw.");
    }
  });
  function closeViewer() {
    $("#viewer").classList.remove("open");
    $("#viewer").setAttribute("aria-hidden", "true");
    $("#expandReference").focus();
  }
  $("#expandReference").addEventListener("click", () => {
    const viewer = $("#viewerContent");
    viewer.replaceChildren($("#reference").cloneNode(true));
    viewer.firstChild.removeAttribute("id");
    $("#viewer").classList.add("open");
    $("#viewer").setAttribute("aria-hidden", "false");
    $("#closeViewer").focus();
  });
  $("#closeViewer").addEventListener("click", closeViewer);
  // Trap keyboard focus in the topmost dialog; keep browsing controls out of reach.
  document.addEventListener(
    "keydown",
    (e) => {
      const overlay =
        $("#viewer.open") ||
        $("#scoreOverlay.open") ||
        $("#detailOverlay.open");
      if (!overlay) return;
      if ($("#viewer.open") && e.key === "Escape") {
        e.stopImmediatePropagation();
        closeViewer();
        return;
      }
      if (e.key !== "Tab") return;
      const elements = [
        ...overlay.querySelectorAll(
          "button:not(:disabled),a[href],input:not(.hidden),select",
        ),
      ].filter((el) => el.getClientRects().length);
      if (!elements.length) return;
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    true,
  );
  render();
  updateClock();
  loadSavedImages().then(() => {
    if ($("#detailOverlay.open")) syncModal();
  });
  if (s.timer?.deadline) {
    deadline = s.timer.deadline;
    selected = Math.max(
      0,
      data.findIndex((x) => x.id === s.timer.id),
    );
    running = true;
    tick = setInterval(clockTick, 250);
    clockTick();
  }
  if ("serviceWorker" in navigator && location.protocol === "https:")
    navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
