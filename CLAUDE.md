# Правила проекта: china-guide (справочник туриста в Китае)

## Что это
Офлайн-PWA-справочник для туриста в Китае. Живой: **manoliur.github.io/china-tourist-guide**
Репозиторий: **github.com/manoliur/china-tourist-guide** (публичный, GitHub Pages).

## Команды
```bash
npm run dev        # разработка
npm run build      # сборка → dist/
cp src/content/*.json public/content/ && npm run build   # после правки контента!
```

## Структура
- `src/content/*.json` — **канонический источник контента** (17 разделов, 180 записей)
- `public/content/*.json` — копия для рантайм-fetch (Vite отдаёт public/ как есть)
- `src/metro.js` — навигация по метро (Дейкстра, портировано из route.py)
- `public/metro/beijing.bin` — данные метро (gzip, 23 КБ, 425 станций)
- `public/audio/` — озвучка фраз (43 mp3, ~352 КБ)
- `dist/` — сборка

## Критичные правила
- **Источники только первичные.** Запрещены как источник факта: vc.ru, travelto.ru,
  easypay.world, форумы, блоги-агрегаторы, соцсети. Официальные домены: gov.cn,
  mfa.gov.cn, china-consulate.gov.cn, alipayplus.com, pbc.gov.cn, mid.ru, custom.gov.cn.
  Нет первоисточника → пометка `requires_check`, но запись НЕ выбрасывается.
- **Перед поиском в вебе** — сразу пробовать WebFetch на официальный домен,
  а не останавливаться на первой подборке блогов.
- **Происхождение записей:** `origin: translated` — из `/root/projects/htlb-raw`
  (книга HowToLiveBetter, Unlicense), источники как в оригинале. `origin: original` —
  написано с нуля (Alipay, SIM, транспорт, отели, безвиз, таможня, еда, розетки,
  связь с РФ, деньги) — источники строго первичные.
- **JSON-схема записи и согласованные примеры:** `/root/TASK-china-concept.md`.
- **Офлайн обязателен.** Все 16 разделов + metro + audio должны быть в precache `sw.js`.
  После сборки проверять: `grep -o '"[^"]*"' dist/sw.js | wc -l`
- **Вес до 1 МБ.** Сейчас ~1.1 МБ — при добавлении контента думать про модульную загрузку.
- **Шрифты self-hosted** (Manrope с кириллицей). Google Fonts запрещены — в Китае блокируются.
- Номера экстренных служб сверять через официальные консульские сайты, с датой сверки.

## Проверка результата (обязательно)
```bash
/root/bin/verify-web.sh dist 8911    # HTTP-код, title, скриншот
```
"""
