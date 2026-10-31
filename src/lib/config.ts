/**
 * Configuraciones de partida: qué zona se juega, el tamaño de partida, el
 * radio de escondite y qué estaciones y líneas cuentan. Hay unas
 * predefinidas y los jugadores pueden guardar las suyas y compartirlas por
 * enlace o archivo, sin servidor: el enlace lleva la configuración
 * comprimida detrás de «#», que el navegador nunca envía a la web.
 */
import { persistentAtom } from "@nanostores/persistent";
import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Polygon,
} from "geojson";
import { z } from "zod";

import {
    additionalMapGeoLocations,
    ALL_STATIONS,
    disabledLines,
    disabledStations,
    displayHidingZonesOptions,
    gameSize,
    hidingRadius,
    hidingRadiusUnits,
    MADRID_MAP_LOCATION,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    questions,
    STATION_TYPE_OPTIONS,
} from "@/lib/context";
import { compress, decompress } from "@/lib/utils";
import { adminFeatures } from "@/maps/api/local";
import type { GameSize } from "@/maps/catalog";
import { houseRules } from "@/maps/catalog";

export const SIZE_INFO: Record<
    GameSize,
    { label: string; hidingRadiusKm: number; hidingMinutes: number }
> = {
    small: { label: "Pequeña", hidingRadiusKm: 0.5, hidingMinutes: 30 },
    medium: { label: "Mediana", hidingRadiusKm: 0.5, hidingMinutes: 60 },
    large: { label: "Grande", hidingRadiusKm: 1, hidingMinutes: 180 },
};

const areaSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("comunidad") }),
    z.object({
        kind: z.literal("zonas"),
        municipios: z.array(z.string()).default([]),
        distritos: z.array(z.string()).default([]),
    }),
    z.object({
        kind: z.literal("poligono"),
        /** FeatureCollection de polígonos (dibujada en el mapa). */
        geojson: z.object({
            type: z.literal("FeatureCollection"),
            features: z.array(z.any()).min(1),
        }),
    }),
]);
export type GameArea = z.infer<typeof areaSchema>;

