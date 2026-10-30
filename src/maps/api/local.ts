/**
 * Datos de la Comunidad de Madrid incluidos en la app.
 *
 * Sustituye las consultas en directo a Overpass por un fichero propio
 * (public/data/madrid.json, generado con scripts/build-madrid-data.mjs).
 * Los filtros siguen escribiéndose con la sintaxis de Overpass
 * (`[k=v]`, `["k"~"re"]`, `[k!=v]`, `[k]`, `[!k]`), así que el resto de la
 * app no necesita saber de dónde vienen los datos.
 */
import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Polygon,
} from "geojson";

import { mapGeoLocation, polyGeoJSON } from "@/lib/context";

export const MADRID_OSM_ID = 349055;

type Tags = Record<string, string>;
export type LocalElement =
    | { type: "node"; id: number; lat: number; lon: number; tags: Tags }
    | {
          type: "way";
          id: number;
          nodes: number[];
          geometry: { lat: number; lon: number }[];
          tags: Tags;
      };

type AdminFeature = Feature<
    Polygon | MultiPolygon,
    { name: string; admin_level: string; id: string }
>;

export interface TransitLine {
    id: string;
    system: "metro" | "ligero" | "cercanias";
    name: string;
    color: string;
    textColor: string;
    /** Ids de las estaciones (nodos) en las que para la línea. */
    stations: number[];
    /** Estaciones por las que pasan algunos trenes de la línea sin parar. */
    skipped: number[];
    /** Trazados como listas de [lat, lon]. */
    shapes: [number, number][][];
}

interface MadridData {
    transit: { date: string; hours: [number, number]; lines: TransitLine[] };
    comunidad: AdminFeature;
    admin: FeatureCollection<
        Polygon | MultiPolygon,
        AdminFeature["properties"]
    >;
    elements: LocalElement[];
}

let dataPromise: Promise<MadridData> | null = null;

export const loadMadridData = () => {
    if (!dataPromise) {
        dataPromise = fetch(import.meta.env.BASE_URL + "/data/madrid.json")
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<MadridData>;
            })
            .catch((e) => {
                dataPromise = null;
                throw e;
            });
    }
    return dataPromise;
};

// --- Filtros con sintaxis de Overpass ----------------------------------

type Clause = (tags: Tags) => boolean;

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, "$1");

const CLAUSE_RE =
    /\[\s*(!)?\s*("[^"]+"|[^\]=!~\s]+)\s*(?:(!=|=|!~|~)\s*("[^"]*"|[^\]]*?))?\s*\]/g;

export const parseFilter = (
    filter: string,
): { keys: string[]; test: Clause } => {
    const clauses: Clause[] = [];
    const keys: string[] = [];
    let consumed = "";
    for (const m of filter.matchAll(CLAUSE_RE)) {
        consumed += m[0];
        const [, not, rawKey, op, rawValue] = m;
        const key = unquote(rawKey);
        keys.push(key);
        const value = rawValue === undefined ? undefined : unquote(rawValue);
        if (!op) {
            clauses.push(
                not ? (t) => t[key] === undefined : (t) => t[key] !== undefined,
            );
        } else if (op === "=") {
            clauses.push((t) => t[key] === value);
        } else if (op === "!=") {
            clauses.push((t) => t[key] !== value);
        } else {
            const re = new RegExp(value!);
            clauses.push(
                op === "~"
                    ? (t) => t[key] !== undefined && re.test(t[key])
                    : (t) => t[key] === undefined || !re.test(t[key]),
            );
        }
    }
    if (consumed.replace(/\s/g, "") !== filter.replace(/\s/g, "")) {
        throw new Error(`Filtro no soportado en local: ${filter}`);
    }
    return { keys, test: (tags) => clauses.every((c) => c(tags)) };
};

/** Claves que existen en los datos locales. Un filtro con otras claves va a Overpass. */
const LOCAL_KEYS = new Set([
    "name",
    "name:en",
    "tourism",
    "amenity",
    "leisure",
    "natural",
    "diplomatic",
    "office",
    "aeroway",
    "iata",
    "place",
    "population",
    "brand:wikidata",
    "railway",
    "station",
    "subway",
    "light_rail",
    "train",
    "tram",
    "public_transport",
    "highspeed",
    "waterway",
    "admin_level",
    "jlm:cat",
]);

/** ¿Se puede responder este filtro con los datos locales? */
export const isLocalQuery = (filters: string[]) => {
    const loc = mapGeoLocation.get();
    const inMadrid =
        polyGeoJSON.get() !== null ||
        Number(loc?.properties?.osm_id) === MADRID_OSM_ID;
    if (!inMadrid) return false;
    try {
        return filters.every((f) =>
            parseFilter(f).keys.every((k) => LOCAL_KEYS.has(k)),
        );
    } catch {
        return false;
    }
};

// --- Límites administrativos -------------------------------------------

