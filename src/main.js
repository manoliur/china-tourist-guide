import "./style.css";
import { ICON_SPRITE } from "./icons.js";

// Спрайт иконок — вставляем синхронно первым делом, до какого-либо рендера,
// чтобы <use href="#ic-…"> в статическом index.html сразу резолвился без FOUC.
document.body.insertAdjacentHTML("afterbegin", ICON_SPRITE);

const CONTENT_FILES = [
  "emergency", "law", "doctor", "consulate", "phone", "nightlife",
  "payments", "sim", "transport", "hotels", "visa", "customs",
  "food", "power", "contact", "money",
];

const SECTION_ICON = {
  emergency: "ic-siren",
  law: "ic-scale",
  doctor: "ic-cross-medical",
  consulate: "ic-embassy",
  phone: "ic-smartphone",
  nightlife: "ic-glass",
  payments: "ic-card",
  sim: "ic-wifi",
  transport: "ic-train",
  hotels: "ic-bed",
  visa: "ic-passport",
  customs: "ic-suitcase",
  food: "ic-bowl",
  power: "ic-plug",
  contact: "ic-chat",
  money: "ic-banknote",
};

let sections = [];
let allEntries = [];
let phrasebook = [];

async function loadContent() {
  const results = await Promise.all(
    CONTENT_FILES.map((key) =>
      fetch(`./content/${key}.json`)
        .then((r) => r.json())
        .then((data) => ({ key, data }))
        .catch(() => null)
    )
  );
  sections = results
    .filter(Boolean)
    .map(({ key, data }) => ({ key, title: data.title, entries: data.entries }));

  allEntries = [];
  for (const s of sections) {
    for (const e of s.entries) {
      allEntries.push({ ...e, sectionKey: s.key, sectionTitle: s.title });
    }
  }

  try {
    const r = await fetch("./content/phrasebook.json");
    const data = await r.json();
    phrasebook = data.entries;
  } catch {
    phrasebook = [];
  }
}

const ORIGIN_LABEL = { translated: "переведено", adapted: "адаптировано", original: "написано заново" };

function fmtCost(cost) {
  if (!cost) return "";
  const parts = [];
  if (cost.money !== undefined) parts.push(`деньги: ${cost.money}`);
  if (cost.time !== undefined) parts.push(`время: ${cost.time}`);
  if (cost.willpower !== undefined) parts.push(`воля: ${cost.willpower === true ? "да" : cost.willpower === false ? "нет" : cost.willpower}`);
  return parts.join(" · ");
}

function iconTag(id, cls = "icon") {
  return `<svg class="${cls}"><use href="#${id}"/></svg>`;
}

