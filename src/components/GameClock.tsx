import { useStore } from "@nanostores/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    addClockEvent,
    clockStatus,
    formatDuration,
    gameClock,
    roundHistory,
    type RoundStatus,
} from "@/lib/clock";
import { SIZE_INFO } from "@/lib/config";
import { gameSize, questions } from "@/lib/context";
import { cn } from "@/lib/utils";
import { loadMadridData } from "@/maps/api/local";

const PHASE_LABEL: Record<RoundStatus["phase"], string> = {
    "sin-empezar": "Sin empezar",
    escondiendose: "Escondiéndose",
    buscando: "Buscando",
    pausa: "En pausa",
    descanso: "Descanso",
    move: "Move",
    encontrado: "Encontrado",
};

const vibrate = (pattern: number[]) => {
    try {
        navigator.vibrate?.(pattern);
    } catch {
        // Sin vibración en este navegador.
    }
};

interface StationOption {
    name: string;
    lat: number;
    lng: number;
}

let stationListPromise: Promise<StationOption[]> | null = null;
/** Estaciones para elegir la que revela el escondido al hacer Move. */
const stationList = () =>
    (stationListPromise ??= loadMadridData().then((d) =>
        d.elements
            .filter((e) => e.type === "node" && e.tags["jlm:system"])
            .map((e: any) => ({ name: e.tags.name, lat: e.lat, lng: e.lon }))
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
    ));

const useStations = (enabled: boolean) => {
    const [stations, setStations] = useState<StationOption[]>([]);
    useEffect(() => {
        if (enabled) stationList().then(setStations);
    }, [enabled]);
    return stations;
};

/** «sol», «Sól » → «Sol». */
const normalize = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

const NumberField = ({
    value,
    onChange,
    label,
}: {
    value: string;
    onChange: (v: string) => void;
    label: string;
}) => (
    <label className="flex items-center gap-2 text-sm">
        <span className="flex-1">{label}</span>
        <Input
            className="w-20"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </label>
);

/**
 * Reloj de partida: rondas, tiempo para esconderse, tiempo del escondido,
 * pausas, descansos, Move y el ganador.
 */
