import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import {
    altitudeAtGrid,
    type AltitudeGrid,
    regionAboveGrid,
} from "@/maps/api/altitude";

/** Terreno de prueba: una rampa que sube de oeste (500 m) a este (1.500 m). */
const ramp = (): AltitudeGrid => {
    const width = 101;
    const height = 51;
    const z = new Int16Array(width * height);
    for (let j = 0; j < height; j++)
        for (let i = 0; i < width; i++) z[j * width + i] = 500 + i * 10;
    return {
        header: {
            north: 40.5,
            west: -4,
            dLat: 0.01,
            dLon: 0.01,
            width,
            height,
            min: 500,
            max: 1500,
            source: "prueba",
        },
        z,
    };
};

describe("altitud", () => {
    it("interpola la altitud en un punto", () => {
        const g = ramp();
        // Centro de la celda i = 50 → 1.000 m.
        expect(altitudeAtGrid(g, 40.25, -4 + 50.5 * 0.01)).toBeCloseTo(1000, 5);
        // A medio camino entre dos celdas.
        expect(altitudeAtGrid(g, 40.25, -4 + 51 * 0.01)).toBeCloseTo(1005, 5);
        expect(altitudeAtGrid(g, 41, -3.5)).toBeNull();
    });

    it("la zona por encima de una cota queda al este", () => {
        const g = ramp();
        const above = regionAboveGrid(g, 1000);
        const inside = (lng: number) =>
            turf.booleanPointInPolygon(turf.point([lng, 40.25]), above);
        // Centro de la celda i: -4 + (i + 0,5) · 0,01, a 500 + 10·i m.
        const at = (i: number) => -4 + (i + 0.5) * 0.01;
        expect(inside(at(60))).toBe(true); // 1.100 m
        expect(inside(at(80))).toBe(true); // 1.300 m
        expect(inside(at(30))).toBe(false); // 800 m
        expect(inside(at(10))).toBe(false); // 600 m
    });
});
