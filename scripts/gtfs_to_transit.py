"""Convierte los GTFS oficiales en data-src/transit.json.

Uso:
    python3 -I scripts/gtfs_to_transit.py <dir_metro_gtfs> <metro_routes_osm.json> <dir_ligero> <dir_renfe> <stations_raw.json> <salida.json>

Para cada sistema (Metro, Metro Ligero, Cercanías) obtiene:
- líneas con su color y su trazado,
- estaciones con las líneas que paran en ellas,
- trenes por hora de cada línea en cada estación (día laborable, de 6:00 a 18:00),
- si en una línea hay trenes que pasan por la estación sin parar.
"""
import csv
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict

METRO, METRO_ROUTES, LIGERO, RENFE, OSM_STATIONS, OUT = sys.argv[1:7]
DAY = "20261030"  # viernes laborable de octubre de 2026
WEEKDAY = "friday"
HOURS = range(6, 18)  # franjas 6-7 … 17-18


def rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            yield {k.strip(): (v or "").strip() for k, v in r.items()}


def secs(t):
    h, m, s = (int(x) for x in t.split(":"))
    return h * 3600 + m * 60 + s


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def dist_m(a, b):
    k = math.cos(math.radians(40.4))
    return math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 111_320 * k)


def active_services(d, date, weekday, ignore_dates=False):
    act = set()
    for r in rows(f"{d}/calendar.txt"):
        if r[weekday] == "1" and (ignore_dates or r["start_date"] <= date <= r["end_date"]):
            act.add(r["service_id"])
    try:
        for r in rows(f"{d}/calendar_dates.txt"):
            if r["date"] == date and not ignore_dates:
                (act.add if r["exception_type"] == "1" else act.discard)(r["service_id"])
    except FileNotFoundError:
        pass
    return act


def simplify(pts, tol=0.00008):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        num = abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0])
        den = math.hypot(b[1] - a[1], b[0] - a[0]) or 1e-12
        if num / den > dmax:
            dmax, idx = num / den, i
    if dmax > tol:
        return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [a, b]


