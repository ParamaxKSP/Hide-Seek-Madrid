import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { t } from "@/i18n";
import {
    additionalMapGeoLocations,
    allowGooglePlusCodes,
    animateMapMovements,
    autoSave,
    autoZoom,
    baseTileLayer,
    customInitPreference,
    customPresets,
    customStations,
    defaultCustomQuestions,
    defaultUnit,
    disabledStations,
    displayHidingZonesOptions,
    followMe,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    hidingZone,
    includeDefaultStations,
    leafletMapContext,
    mapGeoJSON,
    mapGeoLocation,
    overpassCustomHost,
    overpassHost,
    permanentOverlay,
    planningModeEnabled,
    polyGeoJSON,
    questions,
    save,
    showTutorial,
    thunderforestApiKey,
    triggerLocalRefresh,
    useCustomStations,
} from "@/lib/context";
import { cn, compress, decompress, shareOrFallback } from "@/lib/utils";
import { OVERPASS_HOSTS } from "@/maps/api/constants";
import { questionsSchema } from "@/maps/schema";

import { ConfigDialog } from "./ConfigDialog";
import { GameClock } from "./GameClock";
import { LatitudeLongitude } from "./LatLngPicker";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./ui/sidebar-l";
import { UnitSelect } from "./UnitSelect";

const HIDING_ZONE_URL_PARAM = "hz";
const HIDING_ZONE_COMPRESSED_URL_PARAM = "hzc";
/** Enlace de partida: …/#partida=<datos comprimidos>. */
const GAME_HASH = "partida";
/** Más largo que esto, mejor mandar un archivo. */
const MAX_LINK_LENGTH = 16000;

