import { z } from "zod";

import { t } from "@/i18n";
import { defaultUnit } from "@/lib/context";

import { ICON_COLORS } from "./api/constants";
import { MADRID_GROUP } from "./madrid-categories";

export const NO_GROUP = "NO_GROUP";

export const determineUnionizedStrings = (
    obj: z.ZodUnion<any> | z.ZodLiteral<any> | z.ZodDefault<any>,
): z.ZodLiteral<any>[] => {
    if (obj instanceof z.ZodUnion) {
        return obj.options.flatMap((option: any) =>
            determineUnionizedStrings(option),
        );
    } else if (obj instanceof z.ZodLiteral) {
        return [obj];
    } else if (obj instanceof z.ZodDefault) {
        return determineUnionizedStrings(obj._def.innerType);
    }
    return [];
};

const unitsSchema = z.union([
    z.literal("miles"),
    z.literal("kilometers"),
    z.literal("meters"),
]);

const iconColorSchema = z.union([
    z.literal("green"),
    z.literal("black"),
    z.literal("blue"),
    z.literal("gold"),
    z.literal("grey"),
    z.literal("orange"),
    z.literal("red"),
    z.literal("violet"),
]);

type IconColor = z.infer<typeof iconColorSchema>;

const randomColor = () =>
    (Object.keys(ICON_COLORS) as IconColor[])[
        Math.floor(Math.random() * Object.keys(ICON_COLORS).length)
    ];

const randomColorExcluding = (excluded: IconColor[] = []) => {
    const options = (Object.keys(ICON_COLORS) as IconColor[]).filter(
        (color) => !excluded.includes(color),
    );

    return options[Math.floor(Math.random() * options.length)];
};

const thermometerQuestionSchema = z
    .object({
        latA: z
            .number()
            .min(-90, "Latitude must not overlap with the poles")
            .max(90, "Latitude must not overlap with the poles"),
        lngA: z
            .number()
            .min(-180, "Longitude must not overlap with the antemeridian")
            .max(180, "Longitude must not overlap with the antemeridian"),
        latB: z
            .number()
            .min(-90, "Latitude must not overlap with the poles")
            .max(90, "Latitude must not overlap with the poles"),
        lngB: z
            .number()
            .min(-180, "Longitude must not overlap with the antemeridian")
            .max(180, "Longitude must not overlap with the antemeridian"),
        warmer: z.boolean().default(true),
        colorA: iconColorSchema.default(() => randomColorExcluding(["green"])),
        colorB: iconColorSchema.default(() => randomColorExcluding(["green"])),
        /** Note that drag is now synonymous with unlocked */
        drag: z.boolean().default(true),
        collapsed: z.boolean().default(false),
        hidden: z.boolean().default(false),
        /** Vetada por el escondido: cuenta como hecha pero no cambia el mapa. */
        vetoed: z.boolean().default(false),
        /** Distancia de la pregunta («después de viajar X km»), en km. */
        distance: z.number().positive().optional(),
    })
    .transform((question) => {
        if (question.colorA === question.colorB) {
            question.colorB = "green";
        }

        return question;
    });

const ordinaryBaseQuestionSchema = z.object({
    lat: z
        .number()
        .min(-90, "Latitude must not overlap with the poles")
        .max(90, "Latitude must not overlap with the poles"),
    lng: z
        .number()
        .min(-180, "Longitude must not overlap with the antemeridian")
        .max(180, "Longitude must not overlap with the antemeridian"),
    /** Note that drag is now synonymous with unlocked */
    drag: z.boolean().default(true),
    color: iconColorSchema.default(randomColor),
    collapsed: z.boolean().default(false),
    hidden: z.boolean().default(false),
    /** Vetada por el escondido: cuenta como hecha pero no cambia el mapa. */
    vetoed: z.boolean().default(false),
});

const getDefaultUnit = () => {
    try {
        return defaultUnit.get();
    } catch {
        return "miles";
    }
};

const radiusQuestionSchema = ordinaryBaseQuestionSchema.extend({
    radius: z.number().min(0, "You cannot have a negative radius").default(50),
    unit: unitsSchema.default(getDefaultUnit),
    within: z.boolean().default(true),
    /** Radar «a elegir»: los buscadores eligen la distancia. */
    chosen: z.boolean().default(false),
});

