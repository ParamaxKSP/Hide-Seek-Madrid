import fs from "node:fs";

import osmtogeojson from "osmtogeojson";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

beforeAll(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (String(url).endsWith("/data/madrid.json"))
                return new Response(JSON.stringify(madrid));
            throw new Error(`Petición inesperada a la red: ${url}`);
        }),
    );
});

const SOL = { lat: 40.41692, lng: -3.70348 };

describe("datos locales de Madrid", async () => {
    const api = await import("@/maps/api");
    const local = await import("@/maps/api/local");

    it("interpreta filtros con sintaxis de Overpass", () => {
        const { test } = local.parseFilter(
            '[railway=station]["subway"!="yes"]',
        );
        expect(test({ railway: "station" })).toBe(true);
        expect(test({ railway: "station", subway: "yes" })).toBe(false);
        expect(
            local
                .parseFilter('["name:en"~"^A.+"]')
                .test({ "name:en": "Alcala" }),
        ).toBe(true);
    });

    it("dibuja el borde de la Comunidad sin Overpass", async () => {
        const geo = await api.determineGeoJSON("349055", "R");
        expect(geo.features.length).toBeGreaterThan(0);
        expect(geo.features[0].geometry.type).toMatch(/Polygon/);
    });

    it("encuentra estaciones para las zonas de escondite", async () => {
        const data = await api.findPlacesInZone(
            "[railway=station]",
            "",
            "nwr",
            "center",
            ["[railway=halt]"],
        );
        expect(data.elements.length).toBeGreaterThan(300);
        const metro = await api.findPlacesInZone(
            "[railway=station][subway=yes]",
        );
        expect(metro.elements.length).toBeGreaterThan(200);
        expect(metro.elements.length).toBeLessThan(data.elements.length);
    });

    it("resuelve municipio y distrito de un punto", async () => {
        const muni = await api.findAdminBoundary(SOL.lat, SOL.lng, 8);
        expect(muni?.properties?.name).toBe("Madrid");
        const distrito = await api.findAdminBoundary(SOL.lat, SOL.lng, 9);
        expect(distrito?.properties?.name).toBe("Centro");
        const getafe = await api.findAdminBoundary(40.3057, -3.7329, 8);
        expect(getafe?.properties?.name).toBe("Getafe");
        expect(
            await api.findAdminBoundary(SOL.lat, SOL.lng, 10),
        ).toBeUndefined();
    });

    it("busca zonas por inicial sin tener en cuenta las tildes", async () => {
        const data = await api.findPlacesInZone(
            '[admin_level=8]["name:en"~"^A.+"]',
            "",
            "relation",
            "geom",
        );
        const names = osmtogeojson(data).features.map(
            (f: any) => f.properties.name,
        );
        expect(names).toContain("Alcalá de Henares");
        expect(names).toContain("Arganda del Rey");
        expect(local.stripAccents("Ávila")).toBe("Avila");
        expect(names).not.toContain("Madrid");
    });

    it("devuelve lugares de las categorías del reglamento", async () => {
        const museums = await api.findPlacesInZone("[tourism=museum]");
        expect(museums.elements.length).toBe(186);
        const airports = await api.findPlacesInZone(
            '["aeroway"="aerodrome"]["iata"]',
        );
        expect(airports.elements.length).toBe(4);
        const consulates = await api.findPlacesInZone("[diplomatic=consulate]");
        expect(consulates.elements.length).toBe(164);
        const mcd = await api.findPlacesSpecificInZone(
            api.QuestionSpecificLocation.McDonalds,
        );
        expect(mcd.features.length).toBe(104);
        const city = await api.findPlacesInZone(
            '[place=city]["population"~"^[1-9]+[0-9]{6}$"]',
        );
        expect(city.elements.length).toBe(1);
    });

    it("da geometría de líneas para la alta velocidad", async () => {
        const data = await api.findPlacesInZone(
            "[highspeed=yes]",
            "",
            "nwr",
            "geom",
        );
        const lines = osmtogeojson(data).features.filter(
            (f: any) => f.geometry.type === "LineString",
        );
        expect(lines.length).toBeGreaterThan(100);
    });

    it("calcula tentáculos y el lugar más cercano", async () => {
        const near = await api.findTentacleLocations({
            ...SOL,
            radius: 2,
            unit: "kilometers",
            locationType: "museum",
        });
        expect(near.features.length).toBeGreaterThan(5);
        const nearest = await api.nearestToQuestion({
            ...SOL,
            same: true,
            type: "zoo",
            drag: false,
            color: "black",
            collapsed: false,
        } as any);
        expect(nearest.properties.name).toBe("Zoo Aquarium de Madrid");
    });
});
