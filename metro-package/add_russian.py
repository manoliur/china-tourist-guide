#!/usr/bin/env python3
"""Добавляет русские названия станций в граф метро.

Источник русских названий: Википедия, «Список станций Пекинского метрополитена»
(CC BY-SA). Ориентиры (вокзал, храм) берём из английских алиасов исходных данных.
"""
import json, os, re

OUT = "out"
net = json.load(open(f"{OUT}/network.json", encoding="utf-8"))
wiki = json.load(open(f"{OUT}/wiki_ru.json", encoding="utf-8"))

# ориентиры: английский алиас -> русский пояснитель
LANDMARK = {
    "beijing railway station": "Северный вокзал",
    "railway station": "вокзал",
    "lama temple": "Храм Ламы (Юнхэгун)",
    "temple of heaven": "Храм Неба",
    "forbidden city": "Запретный город",
    "tiananmen": "Тяньаньмэнь",
    "tian'anmen": "Тяньаньмэнь",
    "airport": "аэропорт",
    "daxing airport": "аэропорт Дасин",
    "capital airport": "Столичный аэропорт",
    "national library": "Национальная библиотека",
    "beijing zoo": "Пекинский зоопарк",
    "olympic": "Олимпийский парк",
    "summer palace": "Летний дворец",
    "universiade": "Универсиада",
    "china world": "China World",
    "silk street": "Шёлковая улица",
    "wangfujing": "Ванфуцзин (торговая улица)",
    "sanlitun": "Саньлитунь",
    "yabaolu": "Ябаолу (русский квартал)",
}

matched = 0
missing = []
for sid, st in net["stations"].items():
    zh = st["name"]
    w = wiki.get(zh)
    if w:
        st["name_ru"] = w["ru"]
        if w.get("en") and not st.get("name_en"):
            st["name_en"] = w["en"]
        matched += 1
    else:
        st["name_ru"] = None
        missing.append(zh)
    # ориентир
    lm = None
    for a in (st.get("aliases") or []) + ([st.get("name_en")] if st.get("name_en") else []):
        if not a:
            continue
        key = a.lower()
        if key in LANDMARK:
            lm = LANDMARK[key]
            break
    if lm:
        st["landmark_ru"] = lm

# мета
net["meta"]["ru_names_matched"] = matched
net["meta"]["ru_names_missing"] = len(missing)
net["meta"]["ru_source"] = "Википедия, Список станций Пекинского метрополитена (CC BY-SA)"

json.dump(net, open(f"{OUT}/network.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))

print(f"  станций всего:        {len(net['stations'])}")
print(f"  с русским названием:  {matched}")
print(f"  без русского:         {len(missing)}")
print(f"  с ориентиром:         {sum(1 for s in net['stations'].values() if s.get('landmark_ru'))}")
print(f"  размер файла:         {os.path.getsize(f'{OUT}/network.json')/1024:.0f} КБ")
if missing:
    print(f"  примеры без названия: {' / '.join(missing[:6])}")