const tentacleLocationsFifteen = z.union([
    z.literal("theme_park").describe(t("Parques de atracciones")),
    z.literal("zoo").describe(t("Zoos")),
    z.literal("aquarium").describe(t("Acuarios")),
]);

const tentacleLocationsOne = z.union([
    z.literal("museum").describe(t("Museos")),
    z.literal("hospital").describe(t("Hospitales")),
    z.literal("cinema").describe(t("Cines")),
    z.literal("library").describe(t("Bibliotecas")),
]);

/** Categorías propias de Madrid con tentáculos (radio por defecto en MADRID_TENTACLE_KM). */
const tentacleLocationsMadrid = z.union([
    z.literal("madrid-mercadona").describe(t("Mercadona")),
    z.literal("madrid-mcdonalds").describe(t("McDonald's")),
]);

const apiLocationSchema = z.union([
    z.literal("golf_course"),
    z.literal("consulate"),
    z.literal("park"),
    z.literal("peak"),
    tentacleLocationsFifteen,
    tentacleLocationsOne,
]);

const baseTentacleQuestionSchema = ordinaryBaseQuestionSchema.extend({
    radius: z.number().min(0, "You cannot have a negative radius").default(15),
    unit: unitsSchema.default(getDefaultUnit),
    location: z
        .union([
            z.object({
                type: z.literal("Feature"),
                geometry: z.object({
                    type: z.literal("Point"),
                    coordinates: z.array(z.number()),
                }),
                id: z.union([z.string(), z.number(), z.undefined()]).optional(),
                properties: z.object({
                    name: z.any(),
                }),
            }),
            z.literal(false),
        ])
        .default(false),
});
const tentacleQuestionSpecificSchemaFifteen = baseTentacleQuestionSchema.extend(
    {
        locationType: tentacleLocationsFifteen.default("theme_park"),
        places: z.array(z.any()).optional(),
    },
);

const tentacleQuestionSpecificSchemaOne = baseTentacleQuestionSchema.extend({
    locationType: tentacleLocationsOne,
    places: z.array(z.any()).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const encompassingTentacleQuestionSchema = baseTentacleQuestionSchema.extend({
    locationType: z.union([apiLocationSchema, tentacleLocationsMadrid]),
    places: z.array(z.any()).optional(),
});

const customTentacleQuestionSchema = baseTentacleQuestionSchema.extend({
    locationType: z.literal("custom").describe(t("Lugares personalizados")),
    places: z.array(
        z.object({
            type: z.literal("Feature"),
            geometry: z.object({
                type: z.literal("Point"),
                coordinates: z.array(z.number()),
            }),
            id: z.union([z.string(), z.number(), z.undefined()]).optional(),
            properties: z.object({
                name: z.any(),
            }),
        }),
    ),
});

const tentacleQuestionSpecificSchemaMadrid = baseTentacleQuestionSchema.extend({
    locationType: tentacleLocationsMadrid,
    places: z.array(z.any()).optional(),
});

export const tentacleQuestionSchema = z.union([
    customTentacleQuestionSchema.describe(NO_GROUP),
    tentacleQuestionSpecificSchemaFifteen.describe(
        t("Originales de 15 millas"),
    ),
    tentacleQuestionSpecificSchemaOne.describe(t("Originales de 1 milla")),
    tentacleQuestionSpecificSchemaMadrid.describe(t("Madrid (2 km)")),
]);

const baseMatchingQuestionSchema = ordinaryBaseQuestionSchema.extend({
    same: z.boolean().default(true),
    lengthComparison: z.enum(["shorter", "longer", "same"]).optional(),
});

const ordinaryMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z
        .union([
            z.literal("airport").describe(t("Aeropuerto comercial")),
            z
                .literal("major-city")
                .describe(t("Gran ciudad (más de 1 000 000 hab.)")),
            z
                .literal("aquarium-full")
                .describe(t("Acuario (partidas pequeña y mediana)")),
            z
                .literal("zoo-full")
                .describe(t("Zoo (partidas pequeña y mediana)")),
            z
                .literal("theme_park-full")
                .describe(
                    t("Parque de atracciones (partidas pequeña y mediana)"),
                ),
            z
                .literal("peak-full")
                .describe(t("Montaña (partidas pequeña y mediana)")),
            z
                .literal("museum-full")
                .describe(t("Museo (partidas pequeña y mediana)")),
            z
                .literal("hospital-full")
                .describe(t("Hospital (partidas pequeña y mediana)")),
            z
                .literal("cinema-full")
                .describe(t("Cine (partidas pequeña y mediana)")),
            z
                .literal("library-full")
                .describe(t("Biblioteca (partidas pequeña y mediana)")),
            z
                .literal("golf_course-full")
                .describe(t("Campo de golf (partidas pequeña y mediana)")),
            z
                .literal("consulate-full")
                .describe(
                    t("Consulado o embajada (partidas pequeña y mediana)"),
                ),
            z
                .literal("park-full")
                .describe(t("Parque (partidas pequeña y mediana)")),
        ])
        .default("airport"),
});

const zoneMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("zone").describe(t("Zona administrativa")),
        z
            .literal("letter-zone")
            .describe(t("Zona que empieza por la misma letra")),
    ]),
    cat: z
        .object({
            adminLevel: z.union([
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(7),
                z.literal(8),
                z.literal(9),
                z.literal(10),
            ]),
        })
        .default(() => ({ adminLevel: 8 }) as { adminLevel: 8 }),
});

const homeGameMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("aquarium").describe(t("Acuario")),
        z.literal("zoo").describe(t("Zoo")),
        z.literal("theme_park").describe(t("Parque de atracciones")),
        z.literal("peak").describe(t("Montaña")),
        z.literal("museum").describe(t("Museo")),
        z.literal("hospital").describe(t("Hospital")),
        z.literal("cinema").describe(t("Cine")),
        z.literal("library").describe(t("Biblioteca")),
        z.literal("golf_course").describe(t("Campo de golf")),
        z.literal("consulate").describe(t("Consulado o embajada")),
        z.literal("park").describe(t("Parque")),
    ]),
});

const hidingZoneMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z
            .literal("same-first-letter-station")
            .describe(t("Estación que empieza por la misma letra")),
        z
            .literal("same-length-station")
            .describe(t("Estación con nombre de la misma longitud")),
    ]),
});

/**
 * «¿Tu estación está en la misma línea que el tren en el que vamos?».
 * Funciona como una pregunta normal: no necesita activar las zonas de escondite.
 */
const trainLineMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z.literal("same-train-line").describe(t("Misma línea de tren")),
    /** Línea del tren en el que van los buscadores (vacío: todas las de la estación). */
    trainLine: z.string().optional(),
});

const customMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("custom-zone").describe(t("Zona personalizada")),
        z.literal("custom-points").describe(t("Puntos personalizados")),
    ]),
    geo: z.any(),
});

/** Categorías propias de Madrid (ver madrid-categories.ts). */
const madridMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("madrid-mercadona").describe(t("Mercadona")),
        z.literal("madrid-mcdonalds").describe(t("McDonald's")),
        z.literal("madrid-corteingles").describe(t("El Corte Inglés")),
        z.literal("madrid-ikea").describe(t("IKEA")),
        z.literal("madrid-stadiums").describe(t("Estadios y arenas")),
        z.literal("madrid-bullrings").describe(t("Plazas de toros")),
        z.literal("madrid-malls").describe(t("Centros comerciales")),
        z.literal("madrid-univ").describe(t("Universidades")),
        z.literal("madrid-markets").describe(t("Mercados municipales")),
        z.literal("madrid-cemeteries").describe(t("Cementerios")),
        z.literal("madrid-castles").describe(t("Palacios y castillos")),
    ]),
});

export const matchingQuestionSchema = z.union([
    zoneMatchingQuestionsSchema.describe(NO_GROUP),
    ordinaryMatchingQuestionSchema.describe(NO_GROUP),
    customMatchingQuestionSchema.describe(NO_GROUP),
    trainLineMatchingQuestionSchema.describe(NO_GROUP),
    madridMatchingQuestionSchema.describe(MADRID_GROUP),
    hidingZoneMatchingQuestionsSchema.describe(t("Modo zonas de escondite")),
    homeGameMatchingQuestionsSchema.describe(t("Modo zonas de escondite")),
]);

const baseMeasuringQuestionSchema = ordinaryBaseQuestionSchema.extend({
    hiderCloser: z.boolean().default(true),
});

