/**
 * Catálogo de preguntas del reglamento de Hide+Seek (por tamaño de partida)
 * más las reglas de casa de Madrid. Sirve para:
 *  - saber cuántas veces se ha hecho ya una pregunta (el coste se multiplica),
 *  - sortear otra pregunta no hecha de la misma categoría (randomize).
 */
import type { Question, QuestionCategory } from "@/maps/schema";

export type GameSize = "small" | "medium" | "large";

const MEDIUM_UP: GameSize[] = ["medium", "large"];
const LARGE: GameSize[] = ["large"];

export interface CategoryInfo {
    label: string;
    /** Cartas que roba y se queda el escondido al responder. */
    draw: number;
    keep: number;
}

export const CATEGORY_INFO: Record<QuestionCategory, CategoryInfo> = {
    matching: { label: "Coincidencia", draw: 3, keep: 1 },
    measuring: { label: "Medición", draw: 3, keep: 1 },
    radius: { label: "Radar", draw: 2, keep: 1 },
    thermometer: { label: "Termómetro", draw: 2, keep: 1 },
    tentacles: { label: "Tentáculos", draw: 4, keep: 2 },
    photo: { label: "Foto", draw: 1, keep: 1 },
};

export interface CatalogEntry {
    id: string;
    category: QuestionCategory;
    label: string;
    /** Cómo se dibuja en la app; sin esto, la pregunta se registra sin mapa. */
    make?: { id: Exclude<Question["id"], "manual">; data: Record<string, any> };
    /** Aclaración para los jugadores (p. ej. respuesta nula en Madrid). */
    note?: string;
    /** Tamaños de partida en los que existe (por defecto, todos). */
    sizes?: GameSize[];
}

const match = (
    id: string,
    label: string,
    data?: Record<string, any>,
    note?: string,
): CatalogEntry => ({
    id: `matching:${id}`,
    category: "matching",
    label,
    make: data ? { id: "matching", data } : undefined,
    note,
});
const measure = (
    id: string,
    label: string,
    data?: Record<string, any>,
    note?: string,
): CatalogEntry => ({
    id: `measuring:${id}`,
    category: "measuring",
    label,
    make: data ? { id: "measuring", data } : undefined,
    note,
});

/** Lugares del reglamento que valen para Matching y Measuring. */
const PLACES: [string, string][] = [
    ["peak", "Montaña"],
    ["park", "Parque"],
    ["theme_park", "Parque de atracciones"],
    ["zoo", "Zoo"],
    ["aquarium", "Acuario"],
    ["golf_course", "Campo de golf"],
    ["museum", "Museo"],
    ["cinema", "Cine"],
    ["hospital", "Hospital"],
    ["library", "Biblioteca"],
    ["consulate", "Consulado extranjero (y embajadas)"],
];

/** Categorías propias (reglas de casa), en Matching y Measuring. */
const MADRID: [string, string][] = [
    ["mercadona", "Mercadona"],
    ["mcdonalds", "McDonald's"],
    ["corteingles", "El Corte Inglés"],
    ["ikea", "IKEA"],
    ["stadiums", "Estadio o arena"],
    ["bullrings", "Plaza de toros"],
    ["malls", "Centro comercial"],
    ["univ", "Universidad"],
    ["markets", "Mercado municipal"],
    ["cemeteries", "Cementerio"],
    ["castles", "Palacio o castillo"],
];

const NO_BORDER = "En el mapa no hay ninguna: la respuesta es nula.";