export const OptionDrawers = ({ className }: { className?: string }) => {
    useStore(triggerLocalRefresh);
    const $defaultCustomQuestions = useStore(defaultCustomQuestions);
    const $allowGooglePlusCodes = useStore(allowGooglePlusCodes);
    const $defaultUnit = useStore(defaultUnit);
    const $animateMapMovements = useStore(animateMapMovements);
    const $autoZoom = useStore(autoZoom);
    const $hiderMode = useStore(hiderMode);
    const $autoSave = useStore(autoSave);
    const $hidingZone = useStore(hidingZone);
    const $planningMode = useStore(planningModeEnabled);
    const $baseTileLayer = useStore(baseTileLayer);
    const $thunderforestApiKey = useStore(thunderforestApiKey);
    const $followMe = useStore(followMe);
    const $customInitPref = useStore(customInitPreference);
    const $overpassHost = useStore(overpassHost);
    const $overpassCustomHost = useStore(overpassCustomHost);
    const lastDefaultUnit = useRef($defaultUnit);
    const hasSyncedInitialUnit = useRef(false);
    const [isOptionsOpen, setOptionsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const currentDefault = $defaultUnit;

        if (!hasSyncedInitialUnit.current) {
            hasSyncedInitialUnit.current = true;
            if (hidingRadiusUnits.get() !== currentDefault) {
                hidingRadiusUnits.set(currentDefault);
            }
        } else if (lastDefaultUnit.current !== currentDefault) {
            hidingRadiusUnits.set(currentDefault);
        }

        lastDefaultUnit.current = currentDefault;
    }, [$defaultUnit]);

    useEffect(() => {
        const clean = () =>
            window.history.replaceState({}, "", window.location.pathname);
        // Partida compartida: los datos van detrás de «#» y nunca llegan al servidor.
        const hash = window.location.hash.match(
            new RegExp(`^#${GAME_HASH}=([A-Za-z0-9_-]+)$`),
        );
        const params = new URL(window.location.toString()).searchParams;
        const hidingZoneOld = params.get(HIDING_ZONE_URL_PARAM);
        const hidingZoneCompressed =
            hash?.[1] ?? params.get(HIDING_ZONE_COMPRESSED_URL_PARAM);

        if (hidingZoneOld !== null) {
            // Enlaces antiguos de la app original (base64).
            try {
                loadHidingZone(atob(hidingZoneOld));
                clean();
            } catch (e) {
                toast.error(
                    t("Enlace de partida no válido: {error}", {
                        error: String(e),
                    }),
                );
            }
        } else if (hidingZoneCompressed) {
            decompress(hidingZoneCompressed)
                .then((data) => {
                    loadHidingZone(data);
                    clean();
                })
                .catch(() => toast.error(t("El enlace de partida está roto.")));
        }
    }, []);

    const loadHidingZone = (hidingZone: string) => {
        try {
            const geojson = JSON.parse(hidingZone);

            if (
                geojson.properties &&
                geojson.properties.isHidingZone === true
            ) {
                questions.set(
                    questionsSchema.parse(geojson.properties.questions ?? []),
                );
                mapGeoLocation.set(geojson);
                mapGeoJSON.set(null);
                polyGeoJSON.set(null);

                if (geojson.alternateLocations) {
                    additionalMapGeoLocations.set(geojson.alternateLocations);
                } else {
                    additionalMapGeoLocations.set([]);
                }
            } else {
                if (geojson.questions) {
                    questions.set(questionsSchema.parse(geojson.questions));
                    delete geojson.questions;

                    mapGeoJSON.set(geojson);
                    polyGeoJSON.set(geojson);
                } else {
                    questions.set([]);
                    mapGeoJSON.set(geojson);
                    polyGeoJSON.set(geojson);
                }
            }

            const incomingPresets =
                geojson.presets ?? geojson.properties?.presets;
            if (incomingPresets && Array.isArray(incomingPresets)) {
                try {
                    const normalized = (incomingPresets as any[])
                        .filter((p) => p && p.data)
                        .map((p) => {
                            return {
                                id:
                                    p.id ??
                                    (typeof crypto !== "undefined" &&
                                    typeof (crypto as any).randomUUID ===
                                        "function"
                                        ? (crypto as any).randomUUID()
                                        : String(Date.now()) + Math.random()),
                                name: p.name ?? t("Plantilla importada"),
                                type: p.type ?? "custom",
                                data: p.data,
                                createdAt:
                                    p.createdAt ?? new Date().toISOString(),
                            };
                        });
                    if (normalized.length > 0) {
                        customPresets.set(normalized);
                        toast.info(
                            t("Plantillas importadas: {n}", {
                                n: normalized.length,
                            }),
                        );
                    }
                } catch (err) {
                    console.warn("Failed to import presets", err);
                }
            }

            if (
                geojson.disabledStations !== null &&
                geojson.disabledStations.constructor === Array
            ) {
                disabledStations.set(geojson.disabledStations);
            }

            if (geojson.hidingRadius !== null) {
                hidingRadius.set(geojson.hidingRadius);
            }

            if (geojson.zoneOptions) {
                displayHidingZonesOptions.set(geojson.zoneOptions ?? []);
            }

            if (typeof geojson.useCustomStations === "boolean") {
                useCustomStations.set(geojson.useCustomStations);
            }

            if (
                geojson.customStations &&
                geojson.customStations.constructor === Array
            ) {
                customStations.set(geojson.customStations);
            }

            if (typeof geojson.includeDefaultStations === "boolean") {
                includeDefaultStations.set(geojson.includeDefaultStations);
            }

            if (geojson.permanentOverlay) {
                permanentOverlay.set(geojson.permanentOverlay);
            } else {
                permanentOverlay.set(null);
            }

            toast.success(t("Partida cargada"), {
                autoClose: 2000,
            });
        } catch (e) {
            toast.error(t("Partida no válida: {error}", { error: String(e) }));
        }
    };

    const saveToFile = () => {
        try {
            const data = JSON.stringify($hidingZone, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.download = `partida-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t("Partida guardada en un archivo"), {
                autoClose: 2000,
            });
        } catch (e) {
            console.error("Failed to save file:", e);
            toast.error(
                t("No se ha podido guardar el archivo: {error}", {
                    error: String(e),
                }),
            );
        }
    };

    const loadFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === "string") {
                loadHidingZone(result);
            } else {
                toast.error(t("No se ha podido leer el archivo"));
            }
        };
        reader.onerror = () => {
            toast.error(t("No se ha podido leer el archivo"));
        };
        reader.readAsText(file);
    };

    return (
        <div
            className={cn(
                "flex justify-end gap-2 max-[412px]:!mb-4 max-[640px]:overflow-x-auto max-[640px]:w-[85vw] max-[640px]:justify-start max-[640px]:[&>button]:flex-shrink-0 max-[640px]:[&>div]:flex-shrink-0 max-[640px]:pb-1",
                className,
            )}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadFromFile(file);
                    e.target.value = "";
                }}
            />
            <GameClock />
            <ConfigDialog />
            <Button
                className="shadow-md"
                onClick={saveToFile}
                title={t("Descargar la partida en un archivo")}
            >
                {t("Guardar")}
            </Button>
            <Button
                className="shadow-md"
                onClick={() => fileInputRef.current?.click()}
                title={t("Abrir una partida desde un archivo")}
            >
                {t("Abrir")}
            </Button>
            <Button
                className="shadow-md"
                onClick={async () => {
                    let compressedData;
                    try {
                        compressedData = await compress(
                            JSON.stringify($hidingZone),
                        );
                    } catch (error) {
                        console.error("Compression failed:", error);
                        toast.error(t("No se pudo preparar la partida."));
                        return;
                    }

                    const baseUrl = `${window.location.origin}${window.location.pathname}`;
                    const shareUrl = `${baseUrl}#${GAME_HASH}=${compressedData}`;

                    if (shareUrl.length > MAX_LINK_LENGTH) {
                        toast.info(
                            t(
                                "La partida es demasiado grande para un enlace: se descarga como archivo para que lo mandes.",
                            ),
                        );
                        saveToFile();
                        return;
                    }

                    // Menú de compartir del móvil o, si no hay, portapapeles.
                    const result = await shareOrFallback(shareUrl);
                    if (result === false) {
                        toast.error(
                            t("No se pudo copiar. Enlace: {url}", {
                                url: shareUrl,
                            }),
                            {
                                className: "p-0 w-[1000px]",
                            },
                        );
                    } else if (result === "clipboard") {
                        toast.success(t("Enlace de la partida copiado"), {
                            autoClose: 2000,
                        });
                    }
                }}
                title={t("Compartir la partida (zona y preguntas) por enlace")}
                data-tutorial-id="share-questions-button"
            >
                {t("Compartir")}
            </Button>
            <Button
                className="w-24 shadow-md"
                onClick={() => {
                    showTutorial.set(true);
                }}
            >
                {t("Tutorial")}
            </Button>
            <Drawer open={isOptionsOpen} onOpenChange={setOptionsOpen}>
                <DrawerTrigger className="w-24" asChild>
                    <Button
                        className="w-24 shadow-md"
                        data-tutorial-id="option-questions-button"
                    >
                        {t("Opciones")}
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="flex flex-col items-center gap-4 mb-4">
                        <DrawerHeader>
                            <DrawerTitle className="text-4xl font-semibold font-poppins">
                                {t("Opciones")}
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-scroll max-h-[40vh] flex flex-col items-center gap-4 max-w-[1000px] px-12">
                            <div className="flex flex-row max-[330px]:flex-col gap-4">
                                <Button
                                    onClick={() => {
                                        if (!navigator || !navigator.clipboard)
                                            return toast.error(
                                                t(
                                                    "Tu navegador no permite usar el portapapeles.",
                                                ),
                                            );
                                        navigator.clipboard.writeText(
                                            JSON.stringify($hidingZone),
                                        );
                                        toast.success(t("Partida copiada"), {
                                            autoClose: 2000,
                                        });
                                    }}
                                >
                                    {t("Copiar partida")}
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!navigator || !navigator.clipboard)
                                            return toast.error(
                                                t(
                                                    "Tu navegador no permite usar el portapapeles.",
                                                ),
                                            );
                                        navigator.clipboard
                                            .readText()
                                            .then(loadHidingZone);
                                    }}
                                >
                                    {t("Pegar partida")}
                                </Button>
                            </div>
                            <Separator className="bg-slate-300 w-[280px]" />
                            <Label>{t("Unidad por defecto")}</Label>
                            <UnitSelect
                                unit={$defaultUnit}
                                onChange={defaultUnit.set}
                            />
                            <Separator className="bg-slate-300 w-[280px]" />
                            <Label>
                                {t("Nuevas preguntas personalizadas")}
                            </Label>
                            <Select
                                trigger={t("Al crear una nueva")}
                                options={{
                                    ask: t("Preguntar cada vez"),
                                    blank: t("Empezar vacía"),
                                    prefill: t("Copiar la actual"),
                                }}
                                value={$customInitPref}
                                onValueChange={(v) =>
                                    customInitPreference.set(v as any)
                                }
                            />
                            <Separator className="bg-slate-300 w-[280px]" />
                            <Label>{t("Estilo del mapa")}</Label>
                            <Select
                                trigger={t("Estilo del mapa")}
                                options={{
                                    voyager: "CARTO Voyager",
                                    light: "CARTO Light",
                                    dark: "CARTO Dark",
                                    transport: "Thunderforest Transport",
                                    neighbourhood:
                                        "Thunderforest Neighbourhood",
                                    osmcarto: "OpenStreetMap Carto",
                                }}
                                value={$baseTileLayer}
                                onValueChange={(v) =>
                                    baseTileLayer.set(v as any)
                                }
                            />
                            <div className="flex flex-col items-center gap-2">
                                <Label>{t("Clave de Thunderforest")}</Label>
                                <Input
                                    type="text"
                                    value={$thunderforestApiKey}
                                    id="thunderforestApiKey"
                                    onChange={(e) =>
                                        thunderforestApiKey.set(e.target.value)
                                    }
                                    placeholder={t(
                                        "Escribe tu clave de Thunderforest",
                                    )}
                                />
                                <p className="text-xs text-gray-500">
                                    {t(
                                        "Hace falta para los estilos de Thunderforest. Crea una clave",
                                    )}{" "}
                                    <a
                                        href="https://manage.thunderforest.com/users/sign_up?price=hobby-project-usd"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 cursor-pointer"
                                    >
                                        {t("aquí")}
                                    </a>
                                    {t(". Es gratis.")}
                                </p>
                            </div>
                            <Separator className="bg-slate-300 w-[280px]" />
                            <Label>{t("Servidor de Overpass")}</Label>
                            <Select
                                trigger={t("Servidor de Overpass")}
                                options={{
                                    ...Object.fromEntries(
                                        Object.entries(OVERPASS_HOSTS).map(
                                            ([label, url]) => [url, label],
                                        ),
                                    ),
                                    custom: t("Otra dirección"),
                                }}
                                value={$overpassHost}
                                onValueChange={(v) =>
                                    overpassHost.set(v as any)
                                }
                            />
                            {$overpassHost === "custom" && (
                                <div className="flex flex-col items-center gap-2 w-full">
                                    <Input
                                        type="text"
                                        value={$overpassCustomHost}
                                        onChange={(e) =>
                                            overpassCustomHost.set(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="https://your-overpass-instance/api/interpreter"
                                    />
                                </div>
                            )}
                            <p className="text-xs text-gray-500 text-center">
                                {$overpassHost === "custom"
                                    ? t("Si este falla, se probarán los demás.")
                                    : t(
                                          "Si el elegido falla, se probarán los demás.",
                                      )}
                            </p>
                            <Separator className="bg-slate-300 w-[280px]" />
                            <Label>{t("Capa fija en el mapa")}</Label>
                            <div className="flex flex-row max-[330px]:flex-col gap-4">
                                <Button
                                    onClick={() => permanentOverlay.set(null)}
                                >
                                    {t("Quitar")}
                                </Button>
                                <Button
                                    onClick={async () => {
                                        if (!navigator || !navigator.clipboard)
                                            return toast.error(
                                                t(
                                                    "Tu navegador no permite usar el portapapeles.",
                                                ),
                                            );

                                        try {
                                            const clipboard =
                                                await navigator.clipboard.readText();
                                            const geojson =
                                                JSON.parse(clipboard);
                                            permanentOverlay.set(geojson);
                                        } catch (e) {
                                            toast.error(
                                                t(
                                                    "GeoJSON no válido: {error}",
                                                    { error: String(e) },
                                                ),
                                            );
                                        }
                                    }}
                                >
                                    {t("Pegar GeoJSON")}
                                </Button>
                            </div>
                            <Separator className="bg-slate-300 w-[280px]" />
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Animar los movimientos del mapa?")}
                                </label>
                                <Checkbox
                                    checked={$animateMapMovements}
                                    onCheckedChange={() => {
                                        animateMapMovements.set(
                                            !$animateMapMovements,
                                        );
                                    }}
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Modo planificación?")}
                                </label>
                                <Checkbox
                                    checked={$planningMode}
                                    onCheckedChange={() => {
                                        if ($planningMode === true) {
                                            const map = leafletMapContext.get();

                                            if (map) {
                                                map.eachLayer((layer: any) => {
                                                    if (
                                                        layer.questionKey ||
                                                        layer.questionKey === 0
                                                    ) {
                                                        map.removeLayer(layer);
                                                    }
                                                });
                                            }
                                        } else {
                                            questions.set([...questions.get()]); // I think that this should always be auto-saved
                                        }

                                        planningModeEnabled.set(!$planningMode);
                                    }}
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Guardar automáticamente?")}
                                </label>
                                <Checkbox
                                    checked={$autoSave}
                                    onCheckedChange={() =>
                                        autoSave.set(!$autoSave)
                                    }
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Zoom automático?")}
                                </label>
                                <Checkbox
                                    checked={$autoZoom}
                                    onCheckedChange={() =>
                                        autoZoom.set(!$autoZoom)
                                    }
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Seguir mi posición (GPS)?")}
                                </label>
                                <Checkbox
                                    checked={$followMe}
                                    onCheckedChange={() =>
                                        followMe.set(!$followMe)
                                    }
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t(
                                        "¿Preguntas personalizadas por defecto?",
                                    )}
                                </label>
                                <Checkbox
                                    checked={$defaultCustomQuestions}
                                    onCheckedChange={() =>
                                        defaultCustomQuestions.set(
                                            !$defaultCustomQuestions,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Permitir Plus Codes de Google?")}
                                </label>
                                <Checkbox
                                    checked={$allowGooglePlusCodes}
                                    onCheckedChange={() =>
                                        allowGooglePlusCodes.set(
                                            !$allowGooglePlusCodes,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-2xl font-semibold font-poppins">
                                    {t("¿Modo escondido?")}
                                </label>
                                <Checkbox
                                    checked={!!$hiderMode}
                                    onCheckedChange={() => {
                                        if ($hiderMode === false) {
                                            const $leafletMapContext =
                                                leafletMapContext.get();

                                            if ($leafletMapContext) {
                                                const center =
                                                    $leafletMapContext.getCenter();
                                                hiderMode.set({
                                                    latitude: center.lat,
                                                    longitude: center.lng,
                                                });
                                            } else {
                                                hiderMode.set({
                                                    latitude: 0,
                                                    longitude: 0,
                                                });
                                            }
                                        } else {
                                            hiderMode.set(false);
                                        }
                                    }}
                                />
                            </div>
                            {$hiderMode !== false && (
                                <SidebarMenu>
                                    <LatitudeLongitude
                                        latitude={$hiderMode.latitude}
                                        longitude={$hiderMode.longitude}
                                        inlineEdit
                                        onChange={(latitude, longitude) => {
                                            $hiderMode.latitude =
                                                latitude ?? $hiderMode.latitude;
                                            $hiderMode.longitude =
                                                longitude ??
                                                $hiderMode.longitude;

                                            if ($autoSave) {
                                                hiderMode.set({
                                                    ...$hiderMode,
                                                });
                                            } else {
                                                triggerLocalRefresh.set(
                                                    Math.random(),
                                                );
                                            }
                                        }}
                                        label={t("Posición del escondido")}
                                    />
                                    {!autoSave && (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500 mt-2"
                                                onClick={save}
                                            >
                                                {t("Guardar")}
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )}
                                </SidebarMenu>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
};
