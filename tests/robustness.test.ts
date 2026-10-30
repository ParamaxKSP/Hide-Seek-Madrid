import { describe, expect, it } from "vitest";

import { parsePositive } from "@/components/PositiveNumberInput";
import { decodeQuestions } from "@/lib/context";

const base = {
    lat: 40.41692,
    lng: -3.70348,
    drag: true,
    color: "blue",
    collapsed: false,
    hidden: false,
};

describe("datos imposibles en las preguntas", () => {
    it("solo acepta radios mayores que cero, con coma o punto", () => {
        expect(parsePositive("2")).toBe(2);
        expect(parsePositive("1,5")).toBe(1.5);
        expect(parsePositive("1.5")).toBe(1.5);
        expect(parsePositive("")).toBeNull();
        expect(parsePositive("0")).toBeNull();
        expect(parsePositive("-3")).toBeNull();
        expect(parsePositive("abc")).toBeNull();
    });

    it("repara un radio vacío guardado y no pierde las demás preguntas", () => {
        const saved = JSON.stringify([
            {
                id: "tentacles",
                key: 1,
                data: {
                    ...base,
                    locationType: "theme_park",
                    radius: null,
                    unit: "kilometers",
                    location: false,
                },
            },
            {
                id: "matching",
                key: 2,
                data: { ...base, type: "madrid-ikea", same: true },
            },
            { id: "nonsense", key: 3, data: {} },
        ]);
        const qs = decodeQuestions(saved);
        expect(qs.map((q) => q.key)).toEqual([1, 2]);
        expect((qs[0].data as any).radius).toBe(15);
        expect(decodeQuestions("not json")).toEqual([]);
    });
});
