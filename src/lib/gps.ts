import { persistentAtom } from "@nanostores/persistent";
import { toast } from "react-toastify";

/** Crear las preguntas nuevas en la ubicación del GPS (si no, en el centro del mapa). */
export const newQuestionsAtGps = persistentAtom<boolean>(
    "newQuestionsAtGps",
    true,
    { encode: JSON.stringify, decode: JSON.parse },
);

/** Precisión a partir de la que se avisa (metros). */
const LOW_ACCURACY_M = 100;

const REASONS: Record<number, string> = {
    1: "no hay permiso de ubicación para esta web (actívalo en los ajustes del navegador)",
    2: "el móvil no sabe dónde está (¿GPS desactivado o sin cobertura?)",
    3: "el GPS ha tardado demasiado",
};

/**
 * Ubicación actual con alta precisión. Muestra el progreso y los errores
 * en español y avisa si la precisión es baja. Devuelve null si falla.
 */
export const getGpsPosition = async (): Promise<{
    lat: number;
    lng: number;
    accuracy: number;
} | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        toast.error("Este navegador no permite usar el GPS.");
        return null;
    }
    const id = toast.loading("Buscando tu ubicación…");
    try {
        const position = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    maximumAge: 10_000,
                    timeout: 15_000,
                }),
        );
        const accuracy = Math.round(position.coords.accuracy);
        toast.update(id, {
            render:
                accuracy > LOW_ACCURACY_M
                    ? `Ubicación con poca precisión (±${accuracy} m). Si puedes, espera un poco y repite.`
                    : `Ubicación del GPS (±${accuracy} m)`,
            type: accuracy > LOW_ACCURACY_M ? "warning" : "success",
            isLoading: false,
            autoClose: accuracy > LOW_ACCURACY_M ? 5000 : 1500,
        });
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy,
        };
    } catch (e) {
        const code = (e as GeolocationPositionError)?.code;
        toast.update(id, {
            render: `No se pudo obtener la ubicación: ${REASONS[code] ?? "error desconocido"}.`,
            type: "error",
            isLoading: false,
            autoClose: 6000,
        });
        return null;
    }
};
