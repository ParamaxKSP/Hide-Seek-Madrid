import { useEffect, useState } from "react";

import { lineBadgeStyle } from "@/components/TransitLinesPanel";
import { cn } from "@/lib/utils";
import {
    linesAtStation,
    nearestTransitStation,
    type TransitLine,
} from "@/maps/api/local";

/**
 * Elige la línea del tren en el que van los buscadores para la pregunta
 * «¿Tu estación está en la misma línea?». Las opciones son las líneas que
 * paran en la estación más cercana a la posición de la pregunta.
 */
export const TrainLineSelect = ({
    lat,
    lng,
    value,
    disabled,
    onChange,
}: {
    lat: number;
    lng: number;
    value?: string;
    disabled?: boolean;
    onChange: (line: string | undefined) => void;
}) => {
    const [station, setStation] = useState<string | null>(null);
    const [lines, setLines] = useState<TransitLine[]>([]);

    useEffect(() => {
        let cancelled = false;
        nearestTransitStation(lat, lng)
            .then(async (st) => {
                if (cancelled || !st) return;
                setStation(st.tags.name);
                setLines(await linesAtStation(`node/${st.id}`));
            })
            .catch(() => setLines([]));
        return () => {
            cancelled = true;
        };
    }, [lat, lng]);

    // Si se mueve la pregunta a otra estación, la línea elegida puede dejar de valer.
    useEffect(() => {
        if (value && lines.length > 0 && !lines.some((l) => l.id === value)) {
            onChange(undefined);
        }
    }, [lines, value]);

    if (!station) return null;

    const chosen = lines.find((l) => l.id === value);

    return (
        <div className="flex flex-col gap-2 px-2 pb-2 text-sm">
            <span>
                Estación más cercana: <strong>{station}</strong>
            </span>
            <span>¿En qué línea vais?</span>
            <div className="flex flex-wrap gap-1.5">
                <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={!value}
                    onClick={() => onChange(undefined)}
                    className={cn(
                        "rounded border px-1.5 py-0.5 text-xs",
                        !value ? "border-foreground font-bold" : "opacity-60",
                    )}
                >
                    Cualquiera
                </button>
                {lines.map((line) => (
                    <button
                        key={line.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={value === line.id}
                        title={line.name}
                        onClick={() => onChange(line.id)}
                        style={lineBadgeStyle(line)}
                        className={cn(
                            "min-w-9 rounded px-1.5 py-0.5 text-xs font-bold",
                            value !== line.id && "opacity-40",
                        )}
                    >
                        {line.id}
                    </button>
                ))}
            </div>
            {!value && lines.length > 1 && (
                <span className="text-xs text-orange-500">
                    Con «Cualquiera» cuenta cualquier línea que pare aquí.
                    Elegid la vuestra para que la respuesta sea exacta.
                </span>
            )}
            {chosen && chosen.skipped.length > 0 && (
                <span className="text-xs text-orange-500">
                    Algunos trenes de la {chosen.id} pasan sin parar por{" "}
                    {chosen.skipped.length === 1
                        ? "1 estación"
                        : `${chosen.skipped.length} estaciones`}
                    . El mapa cuenta todas las paradas de la línea; si vuestro
                    tren no para en la estación del escondido, la respuesta del
                    reglamento es «no».
                </span>
            )}
        </div>
    );
};
