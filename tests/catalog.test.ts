import { describe, expect, it } from "vitest";

import {
    CATALOG,
    catalogIdOf,
    costMultiplier,
    randomizeQuestion,
    unaskedEntries,
} from "@/maps/catalog";
import { questionSchema } from "@/maps/schema";

const base = {
    lat: 40.41692,
    lng: -3.70348,
    drag: true,
    color: "blue",
    collapsed: false,
    hidden: false,
};
const q = (x: any) => questionSchema.parse(x);

describe("catálogo de preguntas", () => {
    it("tiene ids únicos y cada pregunta de mapa es válida", () => {
        const ids = CATALOG.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const e of CATALOG) {
            if (!e.make) continue;
            const data =
                e.make.id === "thermometer"
                    ? {
                          latA: 40.4,
                          lngA: -3.7,
                          latB: 40.45,
                          lngB: -3.7,
                          ...e.make.data,
                      }
                    : { ...base, ...e.make.data };
            const parsed = questionSchema.safeParse({
                id: e.make.id,
                key: 1,
                data,
            });
            expect(parsed.success, e.id).toBe(true);
            // La pregunta creada se reconoce como la misma del catálogo.
            if (parsed.success)
                expect(catalogIdOf(parsed.data), e.id).toBe(e.id);
        }
    });

    it("multiplica el coste al repetir, contando las vetadas", () => {
        const qs = [
            q({
                id: "radius",
                key: 1,
                data: { ...base, radius: 5, unit: "kilometers" },
            }),
            q({ id: "matching", key: 2, data: { ...base, type: "zoo-full" } }),
            q({
                id: "radius",
                key: 3,
                data: { ...base, radius: 5000, unit: "meters", vetoed: true },
            }),
            q({
                id: "radius",
                key: 4,
                data: { ...base, radius: 5, unit: "kilometers" },
            }),
            q({ id: "matching", key: 5, data: { ...base, type: "zoo" } }),
        ];
        expect(qs.map((x) => costMultiplier(qs, x.key))).toEqual([
            1, 1, 2, 3, 2,
        ]);
    });

    it("sortea otra pregunta no hecha de la misma categoría", () => {
        const qs = [
            q({
                id: "radius",
                key: 1,
                data: { ...base, radius: 5, unit: "kilometers" },
            }),
            q({
                id: "radius",
                key: 2,
                data: { ...base, radius: 10, unit: "kilometers" },
            }),
        ];
        const left = unaskedEntries(qs, "radius").map((e) => e.id);
        expect(left).not.toContain("radius:5");
        expect(left).not.toContain("radius:10");
        expect(left).toHaveLength(8);
        for (let i = 0; i < 20; i++) {
            const r = randomizeQuestion(qs, 1, () => i / 20)!;
            expect(r.entry.category).toBe("radius");
            expect(["radius:5", "radius:10"]).not.toContain(r.entry.id);
            const parsed = q(r.question);
            expect(parsed.key).toBe(1);
            expect((parsed.data as any).lat).toBe(base.lat);
        }
    });

    it("las preguntas que la app no dibuja quedan registradas sin mapa", () => {
        const qs = [
            q({ id: "matching", key: 7, data: { ...base, type: "zoo-full" } }),
        ];
        const street = CATALOG.findIndex((e) => e.id === "matching:street");
        const options = unaskedEntries(qs, "matching");
        const idx = options.findIndex((e) => e.id === "matching:street");
        expect(street).toBeGreaterThan(-1);
        const r = randomizeQuestion(qs, 7, () => (idx + 0.5) / options.length)!;
        expect(r.entry.id).toBe("matching:street");
        const parsed = q(r.question);
        expect(parsed.id).toBe("manual");
        expect(catalogIdOf(parsed)).toBe("matching:street");
        // Y desde una sin mapa se puede volver a una de mapa.
        const back = randomizeQuestion([parsed], 7, () => 0)!;
        expect(q(back.question).id).toBe("matching");
    });

    it("no sortea nada si ya se han hecho todas", () => {
        const qs = [1, 5, 15].map((km, i) =>
            q({
                id: "thermometer",
                key: i,
                data: {
                    latA: 40.4,
                    lngA: -3.7,
                    latB: 40.5,
                    lngB: -3.7,
                    distance: km,
                },
            }),
        );
        expect(randomizeQuestion(qs, 0)).toBeNull();
    });
});
