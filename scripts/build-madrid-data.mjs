// Genera public/data/madrid.json a partir de data-src/.
// Uso: node scripts/build-madrid-data.mjs
import * as turf from "@turf/turf";
import fs from "node:fs";
import osmtogeojson from "osmtogeojson";

const SRC = new URL("../data-src/", import.meta.url);
const OUT = new URL("../public/data/madrid.json", import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, SRC), "utf8"));
const r5 = (x) => Math.round(x * 1e5) / 1e5;

const base = read("base_datos.json");

// --- Límites -----------------------------------------------------------
const polygonsOf = (osmJson) =>
    osmtogeojson(osmJson).features.filter(
        (f) =>
            f.geometry &&
            (f.geometry.type === "Polygon" ||
                f.geometry.type === "MultiPolygon"),
    );

const simplify = (f, tolerance) => {
    const s = turf.simplify(f, { tolerance, highQuality: true });
    s.geometry.coordinates = JSON.parse(
        JSON.stringify(s.geometry.coordinates, (_, v) =>
            typeof v === "number" ? r5(v) : v,
        ),
    );
    return s;
};

const comunidadRaw = polygonsOf(read("comunidad_raw.json"))[0];
const comunidad = simplify(comunidadRaw, 0.0005);
comunidad.properties = {
    name: "Comunidad de Madrid",
    admin_level: "4",
    id: "relation/349055",
};

const inside = (f) =>
    turf.booleanPointInPolygon(turf.pointOnFeature(f), comunidadRaw);

// Solo municipios reales (con código INE); fuera zonas comunes como «Los Baldíos».
const municipios = polygonsOf(read("municipios_raw.json"))
    .filter(
        (f) =>
            inside(f) &&
            String(f.properties["ine:municipio"] ?? "").startsWith("28"),
    )
    .map((f) => {
        const s = simplify(f, 0.0003);
        s.properties = {
            name: f.properties.name ?? f.properties.tags?.name,
            admin_level: "8",
            id: f.id,
        };
        return s;
    });

const madridRaw = polygonsOf(read("municipios_raw.json")).find(
    (f) => f.properties["ine:municipio"] === "28079",
);
// Distrito de Madrid si más de la mitad de su superficie cae en el término municipal.
const distritos = polygonsOf(read("districts_raw.json"))
    .filter((f) => {
        const i = turf.intersect(turf.featureCollection([f, madridRaw]));
        return i && turf.area(i) > 0.5 * turf.area(f);
    })
    .map((f) => {
        const s = simplify(f, 0.0002);
        s.properties = {
            name: f.properties.name ?? f.properties.tags?.name,
            admin_level: "9",
            id: f.id,
        };
        return s;
    });

// --- Elementos tipo OSM ------------------------------------------------
const elements = [];
let nextId = 9_000_000_000;
const node = (lat, lon, tags) =>
    elements.push({
        type: "node",
        id: nextId++,
        lat: r5(lat),
        lon: r5(lon),
        tags,
    });
const way = (coords, tags) => {
    const geometry = coords.map(([lat, lon]) => ({
        lat: r5(lat),
        lon: r5(lon),
    }));
    const nodes = geometry.map(() => nextId++);
    elements.push({ type: "way", id: nextId++, nodes, geometry, tags });
};

// Categorías del reglamento: se etiquetan como en OSM para que la app las encuentre.
const RULEBOOK = {
    museums: { tourism: "museum" },
    cinemas: { amenity: "cinema" },
    libraries: { amenity: "library" },
    hospitals: { amenity: "hospital" },
    embassies: { diplomatic: "consulate", office: "diplomatic" },
    zoos: { tourism: "zoo" },
    aquariums: { tourism: "aquarium" },
    themeparks: { tourism: "theme_park" },
    golf: { leisure: "golf_course" },
    parks: { leisure: "park" },
    water: { natural: "water" },
    mcdonalds: { amenity: "fast_food", "brand:wikidata": "Q38076" },
};
// Categorías propias (preguntas nuevas en una fase posterior).
const CUSTOM = [
    "mercadona",
    "corteingles",
    "ikea",
    "stadiums",
    "bullrings",
    "malls",
    "univ",
    "markets",
    "cemeteries",
    "castles",
];
const counts = {};
// En la revisión se añadió el municipio entre paréntesis a algunos nombres
// para distinguirlos; en la app se muestra el nombre real.
const MUNI_NAMES = new Set(municipios.map((m) => m.properties.name));
const cleanName = (n) => {
    const m = n.match(/^(.*) \(([^)]+)\)$/);
    return m && MUNI_NAMES.has(m[2]) && !n.startsWith("El Corte Inglés")
        ? m[1]
        : n;
};
const add = (cat, extra) => {
    // Fuera los sitios marcados como cerrados en OpenStreetMap.
    const items = (base[cat] ?? []).filter(
        (e) => e.p && !/cerrad[oa]/i.test(e.n),
    );
    counts[cat] = items.length;
    for (const e of items)
        node(e.la, e.lo, {
            name:
                e.n === "(sin nombre)" ? "Embajada sin nombre" : cleanName(e.n),
            "jlm:cat": cat,
            ...extra(e),
        });
};
for (const [cat, tags] of Object.entries(RULEBOOK)) add(cat, () => tags);
for (const cat of CUSTOM) add(cat, () => ({}));
add("peaks", (e) => ({ natural: "peak", ele: String(e.ele) }));

