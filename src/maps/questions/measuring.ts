import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Position } from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";
import { toast } from "react-toastify";

import { t } from "@/i18n";
import {
    hiderMode,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    trainStations,
} from "@/lib/context";
import {
    altitudeAt,
    fetchCoastline,
    findAdminBoundary,
    findPlacesInZone,
    findPlacesSpecificInZone,
    LOCATION_FIRST_TAG,
    madridCategoryLines,
    madridCategoryPoints,
    nearestToQuestion,
    prettifyLocation,
    QuestionSpecificLocation,
    regionAbove,
} from "@/maps/api";
import {
    arcBufferToPoint,
    arcDistance,
    connectToSeparateLines,
    groupObjects,
    holedMask,
    modifyMapData,
} from "@/maps/geo-utils";
import { MADRID_CATEGORIES, madridCategoryOf } from "@/maps/madrid-categories";
import type {
    APILocations,
    HomeGameMeasuringQuestions,
    MeasuringQuestion,
} from "@/maps/schema";

export interface AdminZoneInfo {
    name: string;
    boundary: any;
}

export const findAdminZoneInfo = _.memoize(
    async (
        lat: number,
        lng: number,
        adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    ): Promise<AdminZoneInfo | null> => {
        const boundary = await findAdminBoundary(lat, lng, adminLevel);

        if (!boundary) {
            return null;
        }

        const name =
            boundary.properties?.["name:en"] ??
            boundary.properties?.name ??
            "Unknown";

        return { name, boundary };
    },
    (lat, lng, adminLevel) =>
        `${lat.toFixed(6)},${lng.toFixed(6)},${adminLevel}`,
);

const highSpeedBase = _.memoize(
    (features: Feature[]) => {
        const grouped = groupObjects(features);

        const neighbored = grouped
            .map((group) => {
                return turf.multiLineString(
                    connectToSeparateLines(
                        group
                            .filter((x) => turf.getType(x) === "LineString")
                            .map((x) => x.geometry.coordinates),
                    ),
                );
            })
            .filter((x) => x.geometry.coordinates.length > 0);

        return turf.combine(
            turf.buffer(
                turf.simplify(turf.featureCollection(neighbored), {
                    tolerance: 0.001,
                }),
                0.001,
            )!,
        ).features[0];
    },
    (features) => `${JSON.stringify(features.map((x) => x.geometry))}`,
);

const bboxExtension = (
    bBox: [number, number, number, number],
    distance: number,
): [number, number, number, number] => {
    const buffered = turf.bbox(
        turf.buffer(turf.bboxPolygon(bBox), Math.abs(distance), {
            units: "miles",
        })!,
    );

    const originalDeltaLat = bBox[3] - bBox[1];
    const originalDeltaLng = bBox[2] - bBox[0];

    return [
        buffered[0] - originalDeltaLng,
        buffered[1] - originalDeltaLat,
        buffered[2] + originalDeltaLng,
        buffered[3] + originalDeltaLat,
    ];
};

