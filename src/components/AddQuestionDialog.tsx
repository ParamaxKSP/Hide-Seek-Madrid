import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import React from "react";
import { toast } from "react-toastify";

import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar-l";
import {
    addQuestion,
    defaultCustomQuestions,
    gameSize,
    isLoading,
    leafletMapContext,
    questions,
} from "@/lib/context";
import { getGpsPosition, newQuestionsAtGps } from "@/lib/gps";
import { availableIn, CATALOG, catalogIdOf } from "@/maps/catalog";

/**
 * Dónde se crea una pregunta nueva: en la ubicación del GPS si está activado
 * (y funciona); si no, en el centro del mapa.
 */
const whereToAsk = async (): Promise<{ lat: number; lng: number } | null> => {
    if (newQuestionsAtGps.get()) {
        const pos = await getGpsPosition();
        if (pos) return pos;
    }
    const map = leafletMapContext.get();
    if (!map) return null;
    const center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
};

export const AddQuestionDialog = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const $isLoading = useStore(isLoading);
    const $newQuestionsAtGps = useStore(newQuestionsAtGps);
    const [open, setOpen] = React.useState(false);

    const runAddRadius = async () => {
        const center = await whereToAsk();
        if (!center) return false;
        addQuestion({
            id: "radius",
            data: { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddThermometer = async () => {
        const center = await whereToAsk();
        if (!center) return false;
        // Inicio donde estás; el final, provisional a 5 km (se cambia al llegar).
        const destination = turf.destination([center.lng, center.lat], 5, 90, {
            units: "kilometers",
        });

        addQuestion({
            id: "thermometer",
            data: {
                latA: center.lat,
                lngA: center.lng,
                latB: destination.geometry.coordinates[1],
                lngB: destination.geometry.coordinates[0],
            },
        });

        return true;
    };

    const runAddTentacles = async () => {
        const center = await whereToAsk();
        if (!center) return false;
        addQuestion({
            id: "tentacles",
            data: defaultCustomQuestions.get()
                ? {
                      lat: center.lat,
                      lng: center.lng,
                      locationType: "custom",
                      places: [],
                  }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMatching = async () => {
        const center = await whereToAsk();
        if (!center) return false;
        addQuestion({
            id: "matching",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-points" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMeasuring = async () => {
        const center = await whereToAsk();
        if (!center) return false;
        addQuestion({
            id: "measuring",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-measure" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    /** Pregunta que la app no dibuja: la primera no hecha de la categoría. */
    const runAddManual = async (category: "photo" | "matching") => {
        // Sin mapa: no hace falta el GPS.
        const center = leafletMapContext.get()?.getCenter();
        const asked = new Set(questions.get().map(catalogIdOf));
        const options = CATALOG.filter(
            (e) =>
                e.category === category &&
                !e.make &&
                availableIn(e, gameSize.get()),
        );
        const entry = options.find((e) => !asked.has(e.id)) ?? options[0];
        addQuestion({
            id: "manual",
            data: {
                category: entry.category,
                catalogId: entry.id,
                lat: center?.lat,
                lng: center?.lng,
            },
        });
        return true;
    };

    const runPasteQuestion = async () => {
        if (!navigator || !navigator.clipboard) {
            toast.error("Clipboard API not supported in your browser");
            return false;
        }

        try {
            await toast.promise(
                navigator.clipboard.readText().then((text) => {
                    const parsed = JSON.parse(text);
                    const question =
                        parsed &&
                        typeof parsed === "object" &&
                        !Array.isArray(parsed)
                            ? { ...parsed, key: Math.random() }
                            : parsed;

                    return addQuestion(question);
                }),
                {
                    pending: "Reading from clipboard",
                    success: "Question added from clipboard!",
                    error: "No valid question found in clipboard",
                },
                { autoClose: 1000 },
            );

            return true;
        } catch {
            return false;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Add Question</DialogTitle>
                <DialogDescription>
                    Select which question type you would like to add.
                </DialogDescription>

                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={$newQuestionsAtGps}
                        onCheckedChange={(checked) =>
                            newQuestionsAtGps.set(checked === true)
                        }
                    />
                    Crear la pregunta en mi ubicación (GPS)
                </label>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddRadius();
                        }}
                        disabled={$isLoading}
                    >
                        Add Radius
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddThermometer();
                        }}
                        disabled={$isLoading}
                    >
                        Add Thermometer
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddTentacles();
                        }}
                        disabled={$isLoading}
                    >
                        Add Tentacles
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddMatching();
                        }}
                        disabled={$isLoading}
                    >
                        Add Matching
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddMeasuring();
                        }}
                        disabled={$isLoading}
                    >
                        Add Measuring
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddManual("photo");
                        }}
                        disabled={$isLoading}
                    >
                        Añadir foto
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            setOpen(false);
                            await runAddManual("matching");
                        }}
                        disabled={$isLoading}
                    >
                        Otra pregunta sin mapa
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            const ok = await runPasteQuestion();
                            if (ok) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Paste Question
                    </SidebarMenuButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
