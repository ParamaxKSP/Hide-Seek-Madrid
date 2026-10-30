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

    it("conoce las líneas oficiales y sus estaciones", async () => {
        const lines = await local.loadTransitLines();
        const ids = lines.map((l) => l.id);
        for (const id of ["L1", "L3", "L12", "LR", "ML1", "C-1", "C-4a", "C-9"])
            expect(ids).toContain(id);
        const sol = await local.nearestTransitStation(40.41692, -3.70348);
        expect(sol?.tags.name).toBe("Sol");
        const atSol = (await local.linesAtStation(`node/${sol!.id}`)).map(
            (l) => l.id,
        );
        expect(atSol).toEqual(expect.arrayContaining(["L1", "L2", "L3"]));
    });

    it("responde «¿misma línea?» con la línea elegida", async () => {
        const all = await local.loadMadridData();
        const named = (n: string, sys: string) =>
            all.elements.find(
                (e) =>
                    e.tags.name === n &&
                    e.tags["jlm:system"]?.split(";").includes(sys),
            )!;
        const sol = named("Sol", "metro");
        const valdecarros = named("Valdecarros", "metro");
        const moncloa = named("Moncloa", "metro");
        const l1 = await api.trainLineNodeFinder(`node/${sol.id}`, "L1");
        expect(l1).toContain(valdecarros.id);
        expect(l1).not.toContain(moncloa.id);
        const any = await api.trainLineNodeFinder(`node/${sol.id}`);
        expect(any).toContain(moncloa.id);
    });

    it("desactiva una estación solo si todas sus líneas están desactivadas", () => {
        const props = { id: "node/1", "jlm:lines": "L1;L2" };
        expect(local.isStationDisabled(props, [], ["L1"])).toBe(false);
        expect(local.isStationDisabled(props, [], ["L1", "L2"])).toBe(true);
        expect(local.isStationDisabled(props, ["node/1"], [])).toBe(true);
    });

    it("deja fuera las estaciones con menos de 1 tren por hora", async () => {
        const d = await local.loadMadridData();
        const excluded = d.elements
            .filter((e) => e.tags["jlm:excluded"])
            .map((e) => e.tags.name);
        expect(excluded).toContain("Zarzalejo");
        const stations = await api.findPlacesInZone("[railway=station]");
        expect(stations.elements.map((e: any) => e.tags.name)).not.toContain(
            "Zarzalejo",
        );
    });

    it("une las estaciones de Metro y Cercanías del mismo sitio", async () => {
        const d = await local.loadMadridData();
        const sol = d.elements.filter((e) => e.tags.name === "Sol");
        expect(sol.length).toBe(1);
        expect(sol[0].tags["jlm:lines"]?.split(";")).toEqual(
            expect.arrayContaining(["L1", "L2", "L3", "C-3", "C-4"]),
        );
        expect(sol[0].tags.subway).toBe("yes");
        expect(sol[0].tags.train).toBe("yes");
    });

    it("dibuja la zona de «¿misma línea?» sin activar las zonas de escondite", async () => {
        const turf = await import("@turf/turf");
        const valdecarros: [number, number] = [40.3693, -3.6125];
        const moncloa: [number, number] = [40.4351, -3.7192];
        const inside = (f: any, lat: number, lng: number) =>
            turf.booleanPointInPolygon(turf.point([lng, lat]), f);
        const yes = await local.sameLineZone(
            40.41692,
            -3.70348,
            "L1",
            true,
            0.5,
            "kilometers",
        );
        expect(yes?.mode).toBe("keep");
        const keep = yes!.zone;
        expect(inside(keep, ...valdecarros)).toBe(true);
        expect(inside(keep, ...moncloa)).toBe(false);
        const no = await local.sameLineZone(
            40.41692,
            -3.70348,
            "L1",
            false,
            0.5,
            "kilometers",
        );
        expect(no?.mode).toBe("remove");
        const remove = no!.zone;
        // Con «no» solo se quitan las zonas de la L1; Moncloa sigue posible.
        expect(inside(remove, ...valdecarros)).toBe(true);
        expect(inside(remove, ...moncloa)).toBe(false);
        // Sol también es de L2 y L3: su zona se solapa con otras estaciones y no se quita entera.
        expect(inside(remove, 40.41692, -3.70348)).toBe(false);
    });

    it("une Metro y Cercanías pegados aunque se llamen distinto", async () => {
        const d = await local.loadMadridData();
        const names = d.elements
            .filter((e) => e.tags["jlm:system"])
            .map((e) => e.tags.name);
        expect(names).toContain("Sierra de Guadalupe");
        expect(names).toContain("Villa de Vallecas");
        expect(names).toContain("Puerta de Arganda");
        expect(names).not.toContain("Vallecas");
        const pa = d.elements.find((e) => e.tags.name === "Puerta de Arganda")!;
        expect(pa.tags["jlm:system"]).toBe("metro;cercanias");
        const sg = d.elements.find(
            (e) => e.tags.name === "Sierra de Guadalupe",
        )!;
        expect(sg.tags["jlm:system"]).toBe("metro;cercanias");
        const vv = d.elements.find((e) => e.tags.name === "Villa de Vallecas")!;
        expect(vv.tags["jlm:system"]).toBe("metro");
    });

    it("da nombres distintos a los sitios de una misma categoría", async () => {
        for (const cat of [
            "mercadona",
            "mcdonalds",
            "bullrings",
            "libraries",
        ]) {
            const d = await local.loadMadridData();
            const names = d.elements
                .filter((e) => e.tags["jlm:cat"] === cat)
                .map((e) => e.tags.name);
            expect(new Set(names).size).toBe(names.length);
        }
    });

    it("encuentra los sitios de las categorías de Madrid", async () => {
        const counts = {
            mercadona: 193,
            mcdonalds: 104,
            corteingles: 12,
            ikea: 3,
            stadiums: 14,
            bullrings: 53,
            malls: 35,
            univ: 22,
            markets: 49,
            cemeteries: 71,
            castles: 44,
        } as const;
        for (const [cat, n] of Object.entries(counts))
            expect(
                (await api.madridCategoryPoints(cat as keyof typeof counts))
                    .length,
            ).toBe(n);
        const rivers = await api.madridCategoryLines("rivers");
        expect(new Set(rivers.map((r: any) => r.properties.name)).size).toBe(8);
    });

    it("tentáculos de Mercadona a 2 km con nombres distinguibles", async () => {
        const near = await api.findTentacleLocations({
            ...SOL,
            radius: 2,
            unit: "kilometers",
            locationType: "madrid-mercadona",
        });
        expect(near.features.length).toBeGreaterThan(5);
        const names = near.features.map((f: any) => f.properties.name);
        expect(new Set(names).size).toBe(names.length);
        expect(names.every((n: string) => n.startsWith("Mercadona"))).toBe(
            true,
        );
    });

    it("conoce las cuatro divisiones administrativas y las nuevas medidas", async () => {
        const c = await api.findAdminBoundary(SOL.lat, SOL.lng, 4);
        const p = await api.findAdminBoundary(SOL.lat, SOL.lng, 6);
        expect(c?.properties?.name).toMatch(/Madrid/);
        expect(p?.properties?.name).toBe("Madrid");
        expect((await api.madridCategoryPoints("water")).length).toBe(50);
        const st = await api.madridCategoryPoints("stations");
        expect(st.length).toBeGreaterThan(300);
        expect(st.map((s) => s.properties?.name)).not.toContain("Zarzalejo");
    });
});