export const determineMeasuringBoundary = async (
    question: MeasuringQuestion,
) => {
    const bBox = turf.bbox(mapGeoJSON.get()!);

    const madrid = madridCategoryOf(question.type);
    if (madrid) {
        // Distancia al <sitio> más cercano (o al río más cercano).
        if (MADRID_CATEGORIES[madrid].geometry === "line") {
            return [
                turf.combine(
                    turf.featureCollection(await madridCategoryLines(madrid)),
                ).features[0],
            ];
        }
        const points = await madridCategoryPoints(madrid);
        if (points.length === 0) return [turf.multiPolygon([])];
        return [turf.combine(turf.featureCollection(points)).features[0]];
    }

    switch (question.type) {
        case "highspeed-measure-shinkansen": {
            const features = osmtogeojson(
                await findPlacesInZone(
                    "[highspeed=yes]",
                    t("Buscando las líneas de alta velocidad…"),
                    "nwr",
                    "geom",
                ),
            ).features;

            // Datos de Madrid: las vías ya vienen trazadas; se mide a ellas
            // directamente (el método original une tramos con saltos rectos).
            const lines = features.filter(
                (f) =>
                    f.geometry?.type === "LineString" ||
                    f.geometry?.type === "MultiLineString",
            );
            if (lines.length > 0)
                return [
                    turf.combine(turf.featureCollection(lines as any))
                        .features[0],
                ];

            return [highSpeedBase(features)];
        }
        case "admin-measure": {
            const adminLevel = (question as any).cat?.adminLevel ?? 4;
            const zoneInfo = await findAdminZoneInfo(
                question.lat,
                question.lng,
                adminLevel,
            );

            if (!zoneInfo) {
                toast.error(
                    t("No hay ninguna división administrativa en este punto"),
                );
                return [turf.multiPolygon([])];
            }

            // Store the zone name for display
            if (!(question as any).cat) {
                (question as any).cat = { adminLevel };
            }
            (question as any).cat.zoneName = zoneInfo.name;

            // El borde como una sola línea. La Comunidad de Madrid es un
            // MultiPolygon (tiene un enclave) y polygonToLine devuelve entonces
            // una colección, que el cálculo de distancias no admite.
            const coords: Position[][] = [];
            turf.flattenEach(
                turf.polygonToLine(zoneInfo.boundary as any) as any,
                (line: any) => {
                    if (line.geometry.type === "LineString")
                        coords.push(line.geometry.coordinates);
                    else coords.push(...line.geometry.coordinates);
                },
            );
            return [turf.multiLineString(coords)];
        }
        case "coastline": {
            const coastline = turf.lineToPolygon(
                await fetchCoastline(),
            ) as Feature<MultiPolygon>;

            const distanceToCoastline = turf.pointToPolygonDistance(
                turf.point([question.lng, question.lat]),
                coastline,
                {
                    units: "miles",
                    method: "geodesic",
                },
            );

            return [
                turf.difference(
                    turf.featureCollection([
                        turf.bboxPolygon(bBox),
                        turf.buffer(
                            turf.bboxClip(
                                coastline,
                                bBox
                                    ? bboxExtension(
                                          bBox as any,
                                          distanceToCoastline,
                                      )
                                    : [-180, -90, 180, 90],
                            ),
                            distanceToCoastline,
                            {
                                units: "miles",
                                steps: 64,
                            },
                        )!,
                    ]),
                )!,
            ];
        }
        case "airport":
            return [
                turf.combine(
                    turf.featureCollection(
                        _.uniqBy(
                            (
                                await findPlacesInZone(
                                    '["aeroway"="aerodrome"]["iata"]', // Only commercial airports have IATA codes,
                                    t("Buscando aeropuertos…"),
                                )
                            ).elements,
                            (feature: any) => feature.tags.iata,
                        ).map((x: any) =>
                            turf.point([
                                x.center ? x.center.lon : x.lon,
                                x.center ? x.center.lat : x.lat,
                            ]),
                        ),
                    ),
                ).features[0],
            ];
        case "city":
            return [
                turf.combine(
                    turf.featureCollection(
                        (
                            await findPlacesInZone(
                                '[place=city]["population"~"^[1-9]+[0-9]{6}$"]', // The regex is faster than (if:number(t["population"])>1000000)
                                t("Buscando ciudades…"),
                            )
                        ).elements.map((x: any) =>
                            turf.point([
                                x.center ? x.center.lon : x.lon,
                                x.center ? x.center.lat : x.lat,
                            ]),
                        ),
                    ),
                ).features[0],
            ];
        case "aquarium-full":
        case "zoo-full":
        case "theme_park-full":
        case "peak-full":
        case "museum-full":
        case "hospital-full":
        case "cinema-full":
        case "library-full":
        case "golf_course-full":
        case "consulate-full":
        case "park-full": {
            const location = question.type.split("-full")[0] as APILocations;

            const data = await findPlacesInZone(
                `[${LOCATION_FIRST_TAG[location]}=${location}]`,
                t("Buscando: {what}…", {
                    what: prettifyLocation(location, true).toLowerCase(),
                }),
                "nwr",
                "center",
                [],
                60,
            );

            if (data.remark && data.remark.startsWith("runtime error")) {
                toast.error(
                    t(
                        "Error al buscar: {what}. Activa el modo zonas de escondite y usa la versión de partida grande de esta pregunta.",
                        {
                            what: prettifyLocation(
                                location,
                                true,
                            ).toLowerCase(),
                        },
                    ),
                );
                return [turf.multiPolygon([])];
            }

            if (data.elements.length >= 1000) {
                toast.error(
                    t(
                        "Hay demasiados ({n}): {what}. Activa el modo zonas de escondite y usa la versión de partida grande de esta pregunta.",
                        {
                            n: data.elements.length,
                            what: prettifyLocation(
                                location,
                                true,
                            ).toLowerCase(),
                        },
                    ),
                );
                return [turf.multiPolygon([])];
            }

            return [
                turf.combine(
                    turf.featureCollection(
                        data.elements.map((x: any) =>
                            turf.point([
                                x.center ? x.center.lon : x.lon,
                                x.center ? x.center.lat : x.lat,
                            ]),
                        ),
                    ),
                ).features[0],
            ];
        }
        case "custom-measure":
            return turf.combine(
                turf.featureCollection((question as any).geo.features),
            ).features;
        case "aquarium":
        case "zoo":
        case "theme_park":
        case "peak":
        case "museum":
        case "hospital":
        case "cinema":
        case "library":
        case "golf_course":
        case "consulate":
        case "park":
        case "mcdonalds":
        case "seven11":
        case "rail-measure":
        case "altitude":
            return false;
    }
};

