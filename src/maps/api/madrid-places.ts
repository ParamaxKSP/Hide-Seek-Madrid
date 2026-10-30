import * as turf from "@turf/turf";
import type { Feature, LineString, MultiLineString, Point } from "geojson";
import osmtogeojson from "osmtogeojson";

import {
    MADRID_CATEGORIES,
    type MadridCategoryId,
} from "@/maps/madrid-categories";

import { findPlacesInZone } from "./overpass";

/** Sitios de una categoría propia de Madrid (dentro de la zona de juego), como puntos con nombre. */
export const madridCategoryPoints = async (
    id: MadridCategoryId,
): Promise<Feature<Point>[]> => {
    const cat = MADRID_CATEGORIES[id];
    const data = await findPlacesInZone(
        cat.filter,
        `Buscando ${cat.label.toLowerCase()}...`,
    );
    return data.elements
        .map((x: any) => {
            const lon = x.center ? x.center.lon : x.lon;
            const lat = x.center ? x.center.lat : x.lat;
            if (lon === undefined || lat === undefined) return null;
            return turf.point([lon, lat], {
                name: x.tags?.name ?? cat.label,
            });
        })
        .filter((x: Feature<Point> | null): x is Feature<Point> => !!x);
};

/** Trazados de una categoría de líneas (ríos), simplificados para medir distancias. */
export const madridCategoryLines = async (
    id: MadridCategoryId,
): Promise<Feature<LineString | MultiLineString>[]> => {
    const cat = MADRID_CATEGORIES[id];
    const data = await findPlacesInZone(
        cat.filter,
        `Buscando ${cat.label.toLowerCase()}...`,
        "way",
        "geom",
    );
    const lines = osmtogeojson(data).features.filter(
        (f): f is Feature<LineString | MultiLineString> =>
            f.geometry?.type === "LineString" ||
            f.geometry?.type === "MultiLineString",
    );
    return turf.simplify(turf.featureCollection(lines), {
        tolerance: 0.0003,
        highQuality: true,
    }).features;
};