function entryCardHTML(entry) {
  const grade = entry.evidence_grade ? `<span class="tag grade-${entry.evidence_grade}">证据 ${entry.evidence_grade}</span>` : "";
  const origin = entry.origin ? `<span class="tag origin">${ORIGIN_LABEL[entry.origin] || entry.origin}</span>` : "";
  const sources = (entry.sources || [])
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`)
    .join("");
  const requiresCheck = entry.requires_check
    ? `<div class="requires-check">${iconTag("ic-warning")}<span>Требует проверки: ${escapeHtml(entry.requires_check)}</span></div>`
    : "";
  return `
    <article class="entry-card">
      <div class="entry-tags">${grade}${origin}</div>
      <h3>${escapeHtml(entry.title)}</h3>
      ${entry.cost ? `<div class="entry-field"><div class="label">Стоимость</div><div class="value">${escapeHtml(fmtCost(entry.cost))}</div></div>` : ""}
      ${entry.plain ? `<div class="entry-field"><div class="label">По-человечески</div><div class="value">${escapeHtml(entry.plain)}</div></div>` : ""}
      ${entry.evidence ? `<div class="entry-field"><div class="label">Обоснование</div><div class="value">${escapeHtml(entry.evidence)}</div></div>` : ""}
      ${sources ? `<div class="entry-field"><div class="label">Источники</div><ul class="sources">${sources}</ul></div>` : ""}
      ${entry.note ? `<div class="entry-field"><div class="label">Примечание</div><div class="value">${escapeHtml(entry.note)}</div></div>` : ""}
      ${requiresCheck}
      ${entry.verified_at ? `<div class="verified-at">Проверено: ${escapeHtml(entry.verified_at)}</div>` : ""}
    </article>`;
}

function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// --- навигация ---

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  document.querySelectorAll(".bottom-nav button[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  window.scrollTo(0, 0);
}

function renderHome() {
  const list = document.getElementById("section-list");
  list.innerHTML = sections
    .map(
      (s) => `
      <button class="row" data-open-section="${s.key}">
        <div class="icon-wrap">${iconTag(SECTION_ICON[s.key] || "ic-list")}</div>
        <span class="meta">
          <div class="title">${escapeHtml(s.title)}</div>
          <div class="sub">${s.entries.length} ${plural(s.entries.length)}</div>
        </span>
        ${iconTag("ic-chevron-right", "icon chev")}
      </button>`
    )
    .join("");
}

function plural(n) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "запись";
  if ([2, 3, 4].includes(n10) && ![12, 13, 14].includes(n100)) return "записи";
  return "записей";
}

function openSection(key) {
  const s = sections.find((s) => s.key === key);
  if (!s) return;
  document.getElementById("section-detail-count").textContent = `${s.entries.length} ${plural(s.entries.length)}`;
  document.getElementById("section-detail-title").textContent = s.title;
  document.getElementById("section-detail-list").innerHTML = s.entries.map(entryCardHTML).join("");
  showView("section");
}

// --- поиск ---

function runSearch(query) {
  const q = query.trim().toLowerCase();
  const resultsEl = document.getElementById("search-results");
  if (!q) {
    resultsEl.innerHTML = `<p class="search-empty">Начните вводить запрос — например «дрон», «alipay», «болит», «виза»</p>`;
    return;
  }
  const found = allEntries.filter((e) => {
    const haystack = [e.title, e.plain, e.evidence, e.note, e.sectionTitle].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
  if (!found.length) {
    resultsEl.innerHTML = `<p class="search-empty">Ничего не найдено по «${escapeHtml(query)}»</p>`;
    return;
  }
  resultsEl.innerHTML = found
    .map((e) => `<div class="eyebrow" style="margin:var(--sp-4) 0 4px">${escapeHtml(e.sectionTitle)}</div>${entryCardHTML(e)}`)
    .join("");
}

// --- калькулятор ---

const RATE_KEY = "china-guide-rate";
const DEFAULT_RATE = 11.5;

function initCalculator() {
  const cnyInput = document.getElementById("calc-cny");
  const rubInput = document.getElementById("calc-rub");
  const rateInput = document.getElementById("calc-rate");
  const updatedEl = document.getElementById("calc-updated");

  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(RATE_KEY) || "null");
  } catch {
    saved = null;
  }
  const rate = saved?.rate || DEFAULT_RATE;
  rateInput.value = rate;
  updatedEl.textContent = saved?.date ? `Курс сохранён: ${saved.date}` : "Курс по умолчанию — обновите перед поездкой";

  function saveRate(r) {
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify({ rate: r, date: new Date().toLocaleDateString("ru-RU") }));
    } catch {
      /* приватный режим — калькулятор всё равно работает в рамках сессии */
    }
    updatedEl.textContent = `Курс сохранён: ${new Date().toLocaleDateString("ru-RU")}`;
  }

  rateInput.addEventListener("change", () => {
    const r = parseFloat(rateInput.value);
    if (r > 0) saveRate(r);
  });

  cnyInput.addEventListener("input", () => {
    const v = parseFloat(cnyInput.value);
    const r = parseFloat(rateInput.value) || DEFAULT_RATE;
    rubInput.value = Number.isFinite(v) ? (v * r).toFixed(2) : "";
  });

  rubInput.addEventListener("input", () => {
    const v = parseFloat(rubInput.value);
    const r = parseFloat(rateInput.value) || DEFAULT_RATE;
    cnyInput.value = Number.isFinite(v) && r ? (v / r).toFixed(2) : "";
  });
}

// --- разговорник ---

let currentAudio = null;
let currentAudioBtn = null;

function renderPhrases() {
  const list = document.getElementById("phrase-list");
  let lastCategory = null;
  const html = [];
  for (const p of phrasebook) {
    if (p.category !== lastCategory) {
      html.push(`<div class="phrase-category">${escapeHtml(p.category)}</div>`);
      lastCategory = p.category;
    }
    html.push(`
      <div class="phrase-card ${p.priority ? "priority" : ""}">
        <div class="phrase-text">
          <div class="phrase-ru">${escapeHtml(p.ru)}</div>
          <div class="phrase-zh">${escapeHtml(p.zh)}</div>
          <div class="phrase-pinyin">${escapeHtml(p.pinyin)}</div>
        </div>
        <div class="phrase-actions">
          <button class="phrase-btn" data-play="${p.id}" aria-label="Прослушать">${iconTag("ic-play")}</button>
          <button class="phrase-btn" data-expand="${p.id}" aria-label="Показать на весь экран">${iconTag("ic-expand")}</button>
        </div>
      </div>`);
  }
  list.innerHTML = html.join("");
}

function playPhrase(id, btn) {
  // Повторный тап по уже играющей фразе — остановить.
  if (currentAudio && currentAudioBtn === btn && !currentAudio.paused) {
    currentAudio.pause();
    return;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudioBtn?.classList.remove("playing");
  }
  const audio = new Audio(`./audio/${id}.mp3`);
  currentAudio = audio;
  currentAudioBtn = btn;
  btn.classList.add("playing");
  btn.innerHTML = iconTag("ic-pause");
  audio.addEventListener("ended", () => resetPlayButton(btn));
  audio.addEventListener("error", () => resetPlayButton(btn));
  audio.play().catch(() => resetPlayButton(btn));
}

function resetPlayButton(btn) {
  btn.classList.remove("playing");
  btn.innerHTML = iconTag("ic-play");
}

function openFullscreenPhrase(id) {
  const p = phrasebook.find((p) => p.id === id);
  if (!p) return;
  document.getElementById("fs-zh").textContent = p.zh;
  document.getElementById("fs-pinyin").textContent = p.pinyin;
  showView("fullscreen-phrase");
}

// --- метро (Пекин) ---
// Модуль src/metro.js грузится лениво при первом открытии вкладки «Метро» —
// не при старте приложения (см. ensureMetroLoaded).

let metro = null;
let metroLoadingPromise = null;

async function ensureMetroLoaded() {
  if (metro) return metro;
  const btn = document.getElementById("metro-build-btn");
  if (!metroLoadingPromise) {
    btn.textContent = "Загрузка карты метро…";
    btn.disabled = true;
    metroLoadingPromise = import("./metro.js").then(async (mod) => {
      await mod.loadNetwork();
      metro = mod;
      return mod;
    });
  }
  await metroLoadingPromise;
  btn.textContent = "Построить маршрут";
  btn.disabled = false;
  return metro;
}

function stationDisplay(sid) {
  const net = metro.getNet();
  const st = net.stations[sid];
  const text = st.name_ru || st.name_en || st.name;
  return { text, hz: st.name, honest: !st.name_ru };
}

function wireMetroSuggest(inputId, suggestId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestId);
  input.addEventListener("input", async () => {
    await ensureMetroLoaded();
    input.dataset.stationId = "";
    const q = input.value.trim();
    if (!q) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    const hits = metro.searchStations(q, 8);
    if (!hits.length) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = hits
      .map((sid) => {
        const d = stationDisplay(sid);
        return `<button type="button" data-sid="${sid}">${escapeHtml(d.text)}<span class="hz">${escapeHtml(d.hz)}</span></button>`;
      })
      .join("");
    box.classList.add("open");
  });
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sid]");
    if (!btn) return;
    const sid = btn.dataset.sid;
    const d = stationDisplay(sid);
    input.value = `${d.text} ${d.hz}`;
    input.dataset.stationId = sid;
    box.classList.remove("open");
    box.innerHTML = "";
  });
  input.addEventListener("blur", () => {
    setTimeout(() => box.classList.remove("open"), 150);
  });
}

function fmtKm(m) {
  return (m / 1000).toFixed(1);
}

function renderMetroRoute(srcId, dstId) {
  const resultEl = document.getElementById("metro-result");
  const r = metro.route(srcId, dstId);
  if (!r) {
    resultEl.innerHTML = `<div class="metro-error">Маршрут между этими станциями не найден.</div>`;
    return;
  }
  let totalM = 0;
  const linesUsed = r.segments.map((s) => s.line);
  const segHtml = r.segments
    .map((seg, i) => {
      totalM += seg.dist_m;
      const line = metro.lineById(seg.line);
      const st = seg.stations;
      const fromD = stationDisplay(st[0]);
      const toD = stationDisplay(st[st.length - 1]);
      const transferHtml =
        i > 0 ? `<div class="metro-transfer">${iconTag("ic-exchange")}Пересадка ≈4 мин</div>` : "";
      const honest =
        fromD.honest || toD.honest
          ? `<div class="metro-name-honest">рус. название не подтверждено для этой станции — показан английский вариант</div>`
          : "";
      return `
        ${transferHtml}
        <div class="metro-segment">
          <div class="metro-segment-head">
            <span class="metro-line-dot" style="background:${line?.color || "#888"}"></span>
            <span class="metro-line-name">${escapeHtml(line ? metro.lineDisplayName(line) : seg.line)} <span class="metro-line-hz">${escapeHtml(line?.name || "")}</span></span>
          </div>
          <div class="metro-segment-route">${escapeHtml(fromD.text)} ${escapeHtml(fromD.hz)} → ${escapeHtml(toD.text)} ${escapeHtml(toD.hz)}</div>
          <div class="metro-segment-meta">остановок: ${st.length - 1}${seg.dist_m ? ` · ${fmtKm(seg.dist_m)} км` : ""}</div>
          ${honest}
        </div>`;
    })
    .join("");

  const fare = metro.fareForDistance(totalM, linesUsed);

  resultEl.innerHTML = `
    <div class="metro-route">
      <div class="metro-summary">
        <div class="metro-summary-item"><span class="value">~${Math.round(r.total_min)}</span><span class="unit">мин</span></div>
        <div class="metro-summary-item"><span class="value">${fmtKm(totalM)}</span><span class="unit">км</span></div>
        <div class="metro-summary-item"><span class="value">${fare ? "¥" + fare : "—"}</span><span class="unit">цена</span></div>
      </div>
      ${segHtml}
    </div>`;
}

// Быстрые направления из брифа. Не все запрошенные точки есть в данных
// (нет "Пекин Северный", линии на Великую стену и станции "Ябаолу" в этом
// датасете Beijing-Subway-Tools) — показываем только то, что реально
// подтверждено, остальное честно отмечено как отсутствующее в отчёте.
const METRO_QUICK_DIRECTIONS = [
  { label: "Аэропорт Столичный (Т3)", sid: "st-3号航站楼" },
  { label: "Аэропорт Дасин", sid: "st-大兴机场" },
  { label: "Пекинский вокзал", sid: "st-北京站" },
  { label: "Южный вокзал", sid: "st-北京南站" },
  { label: "Западный вокзал", sid: "st-北京西站" },
  { label: "Запретный город", sid: "st-天安门东" },
  { label: "Храм Неба", sid: "st-天坛东门" },
  { label: "Летний дворец", sid: "st-颐和园西门" },
  { label: "Храм Ламы (Юнхэгун)", sid: "st-雍和宫" },
];

function renderMetroQuick() {
  const box = document.getElementById("metro-quick");
  document.getElementById("metro-quick-label").style.display = "";
  box.innerHTML = METRO_QUICK_DIRECTIONS.map(
    (q) => `<button type="button" data-quick-sid="${q.sid}">${escapeHtml(q.label)}</button>`
  ).join("");
}

async function buildMetroRoute() {
  await ensureMetroLoaded();
  const fromInput = document.getElementById("metro-from-input");
  const toInput = document.getElementById("metro-to-input");
  const resultEl = document.getElementById("metro-result");
  const srcId = fromInput.dataset.stationId || metro.findStation(fromInput.value);
  const dstId = toInput.dataset.stationId || metro.findStation(toInput.value);
  if (!srcId) {
    resultEl.innerHTML = `<div class="metro-error">Не найдена станция отправления «${escapeHtml(fromInput.value)}» — выберите станцию из подсказок.</div>`;
    return;
  }
  if (!dstId) {
    resultEl.innerHTML = `<div class="metro-error">Не найдена станция назначения «${escapeHtml(toInput.value)}» — выберите станцию из подсказок.</div>`;
    return;
  }
  renderMetroRoute(srcId, dstId);
}

// --- индикатор сети ---

function updateNetStatus() {
  const el = document.getElementById("net-status");
  const online = navigator.onLine;
  el.querySelector(".label").textContent = online ? "онлайн" : "офлайн";
  el.className = `status-pill ${online ? "online" : "offline"}`;
}

// --- инициализация ---

async function init() {
  await loadContent();
  renderHome();
  renderPhrases();
  initCalculator();
  runSearch("");
  updateNetStatus();

  document.querySelectorAll(".bottom-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showView(btn.dataset.view);
      if (btn.dataset.view === "metro") ensureMetroLoaded();
    });
  });
  document.querySelectorAll("[data-view-link]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.viewLink));
  });
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.back));
  });
  document.getElementById("section-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-section]");
    if (btn) openSection(btn.dataset.openSection);
  });
  document.getElementById("search-input").addEventListener("input", (e) => runSearch(e.target.value));

  document.getElementById("phrase-list").addEventListener("click", (e) => {
    const playBtn = e.target.closest("[data-play]");
    if (playBtn) return playPhrase(playBtn.dataset.play, playBtn);
    const expandBtn = e.target.closest("[data-expand]");
    if (expandBtn) return openFullscreenPhrase(expandBtn.dataset.expand);
  });
  document.getElementById("fs-close").addEventListener("click", () => {
    currentAudio?.pause();
    showView("phrases");
  });

  window.addEventListener("online", updateNetStatus);
  window.addEventListener("offline", updateNetStatus);

  wireMetroSuggest("metro-from-input", "metro-from-suggest");
  wireMetroSuggest("metro-to-input", "metro-to-suggest");
  document.getElementById("metro-build-btn").addEventListener("click", buildMetroRoute);
  document.getElementById("metro-swap").addEventListener("click", () => {
    const fromInput = document.getElementById("metro-from-input");
    const toInput = document.getElementById("metro-to-input");
    const fromVal = fromInput.value, fromId = fromInput.dataset.stationId || "";
    fromInput.value = toInput.value;
    fromInput.dataset.stationId = toInput.dataset.stationId || "";
    toInput.value = fromVal;
    toInput.dataset.stationId = fromId;
  });

  renderMetroQuick();
  document.getElementById("metro-quick").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-quick-sid]");
    if (!btn) return;
    await ensureMetroLoaded();
    const sid = btn.dataset.quickSid;
    const toInput = document.getElementById("metro-to-input");
    const d = stationDisplay(sid);
    toInput.value = `${d.text} ${d.hz}`;
    toInput.dataset.stationId = sid;
    const fromInput = document.getElementById("metro-from-input");
    if (fromInput.dataset.stationId) {
      renderMetroRoute(fromInput.dataset.stationId, sid);
    } else {
      fromInput.focus();
    }
  });
}

init();
