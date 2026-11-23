"use strict";

const config = window.WEDDING_CONFIG ?? {};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".hero");
const openDoor = document.querySelector("[data-open]");
const skipDoors = document.querySelector("[data-skip]");
const bookmark = document.querySelector(".bookmark");
const startTime = Date.parse("2027-07-28T15:00:00+03:00");
let doorsOpened = false;

function readStorage(storage, key) {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    window[storage].setItem(key, value);
  } catch {
    // Private browsing and embedded webviews can disable storage.
  }
}

function enterInvitation(fast, focusAction = false) {
  if (doorsOpened) return;
  doorsOpened = true;
  writeStorage("sessionStorage", "weddingDoorsOpened", "yes");
  if (fast) hero.classList.add("skipping");
  hero.classList.add("unsealed");
  openDoor.hidden = true;
  skipDoors.hidden = true;
  window.setTimeout(() => {
    hero.classList.add("entered");
    if (focusAction) document.querySelector(".hero-rsvp").focus({ preventScroll: true });
  }, fast || reducedMotion.matches ? 230 : 1150);
}

skipDoors.hidden = !readStorage("sessionStorage", "weddingDoorsOpened");
openDoor.addEventListener("click", (event) => enterInvitation(false, event.detail === 0));
skipDoors.addEventListener("click", (event) => enterInvitation(true, event.detail === 0));
document.querySelector(".gate-intro").addEventListener("click", () => enterInvitation(false));
document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    bookmark.open = false;
    if (link.hash !== "#top") enterInvitation(true);
  });
});
if (location.hash && location.hash !== "#top") enterInvitation(true);
document.addEventListener("pointerdown", (event) => {
  if (!bookmark.contains(event.target)) bookmark.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && bookmark.open) {
    bookmark.open = false;
    bookmark.querySelector("summary").focus();
  }
});

const finaleGate = document.querySelector(".gate-finale");
const floatingRsvp = document.querySelector(".floating-rsvp");
const venue = document.querySelector("#venue");
const rsvp = document.querySelector("#rsvp");
let scrollQueued = false;

function updateScroll() {
  scrollQueued = false;
  const heroRect = hero.getBoundingClientRect();
  if (!reducedMotion.matches && heroRect.bottom > 0) {
    const offset = Math.max(0, -heroRect.top);
    hero.style.setProperty("--sky-y", offset * 0.045 + "px");
    hero.style.setProperty("--land-y", offset * 0.08 + "px");
    hero.style.setProperty("--branch-y", offset * 0.14 + "px");
  }
  floatingRsvp.hidden = venue.getBoundingClientRect().bottom > innerHeight * 0.75
    || rsvp.getBoundingClientRect().top < innerHeight * 0.9;
  if (finaleGate.getBoundingClientRect().top < innerHeight * 0.74) {
    finaleGate.classList.add("closed");
  }
}

function scheduleScrollUpdate() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(updateScroll);
}

addEventListener("scroll", scheduleScrollUpdate, { passive: true });
addEventListener("resize", scheduleScrollUpdate);
scheduleScrollUpdate();

if ("IntersectionObserver" in window && !reducedMotion.matches) {
  document.documentElement.classList.add("motion");
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -3% 0px", threshold: 0.05 });
  document.querySelectorAll(".reveal").forEach((section) => observer.observe(section));
}

if (!reducedMotion.matches && (navigator.hardwareConcurrency ?? 5) > 4) {
  document.querySelectorAll(".fireflies").forEach((container) => {
    for (let i = 0; i < 18; i += 1) {
      const light = document.createElement("span");
      light.className = "firefly";
      light.style.setProperty("--left", (7 + (i * 57) % 87) + "%");
      light.style.setProperty("--top", (29 + (i * 47) % 64) + "%");
      light.style.setProperty("--size", (2 + i % 3) + "px");
      light.style.setProperty("--duration", (4 + i % 6) + "s");
      light.style.setProperty("--delay", (-i % 8) + "s");
      container.append(light);
    }
  });
}

const music = document.querySelector("#wedding-music");
const musicControl = document.querySelector(".sound-toggle");
if (config.music) {
  music.src = config.music;
  music.volume = 0.4;
  musicControl.hidden = false;
  function syncMusicButton() {
    musicControl.setAttribute("aria-pressed", String(!music.paused));
    musicControl.setAttribute("aria-label", music.paused ? "Включить музыку" : "Выключить музыку");
  }
  music.addEventListener("play", syncMusicButton);
  music.addEventListener("pause", syncMusicButton);
  musicControl.addEventListener("click", async () => {
    if (!music.paused) {
      music.pause();
      return;
    }
    try {
      await music.play();
    } catch {
      syncMusicButton();
    }
  });
}

