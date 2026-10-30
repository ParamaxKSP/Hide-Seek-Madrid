/**
 * Altitud del terreno (Copernicus DEM GLO-90, remuestreado a ~150 m) para la
 * pregunta «¿estás más cerca o más lejos del nivel del mar que yo?».
 */
import { contours } from "d3-contour";
import type { Feature, MultiPolygon } from "geojson";

export interface AltitudeHeader {
    north: number;
    west: number;
    dLat: number;
    dLon: number;
    width: number;
    height: number;
    min: number;
    max: number;
    source: string;
}

export interface AltitudeGrid {
    header: AltitudeHeader;
    z: Int16Array;
}

let gridPromise: Promise<AltitudeGrid> | null = null;

export const loadAltitude = (): Promise<AltitudeGrid> => {
    if (!gridPromise) {
        const base = import.meta.env.BASE_URL + "/data/altitud";
        gridPromise = Promise.all([
            fetch(base + ".json").then((r) => r.json()),
            fetch(base + ".bin").then((r) => r.arrayBuffer()),
        ])
            .then(([header, buffer]) => ({
                header: header as AltitudeHeader,
                z: new Int16Array(buffer),
            }))
            .catch((e) => {
                gridPromise = null;
                throw e;
            });
    }
    return gridPromise;
};

/** Para las pruebas: usar una cuadrícula ya cargada. */
export const setAltitudeGrid = (grid: AltitudeGrid) => {
    gridPromise = Promise.resolve(grid);
};

/** Altitud (m) en un punto, interpolada; null fuera de la cuadrícula. */
export const altitudeAtGrid = (
    { header: h, z }: AltitudeGrid,
    lat: number,
    lng: number,
): number | null => {
    // Centros de celda en (i + 0,5, j + 0,5).
    const x = (lng - h.west) / h.dLon - 0.5;
    const y = (h.north - lat) / h.dLat - 0.5;
    if (x < 0 || y < 0 || x > h.width - 1 || y > h.height - 1) return null;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, h.width - 1);
    const y1 = Math.min(y0 + 1, h.height - 1);
    const fx = x - x0;
    const fy = y - y0;
    const v = (i: number, j: number) => z[j * h.width + i];
    return (
        v(x0, y0) * (1 - fx) * (1 - fy) +
        v(x1, y0) * fx * (1 - fy) +
        v(x0, y1) * (1 - fx) * fy +
        v(x1, y1) * fx * fy
    );
};

export const altitudeAt = async (lat: number, lng: number) =>
    altitudeAtGrid(await loadAltitude(), lat, lng);

/**
 * Zona del mapa a esa altitud o más alta. Con «más cerca del nivel del mar»
 * el escondido está fuera de ella; con «más lejos», dentro.
 */
export const regionAboveGrid = (
    { header: h, z }: AltitudeGrid,
    meters: number,
): Feature<MultiPolygon> => {
    const [contour] = contours().size([h.width, h.height]).thresholds([meters])(
        Array.from(z),
    );
    const toLonLat = ([x, y]: number[]) => [
        h.west + x * h.dLon,
        h.north - y * h.dLat,
    ];
    return {
        type: "Feature",
        properties: { altitude: meters },
        geometry: {
            type: "MultiPolygon",
            coordinates: contour.coordinates.map((polygon) =>
                polygon.map((ring) => ring.map(toLonLat)),
            ),
        },
    };
};

const regionCache = new Map<number, Feature<MultiPolygon>>();

export const regionAbove = async (meters: number) => {
    const key = Math.round(meters);
    if (!regionCache.has(key))
        regionCache.set(key, regionAboveGrid(await loadAltitude(), key));
    return regionCache.get(key)!;
};
