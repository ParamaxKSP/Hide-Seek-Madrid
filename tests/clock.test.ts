import { describe, expect, it } from "vitest";

import {
    type ClockEvent,
    clockStatus,
    formatDuration,
    roundStatus,
} from "@/lib/clock";

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const at = (min: number) => T0 + min * MIN;

describe("reloj de partida", () => {
    const round: ClockEvent[] = [
        { t: "round", at: at(0), hider: "Lucas", hidingMinutes: 60 },
    ];

    it("primero se esconde y luego le buscan", () => {
        const s1 = roundStatus(round, at(20));
        expect(s1.phase).toBe("escondiendose");
        expect(s1.remainingMs).toBe(40 * MIN);
        expect(s1.hiderMs).toBe(20 * MIN);
        const s2 = roundStatus(round, at(90));
        expect(s2.phase).toBe("buscando");
        expect(s2.hiderMs).toBe(90 * MIN);
    });

    it("las pausas paran el tiempo (también el de esconderse)", () => {
        const r: ClockEvent[] = [
            ...round,
            { t: "pause", at: at(30), reason: "pausa" },
            { t: "resume", at: at(45) },
        ];
        expect(roundStatus(r, at(40)).phase).toBe("pausa");
        expect(roundStatus(r, at(40)).hiderMs).toBe(30 * MIN);
        const after = roundStatus(r, at(60));
        expect(after.phase).toBe("escondiendose");
        expect(after.hiderMs).toBe(45 * MIN);
        expect(after.remainingMs).toBe(15 * MIN);
    });

    it("un descanso sin reanudar sigue parado", () => {
        const r: ClockEvent[] = [
            ...round,
            { t: "pause", at: at(100), reason: "descanso" },
        ];
        const s = roundStatus(r, at(700));
        expect(s.phase).toBe("descanso");
        expect(s.hiderMs).toBe(100 * MIN);
    });

    it("el Move para el tiempo del escondido mientras dura", () => {
        const r: ClockEvent[] = [
            ...round,
            { t: "move", at: at(120), minutes: 60, station: "Sol" },
        ];
        const during = roundStatus(r, at(150));
        expect(during.phase).toBe("move");
        expect(during.remainingMs).toBe(30 * MIN);
        expect(during.hiderMs).toBe(120 * MIN);
        const after = roundStatus(r, at(200));
        expect(after.phase).toBe("buscando");
        expect(after.hiderMs).toBe(140 * MIN);
        expect(after.moves).toBe(1);
    });

    it("al encontrarle se suman las cartas de tiempo y gana el tiempo más largo", () => {
        const events: ClockEvent[] = [
            ...round,
            { t: "found", at: at(150), bonusMinutes: 20 },
            { t: "round", at: at(200), hider: "Ana", hidingMinutes: 60 },
            { t: "found", at: at(400), bonusMinutes: 0 },
            { t: "round", at: at(500), hider: "Pablo", hidingMinutes: 60 },
        ];
        const { rounds, current, best } = clockStatus(events, at(520));
        expect(rounds.map((r) => r.finalMs)).toEqual([
            170 * MIN,
            200 * MIN,
            null,
        ]);
        expect(best?.hider).toBe("Ana");
        expect(current?.hider).toBe("Pablo");
        expect(current?.phase).toBe("escondiendose");
    });

    it("formatea los tiempos", () => {
        expect(formatDuration(65_000)).toBe("01:05");
        expect(formatDuration(3_725_000)).toBe("1:02:05");
    });
});
