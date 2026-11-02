/* FOTOJACHT: public challenges, private team albums. No photo uploads to GitHub. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const challenges = window.CHALLENGES || [];
  const byId = new Map(challenges.map((item) => [item.id, item]));
  const PREFS = "fotojacht-simple-v1";
  let prefs = {
    challengeId: "foto-114",
    teamId: "",
    duration: 300,
    favorites: [],
    skipped: [],
    timer: null,
  };
  try {
    prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) || "{}") };
  } catch {}
  if (!byId.has(prefs.challengeId)) prefs.challengeId = "foto-114";
  if (![180, 300, 600, 900].includes(prefs.duration)) prefs.duration = 300;
  if (!Array.isArray(prefs.favorites)) prefs.favorites = [];
  if (!Array.isArray(prefs.skipped)) prefs.skipped = [];
  let teams = [],
    photos = [],
    currentPhoto = null,
    pendingPhoto = null,
    storageReady = false,
    exporting = false;
  const media = new Map(),
    localReferences = new Map();
  const current = () => byId.get(prefs.challengeId);
  const activeTeam = () => teams.find((team) => team.id === prefs.teamId);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const searchURL = (item) =>
    "https://www.google.com/search?tbm=isch&q=" +
    encodeURIComponent(item.query);
  const referenceURL = (item) => localReferences.get(item.id) || item.image;
  const persist = () => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {}
  };
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function friendly(error) {
    return /quota|storage/i.test(error?.name || error?.message || "")
      ? "De browseropslag is vol of niet beschikbaar. Download je ZIP en maak ruimte vrij."
      : "Dat is niet gelukt. Probeer opnieuw; je opgeslagen foto’s blijven bewaard.";
  }
  async function busy(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      toast(friendly(error));
    } finally {
      button.disabled = false;
      updateSaveButton();
    }
  }
  function showDialog(id) {
    const dialog = $(id);
    if (dialog.open) return;
    dialog._focus = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = "hidden";
  }
  function closeDialog(id) {
    const dialog = $(id);
    dialog.close();
  }
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      document.body.style.overflow = "";
      if (dialog.id === "uploadDialog" && pendingPhoto) {
        URL.revokeObjectURL(pendingPhoto.url);
        pendingPhoto = null;
        $("uploadPreview").removeAttribute("src");
      }
      if (dialog.id === "photoDialog") currentPhoto = null;

      dialog._focus?.focus?.();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        if (dialog.id === "uploadDialog" && $("savePhoto").disabled) return;
        const r = dialog.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          dialog.close();
      }
    });
  });
  document
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => closeDialog(button.dataset.close)),
    );
  function route() {
    const page = ["spelen", "album", "teams"].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "spelen";
    for (const [id, name] of [
      ["playPage", "spelen"],
      ["albumPage", "album"],
      ["teamsPage", "teams"],
    ])
      $(id).hidden = name !== page;
    document.querySelectorAll("[data-page]").forEach((link) => {
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (page === "album") {
      renderAlbum();
    }
    window.scrollTo(0, 0);
  }
  const go = (page) => {
    if (location.hash === "#" + page) route();
    else location.hash = page;
  };
  window.addEventListener("hashchange", route);
  $("accountButton").addEventListener("click", () => go("teams"));
  $("manageTeams").addEventListener("click", () => go("teams"));
  $("finish").addEventListener("click", () => go("album"));
  function renderReference(container, item, { expand = false } = {}) {
    container.replaceChildren();
    const src = referenceURL(item);
    const missing = () => {
      container.innerHTML = `<div class="reference-message"><p>Voor deze scène is geen foto meegeleverd.</p><a href="${esc(searchURL(item))}" target="_blank" rel="noopener noreferrer">Zoek de originele scène ↗</a><p>Of kies onderaan een eigen voorbeeld.</p></div>`;
    };
    if (!src) {
      missing();
      return;
    }
    const image = document.createElement("img");
    image.src = src;
    image.alt = item.title;
    image.addEventListener("error", missing, { once: true });
    container.append(image);
    if (expand) {
      const button = document.createElement("button");
      button.className = "expand";
      button.textContent = "⛶ Vergroot";
      button.addEventListener("click", () => {
        currentPhoto = { reference: true };
        $("photoTitle").textContent = item.title;
        $("photoView").innerHTML =
          `<img class="preview" src="${esc(src)}" alt="${esc(item.title)}">`;
        $("downloadPhoto").hidden = true;
        $("deletePhoto").hidden = true;
        showDialog("photoDialog");
      });
      container.append(button);
    }
  }
  function renderChallenge() {
    const item = current();
    renderReference($("reference"), item, { expand: true });
    $("challengeTitle").textContent = item.title;
    $("challengeDescription").textContent = item.description;
    const completed = photos.some(
      (photo) =>
        photo.team_id === prefs.teamId && photo.challenge_id === item.id,
    );
    $("challengeMeta").textContent =
      `${item.people} ${item.people === "1" ? "persoon" : "personen"} · ${item.difficulty}${completed ? " · ✓ In jullie album" : ""}`;
    $("favorite").textContent = prefs.favorites.includes(item.id) ? "★" : "☆";
    $("favorite").setAttribute(
      "aria-pressed",
      String(prefs.favorites.includes(item.id)),
    );
    const credit = $("referenceCredit");
    credit.replaceChildren();
    if (localReferences.has(item.id))
      credit.textContent = "Eigen voorbeeld · alleen op deze telefoon";
    else if (item.image) {
      credit.append(
        document.createTextNode(item.author + " · " + item.license + " · "),
      );
      const link = document.createElement("a");
      link.href = item.source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Bron";
      credit.append(link);
    } else
      credit.textContent =
        "Externe zoekreferentie · geen automatische hotlinks";
    $("removeReference").hidden = !localReferences.has(item.id);
    updateSaveButton();
  }
  function selectChallenge(id) {
    if (!byId.has(id)) return;
    if (id !== prefs.challengeId) resetTimer();
    prefs.challengeId = id;
    persist();
    renderChallenge();
  }
  $("favorite").addEventListener("click", () => {
    const id = current().id;
    prefs.favorites = prefs.favorites.includes(id)
      ? prefs.favorites.filter((key) => key !== id)
      : [...prefs.favorites, id];
    persist();
    renderChallenge();
  });
  function available() {
    return challenges.filter((item) => referenceURL(item));
  }
  function next(step) {
    const items = referenceURL(current()) ? available() : challenges;
    const index = items.findIndex((item) => item.id === current().id);
    selectChallenge(items[(index + step + items.length) % items.length].id);
  }
  $("previous").addEventListener("click", () => next(-1));
  $("skip").addEventListener("click", () => {
    if (!prefs.skipped.includes(current().id)) prefs.skipped.push(current().id);
    next(1);
  });
  $("random").addEventListener("click", () => {
    const pool = available().filter((item) => item.id !== current().id);
    const fresh = pool.filter(
      (item) =>
        !prefs.skipped.includes(item.id) &&
        !photos.some(
          (photo) =>
            photo.team_id === prefs.teamId && photo.challenge_id === item.id,
        ),
    );
    const items = fresh.length ? fresh : pool;
    if (items.length)
      selectChallenge(items[Math.floor(Math.random() * items.length)].id);
  });
  function renderBrowse() {
    const query = $("search").value.trim().toLocaleLowerCase("nl");
    const items = challenges.filter(
      (item) =>
        ($("showAll").checked || referenceURL(item)) &&
        (!$("favoritesOnly").checked || prefs.favorites.includes(item.id)) &&
        (!$("category").value || item.category === $("category").value) &&
        (!query ||
          [item.title, item.description, item.category]
            .join(" ")
            .toLocaleLowerCase("nl")
            .includes(query)),
    );
    $("browseCount").textContent =
      `${items.length} opdrachten${$("showAll").checked ? "" : " met een foto op deze telefoon"}. Alle 145 blijven beschikbaar via ‘Ook opdrachten met zoeklink’.`;
    $("browseGrid").innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<button class="browse-card ${referenceURL(item) ? "" : "search-only"}" data-challenge="${item.id}">${referenceURL(item) ? `<img src="${esc(referenceURL(item))}" alt="${esc(item.title)}" loading="lazy">` : ""}<span>${esc(item.title)}<small>${esc(item.people)} personen · ${esc(item.difficulty)}${referenceURL(item) ? "" : " · zoeklink"}</small></span></button>`,
          )
          .join("")
      : '<p class="empty">Geen opdrachten gevonden. Pas je zoekterm of filter aan.</p>';
    $("browseGrid")
      .querySelectorAll("button")
      .forEach((button) =>
        button.addEventListener("click", () => {
          selectChallenge(button.dataset.challenge);
          closeDialog("browseDialog");
        }),
      );
    $("browseGrid")
      .querySelectorAll("img")
      .forEach((image) =>
        image.addEventListener(
          "error",
          () => {
            image.remove();
          },
          { once: true },
        ),
      );
  }
  $("browse").addEventListener("click", () => {
    renderBrowse();
    showDialog("browseDialog");
  });
  ["search", "category", "showAll", "favoritesOnly"].forEach((id) =>
    $(id).addEventListener(id === "search" ? "input" : "change", renderBrowse),
  );
  // End-time based timer stays accurate after Safari suspends the tab.
  let remaining = prefs.duration;
  function timerSeconds() {
    return prefs.timer?.deadline
      ? Math.max(0, Math.ceil((prefs.timer.deadline - Date.now()) / 1000))
      : remaining;
  }
  function drawTimer() {
    const seconds = timerSeconds();
    $("clock").textContent =
      String(Math.floor(seconds / 60)).padStart(2, "0") +
      ":" +
      String(seconds % 60).padStart(2, "0");
    $("timerToggle").textContent = prefs.timer?.deadline
      ? "Pauze"
      : "Start timer";
    if (prefs.timer?.deadline && seconds === 0) {
      prefs.timer = null;
      remaining = 0;
      persist();
      $("timerToggle").textContent = "Opnieuw";
      toast("Tijd is om! Laat jullie foto zien.");
    }
  }
  function resetTimer() {
    prefs.timer = null;
    remaining = prefs.duration;
    persist();
    drawTimer();
  }
  $("duration").value = String(prefs.duration);
  $("duration").addEventListener("change", () => {
    prefs.duration = Number($("duration").value);
    resetTimer();
  });
  $("timerToggle").addEventListener("click", () => {
    if (prefs.timer?.deadline) {
      remaining = timerSeconds();
      prefs.timer = null;
    } else {
      prefs.timer = {
        deadline: Date.now() + (remaining || prefs.duration) * 1000,
      };
    }
    persist();
    drawTimer();
  });
  $("timerReset").addEventListener("click", resetTimer);
  setInterval(drawTimer, 500);
  document.addEventListener("visibilitychange", drawTimer);
  // All personal data stays in IndexedDB; no network writes exist in this app.
  let dbPromise;
  function oldDB() {
    return (dbPromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open("scouting-fotojacht-pictures", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("images"))
          db.createObjectStore("images");
        if (!db.objectStoreNames.contains("teams"))
          db.createObjectStore("teams", { keyPath: "id" });
        if (!db.objectStoreNames.contains("photos"))
          db.createObjectStore("photos", { keyPath: "id" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        toast("Sluit andere FOTOJACHT-tabbladen en vernieuw deze pagina.");
      };
    }));
  }
  async function writeRecords(stores, action) {
    const db = await oldDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite");
      action(tx);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Opslaan mislukt"));
    });
  }
  async function localWrite(key, blob) {
    await writeRecords(["images"], (tx) => {
      if (blob) tx.objectStore("images").put(blob, key);
      else tx.objectStore("images").delete(key);
    });
  }
  async function loadLocal() {
    try {
      const db = await oldDB();
      const saved = await new Promise((resolve, reject) => {
        const tx = db.transaction(["teams", "photos", "images"]);
        const t = tx.objectStore("teams").getAll(),
          p = tx.objectStore("photos").getAll(),
          k = tx.objectStore("images").getAllKeys(),
          v = tx.objectStore("images").getAll();
        tx.oncomplete = () =>
          resolve({
            teams: t.result,
            photos: p.result,
            images: k.result.map((key, i) => [key, v.result[i]]),
          });
        tx.onerror = () => reject(tx.error);
      });
      teams = saved.teams;
      photos = saved.photos;
      const old = saved.images.filter(
        ([key, blob]) =>
          String(key).startsWith("recreation:") && blob instanceof Blob,
      );
      if (!teams.length || old.length) {
        if (!teams.length) teams.push({ id: "team-eerste", name: "Mijn team" });
        if (old.length && !teams.some((t) => t.id === "team-eerder"))
          teams.push({ id: "team-eerder", name: "Eerdere foto’s" });
        await writeRecords(["teams", "photos", "images"], (tx) => {
          teams.forEach((team) => tx.objectStore("teams").put(team));
          for (const [key, blob] of old) {
            const photo = {
              id: "legacy-" + key,
              team_id: "team-eerder",
              challenge_id: String(key).slice(11),
              blob,
              points: 0,
              created_at: new Date().toISOString(),
              referenceBlob: null,
            };
            if (!photos.some((p) => p.id === photo.id)) {
              photos.push(photo);
              tx.objectStore("photos").put(photo);
            }
            tx.objectStore("images").delete(key);
          }
        });
      }
      for (const [key, blob] of saved.images)
        if (byId.has(key) && blob instanceof Blob)
          localReferences.set(key, URL.createObjectURL(blob));
      if (!teams.some((t) => t.id === prefs.teamId))
        prefs.teamId = teams[0]?.id || "";
      persist();
      storageReady = true;
      renderAccount();
      renderChallenge();
      renderAlbum();
    } catch {
      storageReady = false;
      $("storageNotice").hidden = false;
      updateSaveButton();
      toast(
        "Foto-opslag is niet beschikbaar. Gebruik een normale browser en probeer opnieuw.",
      );
    }
  }
  async function prepareImage(file) {
    if (
      file.size > 20 * 1024 * 1024 ||
      (!file.type.startsWith("image/") &&
        !/\.(heic|heif)$/i.test(file.name || ""))
    )
      throw new Error("Kies een foto kleiner dan 20 MB.");
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
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.86),
      );
      if (!blob || blob.size > 5 * 1024 * 1024)
        throw new Error("Foto te groot");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  $("customReference").addEventListener("click", () =>
    $("referencePicker").click(),
  );
  $("referencePicker").addEventListener("change", async (event) => {
    const file = event.target.files?.[0],
      id = current().id;
    event.target.value = "";
    if (!file) return;
    try {
      const blob = await prepareImage(file);
      await localWrite(id, blob);
      if (localReferences.has(id)) URL.revokeObjectURL(localReferences.get(id));
      localReferences.set(id, URL.createObjectURL(blob));
      renderChallenge();
      toast("Eigen voorbeeld bewaard op deze telefoon.");
    } catch {
      toast("Foto niet opgeslagen. Kies een JPEG of kleinere afbeelding.");
    }
  });
  $("removeReference").addEventListener("click", () =>
    busy($("removeReference"), async () => {
      const id = current().id;
      await localWrite(id, null);
      URL.revokeObjectURL(localReferences.get(id));
      localReferences.delete(id);
      renderChallenge();
    }),
  );
  function updateSaveButton() {
    $("takePhoto").disabled = !storageReady || !activeTeam();
    $("saveHint").textContent = storageReady
      ? "Alleen op deze telefoon · " +
        (activeTeam()?.name || "kies een team") +
        " · geen upload"
      : "Browseropslag laden…";
    $("downloadAll").disabled = exporting || !photos.length;
  }
  function photoURL(photo) {
    if (!media.has(photo.id))
      media.set(photo.id, URL.createObjectURL(photo.blob));
    return media.get(photo.id);
  }
  function originalURL(photo) {
    if (photo.referenceBlob) {
      const key = photo.id + ":original";
      if (!media.has(key))
        media.set(key, URL.createObjectURL(photo.referenceBlob));
      return media.get(key);
    }
    return referenceURL(byId.get(photo.challenge_id) || {}) || "";
  }
  function renderAccount() {
    const options = teams
      .map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
      .join("");
    $("accountButton").textContent = "Mijn teams";
    $("activeTeam").innerHTML = options;
    $("activeTeam").value = prefs.teamId;
    const filter = $("albumTeam").value;
    $("albumTeam").innerHTML =
      '<option value="">Alle teams op dit apparaat</option>' + options;
    $("albumTeam").value = teams.some((t) => t.id === filter) ? filter : "";
    $("teamList").innerHTML = teams
      .map(
        (team) =>
          `<article class="team-card"><h2>${esc(team.name)}</h2><p class="hint">${photos.filter((p) => p.team_id === team.id).length} foto’s · ${photos.filter((p) => p.team_id === team.id).reduce((n, p) => n + p.points, 0)} punten</p><div class="split"><button class="secondary" data-team-select="${esc(team.id)}">Speel voor dit team</button><button class="text-button" data-team-rename="${esc(team.id)}">Naam wijzigen</button></div></article>`,
      )
      .join("");
    $("teamList")
      .querySelectorAll("[data-team-select]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          prefs.teamId = b.dataset.teamSelect;
          persist();
          renderAccount();
          renderChallenge();
          go("spelen");
        }),
      );
    $("teamList")
      .querySelectorAll("[data-team-rename]")
      .forEach((b) =>
        b.addEventListener("click", () =>
          busy(b, async () => {
            const team = teams.find((t) => t.id === b.dataset.teamRename),
              name = prompt("Nieuwe teamnaam:", team.name)?.trim();
            if (!name) return;
            if (name.length > 40) {
              toast("Gebruik maximaal 40 tekens.");
              return;
            }
            const updated = { ...team, name };
            await writeRecords(["teams"], (tx) =>
              tx.objectStore("teams").put(updated),
            );
            Object.assign(team, updated);
            renderAccount();
            renderAlbum();
          }),
        ),
      );
    updateSaveButton();
  }
  $("activeTeam").addEventListener("change", () => {
    prefs.teamId = $("activeTeam").value;
    persist();
    renderChallenge();
  });
  $("createTeamForm").addEventListener("submit", (event) => {
    event.preventDefault();
    busy($("createTeamForm").querySelector("button"), async () => {
      if (!storageReady) return;
      const name = $("teamName").value.trim();
      if (!name || name.length > 40) return;
      const team = { id: crypto.randomUUID(), name };
      await writeRecords(["teams"], (tx) => tx.objectStore("teams").put(team));
      teams.push(team);
      prefs.teamId = team.id;
      persist();
      $("teamName").value = "";
      renderAccount();
      renderChallenge();
      go("spelen");
      toast("Team gemaakt. Jullie kunnen beginnen!");
    });
  });
  function renderAlbum() {
    const chosen = $("albumTeam").value,
      visible = teams.filter((t) => !chosen || t.id === chosen);
    $("albumContent").innerHTML = visible
      .map((team) => {
        const rows = photos.filter((p) => p.team_id === team.id);
        return `<section class="album-group"><div class="album-heading"><div><h2>${esc(team.name)}</h2><p class="hint">${rows.length} foto’s · ${rows.reduce((n, p) => n + p.points, 0)} punten</p></div>${rows.length ? `<button class="text-button" data-export-team="${esc(team.id)}">ZIP ↓</button>` : ""}</div>${rows.length ? `<div class="gallery-grid">${rows.map((p) => `<button class="gallery-item" data-photo-open="${esc(p.id)}"><img src="${esc(photoURL(p))}" loading="lazy" alt="${esc(byId.get(p.challenge_id)?.title || "Teamfoto")}"><span class="caption">${esc(byId.get(p.challenge_id)?.title || "Teamfoto")}<small>${p.points} punten · ${new Date(p.created_at).toLocaleDateString("nl-NL")}</small></span></button>`).join("")}</div>` : '<p class="empty">Nog geen foto’s. Kies een opdracht bij Spelen en bewaar jullie eerste foto.</p>'}</section>`;
      })
      .join("");
    $("albumContent")
      .querySelectorAll("[data-photo-open]")
      .forEach((b) =>
        b.addEventListener("click", () =>
          openPhoto(photos.find((p) => p.id === b.dataset.photoOpen)),
        ),
      );
    $("albumContent")
      .querySelectorAll("[data-export-team]")
      .forEach((b) =>
        b.addEventListener("click", () =>
          busy(b, () => exportZIP(b.dataset.exportTeam)),
        ),
      );
    updateSaveButton();
  }
  $("albumTeam").addEventListener("change", renderAlbum);
  $("refreshAlbum").addEventListener("click", renderAlbum);
  function openPhoto(photo) {
    if (!photo) return;
    currentPhoto = photo;
    const item = byId.get(photo.challenge_id),
      original = originalURL(photo);
    $("photoTitle").textContent = item?.title || "Teamfoto";
    $("photoView").innerHTML =
      `<div class="comparison"><figure><figcaption>HET ORIGINEEL</figcaption>${original ? `<img src="${esc(original)}" alt="${esc(item?.title)}">` : '<p class="hint">Geen origineel meegeleverd. De ZIP bevat de titel en zoeklink.</p>'}</figure><figure><figcaption>JULLIE VERSIE</figcaption><img src="${esc(photoURL(photo))}" alt="Jullie nagemaakte foto"></figure></div>`;
    $("downloadPhoto").hidden = false;
    $("deletePhoto").hidden = false;
    showDialog("photoDialog");
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const extension = (blob) =>
    blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";
  const filename = (value) =>
    String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "foto";
  $("downloadPhoto").addEventListener("click", () => {
    if (currentPhoto && !currentPhoto.reference)
      download(
        currentPhoto.blob,
        filename(byId.get(currentPhoto.challenge_id)?.title) +
          "-" +
          currentPhoto.id.slice(-8) +
          "." +
          extension(currentPhoto.blob),
      );
  });
  $("deletePhoto").addEventListener("click", () =>
    busy($("deletePhoto"), async () => {
      const photo = currentPhoto;
      if (
        !photo ||
        photo.reference ||
        !confirm("Deze foto definitief van dit apparaat verwijderen?")
      )
        return;
      await writeRecords(["photos"], (tx) =>
        tx.objectStore("photos").delete(photo.id),
      );
      photos = photos.filter((p) => p.id !== photo.id);
      for (const key of [photo.id, photo.id + ":original"])
        if (media.has(key)) {
          URL.revokeObjectURL(media.get(key));
          media.delete(key);
        }
      closeDialog("photoDialog");
      renderAlbum();
      renderAccount();
      renderChallenge();
      toast("Foto verwijderd.");
    }),
  );
  $("takePhoto").addEventListener("click", () => {
    if (!storageReady || !activeTeam()) return;
    $("photoPicker")._context = {
      teamId: prefs.teamId,
      challengeId: current().id,
      reference: referenceURL(current()),
    };
    $("photoPicker").click();
  });
  $("photoPicker").addEventListener("change", async (event) => {
    const file = event.target.files?.[0],
      context = event.target._context;
    event.target.value = "";
    if (!file || !context) return;
    try {
      const blob = await prepareImage(file);
      let referenceBlob = null;
      if (context.reference) {
        try {
          const response = await fetch(context.reference);
          if (response.ok) referenceBlob = await response.blob();
        } catch {}
      }
      pendingPhoto = {
        ...context,
        blob,
        referenceBlob,
        url: URL.createObjectURL(blob),
      };
      $("uploadPreview").src = pendingPhoto.url;
      $("uploadCaption").textContent =
        (teams.find((t) => t.id === context.teamId)?.name || "Team") +
        " · " +
        byId.get(context.challengeId).title;
      $("uploadMessage").textContent = referenceBlob
        ? "Origineel wordt mee bewaard voor de vergelijking."
        : "Geen origineel beschikbaar: de ZIP krijgt de titel en een zoeklink.";
      $("photoPoints").value = "5";
      showDialog("uploadDialog");
    } catch {
      toast(
        "Foto kon niet worden geopend. Kies een JPEG of kleinere foto (max. 20 MB).",
      );
    }
  });
  $("savePhoto").addEventListener("click", () =>
    busy($("savePhoto"), async () => {
      const pending = pendingPhoto,
        points = Number($("photoPoints").value);
      if (!pending || !Number.isInteger(points) || points < 0 || points > 10)
        return;
      const button = $("uploadDialog").querySelector("[data-close]");
      button.disabled = true;
      try {
        const photo = {
          id: crypto.randomUUID(),
          team_id: pending.teamId,
          challenge_id: pending.challengeId,
          blob: pending.blob,
          referenceBlob: pending.referenceBlob,
          points,
          created_at: new Date().toISOString(),
        };
        await writeRecords(["photos"], (tx) =>
          tx.objectStore("photos").put(photo),
        );
        photos.push(photo);
        closeDialog("uploadDialog");
        resetTimer();
        renderAccount();
        renderAlbum();
        next(1);
        toast("Foto bewaard op deze telefoon.");
        // Ask for durable browser storage only after the first user-initiated save.
        navigator.storage?.persist?.().catch(() => {});
      } catch (error) {
        $("uploadMessage").textContent =
          "Niet opgeslagen. Probeer opnieuw; je foto staat nog in dit venster.";
        throw error;
      } finally {
        button.disabled = false;
      }
    }),
  );
  $("uploadDialog").addEventListener("cancel", (event) => {
    if ($("savePhoto").disabled) event.preventDefault();
  });
  async function imageFromBlob(blob) {
    const url = URL.createObjectURL(blob),
      image = new Image();
    try {
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function drawContain(ctx, image, x, y, width, height) {
    const scale = Math.min(
        width / image.naturalWidth,
        height / image.naturalHeight,
      ),
      w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }
  async function comparisonBlob(photo, reference, teamName) {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1050;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#151813";
    ctx.fillRect(0, 0, 1600, 1050);
    ctx.fillStyle = "#e5f58d";
    ctx.font = "bold 36px system-ui";
    ctx.fillText("FOTOJACHT — " + teamName, 40, 56, 1520);
    ctx.fillStyle = "#f3f4e9";
    ctx.font = "26px system-ui";
    ctx.fillText(
      byId.get(photo.challenge_id)?.title || photo.challenge_id,
      40,
      102,
      1520,
    );
    ctx.fillStyle = "#b0b6a7";
    ctx.font = "20px system-ui";
    ctx.fillText("HET ORIGINEEL", 40, 152);
    ctx.fillText("JULLIE VERSIE", 820, 152);
    if (reference) {
      const image = await imageFromBlob(reference);
      drawContain(ctx, image, 40, 175, 740, 800);
    } else {
      ctx.fillText("Geen origineel beschikbaar.", 60, 500);
      ctx.fillText("Zie referentie.txt voor titel en zoeklink.", 60, 535);
    }
    const own = await imageFromBlob(photo.blob);
    drawContain(ctx, own, 820, 175, 740, 800);
    ctx.fillStyle = "#b0b6a7";
    ctx.font = "18px system-ui";
    ctx.fillText(
      photo.points +
        " punten · " +
        new Date(photo.created_at).toLocaleString("nl-NL"),
      40,
      1015,
    );
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Vergelijking mislukt")),
        "image/jpeg",
        0.86,
      ),
    );
  }
  async function exportZIP(teamId = "") {
    if (exporting) return;
    const rows = photos.filter((p) => !teamId || p.team_id === teamId);
    if (!rows.length) {
      toast("Er zijn nog geen foto’s om te downloaden.");
      return;
    }
    exporting = true;
    updateSaveButton();
    const files = {},
      cards = [],
      manifest = [],
      snapshotTeams = teams.map((t) => ({ ...t }));
    try {
      for (let index = 0; index < rows.length; index++) {
        $("exportStatus").textContent =
          `ZIP klaarmaken: ${index + 1} van ${rows.length} foto’s…`;
        await new Promise((resolve) => setTimeout(resolve, 0));
        const photo = rows[index],
          item = byId.get(photo.challenge_id),
          team = snapshotTeams.find((t) => t.id === photo.team_id),
          teamName = team?.name || "Team";
        const folder =
          "Teams/" +
          filename(teamName) +
          "-" +
          photo.team_id.slice(-8) +
          "/" +
          filename(item?.title || photo.challenge_id) +
          "-" +
          photo.challenge_id +
          "-" +
          photo.id.slice(-8) +
          "/";
        const ownPath = folder + "jullie-foto." + extension(photo.blob);
        files[ownPath] = [
          new Uint8Array(await photo.blob.arrayBuffer()),
          { level: 0 },
        ];
        let reference = photo.referenceBlob;
        if (!reference && item && referenceURL(item)) {
          try {
            const response = await fetch(referenceURL(item));
            if (response.ok) reference = await response.blob();
          } catch {}
        }
        let originalPath = "";
        if (reference) {
          originalPath = folder + "origineel." + extension(reference);
          files[originalPath] = [
            new Uint8Array(await reference.arrayBuffer()),
            { level: 0 },
          ];
        }
        const comparePath = folder + "vergelijking.jpg";
        files[comparePath] = [
          new Uint8Array(
            await (
              await comparisonBlob(photo, reference, teamName)
            ).arrayBuffer(),
          ),
          { level: 0 },
        ];
        const note = `FOTOJACHT\nTeam: ${teamName}\nTitel: ${item?.title || photo.challenge_id}\nOpdracht: ${photo.challenge_id}\nPunten: ${photo.points}\nGemaakt: ${photo.created_at}\nBeschrijving: ${item?.description || ""}\nOrigineel: ${reference ? "In deze map" : "Niet meegeleverd"}\nZoeklink: ${item ? searchURL(item) : ""}\nBron: ${item?.source || "Eigen voorbeeld of zoekreferentie"}\n`;
        files[folder + "referentie.txt"] = fflate.strToU8(note);
        manifest.push({
          team: teamName,
          title: item?.title || photo.challenge_id,
          challengeId: photo.challenge_id,
          points: photo.points,
          createdAt: photo.created_at,
          photo: ownPath,
          original: originalPath || null,
          comparison: comparePath,
        });
        cards.push(
          `<figure><a href="${esc(comparePath)}"><img src="${esc(comparePath)}" alt="${esc(item?.title)}" loading="lazy"></a><figcaption><b>${esc(teamName)} — ${esc(item?.title || photo.challenge_id)}</b><p>${photo.points} punten · <a href="${esc(ownPath)}">Jullie foto</a>${originalPath ? ` · <a href="${esc(originalPath)}">Origineel</a>` : ` · <a href="${esc(item ? searchURL(item) : "#")}">Zoek origineel ↗</a>`}</p></figcaption></figure>`,
        );
      }
      files["album.html"] = fflate.strToU8(
        `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src 'self' data:;style-src 'unsafe-inline'"><title>FOTOJACHT — jullie album</title><style>body{font:16px system-ui;background:#151813;color:#f3f4e9;margin:24px}h1,a{color:#e5f58d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0}img{width:100%;display:block;border-radius:12px}figcaption{padding:12px 0}</style><h1>FOTOJACHT — jullie album</h1><p>${rows.length} foto’s. Deze bestanden zijn privé: deel ze alleen met je groep.</p><main>${cards.join("")}</main></html>`,
      );
      files["overzicht.json"] = fflate.strToU8(
        JSON.stringify(manifest, null, 2),
      );
      files["LEES-MIJ.txt"] = fflate.strToU8(
        "FOTOJACHT\nPak deze ZIP eerst uit. Open daarna album.html om alle foto’s met titels en vergelijkingen te bekijken.\nElke teammap bevat jullie foto’s, beschikbare originelen, vergelijking.jpg en referentie.txt.\nFoto’s zijn alleen afkomstig van dit apparaat. Geen synchronisatie met andere telefoons.\nBewaar deze privékopie veilig.\n",
      );
      const bytes = fflate.zipSync(files, { level: 0 });
      download(
        new Blob([bytes], { type: "application/zip" }),
        "FOTOJACHT-" +
          (teamId
            ? filename(
                snapshotTeams.find((t) => t.id === teamId)?.name || "team",
              )
            : "alle-teams") +
          "-" +
          new Date().toISOString().slice(0, 10) +
          ".zip",
      );
      $("exportStatus").textContent =
        "ZIP klaar. Open Downloads / Bestanden en pak de ZIP uit. Open daarna album.html.";
      toast("ZIP gedownload. Je foto’s blijven ook op deze telefoon bewaard.");
    } catch (error) {
      $("exportStatus").textContent =
        "ZIP niet voltooid. Probeer per team te downloaden; je foto’s blijven bewaard.";
      throw error;
    } finally {
      exporting = false;
      updateSaveButton();
    }
  }
  $("downloadAll").addEventListener("click", () =>
    busy($("downloadAll"), () => exportZIP()),
  );
  route();
  renderAccount();
  renderChallenge();
  drawTimer();
  loadLocal();
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" ||
      ["127.0.0.1", "localhost"].includes(location.hostname))
  )
    navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
