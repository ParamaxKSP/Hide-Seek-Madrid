import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "leaflet-contextmenu";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as L from "leaflet";
import osmtogeojson from "osmtogeojson";
import { useEffect, useMemo } from "react";
import { MapContainer, ScaleControl, TileLayer } from "react-leaflet";
import { toast } from "react-toastify";

import { t } from "@/i18n";
import { gameClock, roundEndgame, roundHistory } from "@/lib/clock";
import {
    additionalMapGeoLocations,
    addQuestion,
    ALL_STATIONS,
    animateMapMovements,
    autoZoom,
    baseTileLayer,
    disabledLines,
    disabledStations,
    displayHidingZonesOptions,
    followMe,
    gameSize,
    HIDER_ANSWER_FIELDS,
    hiderAnswered,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    leafletMapContext,
    mapGeoJSON,
    mapGeoLocation,
    permanentOverlay,
    planningModeEnabled,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    questionSignature,
    showStationMarkers,
    showTransitLines,
    thunderforestApiKey,
    triggerLocalRefresh,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import { applyQuestionsToMapGeoData, holedMask } from "@/maps";
import { hiderifyQuestion } from "@/maps";
import {
    clearCache,
    determineMapBoundaries,
    findPlacesInZone,
} from "@/maps/api";
import { isStationDisabled, loadTransitLines } from "@/maps/api/local";
import { categoryAvailable } from "@/maps/catalog";
import { safeUnion } from "@/maps/geo-utils/operators";
import { extractStationLabel } from "@/maps/geo-utils/special";

import { DraggableMarkers } from "./DraggableMarkers";
import { LeafletFullScreenButton } from "./LeafletFullScreenButton";
import { MapPrint } from "./MapPrint";
import { PolygonDraw } from "./PolygonDraw";

const getTileLayer = (tileLayer: string, thunderforestApiKey: string) => {
    switch (tileLayer) {
        case "light":
            return (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="https://carto.com/attributions">CARTO</a>; Powered by Esri and Turf.js'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
                    subdomains="abcd"
                    maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
                    minZoom={2}
                    noWrap
                />
            );

        case "dark":
            return (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="https://carto.com/attributions">CARTO</a>; Powered by Esri and Turf.js'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
                    subdomains="abcd"
                    maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
                    minZoom={2}
                    noWrap
                />
            );

        case "transport":
            if (thunderforestApiKey)
                return (
                    <TileLayer
                        url={`https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=${thunderforestApiKey}`}
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="http://www.thunderforest.com/">Thunderforest</a>; Powered by Esri and Turf.js'
                        maxZoom={22}
                        minZoom={2}
                        noWrap
                    />
                );
            break;

        case "neighbourhood":
            if (thunderforestApiKey)
                return (
                    <TileLayer
                        url={`https://tile.thunderforest.com/neighbourhood/{z}/{x}/{y}.png?apikey=${thunderforestApiKey}`}
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="http://www.thunderforest.com/">Thunderforest</a>; Powered by Esri and Turf.js'
                        maxZoom={22}
                        minZoom={2}
                        noWrap
                    />
                );
            break;

        case "osmcarto":
            return (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; Powered by Esri and Turf.js'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                    minZoom={2}
                    noWrap
                />
            );
    }

    return (
        <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="https://carto.com/attributions">CARTO</a>; Powered by Esri and Turf.js'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
            subdomains="abcd"
            maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
            minZoom={2}
            noWrap
        />
    );
};

export const Map = ({ className }: { className?: string }) => {
    useStore(additionalMapGeoLocations);
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $questions = useStore(questions);
    const $baseTileLayer = useStore(baseTileLayer);
    const $thunderforestApiKey = useStore(thunderforestApiKey);
    const $hiderMode = useStore(hiderMode);
    const $isLoading = useStore(isLoading);
    const $followMe = useStore(followMe);
    const $permanentOverlay = useStore(permanentOverlay);
    const $showTransitLines = useStore(showTransitLines);
    const $showStationMarkers = useStore(showStationMarkers);
    const $displayHidingZonesOptions = useStore(displayHidingZonesOptions);
    const $disabledStations = useStore(disabledStations);
    const $disabledLines = useStore(disabledLines);
    const $mapGeoJSON = useStore(mapGeoJSON);
    const $roundHistory = useStore(roundHistory);
    const $gameClock = useStore(gameClock);
    // Cambia solo al empezar o cancelar un endgame (no cada segundo).
    const endgameKey = JSON.stringify(roundEndgame($gameClock).active);
    const map = useStore(leafletMapContext);

    const followMeMarkerRef = useMemo(
        () => ({ current: null as L.Marker | null }),
        [],
    );
    const geoWatchIdRef = useMemo(
        () => ({ current: null as number | null }),
        [],
    );

    const refreshQuestions = async (focus: boolean = false) => {
        if (!map) return;

        if ($isLoading) return;

        isLoading.set(true);

        if ($questions.length === 0) {
            await clearCache();
        }

        let mapGeoData = mapGeoJSON.get();

        if (!mapGeoData) {
            const polyGeoData = polyGeoJSON.get();
            if (polyGeoData) {
                mapGeoData = polyGeoData;
                mapGeoJSON.set(polyGeoData);
            } else {
                await toast.promise(
                    determineMapBoundaries()
                        .then((x) => {
                            mapGeoJSON.set(x);
                            mapGeoData = x;
                        })
                        .catch((error) => console.log(error)),
                    {
                        error: t("Error al actualizar el mapa"),
                    },
                );
            }
        }

        if ($hiderMode !== false) {
            // Cada pregunta se responde una vez, con la posición de ese
            // momento; solo se vuelve a responder si cambia la pregunta.
            const answered = { ...hiderAnswered.get() };
            for (const question of $questions) {
                const data = question.data as Record<string, unknown>;
                const saved = answered[question.key];
                if (saved && saved.sig === questionSignature(question)) {
                    // Ya respondida: se mantiene la respuesta de entonces.
                    Object.assign(data, saved.answer);
                    continue;
                }
                await hiderifyQuestion(question);
                answered[question.key] = {
                    sig: questionSignature(question),
                    answer: Object.fromEntries(
                        HIDER_ANSWER_FIELDS.filter((k) => k in data).map(
                            (k) => [k, data[k]],
                        ),
                    ),
                };
            }
            hiderAnswered.set(answered);

            triggerLocalRefresh.set(Math.random()); // Refresh the question sidebar with new information but not this map
        }

        map.eachLayer((layer: any) => {
            if (layer.questionKey || layer.questionKey === 0) {
                map.removeLayer(layer);
            }
        });

        // Endgame: el escondido ha confirmado su estación. Se parte de su zona
        // de escondite entera (las preguntas de antes no cuentan) y las
        // preguntas que se hagan después la siguen recortando.
        const endgame = roundEndgame(gameClock.get()).active;
        let toApply = $questions;
        if (endgame && mapGeoData) {
            const circle = turf.circle(
                [endgame.lng, endgame.lat],
                hidingRadius.get(),
                { units: hidingRadiusUnits.get(), steps: 64 },
            );
            const whole =
                (mapGeoData as any).type === "FeatureCollection"
                    ? safeUnion(mapGeoData as any)
                    : mapGeoData;
            const area = turf.intersect(
                turf.featureCollection([circle, whole as any]),
            );
            mapGeoData = turf.featureCollection([
                (area ?? circle) as any,
            ]) as any;
            toApply = $questions.filter((q) => !endgame.before.includes(q.key));
        }

        try {
            mapGeoData = await applyQuestionsToMapGeoData(
                toApply,
                mapGeoData,
                planningModeEnabled.get(),
                (geoJSONObj, question) => {
                    const geoJSONPlane = L.geoJSON(geoJSONObj);
                    // @ts-expect-error This is a check such that only this type of layer is removed
                    geoJSONPlane.questionKey = question.key;
                    geoJSONPlane.addTo(map);
                },
            );

            mapGeoData = {
                type: "FeatureCollection",
                features: [holedMask(mapGeoData!)!],
            };

            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    map.removeLayer(layer);
                }
            });

            const g = L.geoJSON(mapGeoData);
            // @ts-expect-error This is a check such that only this type of layer is removed
            g.eliminationGeoJSON = true;
            g.addTo(map);

            questionFinishedMapData.set(mapGeoData);

            if (autoZoom.get() && focus) {
                const bbox = turf.bbox(holedMask(mapGeoData) as any);
                const bounds = [
                    [bbox[1], bbox[0]],
                    [bbox[3], bbox[2]],
                ];

                if (animateMapMovements.get()) {
                    map.flyToBounds(bounds as any);
                } else {
                    map.fitBounds(bounds as any);
                }
            }
        } catch (error) {
            console.log(error);

            isLoading.set(false);
            if (document.querySelectorAll(".Toastify__toast").length === 0) {
                return toast.error(
                    t("No queda ninguna zona posible (o ha habido un error)"),
                );
            }
        } finally {
            isLoading.set(false);
        }
    };

    const displayMap = useMemo(
        () => (
            <MapContainer
                center={$mapGeoLocation.geometry.coordinates}
                zoom={5}
                className={cn("w-[500px] h-[500px]", className)}
                ref={leafletMapContext.set}
                // @ts-expect-error Typing doesn't update from react-contextmenu
                contextmenu={true}
                contextmenuWidth={140}
                contextmenuItems={[
                    {
                        text: t("Añadir radar"),
                        callback: (e: any) =>
                            addQuestion({
                                id: "radius",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            }),
                    },
                    {
                        text: t("Añadir termómetro"),
                        callback: (e: any) => {
                            const destination = turf.destination(
                                [e.latlng.lng, e.latlng.lat],
                                5,
                                90,
                                {
                                    units: "miles",
                                },
                            );

                            addQuestion({
                                id: "thermometer",
                                data: {
                                    latA: e.latlng.lat,
                                    lngA: e.latlng.lng,
                                    latB: destination.geometry.coordinates[1],
                                    lngB: destination.geometry.coordinates[0],
                                },
                            });
                        },
                    },
                    {
                        text: t("Añadir tentáculos"),
                        callback: (e: any) => {
                            if (!categoryAvailable("tentacles", gameSize.get()))
                                return toast.info(
                                    t("En partida pequeña no hay tentáculos."),
                                );
                            addQuestion({
                                id: "tentacles",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: t("Añadir coincidencia"),
                        callback: (e: any) => {
                            addQuestion({
                                id: "matching",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: t("Añadir medición"),
                        callback: (e: any) => {
                            addQuestion({
                                id: "measuring",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: t("Excluir país"),
                        callback: (e: any) => {
                            addQuestion({
                                id: "matching",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                    same: false,
                                    cat: {
                                        adminLevel: 2,
                                    },
                                    type: "zone",
                                },
                            });
                        },
                    },
                    {
                        text: t("Copiar coordenadas"),
                        callback: (e: any) => {
                            if (!navigator || !navigator.clipboard) {
                                toast.error(
                                    t(
                                        "Tu navegador no permite usar el portapapeles.",
                                    ),
                                );
                                return;
                            }

                            const latitude = e.latlng.lat;
                            const longitude = e.latlng.lng;

                            toast.promise(
                                navigator.clipboard.writeText(
                                    `${Math.abs(latitude)}°${latitude > 0 ? "N" : "S"}, ${Math.abs(
                                        longitude,
                                    )}°${longitude > 0 ? "E" : "W"}`,
                                ),
                                {
                                    pending: t("Copiando…"),
                                    success: t("Coordenadas copiadas"),
                                    error: t("No se ha podido copiar"),
                                },
                                { autoClose: 1000 },
                            );
                        },
                    },
                ]}
            >
                {getTileLayer($baseTileLayer, $thunderforestApiKey)}
                <DraggableMarkers />
                <div className="leaflet-top leaflet-right">
                    <div className="leaflet-control flex-col flex gap-2">
                        <LeafletFullScreenButton />
                    </div>
                </div>
                <PolygonDraw />
                <ScaleControl position="bottomleft" imperial={false} />
                <MapPrint
                    position="topright"
                    sizeModes={["Current", "A4Portrait", "A4Landscape"]}
                    hideControlContainer={false}
                    hideClasses={[
                        "leaflet-full-screen-specific-name",
                        "leaflet-top",
                        "leaflet-control-easyPrint",
                        "leaflet-draw",
                    ]}
                    title={t("Imprimir")}
                />
            </MapContainer>
        ),
        [map, $baseTileLayer, $thunderforestApiKey],
    );

    useEffect(() => {
        if (!map) return;

        refreshQuestions(true);
    }, [$questions, map, $hiderMode, endgameKey]);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (!map) return;
            let layerCount = 0;
            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    layerCount++;
                }
            });
            if (layerCount > 1) {
                console.log("Too many layers, refreshing...");
                refreshQuestions(false);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [map]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const mainElement: HTMLElement | null =
                document.querySelector("main");

            if (mainElement) {
                if (document.fullscreenElement) {
                    mainElement.classList.add("fullscreen");
                } else {
                    mainElement.classList.remove("fullscreen");
                }
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
        };
    }, []);

    useEffect(() => {
        if (!map) return;
        if (!$followMe) {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            if (geoWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
            return;
        }

        geoWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (followMeMarkerRef.current) {
                    followMeMarkerRef.current.setLatLng([lat, lng]);
                } else {
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: `<div class="text-blue-700 bg-white rounded-full border-2 border-blue-700 shadow w-5 h-5 flex items-center justify-center"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2A81CB" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#2A81CB"/></svg></div>`,
                            className: "",
                        }),
                        zIndexOffset: 1000,
                    });
                    marker.addTo(map);
                    followMeMarkerRef.current = marker;
                }
            },
            () => {
                toast.error(t("No se puede acceder a tu ubicación."));
                followMe.set(false);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
        );
        return () => {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            if (geoWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
        };
    }, [$followMe, map]);

    useEffect(() => {
        if (!map) return;

        map.eachLayer((layer: any) => {
            if (layer.permanentGeoJSON) map.removeLayer(layer);
        });

        if ($permanentOverlay === null) return;

        try {
            const overlay = L.geoJSON($permanentOverlay, {
                interactive: false,

                // @ts-expect-error Type hints force a Layer to be returned, but Leaflet accepts null as well
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                pointToLayer(geoJsonPoint, latlng) {
                    return null;
                },

                style(feature) {
                    return {
                        color: feature?.properties?.stroke,
                        weight: feature?.properties?.["stroke-width"],
                        opacity: feature?.properties?.["stroke-opacity"],
                        fillColor: feature?.properties?.fill,
                        fillOpacity: feature?.properties?.["fill-opacity"],
                    };
                },
            });
            // @ts-expect-error This is a check such that only this type of layer is removed
            overlay.permanentGeoJSON = true;
            overlay.addTo(map);
            overlay.bringToBack();
        } catch (e) {
            toast.error(`Failed to display GeoJSON overlay: ${e}`);
        }
    }, [$permanentOverlay, map]);

    // Líneas de Metro, Metro Ligero y Cercanías, bajo las zonas y las preguntas.
    useEffect(() => {
        if (!map) return;
        if (!map.getPane("transitLines")) {
            const pane = map.createPane("transitLines");
            pane.style.zIndex = "350";
            pane.style.pointerEvents = "none";
        }
        const group = L.layerGroup();
        let cancelled = false;
        if ($showTransitLines) {
            loadTransitLines()
                .then((lines) => {
                    if (cancelled) return;
                    // Cercanías debajo, luego Metro Ligero y Metro encima.
                    const order = { cercanias: 0, ligero: 1, metro: 2 };
                    [...lines]
                        .sort((a, b) => order[a.system] - order[b.system])
                        .forEach((line) => {
                            const off = $disabledLines.includes(line.id);
                            const color =
                                line.color === "#FFFFFF"
                                    ? line.textColor
                                    : line.color;
                            line.shapes.forEach((shape) =>
                                L.polyline(shape, {
                                    pane: "transitLines",
                                    color,
                                    weight: line.system === "cercanias" ? 4 : 3,
                                    opacity: off ? 0.2 : 0.85,
                                    dashArray: off ? "4 6" : undefined,
                                    interactive: false,
                                }).addTo(group),
                            );
                        });
                    group.addTo(map);
                })
                .catch(() => {
                    toast.error("No se han podido cargar las líneas.", {
                        toastId: "transit-lines-error",
                    });
                });
        }
        return () => {
            cancelled = true;
            map.removeLayer(group);
        };
    }, [map, $showTransitLines, $disabledLines]);

    // Todas las estaciones de los tipos elegidos, como puntos pequeños sobre
    // las líneas (sin tener que mostrar las zonas de escondite).
    useEffect(() => {
        if (!map) return;
        if (!map.getPane("stationMarkers")) {
            const pane = map.createPane("stationMarkers");
            pane.style.zIndex = "360";
        }
        const group = L.layerGroup();
        let cancelled = false;
        if ($showStationMarkers) {
            const types = $displayHidingZonesOptions.length
                ? $displayHidingZonesOptions
                : [ALL_STATIONS];
            findPlacesInZone(
                types[0],
                undefined,
                "nwr",
                "center",
                types.slice(1),
            )
                .then((data) => {
                    if (cancelled) return;
                    for (const f of osmtogeojson(data).features as any[]) {
                        const props = f.properties ?? {};
                        if (
                            isStationDisabled(
                                props,
                                $disabledStations,
                                $disabledLines,
                            )
                        )
                            continue;
                        const [lng, lat] = turf.getCoord(turf.centroid(f)) as [
                            number,
                            number,
                        ];
                        L.circleMarker([lat, lng], {
                            pane: "stationMarkers",
                            radius: 3.5,
                            weight: 1.5,
                            color: "#1f2937",
                            fillColor: "#ffffff",
                            fillOpacity: 1,
                        })
                            .bindTooltip(extractStationLabel(f) ?? "", {
                                direction: "top",
                            })
                            .addTo(group);
                    }
                    group.addTo(map);
                })
                .catch(() => {
                    toast.error(t("No se han podido cargar las estaciones."), {
                        toastId: "station-markers-error",
                    });
                });
        }
        return () => {
            cancelled = true;
            map.removeLayer(group);
        };
    }, [
        map,
        $showStationMarkers,
        $displayHidingZonesOptions,
        $disabledStations,
        $disabledLines,
        $mapGeoJSON,
    ]);

    // Estaciones reveladas al hacer Move en esta ronda.
    useEffect(() => {
        if (!map) return;
        const group = L.layerGroup();
        $roundHistory.forEach((move, i) => {
            if (!move.station) return;
            L.circleMarker([move.station.lat, move.station.lng], {
                radius: 9,
                color: "#7c3aed",
                weight: 3,
                fillColor: "#c4b5fd",
                fillOpacity: 0.9,
            })
                .bindTooltip(
                    `Move ${i + 1}: el escondido estaba en ${move.station.name}`,
                )
                .addTo(group);
        });
        group.addTo(map);
        return () => {
            map.removeLayer(group);
        };
    }, [map, $roundHistory]);

    return displayMap;
};