def load_shapes(d, wanted):
    sh = defaultdict(list)
    for r in rows(f"{d}/shapes.txt"):
        if r["shape_id"] in wanted:
            sh[r["shape_id"]].append(
                (int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"]))
            )
    out = {}
    for k, v in sh.items():
        v.sort()
        out[k] = [[round(la, 5), round(lo, 5)] for la, lo in simplify([(la, lo) for _, la, lo in v])]
    return out


def system(d, system_name, line_id, keep_route, date=DAY, ignore_dates=False, frequencies=False):
    routes = {r["route_id"]: r for r in rows(f"{d}/routes.txt") if keep_route(r)}
    services = active_services(d, date, WEEKDAY, ignore_dates)
    trips = {
        r["trip_id"]: r
        for r in rows(f"{d}/trips.txt")
        if r["route_id"] in routes and r["service_id"] in services
    }
    stops = {r["stop_id"]: r for r in rows(f"{d}/stops.txt")}

    def station_of(stop_id):
        s = stops[stop_id]
        return s.get("parent_station") or stop_id

    # Paradas de cada viaje, en orden.
    trip_stops = defaultdict(list)
    for r in rows(f"{d}/stop_times.txt"):
        if r["trip_id"] in trips:
            trip_stops[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"], r["departure_time"]))

    # Viajes por hora: horario exacto o, en Metro, a partir de frequencies.txt.
    starts = defaultdict(list)  # trip_id -> lista de horas de salida (segundos)
    if frequencies:
        for r in rows(f"{d}/frequencies.txt"):
            if r["trip_id"] in trips:
                t, end, h = secs(r["start_time"]), secs(r["end_time"]), int(r["headway_secs"])
                while t < end:
                    starts[r["trip_id"]].append(t)
                    t += h

    hourly = defaultdict(lambda: defaultdict(int))  # (station, line) -> hora -> trenes
    served = defaultdict(set)  # line -> estaciones con parada
    trips_through = defaultdict(int)  # (station, line) -> viajes que paran
    trips_line = defaultdict(int)
    patterns = defaultdict(set)  # line -> conjuntos de estaciones (para detectar saltos)
    shapes_by_line = defaultdict(set)

    for tid, seq in trip_stops.items():
        seq.sort()
        line = line_id(routes[trips[tid]["route_id"]])
        trips_line[line] += 1
        if trips[tid].get("shape_id"):
            shapes_by_line[line].add(trips[tid]["shape_id"])
        st_list = [station_of(s) for _, s, _ in seq]
        patterns[line].add(tuple(st_list))
        t0 = secs(seq[0][2])
        base_starts = starts[tid] if frequencies else [t0]
        for (_, sid, dep) in seq:
            st = station_of(sid)
            served[line].add(st)
            trips_through[(st, line)] += 1
            off = secs(dep) - t0
            for s0 in base_starts:
                h = (s0 + off) // 3600
                if h in HOURS:
                    hourly[(st, line)][h] += 1

    # Estaciones por las que pasa algún tren de la línea sin parar:
    # aparecen entre dos paradas de un patrón pero no en ese patrón.
    partial = set()
    for line, pats in patterns.items():
        longest = max(pats, key=len)
        order = {s: i for i, s in enumerate(longest)}
        for p in pats:
            idx = [order[s] for s in p if s in order]
            if len(idx) < 2:
                continue
            lo, hi = min(idx), max(idx)
            for s in longest[lo : hi + 1]:
                if s not in p:
                    partial.add((s, line))

    lines = {}
    for rid, r in routes.items():
        lid = line_id(r)
        if lid not in served:
            continue
        lines.setdefault(
            lid,
            {
                "id": lid,
                "system": system_name,
                "name": r.get("route_long_name", "").strip(),
                "color": "#" + (r.get("route_color") or "888888").upper(),
                "textColor": "#" + (r.get("route_text_color") or "FFFFFF").upper(),
                "shapes": [],
            },
        )
    shapes = load_shapes(d, {s for v in shapes_by_line.values() for s in v})
    for lid, sids in shapes_by_line.items():
        if lid in lines:
            seen = set()
            for sid in sids:
                g = shapes.get(sid)
                if g and tuple(map(tuple, g)) not in seen:
                    seen.add(tuple(map(tuple, g)))
                    lines[lid]["shapes"].append(g)

    stations = {}
    for line, sts in served.items():
        for st in sts:
            s = stops[st]
            e = stations.setdefault(
                st,
                {
                    "gtfs": st,
                    "system": system_name,
                    "name": s["stop_name"],
                    "lat": float(s["stop_lat"]),
                    "lon": float(s["stop_lon"]),
                    "lines": {},
                },
            )
            h = hourly[(st, line)]
            e["lines"][line] = {
                "min": min(h.get(x, 0) for x in HOURS),
                "avg": round(sum(h.values()) / len(HOURS), 1),
                "partial": (st, line) in partial,
            }
    return lines, stations


def metro_line(r):
    return "L" + r["route_short_name"]


def renfe_line(r):
    return "C-" + r["route_short_name"][1:]


# Metro de Madrid: el GTFS publicado es de 2025 y le falta la línea 3, así que
# las líneas y sus paradas salen de las relaciones de OpenStreetMap. Los colores
# y nombres se toman del GTFS. Toda la red de Metro supera 1 tren/hora.
def metro_from_osm(routes_path, gtfs_dir, osm_nodes):
    gtfs = {"L" + r["route_short_name"]: r for r in rows(f"{gtfs_dir}/routes.txt")}
    rels = json.load(open(routes_path))["elements"]
    stations_osm = [
        e for e in osm_nodes
        if e["tags"].get("railway") == "station"
        and (e["tags"].get("subway") == "yes" or e["tags"].get("station") == "subway")
    ]
    any_station = [e for e in osm_nodes if e["tags"].get("railway") in ("station", "halt")]
    by_id = {e["id"]: e for e in json.load(open(OSM_STATIONS))["elements"]}
    lines, stations = {}, {}
    for r in rels:
        ref = r["tags"].get("ref", "")
        lid = "LR" if ref == "R" else ref
        g = gtfs.get(lid, {})
        line = lines.setdefault(lid, {
            "id": lid,
            "system": "metro",
            "name": g.get("route_long_name") or r["tags"].get("name", ""),
            "color": "#" + (g.get("route_color") or r["tags"].get("colour", "#888888").lstrip("#")).upper(),
            "textColor": "#" + (g.get("route_text_color") or "FFFFFF").upper(),
            "shapes": [],
        })
        for m in r["members"]:
            if m["type"] == "way" and m["role"] == "" and m.get("geometry"):
                pts = simplify([(p["lat"], p["lon"]) for p in m["geometry"]])
                line["shapes"].append([[round(a, 5), round(b, 5)] for a, b in pts])
        stops = [m for m in r["members"] if m["type"] == "node" and m["role"].startswith("stop")]
        for m in stops:
            # Las relaciones con "out geom" traen lat/lon de los nodos miembro.
            if "lat" not in m:
                continue
            pos = (m["lat"], m["lon"])
            best = min(stations_osm, key=lambda e: dist_m(pos, (e["lat"], e["lon"])))
            if dist_m(pos, (best["lat"], best["lon"])) > 350:
                # Estaciones sin etiqueta de metro en OSM (p. ej. tramo de Arganda de la L9).
                best = min(any_station, key=lambda e: dist_m(pos, (e["lat"], e["lon"])))
                if dist_m(pos, (best["lat"], best["lon"])) > 250:
                    # Sin nodo de estación: se usa la propia parada (stop_position) de OSM.
                    stop = by_id.get(m["ref"])
                    if not stop or not stop.get("tags", {}).get("name"):
                        print("parada sin estación:", lid, pos, file=sys.stderr)
                        continue
                    best = {"id": stop["id"], "lat": stop["lat"], "lon": stop["lon"], "tags": stop["tags"]}
                    # Las paradas de los dos sentidos se agrupan en la misma estación.
                    for st in stations.values():
                        if norm(st["name"]) == norm(best["tags"]["name"]) and dist_m(pos, (st["lat"], st["lon"])) < 250:
                            best = {"id": st["osm"], "lat": st["lat"], "lon": st["lon"], "tags": {"name": st["name"]}}
                            break
            st = stations.setdefault(best["id"], {
                "gtfs": None, "system": "metro", "name": best["tags"]["name"],
                "lat": best["lat"], "lon": best["lon"], "lines": {}, "osm": best["id"],
            })
            st["lines"][lid] = {"min": None, "avg": None, "partial": False}
    return lines, list(stations.values())


osm = [
    e
    for e in json.load(open(OSM_STATIONS))["elements"]
    if e.get("tags", {}).get("name")
    and e["tags"].get("railway") in ("station", "halt", "tram_stop")
]

all_lines, all_stations = {}, []
ml, ms = metro_from_osm(METRO_ROUTES, METRO, osm)
all_lines.update(ml)
all_stations.extend(ms)
print("metro", len(ml), "líneas", len(ms), "estaciones", file=sys.stderr)
for d, name, lid, keep, kw in [
    (LIGERO, "ligero", lambda r: r["route_short_name"], lambda r: True, {}),
    (RENFE, "cercanias", renfe_line, lambda r: r["route_id"].startswith("10T"), {}),
]:
    ls, sts = system(d, name, lid, keep, **kw)
    for st in sts.values():
        st["osm"] = None
    all_lines.update(ls)
    all_stations.extend(sts.values())
    print(name, len(ls), "líneas", len(sts), "estaciones", file=sys.stderr)


def osm_system(t):
    if t.get("subway") == "yes" or t.get("station") == "subway":
        return "metro"
    if t.get("light_rail") == "yes" or t.get("railway") == "tram_stop" or t.get("station") == "light_rail":
        return "ligero"
    return "cercanias"


# Nombres e ids de OpenStreetMap para Metro Ligero y Cercanías.
for s in all_stations:
    if s["system"] == "metro":
        continue
    cands = sorted(
        (dist_m((s["lat"], s["lon"]), (e["lat"], e["lon"])), i)
        for i, e in enumerate(osm)
        if osm_system(e["tags"]) == s["system"]
    )
    for dm, i in cands[:3]:
        e = osm[i]
        if dm > 400:
            break
        a, b = norm(s["name"]), norm(e["tags"]["name"])
        if dm < 150 or a in b or b in a or a.split()[0] == b.split()[0]:
            s["osm"] = e["id"]
            s["name"] = e["tags"]["name"]
            break
    if s["osm"] is None:
        # Nombre bien escrito de cualquier estación de OSM a menos de 150 m con el mismo nombre.
        for e in osm:
            if dist_m((s["lat"], s["lon"]), (e["lat"], e["lon"])) < 150 and norm(e["tags"]["name"]) == norm(s["name"]):
                s["name"] = e["tags"]["name"]
                break
    if s["osm"] is None and s["name"].isupper():
        s["name"] = s["name"].title()

# Una estación por sistema aunque el GTFS la tenga partida (p. ej. un andén por línea).
merged = {}
for s in all_stations:
    key = (s["system"], s["osm"]) if s["osm"] else (s["system"], norm(s["name"]))
    if key in merged:
        merged[key]["lines"].update(s["lines"])
    else:
        merged[key] = s
all_stations = list(merged.values())

json.dump(
    {"date": DAY, "hours": [HOURS.start, HOURS.stop], "lines": list(all_lines.values()), "stations": all_stations},
    open(OUT, "w"),
    ensure_ascii=False,
)
matched = sum(1 for s in all_stations if s["osm"])
print("estaciones", len(all_stations), "con id OSM", matched, file=sys.stderr)
