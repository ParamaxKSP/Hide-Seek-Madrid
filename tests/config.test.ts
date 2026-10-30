import fs from "node:fs";

import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-toastify", () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
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

describe("configuraciones de partida", async () => {
    const cfg = await import("@/lib/config");
    const ctx = await import("@/lib/context");
    const api = await import("@/maps/api");

    it("las predefinidas tienen la zona y las estaciones previstas", async () => {
        const expected: Record<string, [number, number]> = {
            metropolitana: [1261, 327],
            madrid: [604, 220],
            almendra: [42, 79],
        };
        for (const p of cfg.PRESETS) {
            await cfg.applyConfig(p);
            const poly = ctx.polyGeoJSON.get();
            const stations = await api.findPlacesInZone("[railway=station]");
            if (p.id === "comunidad") {
                expect(poly).toBeNull();
                expect(stations.elements.length).toBe(355);
                continue;
            }
            const [km2, n] = expected[p.id];
            expect(Math.round(turf.area(poly!) / 1e6), p.id).toBe(km2);
            expect(stations.elements.length, p.id).toBe(n);
        }
    });

    it("el tamaño de partida pone el radio del reglamento", async () => {
        await cfg.applyConfig({ ...cfg.PRESETS[3] });
        expect(ctx.gameSize.get()).toBe("small");
        expect(ctx.hidingRadius.get()).toBe(0.5);
        await cfg.applyConfig({ ...cfg.PRESETS[0], size: "large" });
        expect(ctx.hidingRadius.get()).toBe(1);
        expect(ctx.hidingRadiusUnits.get()).toBe("kilometers");
    });

    it("aplicar borra las preguntas y guarda líneas y estaciones quitadas", async () => {
        ctx.questions.set([
            {
                id: "radius",
                key: 1,
                data: {
                    lat: 40.4,
                    lng: -3.7,
                    radius: 5,
                    unit: "kilometers",
                    within: true,
                    chosen: false,
                    drag: true,
                    color: "blue",
                    collapsed: false,
                    hidden: false,
                    vetoed: false,
                },
            },
        ]);
        await cfg.applyConfig({
            ...cfg.PRESETS[2],
            disabledLines: ["C-9", "L12"],
            disabledStations: ["node/1"],
        });
        expect(ctx.questions.get()).toEqual([]);
        expect(ctx.disabledLines.get()).toEqual(["C-9", "L12"]);
        expect(ctx.disabledStations.get()).toEqual(["node/1"]);
    });

    it("al guardar la actual, la zona se reconoce y si se dibuja otra se guarda el polígono", async () => {
        await cfg.applyConfig(cfg.PRESETS[1]);
        ctx.hidingRadius.set(800);
        ctx.hidingRadiusUnits.set("meters");
        const mine = cfg.captureConfig("Mi partida");
        expect(mine.area).toEqual(cfg.PRESETS[1].area);
        expect(mine.hidingRadiusKm).toBe(0.8);

        const drawn = turf.featureCollection([
            turf.bboxPolygon([-3.75, 40.38, -3.65, 40.45]),
        ]);
        ctx.polyGeoJSON.set(drawn as any);
        const custom = cfg.captureConfig("Dibujada");
        expect(custom.area.kind).toBe("poligono");

        await cfg.applyConfig(cfg.PRESETS[0]);
        expect(cfg.captureConfig("Otra").area).toEqual({ kind: "comunidad" });
    });

    it("se comparte por enlace comprimido y por archivo", async () => {
        const config = {
            ...cfg.PRESETS[3],
            name: "Almendra con amigos",
            disabledLines: ["L1"],
        };
        const encoded = await cfg.encodeConfig(config);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encoded.length).toBeLessThan(400);
        const back = await cfg.decodeConfig(encoded);
        expect(back.name).toBe("Almendra con amigos");
        expect(back.area).toEqual(config.area);
        expect(back.disabledLines).toEqual(["L1"]);
        const file = cfg.configFromFile(cfg.configToFile(config));
        expect(file.name).toBe("Almendra con amigos");
        expect(cfg.configFileName(config)).toBe(
            "configuracion-almendra-con-amigos.json",
        );
        await expect(cfg.decodeConfig("basura")).rejects.toThrow();
    });

    it("una zona dibujada cabe en un enlace razonable", async () => {
        await cfg.applyConfig(cfg.PRESETS[2]);
        // Simula una zona dibujada a mano a partir de Madrid capital.
        cfg.activeConfig.set(null);
        const drawn = cfg.captureConfig("Madrid dibujado");
        expect(drawn.area.kind).toBe("poligono");
        const encoded = await cfg.encodeConfig(drawn);
        expect(encoded.length).toBeLessThan(8000);
    });
});
