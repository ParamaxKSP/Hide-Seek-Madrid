/**
 * Reloj de partida. Se guarda como una lista de sucesos con su hora (empieza
 * la ronda, pausa, reanudar, Move, encontrado) y todo lo demás se calcula a
 * partir de ellos, así que sobrevive a recargar la página o cerrar el móvil.
 *
 * El tiempo del escondido empieza a contar cuando acaba el tiempo para
 * esconderse (como en el programa) y se para durante las pausas, los
 * descansos y los Move. Al encontrarle se suman las cartas de tiempo que
 * tenga en la mano.
 */
import { persistentAtom } from "@nanostores/persistent";

import type { Question } from "@/maps/schema";

export type ClockEvent =
    | { t: "round"; at: number; hider: string; hidingMinutes: number }
    | { t: "pause"; at: number; reason: "pausa" | "descanso" }
    | { t: "resume"; at: number }
    | { t: "move"; at: number; minutes: number; station?: string }
    | { t: "found"; at: number; bonusMinutes: number }
    /** El escondido confirma que los buscadores han llegado a su zona. */
    | {
          t: "endgame";
          at: number;
          station: string;
          lat: number;
          lng: number;
          /** Preguntas hechas antes del endgame: ya no cuentan. */
          before?: number[];
      }
    | { t: "endgame-cancel"; at: number };

export type ClockPhase =
    | "sin-empezar"
    | "escondiendose"
    | "buscando"
    | "pausa"
    | "descanso"
    | "move"
    | "encontrado";

export interface RoundStatus {
    hider: string;
    phase: ClockPhase;
    /** Tiempo del escondido hasta ahora (ms): desde que acaba el de esconderse, sin pausas ni Move. */
    hiderMs: number;
    /** Lo que queda de la fase actual (para esconderse o del Move), en ms. */
    remainingMs: number | null;
    /** Tiempo final con las cartas de tiempo (solo si le han encontrado). */
    finalMs: number | null;
    moves: number;
}

const MIN = 60_000;

/** Sucesos de cada ronda, por orden. */
export const splitRounds = (events: ClockEvent[]) => {
    const rounds: ClockEvent[][] = [];
    for (const e of events) {
        if (e.t === "round") rounds.push([e]);
        else if (rounds.length) rounds.at(-1)!.push(e);
    }
    return rounds;
};

/** Estado de una ronda en el instante `now`. */
export const roundStatus = (round: ClockEvent[], now: number): RoundStatus => {
    const start = round[0] as Extract<ClockEvent, { t: "round" }>;
    const found = round.find((e) => e.t === "found") as
        | Extract<ClockEvent, { t: "found" }>
        | undefined;
    const end = found ? found.at : now;

    // Intervalos parados: pausas/descansos y Move.
    let stopped = 0;
    let openPause: Extract<ClockEvent, { t: "pause" }> | null = null;
    let moveUntil = 0;
    let moves = 0;
    for (const e of round) {
        if (e.at > end) break;
        if (e.t === "pause" && !openPause) openPause = e;
        else if (e.t === "resume" && openPause) {
            stopped += e.at - openPause.at;
            openPause = null;
        } else if (e.t === "move") {
            moves++;
            const until = e.at + e.minutes * MIN;
            moveUntil = Math.max(moveUntil, until);
            stopped += Math.max(0, Math.min(until, end) - e.at);
        }
    }
    if (openPause) stopped += end - openPause.at;

    // Tiempo de juego sin pausas ni Move; el del escondido empieza a contar
    // cuando acaba el tiempo para esconderse (como en el programa).
    const activeMs = Math.max(0, end - start.at - stopped);
    const hidingMs = start.hidingMinutes * MIN;
    const hiderMs = Math.max(0, activeMs - hidingMs);

    let phase: ClockPhase;
    let remainingMs: number | null = null;
    if (found) phase = "encontrado";
    else if (openPause) phase = openPause.reason;
    else if (now < moveUntil) {
        phase = "move";
        remainingMs = moveUntil - now;
    } else if (activeMs < hidingMs) {
        phase = "escondiendose";
        remainingMs = hidingMs - activeMs;
    } else phase = "buscando";

    return {
        hider: start.hider,
        phase,
        hiderMs,
        remainingMs,
        finalMs: found ? hiderMs + found.bonusMinutes * MIN : null,
        moves,
    };
};

export const clockStatus = (events: ClockEvent[], now: number) => {
    const rounds = splitRounds(events).map((r) => roundStatus(r, now));
    const current = rounds.at(-1) ?? null;
    const finished = rounds.filter((r) => r.finalMs !== null);
    const best = finished.reduce<RoundStatus | null>(
        (a, r) => (!a || r.finalMs! > a.finalMs! ? r : a),
        null,
    );
    return { rounds, current, best };
};

/** «1 h 05 min 09 s» o «12:09» si es menos de una hora. */
export const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const two = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
};

export const gameClock = persistentAtom<ClockEvent[]>("gameClock", [], {
    encode: JSON.stringify,
    decode: (x) => {
        try {
            const v = JSON.parse(x);
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    },
});

export interface EndgameState {
    station: string;
    lat: number;
    lng: number;
    at: number;
    /** Claves de las preguntas de antes del endgame (no cuentan). */
    before: number[];
}

/**
 * Endgame de la ronda en curso: la estación que ha confirmado el escondido
 * (null si no hay o se ha cancelado) y si ya se ha usado en esta ronda. Solo
 * se puede usar una vez por ronda, aunque se cancele.
 */
export const roundEndgame = (events: ClockEvent[]) => {
    const round = splitRounds(events).at(-1) ?? [];
    const found = round.some((e) => e.t === "found");
    const start = round.find((e) => e.t === "endgame") as
        | Extract<ClockEvent, { t: "endgame" }>
        | undefined;
    const cancelled = round.some((e) => e.t === "endgame-cancel");
    const active: EndgameState | null =
        start && !cancelled && !found
            ? {
                  station: start.station,
                  lat: start.lat,
                  lng: start.lng,
                  at: start.at,
                  before: start.before ?? [],
              }
            : null;
    return { active, used: !!start, cancelled };
};

export const addClockEvent = (e: ClockEvent) =>
    gameClock.set([...gameClock.get(), e]);

/** Preguntas de la ronda guardadas al hacer Move (siguen contando para el coste). */
export interface MoveRecord {
    at: number;
    station?: { name: string; lat: number; lng: number };
    questions: Question[];
}

export const roundHistory = persistentAtom<MoveRecord[]>("roundHistory", [], {
    encode: JSON.stringify,
    decode: (x) => {
        try {
            const v = JSON.parse(x);
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    },
});

/** Todas las preguntas de la ronda: las de antes de cada Move y las actuales. */
export const roundQuestions = (current: Question[], history: MoveRecord[]) => [
    ...history.flatMap((h) => h.questions),
    ...current,
];
