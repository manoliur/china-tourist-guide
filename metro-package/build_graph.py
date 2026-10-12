#!/usr/bin/env python3
"""Собирает граф метро Пекина из данных Beijing-Subway-Tools (MIT).

Вход:  raw/*.json5 (официальные данные Пекинского метро)
Выход: out/network.json — линии, станции, пересадки, расстояния, тарифы

Структура выхода:
{
  "lines": [{"id","name","name_en","color","loop","stations":[...]}],
  "stations": {"<id>": {"name","name_en","lines":[...],"transfers":[...]}},
  "edges": [{"from","to","dist_m","line","time_min"}],
  "fares": [...],
  "meta": {...}
}
"""
import json, os, glob, re, sys
import pyjson5

RAW = "raw"
OUT = "out"
os.makedirs(OUT, exist_ok=True)

# файлы, которые не являются линиями
SKIP = {"fare_rules.json5", "carriage_types.json5", "metadata.json5"}

def station_id(name: str) -> str:
    """Стабильный id станции из китайского названия."""
    return "st-" + re.sub(r"\W+", "", name)

def parse_file(path):
    txt = open(path, encoding="utf-8").read()
    return pyjson5.loads(txt)

def main():
    lines = []
    edges = []
    raw_stations = {}   # id -> {name, aliases, lines:set, transfers:list}
    fares = None
    errors = []

    for f in sorted(glob.glob(f"{RAW}/*.json5")):
        base = os.path.basename(f)
        if base in SKIP:
            if base == "fare_rules.json5":
                try:
                    fares = parse_file(f)
                except Exception as e:
                    errors.append(f"{base}: {e}")
            continue
        try:
            d = parse_file(f)
        except Exception as e:
            errors.append(f"{base}: {e}")
            continue

        if not isinstance(d, dict) or "stations" not in d:
            errors.append(f"{base}: нет поля stations")
            continue

        lid = base.replace(".json5", "")
        name = d.get("name", lid)
        color = d.get("color", "#888")
        loop = bool(d.get("loop", False))
        aliases = d.get("aliases", []) or []

        st_list = []
        prev = None
        for s in d["stations"]:
            sname = s.get("name")
            if not sname:
                continue
            sid = station_id(sname)
            st_list.append({
                "id": sid,
                "name": sname,
                "name_en": (s.get("aliases") or [None])[0],
                "dist_from_prev_m": s.get("dist"),
            })
            # регистрируем станцию
            st = raw_stations.setdefault(sid, {"name": sname, "name_en": None, "lines": set(), "aliases": set()})
            st["lines"].add(lid)
            for a in (s.get("aliases") or []):
                st["aliases"].add(a)
                if st["name_en"] is None:
                    st["name_en"] = a
            # ребро к предыдущей
            if prev is not None:
                dist = s.get("dist")
                edges.append({
                    "from": prev, "to": sid, "line": lid,
                    "dist_m": dist if isinstance(dist, (int, float)) else None,
                })
            prev = sid

        # замыкаем кольцевые линии
        if loop and len(st_list) > 1:
            first, last = st_list[0]["id"], st_list[-1]["id"]
            edges.append({"from": last, "to": first, "line": lid, "dist_m": None,
                          "note": "loop"})

        lines.append({
            "id": lid, "name": name, "aliases": aliases, "color": color,
            "loop": loop, "station_count": len(st_list),
            "stations": [s["id"] for s in st_list],
        })

    # пересадки: станции, где сходятся >=2 разных линии
    transfers = {}
    for sid, st in raw_stations.items():
        if len(st["lines"]) >= 2:
            transfers[sid] = sorted(st["lines"])

    # сериализуем
    stations_out = {}
    for sid, st in raw_stations.items():
        stations_out[sid] = {
            "name": st["name"],
            "name_en": st["name_en"],
            "aliases": sorted(st["aliases"]),
            "lines": sorted(st["lines"]),
        }

    net = {
        "city": "beijing",
        "lines": lines,
        "stations": stations_out,
        "edges": edges,
        "transfers": transfers,
        "fares": fares,
        "meta": {
            "source": "Mick235711/Beijing-Subway-Tools (MIT), данные с официального сайта Пекинского метро",
            "lines": len(lines),
            "stations": len(stations_out),
            "edges": len(edges),
            "transfer_stations": len(transfers),
            "errors": errors,
        },
    }

    with open(f"{OUT}/network.json", "w", encoding="utf-8") as fh:
        json.dump(net, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"  линий:            {len(lines)}")
    print(f"  станций:          {len(stations_out)}")
    print(f"  рёбер:            {len(edges)}")
    print(f"  пересадочных:     {len(transfers)}")
    print(f"  ошибок парсинга:  {len(errors)}")
    for e in errors[:5]:
        print(f"     {e}")
    print(f"  размер файла:     {os.path.getsize(f'{OUT}/network.json')/1024:.0f} КБ")

if __name__ == "__main__":
    main()
