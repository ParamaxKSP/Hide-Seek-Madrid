import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { questionModified } from "@/lib/context";
import { altitudeAt } from "@/maps/api";

/**
 * Altitud del buscador para la pregunta del nivel del mar: la del terreno
 * donde está, o la que marque su móvil si la escribe (lo que dice el
 * reglamento).
 */
export const AltitudeInfo = ({
    data,
    disabled,
}: {
    data: { lat: number; lng: number; altitude?: number };
    disabled?: boolean;
}) => {
    const [ground, setGround] = useState<number | null | undefined>(undefined);
    const [text, setText] = useState(
        data.altitude === undefined ? "" : String(data.altitude),
    );

    useEffect(() => {
        let cancelled = false;
        altitudeAt(data.lat, data.lng)
            .then((m) => !cancelled && setGround(m))
            .catch(() => !cancelled && setGround(null));
        return () => {
            cancelled = true;
        };
    }, [data.lat, data.lng]);

    const used = data.altitude ?? ground;

    return (
        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
            <div className="flex flex-col gap-1 text-sm w-full">
                <span>
                    Altitud del terreno aquí:{" "}
                    <b>
                        {ground === undefined
                            ? "…"
                            : ground === null
                              ? "sin datos"
                              : `${Math.round(ground)} m`}
                    </b>
                </span>
                <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Altitud de tu móvil (m), opcional"
                    value={text}
                    disabled={disabled}
                    onChange={(e) => {
                        setText(e.target.value);
                        const n = Number(e.target.value.replace(",", "."));
                        data.altitude =
                            e.target.value.trim() !== "" && Number.isFinite(n)
                                ? n
                                : undefined;
                        questionModified();
                    }}
                />
                {typeof used === "number" && (
                    <span className="text-xs text-muted-foreground">
                        Se compara con {Math.round(used)} m
                        {data.altitude !== undefined
                            ? " (la de tu móvil)"
                            : " (la del terreno)"}
                        . Más cerca del nivel del mar = más bajo que tú.
                    </span>
                )}
            </div>
        </SidebarMenuItem>
    );
};