function enableVenueCarousel(photos) {
  const carousel = document.querySelector("[data-carousel]");
  const frame = carousel.querySelector("figure");
  const image = carousel.querySelector("[data-venue-image]");
  const webp = carousel.querySelector("[data-venue-webp]");
  const dots = carousel.querySelector(".carousel-dots");
  const pause = carousel.querySelector("[data-pause]");
  let active = 0;
  let pausedByGuest = reducedMotion.matches;
  let startX;
  let onScreen = false;
  let pauseForTouchUntil = 0;

  function show(index) {
    active = (index + photos.length) % photos.length;
    if (photos[active].webp) webp.srcset = photos[active].webp;
    else webp.removeAttribute("srcset");
    image.src = photos[active].src;
    image.alt = photos[active].alt;
    dots.querySelectorAll("button").forEach((button, i) => {
      button.setAttribute("aria-current", i === active ? "true" : "false");
    });
  }

  function syncPauseControl() {
    pause.setAttribute("aria-pressed", String(pausedByGuest));
    pause.textContent = pausedByGuest ? "Воспроизвести" : "Пауза";
    pause.setAttribute("aria-label", pausedByGuest ? "Возобновить смену фотографий" : "Приостановить смену фотографий");
  }

  photos.forEach((photo, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "Фото " + (i + 1) + ". " + photo.alt);
    dot.addEventListener("click", () => show(i));
    dots.append(dot);
  });
  carousel.querySelector("[data-prev]").addEventListener("click", () => show(active - 1));
  carousel.querySelector("[data-next]").addEventListener("click", () => show(active + 1));
  pause.addEventListener("click", () => {
    pausedByGuest = !pausedByGuest;
    syncPauseControl();
  });
  frame.addEventListener("touchstart", (event) => {
    startX = event.changedTouches[0].clientX;
    pauseForTouchUntil = Date.now() + 9000;
  }, { passive: true });
  frame.addEventListener("touchend", (event) => {
    if (startX === undefined) return;
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) show(active + (delta < 0 ? 1 : -1));
    startX = undefined;
  }, { passive: true });
  frame.addEventListener("touchcancel", () => { startX = undefined; }, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0.15 }).observe(carousel);
  }
  if (photos.length > 1) {
    setInterval(() => {
      if (onScreen && !pausedByGuest && !document.hidden && Date.now() > pauseForTouchUntil
        && !carousel.matches(":hover") && !carousel.contains(document.activeElement)) show(active + 1);
    }, 5000);
  } else {
    carousel.querySelector(".carousel-controls").hidden = true;
  }
  syncPauseControl();
  show(0);
  carousel.hidden = false;
  document.querySelector(".venue-illustration").hidden = true;
}
if (config.venuePhotos?.length) enableVenueCarousel(config.venuePhotos);

function setPortrait(selector, path, alt) {
  if (!path) return;
  const oldPicture = document.querySelector(selector);
  if (!oldPicture) return;
  const image = document.createElement("img");
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.src = path;
  if (selector.startsWith(".finale")) {
    image.className = "finale-portrait";
    oldPicture.after(image);
  } else {
    oldPicture.replaceWith(image);
  }
}
setPortrait(".invitation-art picture", config.couplePortrait, "Роман и Вероника на фоне долины");
setPortrait(".finale-copy", config.coupleFull, "Роман и Вероника на мосту в долине на закате");

document.querySelectorAll("[data-looks]").forEach((group) => {
  const rail = group.querySelector(".look-rail");
  const controls = group.querySelectorAll("[data-rail]");
  function updateControls() {
    controls[0].disabled = rail.scrollLeft < 2;
    controls[1].disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 2;
  }
  controls.forEach((button) => button.addEventListener("click", () => {
    const distance = rail.firstElementChild.getBoundingClientRect().width + 13;
    rail.scrollBy({ left: distance * Number(button.dataset.rail), behavior: reducedMotion.matches ? "instant" : "smooth" });
  }));
  rail.addEventListener("scroll", updateControls, { passive: true });
  addEventListener("resize", updateControls);
  updateControls();
});