export const CATALOG: CatalogEntry[] = [
    // --- Matching (robar 3, quedarse 1) ---
    match("airport", "Aeropuerto comercial", { type: "airport" }),
    match("same-train-line", "Línea de transporte", {
        type: "same-train-line",
    }),
    match("same-length-station", "Longitud del nombre de la estación", {
        type: "same-length-station",
    }),
    match("street", "Calle o camino"),
    match(
        "zone:4",
        "1.ª división administrativa (comunidad)",
        { type: "zone", cat: { adminLevel: 4 } },
        "En la Comunidad de Madrid la respuesta siempre es sí.",
    ),
    match(
        "zone:6",
        "2.ª división administrativa (provincia)",
        { type: "zone", cat: { adminLevel: 6 } },
        "En la Comunidad de Madrid la respuesta siempre es sí.",
    ),
    match("zone:8", "3.ª división administrativa (municipio)", {
        type: "zone",
        cat: { adminLevel: 8 },
    }),
    match("zone:9", "4.ª división administrativa (distrito)", {
        type: "zone",
        cat: { adminLevel: 9 },
    }),
    match(
        "landmass",
        "Masa de tierra",
        undefined,
        "En la Comunidad de Madrid la respuesta siempre es sí.",
    ),
    ...PLACES.map(([k, l]) => match(k, l, { type: `${k}-full` })),
    ...MADRID.map(([k, l]) => match(`madrid-${k}`, l, { type: `madrid-${k}` })),

    // --- Measuring (robar 3, quedarse 1) ---
    measure("airport", "Aeropuerto comercial", { type: "airport" }),
    measure("highspeed", "Línea de alta velocidad", {
        type: "highspeed-measure-shinkansen",
    }),
    measure("madrid-stations", "Estación de tren (Metro, ML o Cercanías)", {
        type: "madrid-stations",
    }),
    measure("border", "Frontera internacional", undefined, NO_BORDER),
    measure("admin:4", "Borde de la 1.ª división (comunidad)", {
        type: "admin-measure",
        cat: { adminLevel: 4 },
    }),
    measure("admin:6", "Borde de la 2.ª división (provincia)", {
        type: "admin-measure",
        cat: { adminLevel: 6 },
    }),
    measure("altitude", "Nivel del mar (altitud)", { type: "altitude" }),
    measure("madrid-water", "Masa de agua", { type: "madrid-water" }),
    measure("coastline", "Costa", undefined, NO_BORDER),
    ...PLACES.map(([k, l]) => measure(k, l, { type: `${k}-full` })),
    ...MADRID.map(([k, l]) =>
        measure(`madrid-${k}`, l, { type: `madrid-${k}` }),
    ),
    measure("madrid-rivers", "Río", { type: "madrid-rivers" }),

    // --- Radar (robar 2, quedarse 1) ---
    ...[0.5, 1, 2, 5, 10, 15, 40, 80, 160].map(
        (km): CatalogEntry => ({
            id: `radius:${km}`,
            category: "radius",
            label: km < 1 ? `${km * 1000} m` : `${km} km`,
            make: {
                id: "radius",
                data: { radius: km, unit: "kilometers", chosen: false },
            },
        }),
    ),
    {
        id: "radius:elegir",
        category: "radius",
        label: "A elegir (cualquier distancia)",
        make: { id: "radius", data: { chosen: true } },
    },

    // --- Termómetro (robar 2, quedarse 1) ---
    ...(
        [
            [1, undefined],
            [5, undefined],
            [15, MEDIUM_UP],
            [75, LARGE],
        ] as const
    ).map(
        ([km, sizes]): CatalogEntry => ({
            id: `thermometer:${km}`,
            category: "thermometer",
            label: `${km} km`,
            make: { id: "thermometer", data: { distance: km } },
            sizes: sizes ? [...sizes] : undefined,
        }),
    ),

    // --- Tentáculos (robar 4, quedarse 2); no hay en partida pequeña ---
    ...(
        [
            ["museum", "Museos a 2 km", 2],
            ["library", "Bibliotecas a 2 km", 2],
            ["cinema", "Cines a 2 km", 2],
            ["hospital", "Hospitales a 2 km", 2],
            ["madrid-mercadona", "Mercadona a 2 km", 2],
            ["madrid-mcdonalds", "McDonald's a 2 km", 2],
            ["zoo", "Zoos a 25 km", 25],
            ["aquarium", "Acuarios a 25 km", 25],
            ["theme_park", "Parques de atracciones a 25 km", 25],
        ] as const
    ).map(
        ([k, l, km]): CatalogEntry => ({
            id: `tentacles:${k}`,
            category: "tentacles",
            label: l,
            make: {
                id: "tentacles",
                data: {
                    locationType: k,
                    radius: km,
                    unit: "kilometers",
                    location: false,
                },
            },
            sizes: km === 25 ? LARGE : MEDIUM_UP,
        }),
    ),
    {
        id: "tentacles:metro-lines",
        category: "tentacles",
        label: "Líneas de metro a 25 km",
        sizes: LARGE,
    },

    // --- Fotos (robar 1, quedarse 1): la app no las dibuja ---
    ...(
        [
            ["Cualquier edificio visible desde la estación"],
            ["Estructura más alta en tu línea de visión"],
            ["Calle más ancha"],
            ["Árbol"],
            ["Tú (selfie)"],
            ["El cielo"],
            ["Edificio más alto visible desde la estación", MEDIUM_UP],
            ["Trazar la calle o camino más cercano", MEDIUM_UP],
            ["2 edificios", MEDIUM_UP],
            ["Interior de un restaurante", MEDIUM_UP],
            ["Parque", MEDIUM_UP],
            ["Pasillo de supermercado", MEDIUM_UP],
            ["Lugar de culto", MEDIUM_UP],
            ["Andén", MEDIUM_UP],
            ["1 km de calles trazadas", LARGE],
            ["Montaña más alta visible desde la estación", LARGE],
            ["Masa de agua más grande de tu zona", LARGE],
            ["5 edificios", LARGE],
        ] as [string, GameSize[]?][]
    ).map(
        ([label, sizes], i): CatalogEntry => ({
            id: `photo:${i + 1}`,
            category: "photo",
            label,
            sizes,
        }),
    ),
];

export const catalogEntry = (id: string | null) =>
    id ? CATALOG.find((e) => e.id === id) : undefined;

const KM_PER: Record<string, number> = {
    kilometers: 1,
    meters: 0.001,
    miles: 1.609344,
};

