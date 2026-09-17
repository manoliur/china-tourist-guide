import { chromium } from "playwright";

const URL = "http://localhost:8902/";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.locator('[data-view="phrases"]').click();
  await page.waitForTimeout(300);
  const phraseCount = await page.locator(".phrase-card").count();
  const categoryCount = await page.locator(".phrase-category").count();
  console.log("Фраз:", phraseCount, "| Категорий:", categoryCount);

  // Проверка воспроизведения (онлайн) — слушаем событие play на audio-элементе через сетевой запрос к mp3
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes(".mp3"), { timeout: 5000 }),
    page.locator('[data-play="phrase-01"]').click(),
  ]);
  console.log("Аудио-запрос (онлайн):", req.url(), "status ожидается 200");
  await page.waitForTimeout(500);
  const btnPlayingClass = await page.locator('[data-play="phrase-01"]').getAttribute("class");
  console.log("Кнопка в состоянии playing:", btnPlayingClass.includes("playing"));

  // Полноэкранный режим
  await page.locator('[data-expand="phrase-01"]').click();
  await page.waitForTimeout(300);
  const fsVisible = await page.locator("#view-fullscreen-phrase.active").count();
  const fsText = await page.locator("#fs-zh").innerText();
  console.log("Полноэкранный режим активен:", fsVisible > 0, "| текст:", fsText);
  await page.locator("#fs-close").click();
  await page.waitForTimeout(200);

  console.log("JS-ошибки (онлайн):", errors.length ? errors : "нет");

  // === ОФЛАЙН ===
  console.log("\n=== Отключаю сеть, перезагружаю, проверяю аудио офлайн ===");
  await context.setOffline(true);
  await page.reload({ waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('[data-view="phrases"]').click();
  await page.waitForTimeout(300);

  const audioLoadedOk = await page.evaluate(async () => {
    const audio = new Audio("./audio/phrase-02.mp3");
    return new Promise((resolve) => {
      audio.addEventListener("canplaythrough", () => resolve(true));
      audio.addEventListener("error", () => resolve(false));
      audio.load();
      setTimeout(() => resolve("timeout"), 4000);
    });
  });
  console.log("[OFFLINE] audio canplaythrough (phrase-02.mp3):", audioLoadedOk);

  console.log("JS-ошибки офлайн:", errors.length ? errors : "нет");
  await browser.close();
}

main();
