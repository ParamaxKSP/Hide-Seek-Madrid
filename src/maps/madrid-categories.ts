/**
 * Categorías propias de Madrid (reglas de casa). Cada una dice con qué
 * filtro se encuentran sus sitios en los datos de la app y en qué preguntas
 * se usa. Los tipos de pregunta se llaman «madrid-<id>».
 */
export interface MadridCategory {
    /** Nombre para la interfaz. */
    label: string;
    /** Filtro con sintaxis de Overpass sobre los datos de Madrid. */
    filter: string;
    /** Puntos (sitios) o líneas (ríos). */
    geometry: "point" | "line";
}

export const MADRID_CATEGORIES = {
    mercadona: {
        label: "Mercadona",
        filter: '["jlm:cat"="mercadona"]',
        geometry: "point",
    },
    mcdonalds: {
        label: "McDonald's",
        filter: '["brand:wikidata"="Q38076"]',
        geometry: "point",
    },
    corteingles: {
        label: "El Corte Inglés",
        filter: '["jlm:cat"="corteingles"]',
        geometry: "point",
    },
    ikea: { label: "IKEA", filter: '["jlm:cat"="ikea"]', geometry: "point" },
    stadiums: {
        label: "Estadios y arenas",
        filter: '["jlm:cat"="stadiums"]',
        geometry: "point",
    },
    bullrings: {
        label: "Plazas de toros",
        filter: '["jlm:cat"="bullrings"]',
        geometry: "point",
    },
    malls: {
        label: "Centros comerciales",
        filter: '["jlm:cat"="malls"]',
        geometry: "point",
    },
    univ: {
        label: "Universidades",
        filter: '["jlm:cat"="univ"]',
        geometry: "point",
    },
    markets: {
        label: "Mercados municipales",
        filter: '["jlm:cat"="markets"]',
        geometry: "point",
    },
    cemeteries: {
        label: "Cementerios",
        filter: '["jlm:cat"="cemeteries"]',
        geometry: "point",
    },
    castles: {
        label: "Palacios y castillos",
        filter: '["jlm:cat"="castles"]',
        geometry: "point",
    },
    rivers: {
        label: "Ríos",
        filter: '["jlm:cat"="rivers"]',
        geometry: "line",
    },
    stations: {
        label: "Estaciones",
        filter: "[railway=station]",
        geometry: "point",
    },
    water: {
        label: "Masas de agua",
        filter: "[natural=water]",
        geometry: "point",
    },
} as const satisfies Record<string, MadridCategory>;

export type MadridCategoryId = keyof typeof MADRID_CATEGORIES;

/** Grupo del desplegable de tipos de pregunta; no depende de las zonas de escondite. */
export const MADRID_GROUP = "Madrid";

/** Radio por defecto de los tentáculos de cada categoría (km). */
export const MADRID_TENTACLE_KM: Partial<Record<MadridCategoryId, number>> = {
    mercadona: 2,
    mcdonalds: 2,
};

/** «madrid-mercadona» → «mercadona»; null si no es una categoría de Madrid. */
export const madridCategoryOf = (type: unknown): MadridCategoryId | null => {
    if (typeof type !== "string" || !type.startsWith("madrid-")) return null;
    const id = type.slice("madrid-".length);
    return id in MADRID_CATEGORIES ? (id as MadridCategoryId) : null;
};

/** Divisiones administrativas en la Comunidad de Madrid (niveles de OSM). */
export const ADMIN_LEVEL_OPTIONS = {
    4: "1.ª división: comunidad",
    6: "2.ª división: provincia",
    8: "3.ª división: municipio",
    9: "4.ª división: distrito",
};