const IATA = {
    "Aeropuerto Adolfo Suárez Madrid-Barajas": "MAD",
    "Base Aérea de Torrejón": "TOJ",
    "Aeródromo de Cuatro Vientos": "LECU",
    "Base Aérea de Getafe": "LEGT",
};
add("airports", (e) => ({ aeroway: "aerodrome", iata: IATA[e.n] ?? e.n }));

// Ciudad de más de un millón de habitantes (pregunta «gran ciudad»).
node(40.41692, -3.70348, {
    name: "Madrid",
    place: "city",
    population: "3460491",
});

// Líneas: ríos y alta velocidad.
for (const r of base.rivers)
    for (const g of r.lines)
        if (g.length > 1)
            way(g, { waterway: "river", name: r.n, "jlm:cat": "rivers" });
counts.rivers = base.rivers.length;
for (const g of base.highspeed[0].lines)
    if (g.length > 1) way(g, { railway: "rail", highspeed: "yes" });

// Estaciones (zonas de escondite) a partir de los datos oficiales de líneas
// (scripts/gtfs_to_transit.py). Solo las que están dentro de la Comunidad.
const transit = read("transit.json");
const MIN_TRAINS_PER_HOUR = 1;
const SYSTEM_TAGS = {
    metro: {
        railway: "station",
        station: "subway",
        subway: "yes",
        network: "Metro de Madrid",
    },
    ligero: {
        railway: "station",
        station: "light_rail",
        light_rail: "yes",
        network: "Metro Ligero de Madrid",
    },
    cercanias: {
        railway: "station",
        train: "yes",
        network: "Cercanías Madrid",
    },
};
let syntheticStation = 7_000_000_000;
const lowFrequency = [];
const stationsPerLine = {};
const skippedPerLine = {};
let nStations = 0;
for (const s of transit.stations) {
    if (!turf.booleanPointInPolygon(turf.point([s.lon, s.lat]), comunidadRaw))
        continue;
    const lines = Object.keys(s.lines).sort();
    // Metro no tiene horarios por parada (min = null): toda la red supera 1 tren/hora.
    const frequent = lines.filter(
        (l) => s.lines[l].min === null || s.lines[l].min >= MIN_TRAINS_PER_HOUR,
    );
    const tags = {
        ...SYSTEM_TAGS[s.system],
        name: s.name,
        "jlm:system": s.system,
        "jlm:lines": lines.join(";"),
    };
    const partial = lines.filter((l) => s.lines[l].partial);
    if (partial.length) tags["jlm:partial"] = partial.join(";");
    if (frequent.length === 0) {
        // Regla de casa: fuera las estaciones con menos de 1 tren/hora en alguna franja.
        delete tags.railway;
        tags["jlm:excluded"] = "baja frecuencia";
        lowFrequency.push(s.name);
    }
    const id = s.osm ?? syntheticStation++;
    elements.push({ type: "node", id, lat: r5(s.lat), lon: r5(s.lon), tags });
    for (const l of lines) (stationsPerLine[l] ??= []).push(id);
    for (const l of partial) (skippedPerLine[l] ??= []).push(id);
    nStations++;
}
counts.stations = nStations;
counts.bajaFrecuencia = lowFrequency.join(", ");

const natural = new Intl.Collator("es", { numeric: true }).compare;
const SYSTEM_ORDER = { metro: 0, ligero: 1, cercanias: 2 };
const transitLines = transit.lines
    .filter((l) => stationsPerLine[l.id])
    .sort(
        (a, b) =>
            SYSTEM_ORDER[a.system] - SYSTEM_ORDER[b.system] ||
            natural(a.id, b.id),
    )
    .map((l) => ({
        id: l.id,
        system: l.system,
        name: l.name,
        color: l.color,
        textColor: l.textColor,
        stations: stationsPerLine[l.id],
        skipped: skippedPerLine[l.id] ?? [],
        shapes: l.shapes,
    }));

const out = {
    version: 1,
    generated: new Date().toISOString().slice(0, 10),
    attribution:
        "© colaboradores de OpenStreetMap (ODbL). Revisado a mano para Hide-Seek-Madrid.",
    comunidad,
    admin: turf.featureCollection([...municipios, ...distritos]),
    transit: { date: transit.date, hours: transit.hours, lines: transitLines },
    elements,
};
fs.mkdirSync(new URL("../public/data/", import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log({
    municipios: municipios.length,
    distritos: distritos.length,
    elementos: elements.length,
    ...counts,
    kb: Math.round(fs.statSync(OUT).size / 1024),
});