const ordinaryMeasuringQuestionSchema = baseMeasuringQuestionSchema.extend({
    type: z
        .union([
            z.literal("coastline").describe(t("Costa")),
            z.literal("airport").describe(t("Aeropuerto comercial")),
            z
                .literal("city")
                .describe(t("Gran ciudad (más de 1 000 000 hab.)")),
            z
                .literal("highspeed-measure-shinkansen")
                .describe(t("Línea de alta velocidad")),
            z.literal("admin-measure").describe(t("Frontera administrativa")),
            z
                .literal("aquarium-full")
                .describe(t("Acuario (partidas pequeña y mediana)")),
            z
                .literal("zoo-full")
                .describe(t("Zoo (partidas pequeña y mediana)")),
            z
                .literal("theme_park-full")
                .describe(
                    t("Parque de atracciones (partidas pequeña y mediana)"),
                ),
            z
                .literal("peak-full")
                .describe(t("Montaña (partidas pequeña y mediana)")),
            z
                .literal("museum-full")
                .describe(t("Museo (partidas pequeña y mediana)")),
            z
                .literal("hospital-full")
                .describe(t("Hospital (partidas pequeña y mediana)")),
            z
                .literal("cinema-full")
                .describe(t("Cine (partidas pequeña y mediana)")),
            z
                .literal("library-full")
                .describe(t("Biblioteca (partidas pequeña y mediana)")),
            z
                .literal("golf_course-full")
                .describe(t("Campo de golf (partidas pequeña y mediana)")),
            z
                .literal("consulate-full")
                .describe(
                    t("Consulado o embajada (partidas pequeña y mediana)"),
                ),
            z
                .literal("park-full")
                .describe(t("Parque (partidas pequeña y mediana)")),
        ])
        .default("coastline"),
    cat: z
        .object({
            adminLevel: z.union([
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(7),
                z.literal(8),
                z.literal(9),
                z.literal(10),
            ]),
            zoneName: z.string().optional(),
        })
        .optional(),
});

const hidingZoneMeasuringQuestionsSchema = baseMeasuringQuestionSchema.extend({
    type: z.union([
        z.literal("mcdonalds").describe(t("McDonald's")),
        z.literal("seven11").describe(t("7-Eleven")),
        z.literal("rail-measure").describe(t("Estación de tren")),
    ]),
});

const homeGameMeasuringQuestionsSchema = baseMeasuringQuestionSchema.extend({
    type: z.union([
        z.literal("aquarium").describe(t("Acuario")),
        z.literal("zoo").describe(t("Zoo")),
        z.literal("theme_park").describe(t("Parque de atracciones")),
        z.literal("peak").describe(t("Montaña")),
        z.literal("museum").describe(t("Museo")),
        z.literal("hospital").describe(t("Hospital")),
        z.literal("cinema").describe(t("Cine")),
        z.literal("library").describe(t("Biblioteca")),
        z.literal("golf_course").describe(t("Campo de golf")),
        z.literal("consulate").describe(t("Consulado o embajada")),
        z.literal("park").describe(t("Parque")),
    ]),
});

const customMeasuringQuestionSchema = baseMeasuringQuestionSchema.extend({
    type: z.literal("custom-measure").describe(t("Medición personalizada")),
    geo: z.any(),
});

const madridMeasuringQuestionSchema = baseMeasuringQuestionSchema.extend({
    type: z.union([
        z.literal("madrid-mercadona").describe(t("Mercadona")),
        z.literal("madrid-mcdonalds").describe(t("McDonald's")),
        z.literal("madrid-corteingles").describe(t("El Corte Inglés")),
        z.literal("madrid-ikea").describe(t("IKEA")),
        z.literal("madrid-stadiums").describe(t("Estadios y arenas")),
        z.literal("madrid-bullrings").describe(t("Plazas de toros")),
        z.literal("madrid-malls").describe(t("Centros comerciales")),
        z.literal("madrid-univ").describe(t("Universidades")),
        z.literal("madrid-markets").describe(t("Mercados municipales")),
        z.literal("madrid-cemeteries").describe(t("Cementerios")),
        z.literal("madrid-castles").describe(t("Palacios y castillos")),
        z.literal("madrid-rivers").describe(t("Ríos")),
        z
            .literal("madrid-stations")
            .describe(t("Estaciones (Metro, ML y Cercanías)")),
        z.literal("madrid-water").describe(t("Masas de agua")),
    ]),
});