/** Distancia entre dos puntos en km (fórmula del haversine). */
const haversineKm = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
) => {
    const r = Math.PI / 180;
    const a =
        Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
        Math.cos(lat1 * r) *
            Math.cos(lat2 * r) *
            Math.sin(((lng2 - lng1) * r) / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
};

export const categoryOf = (question: Question): QuestionCategory =>
    question.id === "manual" ? question.data.category : question.id;

/**
 * Qué pregunta del catálogo es (p. ej. «radius:5», «matching:zoo»). Las
 * variantes del modo zonas de escondite cuentan como la misma pregunta.
 */
export const catalogIdOf = (question: Question): string => {
    const d: any = question.data;
    switch (question.id) {
        case "manual":
            return d.catalogId;
        case "radius": {
            if (d.chosen) return "radius:elegir";
            const km = d.radius * (KM_PER[d.unit] ?? 1);
            const hit = [0.5, 1, 2, 5, 10, 15, 40, 80, 160].find(
                (x) => Math.abs(x - km) < 1e-6,
            );
            return hit ? `radius:${hit}` : "radius:elegir";
        }
        case "thermometer": {
            if (d.distance) return `thermometer:${d.distance}`;
            // Sin distancia elegida: la mayor de 1, 5 o 15 km que se ha recorrido.
            const km = haversineKm(d.latA, d.lngA, d.latB, d.lngB);
            const hit = [15, 5, 1].find((x) => km >= x);
            return `thermometer:${hit ?? "?"}`;
        }
        case "tentacles":
            return `tentacles:${d.locationType}`;
        case "matching": {
            if (d.type === "zone" || d.type === "letter-zone")
                return `matching:${d.type}:${d.cat?.adminLevel}`;
            return `matching:${String(d.type).replace(/-full$/, "")}`;
        }
        case "measuring": {
            if (d.type === "admin-measure")
                return `measuring:admin:${d.cat?.adminLevel ?? 4}`;
            if (d.type === "highspeed-measure-shinkansen")
                return "measuring:highspeed";
            if (d.type === "rail-measure") return "measuring:madrid-stations";
            if (d.type === "mcdonalds") return "measuring:madrid-mcdonalds";
            return `measuring:${String(d.type).replace(/-full$/, "")}`;
        }
    }
};

export const questionLabel = (question: Question): string => {
    const id = catalogIdOf(question);
    const entry = catalogEntry(id);
    return entry ? entry.label : id;
};

/**
 * Coste de la pregunta: cuántas veces se ha hecho ya (contando las vetadas)
 * antes de ella en la lista. La 1.ª vez ×1, la 2.ª ×2, etc.
 */
export const costMultiplier = (questions: Question[], key: number): number => {
    const index = questions.findIndex((q) => q.key === key);
    if (index < 0) return 1;
    const id = catalogIdOf(questions[index]);
    return (
        questions.slice(0, index).filter((q) => catalogIdOf(q) === id).length +
        1
    );
};

export const availableIn = (entry: CatalogEntry, size: GameSize) =>
    !entry.sizes || entry.sizes.includes(size);

/** Preguntas de la misma categoría que aún no se han hecho en este tamaño de partida. */
export const unaskedEntries = (
    questions: Question[],
    category: QuestionCategory,
    size: GameSize = "medium",
): CatalogEntry[] => {
    const asked = new Set(questions.map(catalogIdOf));
    return CATALOG.filter(
        (e) =>
            e.category === category && availableIn(e, size) && !asked.has(e.id),
    );
};

/**
 * Randomize: devuelve la pregunta sorteada que sustituye a la original (en
 * el mismo sitio y con la misma clave), o null si no queda ninguna.
 */
export const randomizeQuestion = (
    questions: Question[],
    key: number,
    random: () => number = Math.random,
    size: GameSize = "medium",
): { question: Record<string, any>; entry: CatalogEntry } | null => {
    const original = questions.find((q) => q.key === key);
    if (!original) return null;
    const options = unaskedEntries(questions, categoryOf(original), size);
    if (options.length === 0) return null;
    const entry = options[Math.floor(random() * options.length)];
    const d: any = original.data;
    const common = {
        drag: true,
        collapsed: false,
        hidden: false,
        vetoed: false,
    };

    if (!entry.make)
        return {
            entry,
            question: {
                id: "manual",
                key,
                data: {
                    ...common,
                    category: entry.category,
                    catalogId: entry.id,
                    lat: d.lat ?? d.latB,
                    lng: d.lng ?? d.lngB,
                },
            },
        };

    // Mantener dónde se hizo la pregunta.
    const where =
        original.id === "thermometer"
            ? { latA: d.latA, lngA: d.lngA, latB: d.latB, lngB: d.lngB }
            : original.id === "manual"
              ? { lat: d.lat ?? 40.41692, lng: d.lng ?? -3.70348 }
              : { lat: d.lat, lng: d.lng, color: d.color };
    const keep =
        entry.make.id === "radius" && original.id === "radius"
            ? { radius: d.radius, unit: d.unit }
            : {};

    return {
        entry,
        question: {
            id: entry.make.id,
            key,
            data: { ...keep, ...where, ...common, ...entry.make.data },
        },
    };
};
