import { useStore } from "@nanostores/react";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/i18n";
import {
    hiderAnswered,
    hiderFollowGps,
    hiderMode,
    questions,
} from "@/lib/context";
import { getGpsPosition } from "@/lib/gps";

import { kmBetween } from "./cards/ThermometerHelper";

/** Mínimo movimiento (m) y tiempo (s) entre actualizaciones de la posición. */
const MIN_MOVE_M = 25;
const MIN_INTERVAL_S = 20;

/**
 * Sigue el GPS del móvil en modo escondido y mueve su posición. Va montado
 * siempre (no dibuja nada). Las preguntas ya respondidas no cambian al
 * moverse: se responden con la posición del momento de contestar.
 */
export const HiderGpsTracker = () => {
    const $hiderMode = useStore(hiderMode);
    const $follow = useStore(hiderFollowGps);
    const active = $hiderMode !== false && $follow;
    const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

    useEffect(() => {
        if (!active || !navigator.geolocation) return;
        const id = navigator.geolocation.watchPosition(
            (p) => {
                const lat = p.coords.latitude;
                const lng = p.coords.longitude;
                const now = Date.now();
                const prev = last.current;
                if (
                    prev &&
                    (kmBetween(prev.lat, prev.lng, lat, lng) * 1000 <
                        MIN_MOVE_M ||
                        now - prev.at < MIN_INTERVAL_S * 1000)
                )
                    return;
                last.current = { lat, lng, at: now };
                hiderMode.set({ latitude: lat, longitude: lng });
            },
            (e) => {
                if (e.code === 1) {
                    toast.error(
                        t("No hay permiso de ubicación para esta web."),
                    );
                    hiderFollowGps.set(false);
                }
                // Otros fallos (túneles, interiores) son pasajeros.
            },
            { enableHighAccuracy: true, maximumAge: 10000 },
        );
        return () => navigator.geolocation.clearWatch(id);
    }, [active]);

    return null;
};

/** Controles del modo escondido: seguir el GPS y volver a responder. */
export const HiderGpsControls = () => {
    const $follow = useStore(hiderFollowGps);
    return (
        <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
                <Checkbox
                    checked={$follow}
                    onCheckedChange={(c) => hiderFollowGps.set(c === true)}
                />
                {t("Seguir mi posición con el GPS")}
            </label>
            <p className="text-xs text-muted-foreground">
                {t(
                    "Cada pregunta se responde con tu posición en el momento en que llega; aunque te muevas después, su respuesta no cambia.",
                )}
            </p>
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    hiderAnswered.set({});
                    questions.set([...questions.get()]);
                    toast.info(
                        t("Respuestas recalculadas con tu posición actual."),
                    );
                }}
            >
                {t("Volver a responder todas desde aquí")}
            </Button>
        </div>
    );
};

/** Posición inicial del modo escondido: el GPS si se puede; si no, el centro del mapa. */
export const startHiderMode = async (fallback: {
    latitude: number;
    longitude: number;
}) => {
    hiderAnswered.set({});
    // Primero la posición: las preguntas se responden en cuanto se activa.
    const pos = hiderFollowGps.get() ? await getGpsPosition() : null;
    hiderMode.set(pos ? { latitude: pos.lat, longitude: pos.lng } : fallback);
};
