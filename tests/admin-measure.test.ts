import fs from "node:fs";

import * as turf from "@turf/turf";
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

describe("«¿más cerca del borde de la comunidad?»", async () => {
    const m = await import("@/maps/questions/measuring");
    const ctx = await import("@/lib/context");
    ctx.mapGeoJSON.set({
        type: "FeatureCollection",
        features: [madrid.comunidad],
    } as any);
    const question: any = {
        lat: 40.4168,
        lng: -3.7038,
        type: "admin-measure",
        hiderCloser: true,
        cat: { adminLevel: 4 },
        drag: true,
        color: "blue",
        collapsed: false,
        hidden: false,
    };

    it("el borde es una sola línea aunque la comunidad tenga enclaves", async () => {
        const b: any = await m.determineMeasuringBoundary(question);
        expect(b).toHaveLength(1);
        expect(b[0].type).toBe("Feature");
        expect(b[0].geometry.type).toBe("MultiLineString");
    });
    // El recorte del mapa (buffer geodésico de ArcGIS) se prueba en el navegador.
});