const bufferedDeterminer = _.memoize(
    async (question: MeasuringQuestion) => {
        const placeData = await determineMeasuringBoundary(question);

        if (placeData === false || placeData === undefined) return false;

        return arcBufferToPoint(
            turf.featureCollection(placeData as any),
            question.lat,
            question.lng,
        );
    },
    (question) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            entirety: polyGeoJSON.get()
                ? polyGeoJSON.get()
                : mapGeoLocation.get(),
            geo: (question as any).geo,
            cat: (question as any).cat,
        }),
);

/**
 * Altitud del buscador: la que ha medido con el móvil, si la ha escrito; si
 * no, la del terreno donde se hace la pregunta.
 */
export const seekerAltitude = async (question: MeasuringQuestion) => {
    const typed = (question as { altitude?: number }).altitude;
    if (typeof typed === "number") return typed;
    const ground = await altitudeAt(question.lat, question.lng);
    if (ground === null) throw new Error("Fuera del modelo de altitud");
    return ground;
};

export const adjustPerMeasuring = async (
    question: MeasuringQuestion,
    mapData: any,
) => {
    if (mapData === null) return;

    if (question.type === "altitude") {
        // Más cerca del nivel del mar = más bajo que el buscador: fuera de la
        // zona que está a su altitud o más arriba.
        const above = await regionAbove(await seekerAltitude(question));
        return modifyMapData(mapData, above, !question.hiderCloser);
    }

    const buffer = await bufferedDeterminer(question);

    if (buffer === false) return mapData;

    return modifyMapData(mapData, buffer, question.hiderCloser);
};

export const hiderifyMeasuring = async (question: MeasuringQuestion) => {
    const $hiderMode = hiderMode.get();
    if ($hiderMode === false) {
        return question;
    }

    if (question.type === "altitude") {
        const hider = await altitudeAt(
            $hiderMode.latitude,
            $hiderMode.longitude,
        );
        if (hider !== null)
            question.hiderCloser = hider < (await seekerAltitude(question));
        return question;
    }

    if (
        [
            "aquarium",
            "zoo",
            "theme_park",
            "peak",
            "museum",
            "hospital",
            "cinema",
            "library",
            "golf_course",
            "consulate",
            "park",
        ].includes(question.type)
    ) {
        const questionNearest = await nearestToQuestion(
            question as HomeGameMeasuringQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            hiderCloser: true,
            type: (question as HomeGameMeasuringQuestions).type,
            drag: false,
            color: "black",
            collapsed: false,
        });

        question.hiderCloser =
            questionNearest.properties.distanceToPoint >
            hiderNearest.properties.distanceToPoint;

        return question;
    }

    if (question.type === "rail-measure") {
        const stations = trainStations.get();

        if (stations.length === 0) {
            return question;
        }

        const location = turf.point([question.lng, question.lat]);

        const nearestTrainStation = turf.nearestPoint(
            location,
            turf.featureCollection(stations.map((x) => x.properties)),
        );

        const distance = await arcDistance(location, nearestTrainStation);

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

        const hiderNearest = turf.nearestPoint(
            hider,
            turf.featureCollection(stations.map((x) => x.properties)),
        );

        const hiderDistance = await arcDistance(hider, hiderNearest);

        question.hiderCloser = hiderDistance < distance;
    }

    if (question.type === "mcdonalds" || question.type === "seven11") {
        const points = await findPlacesSpecificInZone(
            question.type === "mcdonalds"
                ? QuestionSpecificLocation.McDonalds
                : QuestionSpecificLocation.Seven11,
        );

        const seeker = turf.point([question.lng, question.lat]);
        const nearest = turf.nearestPoint(seeker, points as any);

        const distance = await arcDistance(seeker, nearest, "miles");

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);
        const hiderNearest = turf.nearestPoint(hider, points as any);

        const hiderDistance = await arcDistance(hider, hiderNearest, "miles");

        question.hiderCloser = hiderDistance < distance;
        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    try {
        feature = holedMask((await adjustPerMeasuring(question, $mapGeoJSON))!);
    } catch {
        try {
            feature = await adjustPerMeasuring(question, {
                type: "FeatureCollection",
                features: [holedMask($mapGeoJSON)],
            });
        } catch {
            return question;
        }
    }

    if (feature === null || feature === undefined) return question;

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

    if (turf.booleanPointInPolygon(hiderPoint, feature)) {
        question.hiderCloser = !question.hiderCloser;
    }

    return question;
};

export const measuringPlanningPolygon = async (question: MeasuringQuestion) => {
    try {
        if (question.type === "altitude")
            return turf.polygonToLine(
                await regionAbove(await seekerAltitude(question)),
            );
        const buffered = await bufferedDeterminer(question);

        if (buffered === false) return false;

        return turf.polygonToLine(buffered);
    } catch {
        return false;
    }
};
