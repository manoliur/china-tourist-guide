// Офлайн-навигация по метро. Грузится лениво при первом открытии вкладки «Метро»,
// не при старте приложения — см. main.js (динамический import()).
// Портировано 1:1 с /root/projects/china-guide/metro-package/route.py (эталон логики,
// проверен на 3 контрольных маршрутах из брифа).

const SPEED_KMH = 34.0;
const SPEED_BY_LINE = {
  "capital-airport-express": 110.0,
  "daxing-airport-express": 130.0,
  "line-s1": 70.0,
};
const TRANSFER_MIN = 4.0;

let net = null;
let adj = null;

export async function loadNetwork() {
  if (net) return net;
  // .bin, не .gz — сервер (Vite dev, некоторые статик-хостинги) видит расширение .gz
  // и сам ставит Content-Encoding: gzip, из-за чего браузер тихо распаковывает файл
  // ДО того, как до него доберётся наш DecompressionStream, и распаковка падает.
  const res = await fetch("./metro/beijing.bin");
  const buf = await res.arrayBuffer();
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  net = JSON.parse(text);
  adj = buildAdj(net);
  return net;
}

export function isLoaded() {
  return net !== null;
}

export function getNet() {
  return net;
}

function buildAdj(net) {
  const a = {};
  for (const e of net.edges) {
    (a[e.from] ??= []).push([e.to, e.dist_m, e.line]);
    (a[e.to] ??= []).push([e.from, e.dist_m, e.line]);
  }
  return a;
}

function edgeTime(distM, line) {
  if (!distM) return 1.5;
  const speed = SPEED_BY_LINE[line] || SPEED_KMH;
  return (distM / 1000 / speed) * 60 + 0.5;
}

export function findStation(query) {
  const q = query.trim();
  if (!q) return null;
  if (net.stations[q]) return q;
  const ql = q.toLowerCase();
  for (const [sid, st] of Object.entries(net.stations)) {
    if (st.name === q) return sid;
    if (st.name_ru && st.name_ru.toLowerCase() === ql) return sid;
    if (st.name_en && st.name_en.toLowerCase() === ql) return sid;
    for (const a of st.aliases || []) {
      if (a.toLowerCase() === ql) return sid;
    }
  }
  const hits = searchStations(q, 2);
  return hits.length === 1 ? hits[0] : null;
}

// Поиск по русскому, английскому, иероглифам и алиасам (пиньинь обычно совпадает с name_en).
export function searchStations(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const [sid, st] of Object.entries(net.stations)) {
    const hay = [st.name, st.name_en, st.name_ru, ...(st.aliases || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      out.push(sid);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function stationLabel(sid) {
  const st = net.stations[sid];
  if (!st) return sid;
  const ru = st.name_ru || st.name_en || st.name;
  return `${ru} ${st.name}`;
}

export function route(srcId, dstId) {
  const dist = { [srcId]: 0 };
  const prev = {};
  const pq = [[0, srcId, null]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [t, u, uline] = pq.shift();
    if (t > (dist[u] ?? Infinity)) continue;
    if (u === dstId) break;
    for (const [v, dm, line] of adj[u] || []) {
      let dt = edgeTime(dm, line);
      if (uline !== null && line !== uline) dt += TRANSFER_MIN;
      const nt = t + dt;
      if (nt < (dist[v] ?? Infinity)) {
        dist[v] = nt;
        prev[v] = [u, line];
        pq.push([nt, v, line]);
      }
    }
  }
  if (!(dstId in dist)) return null;

  const path = [];
  let cur = dstId;
  while (cur !== srcId) {
    const [u, line] = prev[cur];
    path.push([u, cur, line]);
    cur = u;
  }
  path.reverse();

  const segments = [];
  for (const [u, v, line] of path) {
    const last = segments[segments.length - 1];
    if (last && last.line === line) {
      last.stations.push(v);
    } else {
      segments.push({ line, stations: [u, v] });
    }
  }

  const edgeLookup = {};
  for (const e of net.edges) {
    edgeLookup[`${e.from}|${e.to}`] = e.dist_m;
    edgeLookup[`${e.to}|${e.from}`] = e.dist_m;
  }
  for (const seg of segments) {
    let tot = 0;
    const st = seg.stations;
    for (let i = 0; i < st.length - 1; i++) {
      const d = edgeLookup[`${st[i]}|${st[i + 1]}`];
      if (typeof d === "number") tot += d;
    }
    seg.dist_m = tot;
  }

  return { total_min: dist[dstId], segments };
}

export function fareForDistance(meters, linesUsed) {
  if (linesUsed.includes("capital-airport-express")) return 25;
  if (linesUsed.includes("daxing-airport-express")) {
    const km = (meters || 0) / 1000;
    if (km <= 20) return 10;
    if (km <= 30) return 25;
    return 35;
  }
  if (!meters) return null;
  const km = meters / 1000;
  const rules = [
    [6, 3], [12, 4], [22, 5], [32, 6], [52, 7], [72, 8], [92, 9],
  ];
  for (const [lim, fare] of rules) {
    if (km <= lim) return fare;
  }
  return 10;
}

export function lineById(id) {
  return net.lines.find((l) => l.id === id);
}

// Данные не содержат русских названий линий — переводим только то, что переводится
// без домысливания (номерные линии "N号线" = "Линия N", дословно), для остальных
// используем официальный английский алиас как есть, чтобы не выдумывать факты.
export function lineDisplayName(line) {
  const m = line.name.match(/^(\d+)号线$/);
  if (m) return `Линия ${m[1]}`;
  return (line.aliases && line.aliases[0]) || line.name;
}