const timer = document.querySelector(".countdown");
const captions = {
  days: ["день", "дня", "дней"],
  hours: ["час", "часа", "часов"],
  minutes: ["минута", "минуты", "минут"],
  seconds: ["секунда", "секунды", "секунд"],
};
const clock = Object.fromEntries(Object.keys(captions).map((unit) => [
  unit, [document.querySelector('[data-clock="' + unit + '"]'), document.querySelector('[data-caption="' + unit + '"]')],
]));
let timerInterval;

function plural(value, options) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) return options[2];
  const mod10 = value % 10;
  if (mod10 === 1) return options[0];
  return mod10 >= 2 && mod10 <= 4 ? options[1] : options[2];
}

function tick() {
  const milliseconds = startTime - Date.now();
  const seconds = Math.floor(milliseconds / 1000);
  if (milliseconds <= 0) {
    timer.hidden = true;
    document.querySelector(".wedding-day-text").hidden = false;
    clearInterval(timerInterval);
    return;
  }
  const current = {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
  for (const [unit, value] of Object.entries(current)) {
    const [number, label] = clock[unit];
    const text = String(value).padStart(2, "0");
    if (number.textContent === text) continue;
    number.textContent = text;
    label.textContent = plural(value, captions[unit]);
    if (!reducedMotion.matches) {
      number.classList.add("flipping");
      window.setTimeout(() => number.classList.remove("flipping"), 400);
    }
  }
}
timerInterval = window.setInterval(tick, 1000);
tick();

const form = document.querySelector("#guest-form");
const formName = document.querySelector("#guest-name");
const attendDetails = document.querySelector("#attendance-details");
const toastHelp = document.querySelector("#toast-help");
const responsePanel = document.querySelector("#response-panel");
const responseText = document.querySelector("#response-text");
const feedback = document.querySelector("#send-feedback");
const previewNote = document.querySelector("#preview-note");
const submit = form.querySelector('[type="submit"]');
const messages = document.querySelector("#form-messages").content;
const endpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.appsScriptUrl ?? "")
  ? config.appsScriptUrl
  : "";
const storage = endpoint ? "localStorage" : "sessionStorage";
const storageKey = endpoint ? "rv2027Sent" : "rv2027DemoSent";
const attendingValue = "Да, с радостью!";
let isSending = false;

function updateQuestions() {
  const attending = form.elements.attend.value === attendingValue;
  attendDetails.hidden = !attending;
  attendDetails.disabled = !attending;
  toastHelp.hidden = !attending || form.elements.toast.value !== "Да, я в деле!";
}

function showResponse(text) {
  form.hidden = true;
  responseText.textContent = text;
  responsePanel.hidden = false;
}

if (endpoint) {
  previewNote.hidden = true;
  form.removeAttribute("aria-describedby");
}
if (readStorage(storage, storageKey)) {
  showResponse("Вы уже ответили. Хотите изменить ответ?");
} else {
  form.hidden = false;
}
form.addEventListener("change", updateQuestions);
formName.addEventListener("input", () => formName.setCustomValidity(""));
updateQuestions();
document.querySelector("#edit-response").addEventListener("click", () => {
  responsePanel.hidden = true;
  form.hidden = false;
  formName.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSending) return;
  formName.setCustomValidity(formName.value.trim() ? "" : "Введите имя и фамилию.");
  if (!form.reportValidity()) return;
  isSending = true;
  submit.disabled = true;
  feedback.hidden = true;
  const body = new URLSearchParams(new FormData(form));
  const attending = body.get("attend") === attendingValue;
  submit.textContent = "Отправляем…";
  try {
    if (endpoint) {
      const result = await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body,
        signal: AbortSignal.timeout(16000),
      });
      if (result.type !== "opaque" && !result.ok) throw new Error("Submission failed");
    }
    writeStorage(storage, storageKey, "yes");
    const text = endpoint
      ? messages.querySelector(attending ? "[data-yes]" : "[data-no]").textContent
      : "Тест пройден. Ответ в Google Таблицу не отправлен.";
    showResponse(text);
    responseText.focus();
  } catch {
    feedback.textContent = messages.querySelector("[data-error]").textContent;
    feedback.hidden = false;
  } finally {
    isSending = false;
    submit.disabled = false;
    submit.textContent = "Отправить ответ";
  }
});
