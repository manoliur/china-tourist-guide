#!/usr/bin/env python3
"""Маршрутизация по метро Пекина. Отвечает на вопрос туриста:
«откуда → куда → как ехать», с пересадками, временем и стоимостью.

Использование:
    python3 route.py "西直门" "国贸"
    python3 route.py --list | grep 机场
"""
import json, sys, heapq, argparse, os

NET = os.path.join(os.path.dirname(__file__), "out", "network.json")

# средняя скорость метро с учётом остановок, км/ч (для оценки времени)
SPEED_KMH = 34.0
# аэропортные экспрессы едут значительно быстрее
SPEED_BY_LINE = {
    "capital-airport-express": 110.0,
    "daxing-airport-express": 130.0,
    "line-s1": 70.0,
}
# время на пересадку, мин
TRANSFER_MIN = 4.0


def load():
    return json.load(open(NET, encoding="utf-8"))


def build_adj(net):
    adj = {}
    for e in net["edges"]:
        a, b = e["from"], e["to"]
        d = e["dist_m"] if isinstance(e.get("dist_m"), (int, float)) else None
        adj.setdefault(a, []).append((b, d, e["line"]))
        adj.setdefault(b, []).append((a, d, e["line"]))
    return adj


def edge_time(dist_m, line=None):
    if not dist_m:
        return 1.5  # нет данных — типичный короткий перегон
    speed = SPEED_BY_LINE.get(line, SPEED_KMH)
    return (dist_m / 1000.0) / speed * 60.0 + 0.5  # +0.5 мин стоянка


def find_station(net, query):
    """Ищет станцию по китайскому названию, английскому алиасу или id."""
    q = query.strip()
    if q in net["stations"]:
        return q
    ql = q.lower()
    for sid, st in net["stations"].items():
        if st["name"] == q:
            return sid
        for a in st.get("aliases", []):
            if a.lower() == ql:
                return sid
    # частичное совпадение
    hits = [(sid, st) for sid, st in net["stations"].items()
            if q in st["name"] or any(q.lower() in a.lower() for a in st.get("aliases", []))]
    if len(hits) == 1:
        return hits[0][0]
    if len(hits) > 1:
        print(f"  неоднозначно '{query}', найдено {len(hits)}:")
        for sid, st in hits[:8]:
            print(f"    {st['name']}  (линии: {','.join(st['lines'])})")
        return None
    return None


def route(net, src, dst):
    """Дейкстра по времени. Штраф за пересадку — чтобы не дёргать линии зря."""
    adj = build_adj(net)
    dist = {src: 0.0}
    prev = {}
    pq = [(0.0, src, None)]
    # (время, станция, текущая линия)
    while pq:
        t, u, uline = heapq.heappop(pq)
        if t > dist.get(u, float("inf")):
            continue
        if u == dst:
            break
        for v, dm, line in adj.get(u, []):
            dt = edge_time(dm, line)
            if uline is not None and line != uline:
                dt += TRANSFER_MIN  # пересадка
            nt = t + dt
            if nt < dist.get(v, float("inf")):
                dist[v] = nt
                prev[v] = (u, line)
                heapq.heappush(pq, (nt, v, line))

    if dst not in dist:
        return None

    # восстановление пути
    path = []
    cur = dst
    while cur != src:
        u, line = prev[cur]
        path.append((u, cur, line))
        cur = u
    path.reverse()

    # группируем по линиям = сегменты поездки
    segments = []
    for u, v, line in path:
        if segments and segments[-1]["line"] == line:
            segments[-1]["stations"].append(v)
            segments[-1]["dist_m"] += net["edges"][0].get("dist_m") or 0
        else:
            segments.append({"line": line, "from": u, "to": v, "stations": [u, v], "dist_m": 0})

    # точные расстояния по сегментам
    edge_lookup = {}
    for e in net["edges"]:
        edge_lookup[(e["from"], e["to"])] = e.get("dist_m")
        edge_lookup[(e["to"], e["from"])] = e.get("dist_m")
    for seg in segments:
        tot = 0
        st = seg["stations"]
        for i in range(len(st) - 1):
            d = edge_lookup.get((st[i], st[i + 1]))
            if isinstance(d, (int, float)):
                tot += d
        seg["dist_m"] = tot

    return {"total_min": dist[dst], "segments": segments}