/** «Álamo» y «Alcalá» empiezan por la misma letra. */
export const stripAccents = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const adminAsRelation = (f: AdminFeature, id: number) => {
    const polys =
        f.geometry.type === "Polygon"
            ? [f.geometry.coordinates]
            : f.geometry.coordinates;
    let ref = id * 1000;
    const members = polys.flatMap((p) =>
        p.map((ring, i) => ({
            type: "way",
            ref: ref++,
            role: i === 0 ? "outer" : "inner",
            geometry: ring.map(([lon, lat]) => ({ lat, lon })),
        })),
    );
    return {
        type: "relation",
        id,
        members,
        tags: {
            type: "boundary",
            boundary: "administrative",
            admin_level: f.properties.admin_level,
            name: f.properties.name,
            "name:en": stripAccents(f.properties.name),
        },
    };
};

const adminFeatures = async (): Promise<AdminFeature[]> => {
    const d = await loadMadridData();
    const comunidad = d.comunidad;
    const provincia: AdminFeature = {
        ...comunidad,
        properties: {
            ...comunidad.properties,
            name: "Madrid",
            admin_level: "6",
        },
    };
    return [comunidad, provincia, ...(d.admin.features as AdminFeature[])];
};

export const localMadridBoundary = async () => {
    const d = await loadMadridData();
    const rel = adminAsRelation(d.comunidad, MADRID_OSM_ID);
    return { elements: [rel] };
};

export const localAdminBoundary = async (
    lat: number,
    lng: number,
    adminLevel: number,
) => {
    const pt = turf.point([lng, lat]);
    const found = (await adminFeatures()).find(
        (f) =>
            f.properties.admin_level === String(adminLevel) &&
            turf.booleanPointInPolygon(pt, f),
    );
    if (!found) return undefined;
    const properties: Record<string, any> = {
        ...found.properties,
        "name:en": stripAccents(found.properties.name),
    };
    return { ...found, id: found.properties.id, properties };
};

// --- Búsquedas ---------------------------------------------------------

const elementPoint = (e: LocalElement): [number, number] =>
    e.type === "node" ? [e.lon, e.lat] : [e.geometry[0].lon, e.geometry[0].lat];

const insideCustomPolygon = (e: LocalElement) => {
    const poly = polyGeoJSON.get();
    if (!poly) return true;
    if (e.type === "node") {
        const pt = turf.point(elementPoint(e));
        return poly.features.some((f) => turf.booleanPointInPolygon(pt, f));
    }
    return poly.features.some((f) =>
        e.geometry.some((g) =>
            turf.booleanPointInPolygon(turf.point([g.lon, g.lat]), f),
        ),
    );
};

const typeAllowed = (searchType: string, type: string) =>
    searchType === "nwr" ||
    (searchType === "node" && type === "node") ||
    (searchType === "way" && type === "way") ||
    (searchType === "relation" && type === "relation") ||
    (searchType === "nw" && (type === "node" || type === "way")) ||
    (searchType === "wr" && (type === "way" || type === "relation")) ||
    (searchType === "nr" && (type === "node" || type === "relation"));

/**
 * Equivalente local de una búsqueda Overpass `(filtro; alternativas;); out center|geom;`.
 * Devuelve un objeto con la misma forma que la respuesta de Overpass.
 */
export const localFindPlaces = async (
    filters: string[],
    searchType: string,
    outType: "center" | "geom",
) => {
    const tests = filters.map((f) => parseFilter(f).test);
    const matches = (tags: Tags) => tests.some((t) => t(tags));
    const d = await loadMadridData();

    const out: any[] = [];
    if (filters.some((f) => parseFilter(f).keys.includes("admin_level"))) {
        if (typeAllowed(searchType, "relation")) {
            const polys = polyGeoJSON.get();
            (await adminFeatures()).forEach((f, i) => {
                const tags = {
                    admin_level: f.properties.admin_level,
                    name: f.properties.name,
                    "name:en": stripAccents(f.properties.name),
                };
                if (!matches(tags)) return;
                if (
                    polys &&
                    !polys.features.some((p) => turf.booleanIntersects(p, f))
                )
                    return;
                out.push(adminAsRelation(f, 8_000_000_000 + i));
            });
        }
        return { elements: out };
    }

    for (const e of d.elements) {
        if (!typeAllowed(searchType, e.type) || !matches(e.tags)) continue;
        if (!insideCustomPolygon(e)) continue;
        if (e.type === "node" || outType === "geom") {
            out.push(e);
        } else {
            const [lon, lat] = elementPoint(e);
            out.push({
                type: e.type,
                id: e.id,
                tags: e.tags,
                center: { lat, lon },
            });
        }
    }
    return { elements: out };
};

