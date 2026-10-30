import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { questionModified } from "@/lib/context";
import { getGpsPosition } from "@/lib/gps";
import type { ThermometerQuestion } from "@/maps/schema";

/** Distancia en km entre dos puntos (haversine). */
export const kmBetween = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
) => {
    const r = Math.PI / 180;
    const a =
        Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
        Math.cos(lat1 * r) *
            Math.cos(lat2 * r) *
            Math.sin(((lng2 - lng1) * r) / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
};

/**
 * Ayuda con GPS para el termómetro: marca el inicio donde estás, sigue tu
 * posición mostrando la distancia en línea recta y avisa (con vibración)
 * cuando ya has recorrido la de la pregunta.
 */
export const ThermometerHelper = ({
    data,
    disabled,
}: {
    data: ThermometerQuestion;
    disabled?: boolean;
}) => {
    const [tracking, setTracking] = useState(false);
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    const [weak, setWeak] = useState(false);
    const watchId = useRef<number | null>(null);
    const warned = useRef(false);

    const stop = () => {
        if (watchId.current !== null)
            navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setTracking(false);
    };
    useEffect(() => stop, []);

    const travelled = here
        ? kmBetween(data.latA, data.lngA, here.lat, here.lng)
        : null;
    const target = data.distance;

    useEffect(() => {
        if (
            tracking &&
            target &&
            travelled !== null &&
            travelled >= target &&
            !warned.current
        ) {
            warned.current = true;
            toast.success(
                `Ya has recorrido ${target} km en línea recta: puedes mandar el final.`,
                { autoClose: 8000 },
            );
            try {
                navigator.vibrate?.([300, 150, 300]);
            } catch {
                // Sin vibración.
            }
        }
    }, [tracking, target, travelled]);

    const start = async () => {
        const pos = await getGpsPosition();
        if (!pos) return;
        data.latA = pos.lat;
        data.lngA = pos.lng;
        questionModified();
        setHere(pos);
        follow();
    };

    const follow = () => {
        if (!navigator.geolocation || watchId.current !== null) return;
        warned.current = false;
        setTracking(true);
        watchId.current = navigator.geolocation.watchPosition(
            (p) => {
                setWeak(false);
                setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
            },
            (e) => {
                // Sin permiso no hay nada que hacer; los demás fallos (túneles,
                // edificios) son pasajeros: se sigue intentando.
                if (e.code === 1) {
                    toast.error("No hay permiso de ubicación para esta web.");
                    stop();
                } else setWeak(true);
            },
            { enableHighAccuracy: true, maximumAge: 5000 },
        );
    };

    const finish = async () => {
        const pos = here ?? (await getGpsPosition());
        if (!pos) return;
        data.latB = pos.lat;
        data.lngB = pos.lng;
        questionModified();
        stop();
    };

    return (
        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
            <div className="flex flex-col gap-2 w-full text-sm">
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={start}
                        disabled={disabled}
                    >
                        Empezar aquí (GPS)
                    </Button>
                    {!tracking ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={follow}
                            disabled={disabled}
                        >
                            Seguir mi posición
                        </Button>
                    ) : (
                        <Button size="sm" onClick={finish} disabled={disabled}>
                            Terminar aquí
                        </Button>
                    )}
                </div>
                {tracking && weak && (
                    <span className="text-xs text-orange-500">
                        Señal de GPS débil, reintentando…
                    </span>
                )}
                {tracking && (
                    <span>
                        {travelled === null
                            ? "Buscando tu posición…"
                            : `Llevas ${travelled.toFixed(2)} km en línea recta` +
                              (target
                                  ? travelled >= target
                                      ? ` (ya pasas de ${target} km)`
                                      : ` de ${target} km`
                                  : "")}
                    </span>
                )}
                {!target && (
                    <span className="text-xs text-muted-foreground">
                        Elige la distancia de la pregunta para que te avise al
                        llegar.
                    </span>
                )}
            </div>
        </SidebarMenuItem>
    );
};
