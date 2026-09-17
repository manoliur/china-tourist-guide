import "./style.css";

const CONTENT_FILES = [
  "emergency", "law", "doctor", "consulate", "phone", "nightlife",
  "payments", "sim", "transport", "hotels", "visa", "customs",
  "food", "power", "contact", "money",
];

let sections = []; // [{key,title,icon,entries:[...]}]
let allEntries = []; // flattened with sectionKey/sectionTitle/sectionIcon
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
    .map(({ key, data }) => ({ key, title: data.title, icon: data.icon, entries: data.entries }));

  allEntries = [];
  for (const s of sections) {
    for (const e of s.entries) {
      allEntries.push({ ...e, sectionKey: s.key, sectionTitle: s.title, sectionIcon: s.icon });
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

const GRADE_LABEL = { A: "A", B: "B", C: "C" };
const ORIGIN_LABEL = { translated: "переведено", adapted: "адаптировано", original: "написано заново" };

function fmtCost(cost) {
  if (!cost) return "";
  const parts = [];
  if (cost.money !== undefined) parts.push(`деньги: ${cost.money}`);
  if (cost.time !== undefined) parts.push(`время: ${cost.time}`);
  if (cost.willpower !== undefined) parts.push(`воля: ${cost.willpower === true ? "да" : cost.willpower === false ? "нет" : cost.willpower}`);
  return parts.join(" · ");
}

function entryCardHTML(entry) {
  const grade = entry.evidence_grade ? `<span class="tag grade-${entry.evidence_grade}">证据 ${entry.evidence_grade}</span>` : "";
  const origin = entry.origin ? `<span class="tag origin">${ORIGIN_LABEL[entry.origin] || entry.origin}</span>` : "";
  const sources = (entry.sources || [])
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`)
    .join("");
  const requiresCheck = entry.requires_check
    ? `<div class="requires-check">⚠️ Требует проверки: ${escapeHtml(entry.requires_check)}</div>`
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
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
      <button class="section-row" data-open-section="${s.key}">
        <span class="emoji">${s.icon}</span>
        <span class="meta">
          <div class="name">${escapeHtml(s.title)}</div>
          <div class="count">${s.entries.length} ${plural(s.entries.length)}</div>
        </span>
        <span class="arrow">→</span>
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
  document.getElementById("section-detail-title").textContent = `${s.icon} ${s.title}`;
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
    .map((e) => `<div class="section-title" style="margin:16px 0 4px">${e.sectionIcon} ${escapeHtml(e.sectionTitle)}</div>${entryCardHTML(e)}`)
    .join("");
}

// --- калькулятор ---

const RATE_KEY = "china-guide-rate";
const DEFAULT_RATE = 11.5; // ориентировочно, пользователь должен обновить перед поездкой

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
  updatedEl.textContent = saved?.date
    ? `Курс сохранён: ${saved.date}`
    : "Курс по умолчанию — обновите перед поездкой";

  function saveRate(r) {
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify({ rate: r, date: new Date().toLocaleDateString("ru-RU") }));
    } catch {
      /* приватный режим / хранилище недоступно — калькулятор всё равно работает в рамках сессии */
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

function renderPhrases() {
  const list = document.getElementById("phrase-list");
  const sorted = [...phrasebook].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  list.innerHTML = sorted
    .map(
      (p) => `
      <div class="phrase-card ${p.priority ? "priority" : ""}">
        <div class="phrase-ru">${escapeHtml(p.ru)}</div>
        <div class="phrase-zh">${escapeHtml(p.zh)}</div>
        <div class="phrase-pinyin">${escapeHtml(p.pinyin)}</div>
      </div>`
    )
    .join("");
}

// --- сеть (просто индикатор — контент и так весь офлайн) ---

function updateNetStatus() {
  const el = document.getElementById("net-status");
  const online = navigator.onLine;
  el.textContent = online ? "онлайн" : "офлайн-режим";
  el.className = `status ${online ? "online" : "offline"}`;
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
    btn.addEventListener("click", () => showView(btn.dataset.view));
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

  window.addEventListener("online", updateNetStatus);
  window.addEventListener("offline", updateNetStatus);
}

init();