export const GameClock = () => {
    const $events = useStore(gameClock);
    const $gameSize = useStore(gameSize);
    const [now, setNow] = useState(Date.now());
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [form, setForm] = useState<null | "round" | "move" | "found">(null);
    const [hider, setHider] = useState("");
    const [minutes, setMinutes] = useState("");
    const [station, setStation] = useState("");
    const [bonus, setBonus] = useState("0");
    const stations = useStations(form === "move");

    useEffect(() => {
        setMounted(true);
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const { rounds, current, best } = useMemo(
        () => clockStatus($events, now),
        [$events, now],
    );

    // Avisos al cambiar de fase (si la app está abierta).
    const lastPhase = useRef(current?.phase);
    useEffect(() => {
        const prev = lastPhase.current;
        const phase = current?.phase;
        lastPhase.current = phase;
        if (!prev || prev === phase) return;
        if (prev === "escondiendose" && phase === "buscando") {
            toast.info("¡Se acabó el tiempo para esconderse! A buscar.", {
                autoClose: 8000,
            });
            vibrate([300, 150, 300, 150, 300]);
        } else if (prev === "move" && phase === "buscando") {
            toast.info("Se acabó el Move: los buscadores pueden seguir.", {
                autoClose: 8000,
            });
            vibrate([300, 150, 300]);
        }
    }, [current?.phase]);

    const defaultMinutes = String(SIZE_INFO[$gameSize].hidingMinutes);
    const chip = current
        ? current.phase === "escondiendose" || current.phase === "move"
            ? `${PHASE_LABEL[current.phase]} ${formatDuration(current.remainingMs!)}`
            : current.phase === "encontrado"
              ? `Encontrado ${formatDuration(current.finalMs!)}`
              : `${current.phase === "buscando" ? "⏱" : "⏸"} ${formatDuration(current.hiderMs)}`
        : "Reloj";

    const startRound = () => {
        const name = hider.trim() || `Ronda ${rounds.length + 1}`;
        const n = Number(minutes);
        if (
            questions.get().length > 0 &&
            !confirm(
                "Empieza una ronda nueva: se borran las preguntas y el historial de Move. ¿Seguir?",
            )
        )
            return;
        questions.set([]);
        roundHistory.set([]);
        addClockEvent({
            t: "round",
            at: Date.now(),
            hider: name,
            hidingMinutes: Number.isFinite(n) && n > 0 ? n : 60,
        });
        setForm(null);
        setHider("");
        setMinutes("");
    };

    const doMove = async () => {
        const n = Number(minutes);
        const s = (await stationList()).find(
            (x) => normalize(x.name) === normalize(station),
        );
        roundHistory.set([
            ...roundHistory.get(),
            {
                at: Date.now(),
                station: s,
                questions: questions.get(),
            },
        ]);
        questions.set([]);
        addClockEvent({
            t: "move",
            at: Date.now(),
            minutes: Number.isFinite(n) && n > 0 ? n : 60,
            station: s?.name ?? (station.trim() || undefined),
        });
        toast.info(
            "Move: las preguntas pasan al historial (siguen contando para el coste)" +
                (s ? ` y ${s.name} queda marcada en el mapa.` : "."),
            { autoClose: 6000 },
        );
        setForm(null);
        setStation("");
        setMinutes("");
    };

    const found = () => {
        const n = Number(bonus || 0);
        addClockEvent({
            t: "found",
            at: Date.now(),
            bonusMinutes: Number.isFinite(n) && n >= 0 ? n : 0,
        });
        setForm(null);
        setBonus("0");
        vibrate([500]);
    };

    const paused = current?.phase === "pausa" || current?.phase === "descanso";
    const running = current && current.phase !== "encontrado";

    return (
        <>
            <Button
                data-tutorial-id="clock-button"
                className={cn(
                    "shadow-md tabular-nums",
                    mounted &&
                        current?.phase === "escondiendose" &&
                        "bg-amber-200",
                    mounted && current?.phase === "move" && "bg-violet-200",
                    mounted && paused && "bg-slate-300",
                )}
                onClick={() => setOpen(true)}
                title="Reloj de partida"
            >
                {mounted ? chip : "Reloj"}
            </Button>
            {mounted && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogTitle>Reloj de partida</DialogTitle>
                        <DialogDescription>
                            El tiempo del escondido empieza a contar cuando
                            acaba el tiempo para esconderse y se para en pausas,
                            descansos y Move.
                        </DialogDescription>

                        {current && (
                            <div className="rounded-md border p-3 flex flex-col gap-1">
                                <div className="text-sm text-muted-foreground">
                                    Ronda {rounds.length} · se esconde{" "}
                                    <b>{current.hider}</b>
                                </div>
                                <div className="text-lg font-semibold">
                                    {PHASE_LABEL[current.phase]}
                                </div>
                                {current.remainingMs !== null && (
                                    <div className="text-3xl tabular-nums">
                                        {formatDuration(current.remainingMs)}
                                    </div>
                                )}
                                <div className="text-sm">
                                    Tiempo del escondido:{" "}
                                    <b className="tabular-nums">
                                        {formatDuration(current.hiderMs)}
                                    </b>
                                    {current.finalMs !== null &&
                                        ` · con cartas de tiempo: ${formatDuration(current.finalMs)}`}
                                </div>
                                {current.phase === "move" && (
                                    <div className="text-xs text-violet-500">
                                        Durante el Move los buscadores se quedan
                                        donde están y no preguntan.
                                    </div>
                                )}
                            </div>
                        )}

                        {form === null && (
                            <div className="flex flex-wrap gap-2">
                                {running && !paused && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                addClockEvent({
                                                    t: "pause",
                                                    at: Date.now(),
                                                    reason: "pausa",
                                                })
                                            }
                                        >
                                            Pausa
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                addClockEvent({
                                                    t: "pause",
                                                    at: Date.now(),
                                                    reason: "descanso",
                                                })
                                            }
                                        >
                                            Descanso
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setMinutes(defaultMinutes);
                                                setForm("move");
                                            }}
                                        >
                                            Move
                                        </Button>
                                        <Button
                                            onClick={() => setForm("found")}
                                        >
                                            Encontrado
                                        </Button>
                                    </>
                                )}
                                {paused && (
                                    <Button
                                        onClick={() =>
                                            addClockEvent({
                                                t: "resume",
                                                at: Date.now(),
                                            })
                                        }
                                    >
                                        Reanudar
                                    </Button>
                                )}
                                {!running && (
                                    <Button
                                        onClick={() => {
                                            setMinutes(defaultMinutes);
                                            setForm("round");
                                        }}
                                    >
                                        {rounds.length
                                            ? "Siguiente ronda"
                                            : "Empezar ronda"}
                                    </Button>
                                )}
                            </div>
                        )}

                        {form === "round" && (
                            <div className="flex flex-col gap-2">
                                <Input
                                    placeholder="¿Quién se esconde?"
                                    value={hider}
                                    onChange={(e) => setHider(e.target.value)}
                                />
                                <NumberField
                                    label="Minutos para esconderse"
                                    value={minutes}
                                    onChange={setMinutes}
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setForm(null)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button onClick={startRound}>
                                        Empezar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {form === "move" && (
                            <div className="flex flex-col gap-2 text-sm">
                                <p>
                                    El escondido descarta su mano y dice su
                                    estación de antes. Las preguntas actuales
                                    pasan al historial y el reloj se para
                                    mientras dura el Move.
                                </p>
                                <Input
                                    list="move-stations"
                                    placeholder="Estación revelada"
                                    value={station}
                                    onChange={(e) => setStation(e.target.value)}
                                />
                                <datalist id="move-stations">
                                    {stations.map((s) => (
                                        <option key={s.name} value={s.name} />
                                    ))}
                                </datalist>
                                <NumberField
                                    label="Minutos del Move (según la carta)"
                                    value={minutes}
                                    onChange={setMinutes}
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setForm(null)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button onClick={doMove}>Hacer Move</Button>
                                </div>
                            </div>
                        )}

                        {form === "found" && (
                            <div className="flex flex-col gap-2">
                                <NumberField
                                    label="Minutos de cartas de tiempo en la mano"
                                    value={bonus}
                                    onChange={setBonus}
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setForm(null)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button onClick={found}>
                                        Parar el reloj
                                    </Button>
                                </div>
                            </div>
                        )}

                        {rounds.length > 0 && (
                            <>
                                <Separator />
                                <div className="text-sm font-semibold">
                                    Rondas
                                </div>
                                <table className="text-sm w-full">
                                    <tbody>
                                        {rounds.map((r, i) => (
                                            <tr
                                                key={i}
                                                className={cn(
                                                    best === r &&
                                                        "font-semibold text-green-500",
                                                )}
                                            >
                                                <td>{i + 1}.</td>
                                                <td>{r.hider}</td>
                                                <td className="text-right tabular-nums">
                                                    {r.finalMs !== null
                                                        ? formatDuration(
                                                              r.finalMs,
                                                          )
                                                        : PHASE_LABEL[r.phase]}
                                                </td>
                                                <td className="pl-2 text-xs text-muted-foreground">
                                                    {r.moves
                                                        ? `${r.moves} Move`
                                                        : ""}
                                                    {best === r && " · gana"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="self-start"
                                    onClick={() => {
                                        if (
                                            confirm(
                                                "¿Borrar todas las rondas y tiempos?",
                                            )
                                        ) {
                                            gameClock.set([]);
                                            roundHistory.set([]);
                                        }
                                    }}
                                >
                                    Borrar el reloj
                                </Button>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};