export const gameConfigSchema = z.object({
    v: z.literal(1).default(1),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(300).default(""),
    size: z.enum(["small", "medium", "large"]).default("medium"),
    area: areaSchema,
    /** Radio de las zonas de escondite; por defecto el del tamaño de partida. */
    hidingRadiusKm: z.number().positive().max(10).optional(),
    /** Qué estaciones cuentan como zonas de escondite (filtros). */
    stationTypes: z.array(z.string()).optional(),
    disabledLines: z.array(z.string()).default([]),
    disabledStations: z.array(z.string()).default([]),
    /** Categorías propias de Madrid (reglas de casa). */
    houseRules: z.boolean().default(true),
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

export interface PresetConfig extends GameConfig {
    id: string;
}

/** Los 7 distritos que quedan (más o menos) dentro de la M-30. */
const ALMENDRA = [
    "Centro",
    "Arganzuela",
    "Retiro",
    "Salamanca",
    "Chamartín",
    "Tetuán",
    "Chamberí",
];

/** Municipios con estaciones de Metro o Metro Ligero. */
const METRO_MUNICIPIOS = [
    "Madrid",
    "Alcobendas",
    "San Sebastián de los Reyes",
    "Alcorcón",
    "Arganda del Rey",
    "Boadilla del Monte",
    "Coslada",
    "Fuenlabrada",
    "Getafe",
    "Leganés",
    "Móstoles",
    "Parla",
    "Pozuelo de Alarcón",
    "Rivas-Vaciamadrid",
    "San Fernando de Henares",
];

const preset = (
    id: string,
    name: string,
    description: string,
    size: GameSize,
    area: GameArea,
): PresetConfig => ({
    ...gameConfigSchema.parse({ name, description, size, area }),
    id,
});

export const PRESETS: PresetConfig[] = [
    preset(
        "comunidad",
        "Toda la Comunidad",
        "La Comunidad de Madrid entera: 8.019 km², 355 estaciones.",
        "medium",
        { kind: "comunidad" },
    ),
    preset(
        "metropolitana",
        "Área metropolitana",
        "Madrid y los 14 municipios con Metro o Metro Ligero: 1.261 km², 327 estaciones.",
        "medium",
        { kind: "zonas", municipios: METRO_MUNICIPIOS, distritos: [] },
    ),
    preset(
        "madrid",
        "Madrid capital",
        "El municipio de Madrid: 604 km², 220 estaciones.",
        "medium",
        { kind: "zonas", municipios: ["Madrid"], distritos: [] },
    ),
    preset(
        "almendra",
        "Almendra central",
        "Los 7 distritos de dentro de la M-30 (aprox.): 42 km², 80 estaciones.",
        "small",
        { kind: "zonas", municipios: [], distritos: ALMENDRA },
    ),
];

export interface SavedConfig extends GameConfig {
    id: string;
    savedAt: string;
}

/** Configuraciones guardadas por el jugador en este móvil. */
export const savedConfigs = persistentAtom<SavedConfig[]>("savedConfigs", [], {
    encode: JSON.stringify,
    decode: (x) => {
        try {
            const raw = JSON.parse(x);
            return Array.isArray(raw)
                ? raw.flatMap((c) => {
                      const r = gameConfigSchema.safeParse(c);
                      return r.success
                          ? [{ ...r.data, id: c.id, savedAt: c.savedAt }]
                          : [];
                  })
                : [];
        } catch {
            return [];
        }
    },
});

/** Última configuración aplicada (para saber si la zona sigue igual). */
export const activeConfig = persistentAtom<
    (GameConfig & { areaKey: string }) | null
>("activeConfig", null, { encode: JSON.stringify, decode: JSON.parse });

const areaKey = (fc: unknown) =>
    fc
        ? JSON.stringify(fc).length + ":" + hash(JSON.stringify(fc))
        : "comunidad";

/** Hash corto (FNV-1a) para comparar zonas sin guardarlas dos veces. */
const hash = (s: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
};

const SEAM_M = 25;

/** Quita agujeros menores de 0,05 km² (restos de bordes que no encajan). */
const dropTinyHoles = (
    f: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> => {
    const clean = (rings: Polygon["coordinates"]) => [
        rings[0],
        ...rings.slice(1).filter((r) => turf.area(turf.polygon([r])) >= 50_000),
    ];
    return f.geometry.type === "Polygon"
        ? turf.polygon(clean(f.geometry.coordinates))
        : turf.multiPolygon(f.geometry.coordinates.map(clean));
};

/** Polígono de la zona de juego (null = la Comunidad entera). */
export const areaPolygon = async (
    area: GameArea,
): Promise<FeatureCollection<Polygon | MultiPolygon> | null> => {
    if (area.kind === "comunidad") return null;
    if (area.kind === "poligono")
        return area.geojson as FeatureCollection<Polygon | MultiPolygon>;

    const admin = await adminFeatures();
    const parts = admin.filter(
        (f) =>
            (f.properties.admin_level === "8" &&
                area.municipios.includes(f.properties.name)) ||
            (f.properties.admin_level === "9" &&
                area.distritos.includes(f.properties.name)),
    );
    const missing = [...area.municipios, ...area.distritos].filter(
        (n) => !parts.some((p) => p.properties.name === n),
    );
    if (missing.length)
        throw new Error(`Zonas desconocidas: ${missing.join(", ")}`);
    // Los bordes de municipios vecinos no coinciden al milímetro: al unirlos
    // quedan rendijas de pocos metros que el mapa pintaría como excluidas.
    // Se cierran ensanchando cada pieza 25 m, uniéndolas y volviendo a encoger.
    const grown = parts.map(
        (p) => turf.buffer(p, SEAM_M, { units: "meters", steps: 4 })!,
    );
    const merged =
        grown.length > 1 ? turf.union(turf.featureCollection(grown)) : grown[0];
    const union = merged
        ? dropTinyHoles(
              turf.buffer(merged, -SEAM_M, { units: "meters", steps: 4 })!,
          )
        : null;
    if (!union) throw new Error("La zona está vacía");
    return turf.featureCollection([
        { ...union, properties: {} } as Feature<Polygon | MultiPolygon>,
    ]);
};

/**
 * Aplica una configuración: cambia la zona, el tamaño, el radio y las
 * estaciones, y borra las preguntas (es una partida nueva).
 */
export const applyConfig = async (input: GameConfig) => {
    const config = gameConfigSchema.parse(input);
    const poly = await areaPolygon(config.area);

    mapGeoLocation.set(MADRID_MAP_LOCATION);
    additionalMapGeoLocations.set([]);
    polyGeoJSON.set(poly);
    mapGeoJSON.set(poly);

    gameSize.set(config.size);
    hidingRadius.set(
        config.hidingRadiusKm ?? SIZE_INFO[config.size].hidingRadiusKm,
    );
    hidingRadiusUnits.set("kilometers");
    const known = STATION_TYPE_OPTIONS.map((o) => o.value);
    const types = (config.stationTypes ?? []).filter((t) => known.includes(t));
    displayHidingZonesOptions.set(types.length ? types : [ALL_STATIONS]);
    disabledLines.set(config.disabledLines);
    disabledStations.set(config.disabledStations);
    houseRules.set(config.houseRules);

    activeConfig.set({ ...config, areaKey: areaKey(poly) });
    // Al final: vaciar las preguntas hace que el mapa se redibuje con la zona nueva.
    questions.set([]);
};

/** Redondea a 5 decimales (≈ 1 m) para que el enlace sea corto. */
const roundCoords = (fc: FeatureCollection): FeatureCollection =>
    JSON.parse(JSON.stringify(fc), (_k, v) =>
        typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v,
    );

/** La configuración que se está jugando ahora mismo, con otro nombre. */
export const captureConfig = (name: string, description = ""): GameConfig => {
    const active = activeConfig.get();
    const poly = polyGeoJSON.get();
    const isComunidad =
        poly === null &&
        additionalMapGeoLocations.get().length === 0 &&
        mapGeoLocation.get().properties.osm_id ===
            MADRID_MAP_LOCATION.properties.osm_id;

    let area: GameArea;
    if (isComunidad) area = { kind: "comunidad" };
    else if (active && active.areaKey === areaKey(poly)) area = active.area;
    else {
        const shape = poly ?? mapGeoJSON.get();
        if (!shape) throw new Error("No hay zona de juego");
        area = {
            kind: "poligono",
            geojson: roundCoords(
                turf.simplify(shape, { tolerance: 0.0001, highQuality: true }),
            ) as any,
        };
    }

    const size = gameSize.get();
    const radiusKm =
        hidingRadius.get() *
        (hidingRadiusUnits.get() === "meters"
            ? 0.001
            : hidingRadiusUnits.get() === "miles"
              ? 1.609344
              : 1);

    return gameConfigSchema.parse({
        name,
        description,
        size,
        area,
        hidingRadiusKm:
            Math.abs(radiusKm - SIZE_INFO[size].hidingRadiusKm) < 1e-9
                ? undefined
                : Math.round(radiusKm * 1000) / 1000,
        stationTypes: displayHidingZonesOptions.get(),
        disabledLines: disabledLines.get(),
        disabledStations: disabledStations.get(),
        houseRules: houseRules.get(),
    });
};

/**
 * Al abrir la app: si la zona activa es de municipios o distritos y se
 * calculó con una versión anterior (p. ej. con rendijas entre bordes), se
 * recalcula sin tocar las preguntas.
 */
export const refreshActiveArea = async () => {
    const active = activeConfig.get();
    if (!active || active.area.kind !== "zonas") return false;
    const current = polyGeoJSON.get();
    if (active.areaKey !== areaKey(current)) return false; // la han cambiado a mano
    const poly = await areaPolygon(active.area);
    const key = areaKey(poly);
    if (key === active.areaKey) return false;
    polyGeoJSON.set(poly);
    mapGeoJSON.set(poly);
    activeConfig.set({ ...active, areaKey: key });
    questions.set([...questions.get()]); // redibujar el mapa
    return true;
};

/** Marca una configuración como la que se está jugando (sin cambiar nada). */
export const markActive = (config: GameConfig) =>
    activeConfig.set({ ...config, areaKey: areaKey(polyGeoJSON.get()) });

export const saveConfig = (config: GameConfig) => {
    const saved: SavedConfig = {
        ...config,
        id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : String(Date.now()) + Math.random(),
        savedAt: new Date().toISOString(),
    };
    savedConfigs.set([
        ...savedConfigs.get().filter((c) => c.name !== config.name),
        saved,
    ]);
    return saved;
};

export const deleteConfig = (id: string) =>
    savedConfigs.set(savedConfigs.get().filter((c) => c.id !== id));

/** Solo los datos de la configuración (sin id ni fechas). */
const pure = (config: GameConfig): GameConfig => gameConfigSchema.parse(config);

export const CONFIG_HASH = "config";

export const encodeConfig = async (config: GameConfig) =>
    compress(JSON.stringify(pure(config)));

export const decodeConfig = async (text: string): Promise<GameConfig> =>
    gameConfigSchema.parse(JSON.parse(await decompress(text)));

/** Enlace para compartir: la configuración va detrás de «#». */
export const configLink = async (config: GameConfig) => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#${CONFIG_HASH}=${await encodeConfig(config)}`;
};

/** Configuración que viene en el enlace con el que se ha abierto la app. */
export const configFromLocation = async (): Promise<GameConfig | null> => {
    const match = window.location.hash.match(
        new RegExp(`^#${CONFIG_HASH}=([A-Za-z0-9_-]+)$`),
    );
    if (!match) return null;
    return decodeConfig(match[1]);
};

export const configFileName = (config: GameConfig) =>
    `configuracion-${config.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.json`;

export const configToFile = (config: GameConfig) =>
    JSON.stringify(
        { hideSeekMadrid: "configuracion", ...pure(config) },
        null,
        2,
    );

export const configFromFile = (text: string): GameConfig => {
    const raw = JSON.parse(text);
    return gameConfigSchema.parse(raw);
};

/** Resumen de una línea: tamaño, radio y líneas quitadas. */
export const describeConfig = (config: GameConfig) => {
    const size = SIZE_INFO[config.size];
    const radius = config.hidingRadiusKm ?? size.hidingRadiusKm;
    const parts = [
        `Partida ${size.label.toLowerCase()}`,
        `zonas de ${radius < 1 ? `${radius * 1000} m` : `${radius} km`}`,
        `${size.hidingMinutes} min para esconderse`,
    ];
    if (!config.houseRules) parts.push("sin categorías propias");
    if (config.disabledLines.length)
        parts.push(`sin ${config.disabledLines.join(", ")}`);
    return parts.join(" · ");
};