/** Lugares de un tipo dentro de un radio (preguntas de tentáculo y «más cercano»). */
export const localAround = async (
    filter: string,
    radiusMeters: number,
    lat: number,
    lng: number,
) => {
    const test = parseFilter(filter).test;
    const center = turf.point([lng, lat]);
    const d = await loadMadridData();
    return {
        elements: d.elements.filter(
            (e) =>
                test(e.tags) &&
                turf.distance(center, turf.point(elementPoint(e)), {
                    units: "meters",
                }) <= radiusMeters,
        ),
    };
};

// --- Líneas de Metro, Metro Ligero y Cercanías ---------------------------

export const SYSTEM_NAMES: Record<TransitLine["system"], string> = {
    metro: "Metro",
    ligero: "Metro Ligero",
    cercanias: "Cercanías",
};

export const loadTransitLines = async () =>
    (await loadMadridData()).transit.lines;

/** Líneas que paran en una estación (según su id «node/123»). */
export const linesAtStation = async (stationId: string) => {
    const id = Number(stationId.split("/")[1]);
    return (await loadTransitLines()).filter((l) => l.stations.includes(id));
};

/** Estación (con líneas) más cercana a un punto. */
export const nearestTransitStation = async (lat: number, lng: number) => {
    const d = await loadMadridData();
    const pt = turf.point([lng, lat]);
    let best: LocalElement | null = null;
    let bestDist = Infinity;
    for (const e of d.elements) {
        if (e.type !== "node" || !e.tags["jlm:lines"]) continue;
        const dist = turf.distance(pt, turf.point([e.lon, e.lat]));
        if (dist < bestDist) {
            best = e;
            bestDist = dist;
        }
    }
    return best;
};

/**
 * Estaciones de las líneas que pasan por `stationId`. Si se indica `lineId`,
 * solo las de esa línea (la del tren en el que van los buscadores).
 */
export const localTrainLineStations = async (
    stationId: string,
    lineId?: string,
) => {
    const lines = (await linesAtStation(stationId)).filter(
        (l) => !lineId || l.id === lineId,
    );
    return [...new Set(lines.flatMap((l) => l.stations))];
};

/** Una estación está desactivada si lo está ella o todas sus líneas. */
export const isStationDisabled = (
    props: Record<string, any>,
    disabledStations: string[],
    disabledLines: string[],
) => {
    if (disabledStations.includes(props.id)) return true;
    const lines = (props["jlm:lines"] as string | undefined)?.split(";");
    return !!lines && lines.every((l) => disabledLines.includes(l));
};

/**
 * Zonas de «¿Misma línea?». La línea es la elegida por los buscadores o, si no
 * eligen, cualquiera de las que paran en la estación más cercana a la pregunta.
 *
 * - `line`: círculos de escondite de las estaciones de esa línea.
 * - `others`: círculos de escondite del resto de estaciones.
 */
export const sameLineCircles = async (
    lat: number,
    lng: number,
    lineId: string | undefined,
    radius: number,
    units: turf.Units,
) => {
    const station = await nearestTransitStation(lat, lng);
    if (!station) return null;
    const lineStations = new Set(
        await localTrainLineStations(`node/${station.id}`, lineId),
    );
    const d = await loadMadridData();
    const line: Feature<Polygon>[] = [];
    const others: Feature<Polygon>[] = [];
    for (const e of d.elements) {
        if (
            e.type !== "node" ||
            e.tags.railway !== "station" ||
            !e.tags["jlm:lines"]
        )
            continue;
        const c = turf.circle([e.lon, e.lat], radius, { units, steps: 32 });
        (lineStations.has(e.id) ? line : others).push(c);
    }
    return {
        line: turf.featureCollection(line),
        others: turf.featureCollection(others),
    };
};

export interface SameLineEffect {
    /** keep: quedarse dentro de `zone`; remove: quitar `zone` del mapa. */
    mode: "keep" | "remove";
    zone: Feature<Polygon | MultiPolygon>;
}

/**
 * Lo que la respuesta de «¿Misma línea?» deja fuera del mapa:
 * - sí: todo lo que no esté en una zona de escondite de la línea;
 * - no: solo las zonas de escondite de la línea, menos las partes que se solapan
 *   con la zona de otra estación (el escondido podría estar escondido en esa otra).
 */
export const sameLineZone = async (
    lat: number,
    lng: number,
    lineId: string | undefined,
    same: boolean,
    radius: number,
    units: turf.Units,
) => {
    const circles = await sameLineCircles(lat, lng, lineId, radius, units);
    if (!circles || circles.line.features.length === 0) return null;
    const line = turf.union(circles.line) ?? circles.line.features[0];
    if (same) return { mode: "keep", zone: line } as SameLineEffect;
    if (circles.others.features.length === 0)
        return { mode: "remove", zone: line } as SameLineEffect;
    const others = turf.union(circles.others) ?? circles.others.features[0];
    const remove = turf.difference(turf.featureCollection([line, others]));
    return remove ? ({ mode: "remove", zone: remove } as SameLineEffect) : null;
};
