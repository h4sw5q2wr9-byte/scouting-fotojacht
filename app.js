/* FOTOJACHT V2: one device, one group, one local recreation per challenge. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // Placeholder and remote-only entries never enter the playable deck.
  const data = (window.FOTOJACHT_LOCAL_REFERENCES || []).filter(
    (item) =>
      item.enabled !== false &&
      item.status === "ready" &&
      /^assets\/references\/[^?#]+\.(jpe?g|png|webp)$/i.test(item.image || ""),
  );
  const cameraIcon = $("takePhoto").querySelector("svg")?.outerHTML || "";
  const byId = new Map(data.map((item) => [item.id, item]));
  const PREFS = "fotojacht-deck-v2";
  let prefs = {
    challengeId: data[0]?.id,
    groupName: "Onze groep",
    tutorialSeen: false,
    playerFilter: "all",
  };
  try {
    prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) || "{}") };
  } catch {}
  if (prefs.contentRelease !== "action-night-v2.4") {
    prefs.challengeId = data[0]?.id;
    prefs.playerFilter = "all";
    prefs.contentRelease = "action-night-v2.4";
    try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch {}
  }
  if (!byId.has(prefs.challengeId)) prefs.challengeId = data[0]?.id;
  if (typeof prefs.groupName !== "string") prefs.groupName = "Onze groep";
  if (!["group", "all", "1", "2", "3", "4", "5", "6", "7"].includes(prefs.playerFilter))
    prefs.playerFilter = "group";
  const saved = new Map(),
    urls = new Map(),
    failed = new Set(),
    legacyTitles = new Map();
  let oldPhotos = [],
    ready = false,
    storageFailed = false,
    category = "",
    pending = null,
    viewed = null,
    exporting = false,
    dbPromise,
    preparedZIP = null;
  const esc = (value) =>
    String(value ?? "").replace(
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
  const persist = () => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {}
  };
  const current = () => byId.get(prefs.challengeId);
  const playable = () => data.filter((item) => !failed.has(item.id));
  function matchesPlayers(item) {
    if (prefs.playerFilter === "all") return true;
    if (prefs.playerFilter === "group") return item.players >= 2;
    const count = Number(prefs.playerFilter);
    return item.players <= count && (item.maxPlayers || item.players) >= count;
  }
  const blobURL = (key, blob) => {
    if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
    return urls.get(key);
  };
  const revoke = (key) => {
    if (urls.has(key)) {
      URL.revokeObjectURL(urls.get(key));
      urls.delete(key);
    }
  };
  const name = (value) =>
    String(value || "foto")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "foto";
  const extension = (blob) =>
    blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  async function busy(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      toast(
        /quota|storage/i.test(error?.name || "")
          ? "De browseropslag is vol of niet beschikbaar. Download eerst je ZIP."
          : "Dat lukte niet. Probeer opnieuw; je bewaarde foto’s blijven staan.",
      );
    } finally {
      button.disabled = false;
      syncButtons();
    }
  }
  function openDialog(id) {
    const d = $(id);
    if (d.open) return;
    d._focus = document.activeElement;
    d.showModal();
    document.body.style.overflow = "hidden";
  }
  function closeDialog(id) {
    $(id).close();
  }
  document
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => closeDialog(button.dataset.close)),
    );
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      document.body.style.overflow = "";
      if (dialog.id === "tutorialDialog") {
        prefs.tutorialSeen = true;
        persist();
        if (!prefs.groupReady) setTimeout(() => openGroupSetup(), 0);
      }
      if (dialog.id === "uploadDialog" && pending) {
        URL.revokeObjectURL(pending.url);
        pending = null;
        $("uploadPreview").removeAttribute("src");
      }
      dialog._focus?.focus?.();
    });
    dialog.addEventListener("click", (event) => {
      if (
        event.target !== dialog ||
        (dialog.id === "uploadDialog" && $("savePhoto").disabled) || dialog.id === "groupSetupDialog" || (dialog.id === "resetDialog" && $("confirmReset").disabled)
      )
        return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    });
  });
  $("startPlaying").addEventListener("click", () =>
    closeDialog("tutorialDialog"),
  );
  function openGroupSetup() {
    $("groupSetupName").value = prefs.groupName === "Onze groep" ? "" : prefs.groupName;
    openDialog("groupSetupDialog");
  }
  function finishGroupSetup() {
    prefs.groupName = $("groupSetupName").value.trim().slice(0, 40) || "Onze groep";
    prefs.groupReady = true;
    persist();
    $("groupName").value = prefs.groupName;
    $("groupBadge").textContent = prefs.groupName;
    closeDialog("groupSetupDialog");
    renderAlbum();
  }
  $("groupSetupForm").addEventListener("submit", (event) => { event.preventDefault(); finishGroupSetup(); });
  $("skipGroupName").addEventListener("click", finishGroupSetup);
  $("groupBadge").addEventListener("click", openGroupSetup);
  $("groupSetupDialog").addEventListener("cancel", (event) => { event.preventDefault(); finishGroupSetup(); });
  $("resetDialog").addEventListener("cancel", (event) => { if ($("confirmReset").disabled) event.preventDefault(); });
  $("resetGame").addEventListener("click", () => openDialog("resetDialog"));
  $("confirmReset").addEventListener("click", () => busy($("confirmReset"), async () => {
    $("resetStatus").textContent = "Foto’s verwijderen…";
    try {
      const database = await db();
      const stores = Array.from(database.objectStoreNames);
      await write(stores, (tx) => stores.forEach((store) => tx.objectStore(store).clear()));
      for (const key of [...urls.keys()]) revoke(key);
      if (pending) { URL.revokeObjectURL(pending.url); pending = null; }
      saved.clear(); oldPhotos = []; preparedZIP = null;
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) if (/fotojacht/i.test(key)) storage.removeItem(key);
      }
      for (const entry of document.cookie.split(";")) {
        const key = entry.split("=")[0].trim();
        if (/fotojacht/i.test(key)) for (const path of ["/", location.pathname.replace(/[^/]*$/, "")]) document.cookie = `${key}=; Max-Age=0; path=${path}; SameSite=Lax`;
      }
      location.replace(location.pathname + location.search);
    } catch (error) { $("resetStatus").textContent = "Wissen is niet voltooid. Probeer opnieuw."; throw error; }
  }));
  window.addEventListener("storage", (event) => { if (event.key === PREFS && event.newValue === null) location.reload(); });
  $("help").addEventListener("click", () => openDialog("tutorialDialog"));
  $("uploadDialog").addEventListener("cancel", (event) => {
    if ($("savePhoto").disabled) event.preventDefault();
  });
  function route() {
    const page = location.hash === "#album" ? "album" : "deck";
    $("deckPage").hidden = page !== "deck";
    $("albumPage").hidden = page !== "album";
    document.querySelectorAll("[data-page]").forEach((link) => {
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (page === "album") renderAlbum();
    scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  function syncButtons() {
    $("takePhoto").disabled = !ready || !current() || failed.has(current()?.id);
    $("downloadZip").disabled = exporting || !saved.size;
    $("legacyZip").disabled = exporting || !oldPhotos.length;
    $("saveHint").textContent = storageFailed
      ? "Foto-opslag niet beschikbaar. Open de site in een normale browser en vernieuw."
      : !ready
        ? "Lokale foto-opslag laden…"
        : "Alleen op deze telefoon. Niets wordt geüpload.";
    $("albumBadge").textContent = saved.size;
    $("groupBadge").textContent = prefs.groupName;
    $("progress").textContent = `${saved.size} / ${data.length} gemaakt`;
  }
  function renderCard() {
    const item = current();
    if (!item) {
      $("challengeTitle").textContent = "Geen speelbare kaarten";
      $("challengeDescription").textContent =
        "De lokale foto’s zijn nu niet beschikbaar. Vernieuw de pagina zodra je online bent.";
      syncButtons();
      return;
    }
    $("challengeTitle").textContent = item.title;
    $("challengeDescription").textContent = item.description;
    $("categoryLabel").textContent = item.category;
    $("cardIndex").textContent =
      String(data.indexOf(item) + 1).padStart(2, "0") + " / " + data.length;
    $("challengeMeta").textContent =
      `${item.people || item.players} ${item.players === 1 ? "persoon" : "personen"} · ${item.difficulty}`;
    $("reference").alt = item.title;
    $("reference").dataset.challenge = item.id;
    $("reference").srcset = item.previewImage || "";
    $("reference").src = item.image;
    const done = saved.has(item.id);
    $("doneBadge").hidden = !done;
    $("compareCurrent").hidden = !done;
    $("takePhoto").innerHTML = cameraIcon + (done ? "Nieuwe foto" : "Foto maken");
    $("imageError").hidden = !failed.has(item.id);
    $("deckCount").textContent = playable().length;
    syncButtons();
  }
  $("reference").addEventListener("error", () => {
    if ($("reference").srcset) { $("reference").srcset = ""; return; }
    const id = $("reference").dataset.challenge;
    failed.add(id);
    $("imageError").hidden = false;
    syncButtons();
    renderPicker();
  });
  function select(id) {
    if (!byId.has(id) || failed.has(id)) return;
    prefs.challengeId = id;
    persist();
    renderCard();
  }
  function next(step) {
    const items = playable().filter(matchesPlayers);
    if (!items.length) return;
    let index = items.findIndex((item) => item.id === current()?.id);
    if (index < 0) index = step > 0 ? -1 : 0;
    select(items[(index + step + items.length) % items.length].id);
  }
  $("previous").addEventListener("click", () => next(-1));
  $("next").addEventListener("click", () => next(1));
  $("random").addEventListener("click", () => {
    const items = playable().filter(
        (item) => matchesPlayers(item) && item.id !== current()?.id,
      ),
      fresh = items.filter((item) => !saved.has(item.id)),
      pool = fresh.length ? fresh : items;
    if (pool.length) select(pool[Math.floor(Math.random() * pool.length)].id);
  });
  function renderPicker() {
    $("deckCount").textContent = playable().length;
    const eligible = playable().filter(matchesPlayers);
    const categories = [
      "Alles",
      ...new Set(eligible.map((item) => item.category)),
    ];
    if (category && !categories.includes(category)) category = "";
    $("playerFilter").value = prefs.playerFilter;
    $("categories").innerHTML = categories
      .map(
        (cat) =>
          `<button data-category="${esc(cat === "Alles" ? "" : cat)}" aria-pressed="${(category || "Alles") === cat}">${esc(cat)}</button>`,
      )
      .join("");
    $("categories")
      .querySelectorAll("button")
      .forEach((button) =>
        button.addEventListener("click", () => {
          category = button.dataset.category;
          renderPicker();
        }),
      );
    const items = playable().filter(
      (item) =>
        matchesPlayers(item) && (!category || item.category === category || (category === "Actie & dans" && item.action)) &&
        (item.title + " " + item.description).toLocaleLowerCase("nl").includes($("challengeSearch").value.trim().toLocaleLowerCase("nl")),
    );
    $("pickerGrid").innerHTML =
      items
        .map(
          (item) =>
            `<button class="picker-card" data-pick="${item.id}"><img src="${item.image}" srcset="${item.previewImage || ""}" alt="${esc(item.title)}" loading="lazy">${saved.has(item.id) ? '<b class="done-dot">✓</b>' : ""}<span class="caption">${esc(item.title)}<small>${item.people || item.players} ${item.players === 1 ? "persoon" : "personen"} · ${esc(item.difficulty)}</small></span></button>`,
        )
        .join("") ||
      '<p class="hint">Geen kaarten voor deze selectie. Kies een ander aantal spelers of een andere categorie.</p>';
    $("pickerGrid")
      .querySelectorAll("[data-pick]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          select(button.dataset.pick);
          closeDialog("pickerDialog");
          scrollTo(0, 0);
        }),
      );
    $("pickerGrid")
      .querySelectorAll("img")
      .forEach((image) =>
        image.addEventListener(
          "error",
          () => {
            if (image.srcset) { image.srcset = ""; return; }
            const id = image.closest("[data-pick]").dataset.pick;
            failed.add(id);
            image.closest("button").remove();
          },
          // Retry the original JPEG if its optimized copy is unavailable.
          { once: false },
        ),
      );
  }
  $("challengeSearch").addEventListener("input", renderPicker);
  $("playerFilter").addEventListener("change", () => {
    prefs.playerFilter = $("playerFilter").value;
    persist();
    renderPicker();
  });
  $("actionDeck").addEventListener("click", () => {
    prefs.playerFilter = "all";
    category = "Actie & dans";
    $("challengeSearch").value = "";
    persist();
    renderPicker();
    openDialog("pickerDialog");
  });
  $("browse").addEventListener("click", () => {
    prefs.playerFilter = "all";
    category = "";
    $("challengeSearch").value = "";
    persist();
    renderPicker();
    openDialog("pickerDialog");
  });
  function db() {
    return (dbPromise ||= new Promise((resolve, reject) => {
      const r = indexedDB.open("scouting-fotojacht-pictures", 2);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("images"))
          r.result.createObjectStore("images");
        if (!r.result.objectStoreNames.contains("photos"))
          r.result.createObjectStore("photos", { keyPath: "id" });
        if (!r.result.objectStoreNames.contains("teams"))
          r.result.createObjectStore("teams", { keyPath: "id" });
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        toast("Sluit andere FOTOJACHT-tabbladen en vernieuw deze pagina.");
    }));
  }
  async function write(stores, action) {
    const database = await db();
    await new Promise((resolve, reject) => {
      const tx = database.transaction(stores, "readwrite");
      action(tx);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Storage failed"));
    });
  }
  async function initStorage() {
    try {
      const database = await db();
      const records = await new Promise((resolve, reject) => {
        const tx = database.transaction(["photos", "images"]);
        const p = tx.objectStore("photos").getAll(),
          k = tx.objectStore("images").getAllKeys(),
          v = tx.objectStore("images").getAll();
        tx.oncomplete = () =>
          resolve({
            photos: p.result,
            images: k.result.map((key, index) => [key, v.result[index]]),
          });
        tx.onerror = () => reject(tx.error);
      });
      const migrate = records.images.filter(
        ([key, blob]) =>
          String(key).startsWith("recreation:") && blob instanceof Blob,
      );
      if (migrate.length)
        await write(["photos", "images"], (tx) => {
          for (const [key, blob] of migrate) {
            const id = "legacy-" + key;
            if (!records.photos.some((p) => p.id === id)) {
              const photo = {
                id,
                challenge_id: String(key).slice(11),
                blob,
                created_at: new Date().toISOString(),
                referenceBlob: null,
              };
              tx.objectStore("photos").put(photo);
              records.photos.push(photo);
            }
            tx.objectStore("images").delete(key);
          }
        });
      for (const photo of records.photos) {
        if (!(photo.blob instanceof Blob)) continue;
        if (byId.has(photo.challenge_id)) {
          const previous = saved.get(photo.challenge_id);
          if (!previous || photo.created_at > previous.created_at)
            saved.set(photo.challenge_id, photo);
        } else oldPhotos.push(photo);
      }
      if (oldPhotos.length) {
        try {
          const response = await fetch("archive/challenges-v1.json");
          if (response.ok)
            for (const item of await response.json())
              legacyTitles.set(item.id, item);
        } catch {}
      }
      ready = true;
      renderCard();
      renderAlbum();
    } catch {
      ready = false;
      storageFailed = true;
      $("saveHint").textContent =
        "Opslag is niet beschikbaar. Open de site in een normale browser en vernieuw.";
      toast(
        "Foto-opslag niet beschikbaar. Gebruik geen privémodus en probeer opnieuw.",
      );
      $("takePhoto").disabled = true;
    }
  }
  async function prepareImage(file) {
    if (
      file.size > 20 * 1024 * 1024 ||
      (!file.type.startsWith("image/") &&
        !/\.(heic|heif)$/i.test(file.name || ""))
    )
      throw new Error("Invalid image");
    const url = URL.createObjectURL(file),
      image = new Image();
    try {
      image.src = url;
      await image.decode();
      const scale = Math.min(
        1,
        1800 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.86),
      );
      if (!blob) throw new Error("Image encoding failed");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function choosePhoto(id) {
    if (!ready || !byId.has(id) || failed.has(id)) return;
    $("photoPicker")._challenge = id;
    $("photoPicker").click();
  }
  $("takePhoto").addEventListener("click", () => choosePhoto(current()?.id));
  $("photoPicker").addEventListener("change", async (event) => {
    const file = event.target.files?.[0],
      id = event.target._challenge;
    event.target.value = "";
    if (!file || !byId.has(id)) return;
    try {
      const item = byId.get(id),
        blob = await prepareImage(file),
        response = await fetch(item.image);
      if (!response.ok) throw new Error("Missing original");
      const referenceBlob = await response.blob();
      pending = { id, blob, referenceBlob, url: URL.createObjectURL(blob) };
      $("uploadTitle").textContent = item.title;
      $("uploadPreview").src = pending.url;
      $("replaceHint").textContent = saved.has(id)
        ? "Er staat al een foto bij deze kaart. Bewaren vervangt jullie vorige versie."
        : "Eén foto per kaart. Jullie kunnen deze later vervangen.";
      $("uploadStatus").textContent = "Alleen op deze telefoon, zonder upload.";
      openDialog("uploadDialog");
    } catch {
      toast(
        "Foto niet geopend. Kies een JPEG of kleinere foto en controleer of het origineel geladen is.",
      );
    }
  });
  $("savePhoto").addEventListener("click", () =>
    busy($("savePhoto"), async () => {
      const copy = pending;
      if (!copy) return;
      const close = $("uploadDialog").querySelector("[data-close]");
      close.disabled = true;
      try {
        const item = byId.get(copy.id),
          record = {
            id: "v2:" + copy.id,
            challenge_id: copy.id,
            title: item.title,
            blob: copy.blob,
            referenceBlob: copy.referenceBlob,
            created_at: new Date().toISOString(),
          };
        await write(["photos"], (tx) => {
          const store = tx.objectStore("photos");
          const old = saved.get(copy.id);
          if (old && old.id !== record.id) store.delete(old.id);
          store.put(record);
        });
        const old = saved.get(copy.id);
        if (old) {
          revoke(old.id);
          revoke(old.id + ":ref");
        }
        saved.set(copy.id, record);
        closeDialog("uploadDialog");
        renderCard();
        renderAlbum();
        openComparison(record);
        navigator.storage?.persist?.().catch(() => {});
        toast("Bewaard op deze telefoon. Check de vergelijking!");
      } catch (error) {
        $("uploadStatus").textContent =
          "Niet opgeslagen. Je gekozen foto staat nog hier; probeer opnieuw.";
        throw error;
      } finally {
        close.disabled = false;
      }
    }),
  );
  function itemFor(photo) {
    return (
      byId.get(photo.challenge_id) ||
      legacyTitles.get(photo.challenge_id) || {
        title: photo.title || "Eerdere foto",
        description: "",
      }
    );
  }
  function originalFor(photo) {
    const item = byId.get(photo.challenge_id);
    return photo.referenceBlob
      ? blobURL(photo.id + ":ref", photo.referenceBlob)
      : item?.image;
  }
  function openComparison(photo) {
    viewed = photo;
    const item = itemFor(photo),
      original = originalFor(photo);
    $("viewerTitle").textContent = item.title;
    $("comparison").classList.remove("reference-only");
    $("comparison").innerHTML =
      `<figure><figcaption>HET ORIGINEEL</figcaption>${original ? `<img src="${esc(original)}" alt="${esc(item.title)}">` : '<p class="hint">Bij deze eerdere foto is geen origineel bewaard.</p>'}</figure><figure><figcaption>JULLIE VERSIE</figcaption><img src="${esc(blobURL(photo.id, photo.blob))}" alt="Jullie versie van ${esc(item.title)}"></figure>`;
    $("photoActions").hidden = false;
    $("bestPose").setAttribute("aria-pressed", String(prefs.bestPose === photo.id));
    $("bestPose").textContent = prefs.bestPose === photo.id ? "★ Jullie beste pose" : "☆ Kies als beste pose";
    $("replacePhoto").hidden = !byId.has(photo.challenge_id);
    $("continuePlaying").hidden = !byId.has(photo.challenge_id);
    openDialog("viewerDialog");
  }
  $("bestPose").addEventListener("click", () => {
    if (!viewed) return;
    prefs.bestPose = prefs.bestPose === viewed.id ? null : viewed.id;
    persist();
    renderAlbum();
    openComparison(viewed);
  });
  $("compareCurrent").addEventListener("click", () => {
    const photo = saved.get(current()?.id);
    if (photo) openComparison(photo);
  });
  $("referenceZoom").addEventListener("click", () => {
    const item = current();
    if (!item || failed.has(item.id)) return;
    viewed = null;
    $("viewerTitle").textContent = item.title;
    $("comparison").classList.add("reference-only");
    $("comparison").innerHTML =
      `<figure><figcaption>HET ORIGINEEL</figcaption><img src="${item.image}" alt="${esc(item.title)}"></figure>`;
    $("photoActions").hidden = true;
    $("continuePlaying").hidden = true;
    openDialog("viewerDialog");
  });
  $("replacePhoto").addEventListener("click", () => {
    const id = viewed?.challenge_id;
    closeDialog("viewerDialog");
    if (id) choosePhoto(id);
  });
  $("continuePlaying").addEventListener("click", () => {
    const id = viewed?.challenge_id;
    if (id) select(id);
    closeDialog("viewerDialog");
    next(1);
    location.hash = "#deck";
    scrollTo(0, 0);
  });
  $("deletePhoto").addEventListener("click", () =>
    busy($("deletePhoto"), async () => {
      const photo = viewed;
      if (
        !photo ||
        !confirm("Deze foto definitief van dit apparaat verwijderen?")
      )
        return;
      await write(["photos"], (tx) =>
        tx.objectStore("photos").delete(photo.id),
      );
      if (saved.get(photo.challenge_id)?.id === photo.id)
        saved.delete(photo.challenge_id);
      oldPhotos = oldPhotos.filter((p) => p.id !== photo.id);
      revoke(photo.id);
      revoke(photo.id + ":ref");
      closeDialog("viewerDialog");
      renderCard();
      renderAlbum();
      toast("Foto verwijderd.");
    }),
  );
  function albumCard(photo) {
    const item = itemFor(photo);
    return `<button class="album-card" data-photo="${esc(photo.id)}"><img src="${esc(blobURL(photo.id, photo.blob))}" alt="Jullie versie van ${esc(item.title)}" loading="lazy"><span class="caption">${esc(item.title)}<small>${prefs.bestPose === photo.id ? "★ Beste pose · " : "✓ Bewaard · "}tik om te vergelijken</small></span></button>`;
  }
  function renderAlbum() {
    preparedZIP = null;
    $("shareZip").hidden = true;
    const photos = [...saved.values()].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    $("albumCount").textContent =
      `${photos.length} foto’s · ${prefs.groupName || "Onze groep"}`;
    $("albumGrid").innerHTML = photos.map(albumCard).join("");
    $("emptyAlbum").hidden = photos.length > 0;
    $("legacySection").hidden = !oldPhotos.length;
    $("legacyCount").textContent = "(" + oldPhotos.length + ")";
    $("legacyGrid").innerHTML = oldPhotos.map(albumCard).join("");
    document.querySelectorAll("[data-photo]").forEach((button) =>
      button.addEventListener("click", () => {
        const photo = [...saved.values(), ...oldPhotos].find(
          (p) => p.id === button.dataset.photo,
        );
        if (photo) openComparison(photo);
      }),
    );
    syncButtons();
  }
  $("groupName").value = prefs.groupName;
  $("groupName").addEventListener("input", () => {
    preparedZIP = null;
    $("shareZip").hidden = true;
    prefs.groupName = $("groupName").value.slice(0, 40);
    $("groupBadge").textContent = prefs.groupName || "Onze groep";
    persist();
  });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function image(blob) {
    const url = URL.createObjectURL(blob),
      img = new Image();
    try {
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function drawContain(ctx, img, x, y, w, h) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight),
      width = img.naturalWidth * scale,
      height = img.naturalHeight * scale;
    ctx.drawImage(
      img,
      x + (w - width) / 2,
      y + (h - height) / 2,
      width,
      height,
    );
  }
  async function makeComparison(photo, original, title) {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#101014";
    ctx.fillRect(0, 0, 1600, 1080);
    ctx.fillStyle = "#ff7545";
    ctx.font = "bold 36px system-ui";
    ctx.fillText(
      "FOTOJACHT — " + (prefs.groupName.trim() || "Onze groep"),
      40,
      58,
      1520,
    );
    ctx.fillStyle = "#f5f2ee";
    ctx.font = "28px system-ui";
    ctx.fillText(title, 40, 106, 1520);
    ctx.fillStyle = "#b0aeba";
    ctx.font = "20px system-ui";
    ctx.fillText("HET ORIGINEEL", 40, 154);
    ctx.fillText("JULLIE VERSIE", 820, 154);
    if (original) drawContain(ctx, await image(original), 40, 175, 740, 790);
    else {
      ctx.fillText(
        "Geen origineel bewaard bij deze eerdere foto.",
        45,
        500,
        730,
      );
    }
    drawContain(ctx, await image(photo.blob), 820, 175, 740, 790);
    const source = itemFor(photo);
    ctx.font = "14px system-ui";
    ctx.fillText(
      (source.author || "Eigen foto") +
        " · " +
        (source.license || "") +
        " · Origineel verkleind; eigen foto apart auteursrecht.",
      40,
      1030,
      1520,
    );
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Comparison failed")),
        "image/jpeg",
        0.86,
      ),
    );
  }
  async function exportZIP(legacy = false) {
    if (exporting) return;
    const rows = legacy ? [...oldPhotos] : [...saved.values()];
    if (!rows.length) {
      toast("Bewaar eerst een foto.");
      return;
    }
    preparedZIP = null;
    $("shareZip").hidden = true;
    exporting = true;
    syncButtons();
    const files = {},
      results = [],
      cards = [],
      credits = [];
    try {
      for (let index = 0; index < rows.length; index++) {
        $("exportStatus").textContent =
          `ZIP klaarmaken: ${index + 1} van ${rows.length}…`;
        await new Promise((resolve) => setTimeout(resolve, 0));
        const photo = rows[index],
          item = itemFor(photo),
          slug = name(item.title) + (legacy ? "-" + (index + 1) : ""),
          photoPath = "photos/" + slug + "." + extension(photo.blob);
        files[photoPath] = [
          new Uint8Array(await photo.blob.arrayBuffer()),
          { level: 0 },
        ];
        let original = photo.referenceBlob;
        if (!original && byId.has(photo.challenge_id)) {
          const response = await fetch(byId.get(photo.challenge_id).image);
          if (!response.ok) throw new Error("Original unavailable");
          original = await response.blob();
        }
        let originalPath = null;
        if (original) {
          originalPath = "originals/" + slug + "." + extension(original);
          files[originalPath] = [
            new Uint8Array(await original.arrayBuffer()),
            { level: 0 },
          ];
        }
        const comparisonPath = "comparisons/" + slug + "-comparison.jpg";
        files[comparisonPath] = [
          new Uint8Array(
            await (
              await makeComparison(photo, original, item.title)
            ).arrayBuffer(),
          ),
          { level: 0 },
        ];
        const credit = {
          title: item.title,
          author: item.author || "",
          source_page: item.source_page || item.source || "",
          license: item.license || "",
          licenseUrl: item.licenseUrl || "",
          modifications:
            item.modifications || "Reference snapshot saved on this device",
          referenceLicenseAppliesTo: "Original reference and adaptations of it; independent recreation photo retains its own rights",
        };
        credits.push(credit);
        files["originals/" + slug + "-credits.txt"] = fflate.strToU8([credit.title, credit.author, credit.source_page, credit.license, credit.licenseUrl, credit.modifications, credit.referenceLicenseAppliesTo].join("\n"));
        results.push({
          title: item.title,
          challengeId: photo.challenge_id,
          bestPose: prefs.bestPose === photo.id,
          group: prefs.groupName.trim() || "Onze groep",
          createdAt: photo.created_at,
          photo: photoPath,
          original: originalPath,
          comparison: comparisonPath,
          credit,
        });
        cards.push(
          `<figure><a href="${esc(comparisonPath)}"><img src="${esc(comparisonPath)}" loading="lazy" alt="Vergelijking: ${esc(item.title)}"></a><figcaption><b>${esc(item.title)}</b><p><a href="${esc(photoPath)}">Jullie foto</a>${originalPath ? ` · <a href="${esc(originalPath)}">Origineel</a>` : ""}</p><small>${esc(credit.author)} · <a href="${esc(credit.licenseUrl)}">${esc(credit.license)}</a> · <a href="${esc(credit.source_page)}">Bron</a><br>${esc(credit.modifications)} · Origineel en bewerkingen behouden deze licentie; eigen foto heeft afzonderlijke rechten.</small></figcaption></figure>`,
        );
      }
      files["docs/user-reference-uploads.md"] = fflate.strToU8("User-supplied reference images. Copyright retained by original creators / respective rights holders. No independent redistribution license verified. These images are not CC or public domain. See credits.json for titles and original creators.\n");
      files["LICENTIES.txt"] = fflate.strToU8("Referentiebeelden behouden de licentie in credits.json en originals/*-credits.txt. Geef maker, bron, licentielink en bewerkingen mee bij delen. CC BY-SA-bewerkingen van een referentie blijven onder de vermelde CC BY-SA-licentie. De vergelijking is een verzameling van twee afzonderlijke beelden: de eigen recreatiefoto behoudt eigen rechten. Geen algemene vrije licentie geldt voor aangeleverde memes.\n");
      files["results.json"] = fflate.strToU8(JSON.stringify(results, null, 2));
      files["credits.json"] = fflate.strToU8(JSON.stringify(credits, null, 2));
      files["index.html"] = fflate.strToU8(
        `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src 'self' data:;style-src 'unsafe-inline'"><title>FOTOJACHT — ${esc(prefs.groupName)}</title><style>body{font:16px system-ui;background:#101014;color:#f5f2ee;margin:24px}h1,a{color:#ff7545}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0}img{width:100%;border-radius:10px}figcaption{padding:12px 0}small{color:#aaa5b2}</style><h1>FOTOJACHT — ${esc(prefs.groupName || "Onze groep")}</h1><p>${rows.length} foto's vanaf deze telefoon. Deel dit privé met je groep.</p><main>${cards.join("")}</main></html>`,
      );
      files["LEES-MIJ.txt"] = fflate.strToU8(
        "FOTOJACHT V2\nPak deze ZIP uit. In photos/ staan jullie foto’s met leesbare titels. comparisons/ bevat de vergelijkingen. Open index.html voor het album. results.json bevat het overzicht en credits.json de bronnen en licenties van de originelen.\nDe licenties bij referentiebeelden gelden voor die beelden; jullie eigen foto’s houden hun eigen auteursrechten. Deze ZIP wordt niet door de site online gezet. Deel hem alleen met toestemming van de mensen op de foto’s.\n",
      );
      const zipBlob = new Blob([fflate.zipSync(files, { level: 0 })], { type: "application/zip" });
      const filename = "FOTOJACHT-" + name(prefs.groupName || "Onze groep") + (legacy ? "-eerdere-fotos" : "") + ".zip";
      preparedZIP = new File([zipBlob], filename, { type: "application/zip" });
      try { $("shareZip").hidden = !(navigator.share && navigator.canShare?.({ files: [preparedZIP] })); } catch { $("shareZip").hidden = true; }
      download(zipBlob, filename);
      $("exportStatus").textContent =
        "ZIP klaar! Kijk in Downloads / Bestanden, pak de ZIP uit en open index.html of de losse foto’s.";
      toast("ZIP gedownload. Je foto’s blijven ook hier bewaard.");
    } catch (error) {
      $("exportStatus").textContent =
        "ZIP niet voltooid. Probeer opnieuw; je foto’s zijn niet verwijderd.";
      throw error;
    } finally {
      exporting = false;
      syncButtons();
    }
  }
  $("shareZip").addEventListener("click", async () => {
    if (!preparedZIP) return;
    try {
      await navigator.share({ files: [preparedZIP], title: "FOTOJACHT — " + (prefs.groupName || "Onze groep") });
      $("exportStatus").textContent = "ZIP gedeeld via de gekozen app.";
    } catch (error) {
      $("exportStatus").textContent = error.name === "AbortError" ? "Delen geannuleerd. De ZIP staat ook in Downloads / Bestanden." : "Delen lukt hier niet. Gebruik de gedownloade ZIP in Downloads / Bestanden.";
    }
  });
  $("downloadZip").addEventListener("click", () =>
    busy($("downloadZip"), () => exportZIP()),
  );
  $("legacyZip").addEventListener("click", () =>
    busy($("legacyZip"), () => exportZIP(true)),
  );
  route();
  renderCard();
  renderAlbum();
  initStorage();
  if (!prefs.tutorialSeen) openDialog("tutorialDialog");
  else if (!prefs.groupReady) openGroupSetup();
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" ||
      ["127.0.0.1", "localhost"].includes(location.hostname))
  )
    navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