export const measuringQuestionSchema = z.union([
    ordinaryMeasuringQuestionSchema.describe(NO_GROUP),
    customMeasuringQuestionSchema.describe(NO_GROUP),
    madridMeasuringQuestionSchema.describe(MADRID_GROUP),
    hidingZoneMeasuringQuestionsSchema.describe(t("Modo zonas de escondite")),
    homeGameMeasuringQuestionsSchema.describe(t("Modo zonas de escondite")),
]);

/**
 * Pregunta que la app no dibuja (fotos, «calle o camino», costa…): solo se
 * registra para llevar la cuenta del coste, el veto y el randomize.
 */
export const questionCategorySchema = z.enum([
    "matching",
    "measuring",
    "radius",
    "thermometer",
    "tentacles",
    "photo",
]);

const manualQuestionSchema = z.object({
    category: questionCategorySchema,
    /** Identificador en el catálogo (src/maps/catalog.ts). */
    catalogId: z.string(),
    /** Respuesta apuntada a mano. */
    answer: z.string().default(""),
    /** Dónde se hizo (si se conoce). */
    lat: z.number().optional(),
    lng: z.number().optional(),
    drag: z.boolean().default(true),
    collapsed: z.boolean().default(false),
    hidden: z.boolean().default(false),
    vetoed: z.boolean().default(false),
});

export const questionSchema = z.union([
    z.object({
        id: z.literal("radius"),
        key: z.number().default(Math.random),
        data: radiusQuestionSchema,
    }),
    z.object({
        id: z.literal("thermometer"),
        key: z.number().default(Math.random),
        data: thermometerQuestionSchema,
    }),
    z.object({
        id: z.literal("tentacles"),
        key: z.number().default(Math.random),
        data: tentacleQuestionSchema,
    }),
    z.object({
        id: z.literal("measuring"),
        key: z.number().default(Math.random),
        data: measuringQuestionSchema,
    }),
    z.object({
        id: z.literal("matching"),
        key: z.number().default(Math.random),
        data: matchingQuestionSchema,
    }),
    z.object({
        id: z.literal("manual"),
        key: z.number().default(Math.random),
        data: manualQuestionSchema,
    }),
]);

export const questionsSchema = z.array(questionSchema);

export type Units = z.infer<typeof unitsSchema>;
export type QuestionCategory = z.infer<typeof questionCategorySchema>;
export type ManualQuestion = z.infer<typeof manualQuestionSchema>;
export type RadiusQuestion = z.infer<typeof radiusQuestionSchema>;
export type ThermometerQuestion = z.infer<typeof thermometerQuestionSchema>;
export type TentacleQuestion = z.infer<typeof tentacleQuestionSchema>;
export type APILocations = z.infer<typeof apiLocationSchema>;
export type MatchingQuestion = z.infer<typeof matchingQuestionSchema>;
export type HomeGameMatchingQuestions = z.infer<
    typeof homeGameMatchingQuestionsSchema
>;
export type ZoneMatchingQuestions = z.infer<typeof zoneMatchingQuestionsSchema>;
export type CustomMatchingQuestion = z.infer<
    typeof customMatchingQuestionSchema
>;
export type CustomMeasuringQuestion = z.infer<
    typeof customMeasuringQuestionSchema
>;
export type MeasuringQuestion = z.infer<typeof measuringQuestionSchema>;
export type HomeGameMeasuringQuestions = z.infer<
    typeof homeGameMeasuringQuestionsSchema
>;
export type Question = z.infer<typeof questionSchema>;
export type Questions = z.infer<typeof questionsSchema>;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type TraditionalTentacleQuestion =
    | z.infer<typeof tentacleQuestionSpecificSchemaFifteen>
    | z.infer<typeof tentacleQuestionSpecificSchemaOne>
    | z.infer<typeof tentacleQuestionSpecificSchemaMadrid>;
export type EncompassingTentacleQuestionSchema = z.infer<
    typeof encompassingTentacleQuestionSchema
>;
export type CustomTentacleQuestion = z.infer<
    typeof customTentacleQuestionSchema
>;
