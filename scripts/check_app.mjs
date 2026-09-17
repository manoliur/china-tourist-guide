import { chromium } from "playwright";

const URL = "http://localhost:8902/";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(1500);

  // Ждём регистрации service worker
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== undefined, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.active?.state : "no-registration";
  });
  console.log("Service worker state:", swState);

  const sectionCount = await page.locator(".row").count();
  console.log("Разделов на главной:", sectionCount);

  // Открыть раздел "Экстренная помощь" (первый)
  await page.locator(".row").first().click();
  await page.waitForTimeout(300);
  const entryCount = await page.locator("#section-detail-list .entry-card").count();
  console.log("Записей в первом разделе (эмерджэнси):", entryCount);
  const firstTitle = await page.locator("#section-detail-list .entry-card h3").first().innerText();
  console.log("Первая запись:", firstTitle.slice(0, 60));

  // Поиск
  await page.locator('[data-view="search"]').click();
  await page.fill("#search-input", "дрон");
  await page.waitForTimeout(300);
  const searchResults = await page.locator("#search-results .entry-card").count();
  console.log('Поиск "дрон" -> найдено:', searchResults);

  // SOS
  await page.locator('[data-view="sos"]').click();
  await page.waitForTimeout(200);
  const sosHref = await page.locator(".sos-btn").first().getAttribute("href");
  console.log("Первая SOS-кнопка href:", sosHref);
  const sosCount = await page.locator(".sos-btn").count();
  console.log("Всего SOS-кнопок:", sosCount);

  // Калькулятор
  await page.locator('[data-view="calc"]').click();
  await page.waitForTimeout(200);
  await page.fill("#calc-rate", "12");
  await page.locator("#calc-rate").dispatchEvent("change");
  await page.fill("#calc-cny", "100");
  await page.locator("#calc-cny").dispatchEvent("input");
  await page.waitForTimeout(100);
  const rubValue = await page.locator("#calc-rub").inputValue();
  console.log("Калькулятор: 100 CNY по курсу 12 ->", rubValue, "RUB (ожидаем 1200.00)");

  // Разговорник
  await page.locator('[data-view="phrases"]').click();
  await page.waitForTimeout(200);
  const phraseCount = await page.locator(".phrase-card").count();
  console.log("Фраз в разговорнике:", phraseCount);

  console.log("JS-ошибки на этом этапе:", errors.length ? errors : "нет");

  // === ОФЛАЙН-ПРОВЕРКА ===
  console.log("\n=== Отключаю сеть и делаю hard reload ===");
  await context.setOffline(true);
  await page.reload({ waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(1000);

  const offlineSectionCount = await page.locator(".row").count();
  console.log("[OFFLINE] Разделов на главной после reload офлайн:", offlineSectionCount);

  await page.locator(".row").nth(1).click(); // раздел law
  await page.waitForTimeout(300);
  const offlineEntryCount = await page.locator("#section-detail-list .entry-card").count();
  console.log("[OFFLINE] Записей во 2-м разделе:", offlineEntryCount);

  await page.locator('[data-view="sos"]').click();
  await page.waitForTimeout(200);
  const offlineSos = await page.locator(".sos-btn").count();
  console.log("[OFFLINE] SOS-кнопок доступно офлайн:", offlineSos);

  console.log("JS-ошибки офлайн:", errors.length ? errors : "нет");

  await browser.close();
}

main();
