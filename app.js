/* FOTOJACHT: public challenges, private team albums. No photo uploads to GitHub. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const challenges = window.CHALLENGES || [];
  const byId = new Map(challenges.map((item) => [item.id, item]));
  const PREFS = "fotojacht-simple-v1";
  const AUTH_KEY = "fotojacht-private-session-v1";
  const config = window.FOTOJACHT_CONFIG || {};
  let validPublicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(
    config.publishableKey || "",
  );
  try {
    validPublicKey ||=
      JSON.parse(
        atob(
          (config.publishableKey || "")
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
      ).role === "anon";
  } catch {}
  const configured =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url || "") &&
    validPublicKey;
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
  let client = null,
    session = null,
    teams = [],
    photos = [],
    currentPhoto = null,
    pendingPhoto = null,
    inviteTeamId = "",
    cloudEpoch = 0;
  const media = new Map(),
    pendingMedia = new Map(),
    localReferences = new Map(),
    legacyPhotos = [];
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
  const check = (result) => {
    if (result.error) throw result.error;
    return result.data;
  };
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function friendly(error) {
    const text = error?.message || "";
    if (/Invalid login credentials/i.test(text))
      return "E-mailadres of wachtwoord klopt niet.";
    if (/Email not confirmed/i.test(text))
      return "Bevestig eerst je e-mailadres via de mail.";
    if (/rate limit|too many/i.test(text))
      return "Even wachten: er zijn te veel pogingen gedaan. Probeer later opnieuw.";
    if (/network|fetch|offline/i.test(text))
      return "Geen verbinding. Probeer opnieuw zodra je internet hebt.";
    if (/quota|storage|opslaan/i.test(text))
      return "Opslaan is niet gelukt. Probeer een kleinere foto.";
    return "Dat is niet gelukt. Controleer je verbinding en of je nog toegang hebt.";
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
      if (dialog.id === "inviteDialog") {
        $("generatedCode").textContent = "";
        inviteTeamId = "";
      }
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
      if (client && session)
        refreshCloud().catch((error) => toast(friendly(error)));
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
  // Existing browser-only reference photos are retained. Never auto-upload old photos.
  let dbPromise;
  function oldDB() {
    return (dbPromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open("scouting-fotojacht-pictures", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("images");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }
  async function localWrite(key, blob) {
    const db = await oldDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      if (blob) tx.objectStore("images").put(blob, key);
      else tx.objectStore("images").delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function loadLocal() {
    try {
      const db = await oldDB();
      const values = await new Promise((resolve, reject) => {
        const tx = db.transaction("images"),
          store = tx.objectStore("images");
        const keys = store.getAllKeys(),
          blobs = store.getAll();
        tx.oncomplete = () =>
          resolve(keys.result.map((key, i) => [key, blobs.result[i]]));
        tx.onerror = () => reject(tx.error);
      });
      for (const [key, blob] of values) {
        if (!(blob instanceof Blob)) continue;
        const url = URL.createObjectURL(blob);
        if (String(key).startsWith("recreation:"))
          legacyPhotos.push({
            id: key,
            url,
            blob,
            challenge_id: String(key).slice(11),
            legacy: true,
          });
        else if (byId.has(key)) localReferences.set(key, url);
      }
      renderChallenge();
      renderAlbum();
    } catch {
      toast(
        "Lokale opslag is niet beschikbaar. Teamfoto’s worden pas na inloggen gedeeld.",
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
    const canSave = !!(client && session && activeTeam());
    $("takePhoto").disabled = !canSave;
    $("saveHint").textContent = !configured
      ? "Rondkijken kan al. Privé delen wordt nog aangesloten."
      : !session
        ? "Log in om foto’s privé met je team te delen."
        : !activeTeam()
          ? "Maak of kies eerst een team via Teams."
          : "Wordt alleen gedeeld met leden van " + activeTeam().name + ".";
  }
  function renderAccount() {
    $("connectionNotice").hidden = configured;
    $("authPanel").hidden = !configured || !!session;
    $("signedInPanel").hidden = !session;
    $("accountButton").textContent = session ? "Mijn account" : "Inloggen";
    $("accountEmail").textContent = session?.user?.email || "";
    const options = teams
      .map((team) => `<option value="${team.id}">${esc(team.name)}</option>`)
      .join("");
    $("activeTeam").innerHTML =
      '<option value="">Kies een team</option>' + options;
    $("activeTeam").value = prefs.teamId;
    const albumFilter = $("albumTeam").value;
    $("albumTeam").innerHTML =
      '<option value="">Alle mijn teams</option>' + options;
    $("albumTeam").value = teams.some((team) => team.id === albumFilter)
      ? albumFilter
      : "";
    $("teamList").innerHTML = teams
      .map(
        (team) =>
          `<article class="team-card"><h2>${esc(team.name)}</h2><p class="hint">${photos.filter((photo) => photo.team_id === team.id).length} foto’s · ${photos.filter((photo) => photo.team_id === team.id).reduce((total, photo) => total + photo.points, 0)} punten</p><div class="split"><button class="secondary" data-select-team="${team.id}">Speel voor dit team</button>${team.owner_id === session?.user.id ? `<button class="text-button" data-invite-team="${team.id}">Uitnodigen & leden</button>` : ""}</div></article>`,
      )
      .join("");
    $("teamList")
      .querySelectorAll("[data-select-team]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          prefs.teamId = button.dataset.selectTeam;
          persist();
          renderAccount();
          renderChallenge();
          go("spelen");
        }),
      );
    $("teamList")
      .querySelectorAll("[data-invite-team]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          busy(button, () => openInvite(button.dataset.inviteTeam)),
        ),
      );
    updateSaveButton();
  }
  $("activeTeam").addEventListener("change", () => {
    prefs.teamId = $("activeTeam").value;
    persist();
    renderChallenge();
  });
  function clearCloud() {
    cloudEpoch++;
    teams = [];
    photos = [];
    for (const url of media.values()) URL.revokeObjectURL(url);
    media.clear();
    pendingMedia.clear();
    document
      .querySelectorAll("dialog[open]")
      .forEach((dialog) => dialog.close());
    $("photoView").replaceChildren();
    $("generatedCode").textContent = "";
    renderAccount();
    renderChallenge();
    renderAlbum();
  }
  async function refreshCloud() {
    if (!session || !client) {
      renderAccount();
      renderAlbum();
      return;
    }
    const epoch = ++cloudEpoch;
    const newTeams = check(
      await client.from("teams").select("id,name,owner_id").order("created_at"),
    );
    const newPhotos = [];
    for (let offset = 0; ; offset += 500) {
      const page = check(
        await client
          .from("photos")
          .select(
            "id,team_id,owner_id,challenge_id,object_path,points,created_at",
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + 499),
      );
      newPhotos.push(...page);
      if (page.length < 500) break;
    }
    if (epoch !== cloudEpoch || !session) return;
    teams = newTeams;
    photos = newPhotos;
    for (const [id, url] of media) {
      if (!photos.some((photo) => photo.id === id)) {
        URL.revokeObjectURL(url);
        media.delete(id);
      }
    }
    if (!teams.some((team) => team.id === prefs.teamId))
      prefs.teamId = teams[0]?.id || "";
    persist();
    renderAccount();
    renderChallenge();
    renderAlbum();
  }
  async function photoURL(photo) {
    if (photo.legacy) return photo.url;
    if (media.has(photo.id)) return media.get(photo.id);
    if (pendingMedia.has(photo.id)) return pendingMedia.get(photo.id);
    const epoch = cloudEpoch;
    const task = (async () => {
      const blob = check(
        await client.storage.from("team-photos").download(photo.object_path),
      );
      if (epoch !== cloudEpoch || !session) throw new Error("Session changed");
      const url = URL.createObjectURL(blob);
      media.set(photo.id, url);
      return url;
    })();
    pendingMedia.set(photo.id, task);
    try {
      return await task;
    } finally {
      if (pendingMedia.get(photo.id) === task) pendingMedia.delete(photo.id);
    }
  }
  let albumObserver;
  function observeAlbum() {
    albumObserver?.disconnect();
    const load = async (image) => {
      const photo = photos.find((row) => row.id === image.dataset.photo);
      if (!photo) return;
      try {
        const url = await photoURL(photo);
        if (image.isConnected) image.src = url;
      } catch {
        if (image.isConnected) {
          image.remove();
          toast(
            "Een foto kon niet worden geladen. Vernieuw het album of log opnieuw in.",
          );
        }
      }
    };
    albumObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            albumObserver.unobserve(entry.target);
            load(entry.target);
          }
      },
      { rootMargin: "100px" },
    );
    $("albumContent")
      .querySelectorAll("img[data-photo]")
      .forEach((image) => albumObserver.observe(image));
  }
  function renderAlbum() {
    const chosen = $("albumTeam").value,
      visible = teams.filter((team) => !chosen || chosen === team.id);
    $("albumContent").innerHTML = !session
      ? '<div class="empty">Log in bij Teams om je besloten teamalbums te openen.</div>'
      : !visible.length
        ? '<div class="empty">Maak een team of vul een uitnodigingscode in bij Teams.</div>'
        : visible
            .map((team) => {
              const rows = photos.filter((photo) => photo.team_id === team.id);
              return `<section class="album-group"><div class="album-heading"><div><h2>${esc(team.name)}</h2><p class="hint">${rows.length} foto’s · ${rows.reduce((total, photo) => total + photo.points, 0)} punten</p></div>${rows.length ? `<button class="text-button" data-download-team="${team.id}">Download album ↓</button>` : ""}</div>${rows.length ? `<div class="gallery-grid">${rows.map((photo) => `<button class="gallery-item" data-photo-open="${photo.id}"><img data-photo="${photo.id}" alt="${esc(byId.get(photo.challenge_id)?.title || "Teamfoto")}" loading="lazy"><span class="caption">${esc(byId.get(photo.challenge_id)?.title || "Teamfoto")}<small>${photo.points} punten · ${new Date(photo.created_at).toLocaleDateString("nl-NL")}</small></span></button>`).join("")}</div>` : '<p class="empty">Nog geen foto’s. Kies een opdracht bij Spelen en bewaar jullie eerste foto.</p>'}</section>`;
            })
            .join("");
    $("albumContent")
      .querySelectorAll("[data-photo-open]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          busy(button, () =>
            openPhoto(
              photos.find((photo) => photo.id === button.dataset.photoOpen),
            ),
          ),
        ),
      );
    $("albumContent")
      .querySelectorAll("[data-download-team]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          busy(button, () => downloadAlbum(button.dataset.downloadTeam)),
        ),
      );
    observeAlbum();
    $("legacySection").hidden = !legacyPhotos.length;
    $("legacyGrid").innerHTML = legacyPhotos
      .map(
        (photo) =>
          `<button class="gallery-item" data-legacy="${esc(photo.id)}"><img src="${esc(photo.url)}" alt="${esc(byId.get(photo.challenge_id)?.title || "Eerdere foto")}" loading="lazy"><span class="caption">${esc(byId.get(photo.challenge_id)?.title || "Eerdere foto")}<small>Alleen op dit apparaat</small></span></button>`,
      )
      .join("");
    $("legacyGrid")
      .querySelectorAll("[data-legacy]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          busy(button, () =>
            openPhoto(
              legacyPhotos.find((photo) => photo.id === button.dataset.legacy),
            ),
          ),
        ),
      );
  }
  $("albumTeam").addEventListener("change", renderAlbum);
  $("refreshAlbum").addEventListener("click", () =>
    busy($("refreshAlbum"), refreshCloud),
  );
  async function openPhoto(photo) {
    if (!photo) return;
    const url = await photoURL(photo),
      item = byId.get(photo.challenge_id);
    currentPhoto = photo;
    $("photoTitle").textContent = item?.title || "Teamfoto";
    const original = item && referenceURL(item);
    $("photoView").innerHTML =
      `<div class="comparison">${original ? `<figure><figcaption>HET ORIGINEEL</figcaption><img src="${esc(original)}" alt="${esc(item.title)}"></figure>` : ""}<figure><figcaption>JULLIE VERSIE</figcaption><img src="${esc(url)}" alt="Jullie nagemaakte foto"></figure></div>`;
    $("downloadPhoto").hidden = false;
    $("deletePhoto").hidden = !(
      photo.legacy ||
      photo.owner_id === session?.user.id ||
      teams.find((team) => team.id === photo.team_id)?.owner_id ===
        session?.user.id
    );
    showDialog("photoDialog");
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  $("downloadPhoto").addEventListener("click", () =>
    busy($("downloadPhoto"), async () => {
      const photo = currentPhoto;
      if (!photo || photo.reference) return;
      const blob = photo.legacy
        ? photo.blob
        : check(
            await client.storage
              .from("team-photos")
              .download(photo.object_path),
          );
      download(
        blob,
        "fotojacht-" +
          photo.challenge_id +
          (photo.legacy ? "." + (blob.type.split("/")[1] || "jpg") : ".jpg"),
      );
    }),
  );
  $("deletePhoto").addEventListener("click", () =>
    busy($("deletePhoto"), async () => {
      const photo = currentPhoto;
      if (
        !photo ||
        photo.reference ||
        !confirm("Deze foto definitief verwijderen?")
      )
        return;
      if (photo.legacy) {
        await localWrite(photo.id, null);
        URL.revokeObjectURL(photo.url);
        legacyPhotos.splice(legacyPhotos.indexOf(photo), 1);
      } else {
        check(
          await client.storage.from("team-photos").remove([photo.object_path]),
        );
        check(await client.from("photos").delete().eq("id", photo.id));
        if (media.has(photo.id)) URL.revokeObjectURL(media.get(photo.id));
        media.delete(photo.id);
        photos = photos.filter((row) => row.id !== photo.id);
      }
      closeDialog("photoDialog");
      renderAlbum();
      renderChallenge();
      renderAccount();
      toast("Foto verwijderd.");
    }),
  );
  function asDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  async function downloadAlbum(teamId) {
    const team = teams.find((row) => row.id === teamId),
      rows = photos.filter((row) => row.team_id === teamId);
    if (!team) return;
    toast("Je album wordt klaargemaakt. Houd deze pagina open.");
    const epoch = cloudEpoch;
    const cards = [];
    for (const photo of rows) {
      if (epoch !== cloudEpoch || !session) throw new Error("Session changed");
      const blob = check(
        await client.storage.from("team-photos").download(photo.object_path),
      );
      cards.push(
        `<figure><img src="${await asDataURL(blob)}" alt="${esc(byId.get(photo.challenge_id)?.title || "Teamfoto")}"><figcaption>${esc(byId.get(photo.challenge_id)?.title || "Teamfoto")} · ${photo.points} punten</figcaption></figure>`,
      );
    }
    if (epoch !== cloudEpoch || !session) return;
    const html = `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>FOTOJACHT — ${esc(team.name)}</title><style>body{margin:30px;background:#151813;color:#f3f4e9;font:16px system-ui}h1{color:#e5f58d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:0}img{width:100%;max-height:65vh;object-fit:contain;background:#0a1007}figcaption{padding:12px 0}</style><h1>FOTOJACHT — ${esc(team.name)}</h1><p>${rows.length} foto’s · Privékopie: deel dit bestand alleen met je groep.</p><main>${cards.join("")}</main></html>`;
    download(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      "fotojacht-" + team.name.replace(/[^a-z0-9-]/gi, "-") + ".html",
    );
    toast("Album gedownload. Bewaar je privékopie veilig.");
  }
  $("takePhoto").addEventListener("click", () => {
    if (!session || !activeTeam()) return;
    const context = {
      teamId: prefs.teamId,
      challengeId: current().id,
      userId: session.user.id,
    };
    $("photoPicker")._context = context;
    $("photoPicker").click();
  });
  $("photoPicker").addEventListener("change", async (event) => {
    const file = event.target.files?.[0],
      context = event.target._context;
    event.target.value = "";
    if (!file || !context || !session) return;
    try {
      const blob = await prepareImage(file);
      if (
        session?.user.id !== context.userId ||
        !teams.some((team) => team.id === context.teamId)
      )
        return;
      pendingPhoto = { ...context, blob, url: URL.createObjectURL(blob) };
      $("uploadPreview").src = pendingPhoto.url;
      $("uploadCaption").textContent =
        teams.find((team) => team.id === context.teamId).name +
        " · " +
        byId.get(context.challengeId).title;
      $("uploadMessage").textContent = "";
      $("photoPoints").value = "5";
      showDialog("uploadDialog");
    } catch {
      toast(
        "Foto kon niet worden geopend. Probeer een JPEG of een kleinere foto (max. 20 MB).",
      );
    }
  });
  $("savePhoto").addEventListener("click", () =>
    busy($("savePhoto"), async () => {
      const photo = pendingPhoto,
        points = Number($("photoPoints").value);
      if (
        !photo ||
        !client ||
        session?.user.id !== photo.userId ||
        !Number.isInteger(points) ||
        points < 0 ||
        points > 10
      )
        return;
      $("uploadMessage").textContent = "Bezig met privé opslaan…";
      $("uploadDialog").querySelector("[data-close]").disabled = true;
      const id = crypto.randomUUID(),
        path = photo.teamId + "/" + photo.userId + "/" + id + ".jpg";
      try {
        check(
          await client.storage.from("team-photos").upload(path, photo.blob, {
            contentType: "image/jpeg",
            cacheControl: "0",
            upsert: false,
          }),
        );
        const result = await client.from("photos").insert({
          id,
          team_id: photo.teamId,
          owner_id: photo.userId,
          challenge_id: photo.challengeId,
          object_path: path,
          points,
        });
        if (result.error) {
          await client.storage.from("team-photos").remove([path]);
          throw result.error;
        }
        closeDialog("uploadDialog");
        resetTimer();
        await refreshCloud();
        toast("Bewaard in jullie besloten teamalbum.");
        next(1);
      } catch (error) {
        $("uploadMessage").textContent =
          "Niet opgeslagen. Probeer opnieuw; je foto staat nog in dit venster.";
        throw error;
      } finally {
        $("uploadDialog").querySelector("[data-close]").disabled = false;
      }
    }),
  );
  // Prevent dismissing the upload dialog halfway through a write.
  $("uploadDialog").addEventListener("cancel", (event) => {
    if ($("savePhoto").disabled) event.preventDefault();
  });
  $("authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!client) return;
    busy($("signIn"), async () => {
      check(
        await client.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value,
        }),
      );
      $("password").value = "";
      $("authMessage").textContent =
        "Ingelogd. Maak een team of vul je uitnodiging in.";
    });
  });
  $("signUp").addEventListener("click", () => {
    if (!client || !$("authForm").reportValidity()) return;
    busy($("signUp"), async () => {
      const result = check(
        await client.auth.signUp({
          email: $("email").value.trim(),
          password: $("password").value,
          options: { emailRedirectTo: location.origin + location.pathname },
        }),
      );
      $("password").value = "";
      $("authMessage").textContent = result.session
        ? "Account gemaakt."
        : "Controleer je e-mail om je account te bevestigen. Log daarna hier in.";
    });
  });
  $("resetPassword").addEventListener("click", () => {
    if (!client || !$("email").reportValidity()) return;
    busy($("resetPassword"), async () => {
      check(
        await client.auth.resetPasswordForEmail($("email").value.trim(), {
          redirectTo: location.origin + location.pathname,
        }),
      );
      $("authMessage").textContent =
        "Als dit account bestaat, ontvang je een herstelmail.";
    });
  });
  $("recoveryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    busy($("recoveryForm").querySelector("button"), async () => {
      check(await client.auth.updateUser({ password: $("newPassword").value }));
      $("newPassword").value = "";
      closeDialog("recoveryDialog");
      toast("Wachtwoord bijgewerkt.");
    });
  });
  $("signOut").addEventListener("click", () =>
    busy($("signOut"), async () => {
      check(await client.auth.signOut({ scope: "local" }));
      session = null;
      clearCloud();
      $("password").value = "";
      toast("Uitgelogd. Teamfoto’s zijn van dit scherm verwijderd.");
    }),
  );
  $("createTeamForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!session) return;
    busy($("createTeamForm").querySelector("button"), async () => {
      const team = check(
        await client.rpc("create_team", { p_name: $("teamName").value.trim() }),
      );
      prefs.teamId = team.id;
      persist();
      $("teamName").value = "";
      await refreshCloud();
      toast("Team gemaakt. Nodig je teamgenoten uit.");
    });
  });
  $("joinTeamForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!session) return;
    busy($("joinTeamForm").querySelector("button"), async () => {
      const result = check(
        await client.rpc("join_team", {
          p_code: $("inviteCode").value.trim().toLowerCase(),
        }),
      );
      if (result.error) {
        toast(result.error);
        return;
      }
      prefs.teamId = result.id;
      persist();
      $("inviteCode").value = "";
      await refreshCloud();
      toast("Je bent lid van het team.");
    });
  });
  async function listMembers(teamId) {
    const members = check(
      await client
        .from("team_members")
        .select("user_id,display_name")
        .eq("team_id", teamId),
    );
    if (teamId !== inviteTeamId) return;
    $("memberList").innerHTML = members
      .map(
        (member) =>
          `<div class="member-row"><span>${esc(member.display_name)}${member.user_id === session.user.id ? " (jij)" : ""}</span>${member.user_id !== session.user.id ? `<button class="text-button danger" data-remove-member="${member.user_id}">Verwijder lid</button>` : ""}</div>`,
      )
      .join("");
    $("memberList")
      .querySelectorAll("[data-remove-member]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          busy(button, async () => {
            if (!confirm("Dit lid de toegang tot het teamalbum ontnemen?"))
              return;
            check(
              await client.rpc("remove_team_member", {
                p_team: teamId,
                p_user: button.dataset.removeMember,
              }),
            );
            await listMembers(teamId);
            toast(
              "Lid verwijderd. Gedownloade kopieën kun je niet terughalen.",
            );
          }),
        ),
      );
  }
  async function openInvite(teamId) {
    const code = check(
      await client.rpc("rotate_team_invite", { p_team: teamId }),
    );
    inviteTeamId = teamId;
    $("inviteTitle").textContent =
      "Uitnodigen: " + teams.find((team) => team.id === teamId).name;
    $("generatedCode").textContent = code;
    showDialog("inviteDialog");
    await listMembers(teamId);
  }
  $("rotateInvite").addEventListener("click", () =>
    busy($("rotateInvite"), async () => {
      const code = check(
        await client.rpc("rotate_team_invite", { p_team: inviteTeamId }),
      );
      $("generatedCode").textContent = code;
      toast("Nieuwe code gemaakt. De vorige code werkt niet meer.");
    }),
  );
  $("copyInvite").addEventListener("click", () =>
    busy($("copyInvite"), async () => {
      const code = $("generatedCode").textContent;
      try {
        await navigator.clipboard.writeText(code);
        toast("Uitnodigingscode gekopieerd.");
      } catch {
        prompt("Kopieer deze uitnodigingscode:", code);
      }
    }),
  );
  async function initAuth() {
    if (!configured) return;
    client = window.FotojachtSupabase.createClient(
      config.url,
      config.publishableKey,
      {
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
        auth: {
          storage: sessionStorage,
          storageKey: AUTH_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      },
    );
    client.auth.onAuthStateChange((event, newSession) => {
      const previousUser = session?.user.id;
      session = newSession;
      // Database calls must run outside the SDK's auth callback lock.
      setTimeout(async () => {
        try {
          if (!session || (previousUser && previousUser !== session.user.id))
            clearCloud();
          if (session) await refreshCloud();
          else renderAccount();
          if (event === "PASSWORD_RECOVERY") showDialog("recoveryDialog");
        } catch (error) {
          toast(friendly(error));
        }
      }, 0);
    });
    const result = await client.auth.getSession();
    session = result.data?.session || null;
    renderAccount();
  }
  route();
  renderAccount();
  renderChallenge();
  drawTimer();
  loadLocal();
  initAuth().catch(() =>
    toast("Inloggen kon niet worden geladen. Probeer de pagina opnieuw."),
  );
  // Cache public application assets only. The service worker never handles Supabase.
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" ||
      location.hostname === "127.0.0.1" ||
      location.hostname === "localhost")
  )
    navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