def fare_for_distance(net, meters, lines_used=None):
    """Считает тариф по правилам Пекинского метро.

    Важно: у аэропортных экспрессов — отдельные тарифы (не по расстоянию):
      首都机场线 (Столичный аэропорт) — фиксированно ¥25
      大兴机场线 (Дасин) — ¥10 до 20 км, ¥25 до 30 км, ¥35 свыше
    Остальные линии — общая сетка по расстоянию.
    """
    lines_used = lines_used or []
    # аэропортные линии — отдельный тариф, берём максимальный из задействованных
    if "capital-airport-express" in lines_used:
        return 25
    if "daxing-airport-express" in lines_used:
        km = (meters or 0) / 1000.0
        if km <= 20:
            return 10
        if km <= 30:
            return 25
        return 35
    if not meters:
        return None
    km = meters / 1000.0
    rules = [
        (6, 3), (12, 4), (22, 5), (32, 6), (52, 7), (72, 8), (92, 9),
    ]
    for lim, fare in rules:
        if km <= lim:
            return fare
    return 10  # свыше 92 км — максимум


def fmt_line(net, lid):
    for l in net["lines"]:
        if l["id"] == lid:
            return l["name"]
    return lid


def print_route(net, src, dst, r):
    s = net["stations"][src]
    d = net["stations"][dst]
    print(f"\n  ОТКУДА: {s['name']}" + (f" ({s['name_en']})" if s.get('name_en') else ""))
    print(f"  КУДА:   {d['name']}" + (f" ({d['name_en']})" if d.get('name_en') else ""))
    print(f"\n  МАРШРУТ:")
    total_m = 0
    for i, seg in enumerate(r["segments"], 1):
        st = seg["stations"]
        t = sum(edge_time(seg['dist_m'] / max(len(st)-1,1), seg['line']) for _ in range(len(st) - 1))
        total_m += seg["dist_m"]
        mark = "🚇" if i == 1 else "🔄"
        print(f"\n   {mark} {fmt_line(net, seg['line'])}")
        print(f"      {net['stations'][st[0]]['name']} → {net['stations'][st[-1]]['name']}")
        print(f"      остановок: {len(st)-1}" + (f" · {seg['dist_m']/1000:.1f} км" if seg['dist_m'] else ""))
        if i > 1:
            print(f"      ⚠️ пересадка (≈{TRANSFER_MIN:.0f} мин)")
    lines_used = [seg['line'] for seg in r['segments']]
    fare = fare_for_distance(net, total_m, lines_used)
    print(f"\n  ВРЕМЯ:      ~{r['total_min']:.0f} мин (в пути)")
    print(f"  РАССТОЯНИЕ: {total_m/1000:.1f} км")
    if fare:
        print(f"  СТОИМОСТЬ:  ¥{fare}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--list", action="store_true", help="список всех станций")
    ap.add_argument("--transfers", action="store_true", help="только пересадочные")
    a = ap.parse_args()
    net = load()

    if a.list or a.transfers:
        for sid, st in sorted(net["stations"].items(), key=lambda x: x[1]["name"]):
            if a.transfers and len(st["lines"]) < 2:
                continue
            en = f" [{st['name_en']}]" if st.get("name_en") else ""
            print(f"  {st['name']}{en}  — линии: {','.join(st['lines'])}")
        return

    if not a.src or not a.dst:
        ap.print_help(); return

    src = find_station(net, a.src)
    dst = find_station(net, a.dst)
    if not src:
        print(f"  ❌ не найдена станция: {a.src}"); sys.exit(1)
    if not dst:
        print(f"  ❌ не найдена станция: {a.dst}"); sys.exit(1)

    r = route(net, src, dst)
    if not r:
        print("  ❌ маршрут не найден (возможно, сеть не связана в данных)"); sys.exit(1)
    print_route(net, src, dst, r)


if __name__ == "__main__":
    main()
