import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SidebarMenuItem } from "@/components/ui/sidebar-r";
import { disabledLines, isLoading, showTransitLines } from "@/lib/context";
import { cn } from "@/lib/utils";
import {
    loadTransitLines,
    SYSTEM_NAMES,
    type TransitLine,
} from "@/maps/api/local";

/** Fondo y texto de la etiqueta de una línea, legibles también para el Ramal (blanco). */
export const lineBadgeStyle = (line: TransitLine) =>
    line.color === "#FFFFFF"
        ? { background: line.textColor, color: "#FFFFFF" }
        : { background: line.color, color: line.textColor };

/**
 * Lista de líneas de Metro, Metro Ligero y Cercanías. Al pulsar una línea se
 * activa o desactiva como zona de escondite: una estación queda fuera cuando
 * todas sus líneas están desactivadas.
 */
export const TransitLinesPanel = () => {
    const $disabledLines = useStore(disabledLines);
    const $showTransitLines = useStore(showTransitLines);
    const $isLoading = useStore(isLoading);
    const [lines, setLines] = useState<TransitLine[]>([]);

    useEffect(() => {
        loadTransitLines()
            .then(setLines)
            .catch(() => setLines([]));
    }, []);

    if (lines.length === 0) return null;

    const toggle = (ids: string[], enable: boolean) =>
        disabledLines.set(
            enable
                ? $disabledLines.filter((l) => !ids.includes(l))
                : [...new Set([...$disabledLines, ...ids])],
        );

    const systems = Object.keys(SYSTEM_NAMES) as TransitLine["system"][];

    return (
        <SidebarMenuItem className="flex flex-col gap-3 px-2 py-2">
            <div className="flex items-center gap-2">
                <Checkbox
                    id="show-transit-lines"
                    checked={$showTransitLines}
                    onCheckedChange={(v) => showTransitLines.set(v === true)}
                />
                <Label htmlFor="show-transit-lines">
                    Mostrar líneas en el mapa
                </Label>
            </div>
            <p className="text-xs text-muted-foreground">
                Pulsa una línea para quitarla o volver a ponerla como zona de
                escondite.
            </p>
            {systems.map((system) => {
                const group = lines.filter((l) => l.system === system);
                if (group.length === 0) return null;
                const ids = group.map((l) => l.id);
                const allOn = ids.every((id) => !$disabledLines.includes(id));
                return (
                    <div key={system} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">
                                {SYSTEM_NAMES[system]}
                            </span>
                            <button
                                type="button"
                                className="text-xs text-blue-500 disabled:opacity-50"
                                disabled={$isLoading}
                                onClick={() => toggle(ids, !allOn)}
                            >
                                {allOn ? "Quitar todas" : "Poner todas"}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {group.map((line) => {
                                const off = $disabledLines.includes(line.id);
                                return (
                                    <button
                                        key={line.id}
                                        type="button"
                                        title={`${line.id}: ${line.name}`}
                                        aria-pressed={!off}
                                        disabled={$isLoading}
                                        onClick={() => toggle([line.id], off)}
                                        style={lineBadgeStyle(line)}
                                        className={cn(
                                            "min-w-9 rounded px-1.5 py-0.5 text-xs font-bold transition-opacity",
                                            off && "line-through opacity-30",
                                        )}
                                    >
                                        {line.id}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </SidebarMenuItem>
    );
};
