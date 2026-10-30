import fs from "node:fs";

import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-toastify", () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        promise: (p: any) => p,
    },
}));

const madrid = JSON.parse(
    fs.readFileSync(
        new URL("../public/data/madrid.json", import.meta.url),
        "utf8",
    ),
);

vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
        if (String(url).endsWith("/data/madrid.json"))
            return new Response(JSON.stringify(madrid));
        throw new Error(`Petición inesperada a la red: ${url}`);
    }),
);

const SOL = { lat: 40.41692, lng: -3.70348 };
const base = { ...SOL, drag: true, color: "blue", collapsed: false };

/** Escondidos en sitios variados de la Comunidad. */
const HIDERS: [string, number, number][] = [
    ["Atocha", 40.4065, -3.6895],
    ["Getafe", 40.3057, -3.7329],
    ["Alcalá", 40.4818, -3.3641],
    ["Las Rozas", 40.4929, -3.8737],
    ["Aranjuez", 40.0311, -3.6025],
];

describe("modo escondido con las preguntas nuevas", async () => {
    const ctx = await import("@/lib/context");
    const api = await import("@/maps/api");
    const { hiderifyQuestion } = await import("@/maps");
    const { questionSchema } = await import("@/maps/schema");
    ctx.mapGeoJSON.set(await api.determineMapBoundaries());

    const ask = async (hider: [string, number, number], q: any) => {
        ctx.hiderMode.set({ latitude: hider[1], longitude: hider[2] });
        const parsed = questionSchema.parse(q);
        return (await hiderifyQuestion(parsed)).data as any;
    };

    const nearestName = (pts: any[], lat: number, lng: number) =>
        turf.nearestPoint(turf.point([lng, lat]), turf.featureCollection(pts))
            .properties.name;

    it("«¿mismo ___ más cercano?» con categorías de Madrid", async () => {
        for (const cat of ["mercadona", "ikea", "univ", "stadiums"] as const) {
            const pts = await api.madridCategoryPoints(cat);
            for (const h of HIDERS) {
                const d = await ask(h, {
                    id: "matching",
                    key: 1,
                    data: { ...base, type: `madrid-${cat}`, same: true },
                });
                const expected =
                    nearestName(pts, SOL.lat, SOL.lng) ===
                    nearestName(pts, h[1], h[2]);
                expect(d.same, `${cat} / ${h[0]}`).toBe(expected);
            }
        }
    });

    it("«¿misma división administrativa?»", async () => {
        for (const h of HIDERS) {
            for (const level of [4, 6, 8, 9] as const) {
                const d = await ask(h, {
                    id: "matching",
                    key: 2,
                    data: {
                        ...base,
                        type: "zone",
                        cat: { adminLevel: level },
                        same: true,
                    },
                });
                const seeker = await api.findAdminBoundary(
                    SOL.lat,
                    SOL.lng,
                    level,
                );
                const hider = await api.findAdminBoundary(h[1], h[2], level);
                const expected =
                    !!hider &&
                    seeker?.properties?.name === hider?.properties?.name;
                expect(d.same, `nivel ${level} / ${h[0]}`).toBe(expected);
            }
        }
    });

    it("«¿misma línea?» con estaciones unidas", async () => {
        // Escondido junto a Sierra de Guadalupe (L1 y Cercanías C-2/C-7).
        const sg: [string, number, number] = [
            "Sierra de Guadalupe",
            40.3826,
            -3.6249,
        ];
        const l1 = await ask(sg, {
            id: "matching",
            key: 3,
            data: {
                ...base,
                type: "same-train-line",
                trainLine: "L1",
                same: false,
            },
        });
        expect(l1.same).toBe(true);
        const l2 = await ask(sg, {
            id: "matching",
            key: 3,
            data: {
                ...base,
                type: "same-train-line",
                trainLine: "L2",
                same: true,
            },
        });
        expect(l2.same).toBe(false);
    });

    it("una pregunta vetada no se responde", async () => {
        const d = await ask(HIDERS[2], {
            id: "matching",
            key: 4,
            data: { ...base, type: "madrid-ikea", same: true, vetoed: true },
        });
        expect(d.same).toBe(true);
    });
    // Tentáculos y Measuring usan la librería de Esri, que solo funciona en el
    // navegador: se comprueban allí.
});
