import "leaflet-draw/dist/leaflet.draw.css";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type {
    FeatureCollection,
    MultiPolygon,
    Polygon as GeoJSONPolygon,
} from "geojson";
import * as L from "leaflet";
import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { FeatureGroup, Marker, Polygon, Polyline } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";

import { t } from "@/i18n";
import {
    autoSave,
    drawingQuestionKey,
    mapGeoJSON,
    polyGeoJSON,
    questionModified,
    questions,
    save,
} from "@/lib/context";
import { CacheType, clearCache } from "@/maps/api";
import { lngLatToText } from "@/maps/geo-utils";
import type {
    CustomMatchingQuestion,
    CustomMeasuringQuestion,
    CustomTentacleQuestion,
    Question,
} from "@/maps/schema";

import { LatitudeLongitude } from "./LatLngPicker";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input } from "./ui/input";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./ui/sidebar-l";

const swapCoordinates = (geojson: any) => {
    return JSON.parse(JSON.stringify(geojson), (key, value) => {
        if (
            Array.isArray(value) &&
            value.length >= 2 &&
            typeof value[0] === "number" &&
            typeof value[1] === "number"
        ) {
            return [value[1], value[0], ...value.slice(2)];
        }
        return value;
    });
};

const TentacleMarker = ({
    point,
}: {
    point: CustomTentacleQuestion["places"][number];
}) => {
    const $autoSave = useStore(autoSave);
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                // @ts-expect-error This is passed to options, so it is not typed
                properties={point.properties}
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <Input
                        className="text-center !text-2xl font-bold font-poppins mt-3"
                        value={point.properties?.name}
                        onChange={(e) => {
                            point.properties.name = e.target.value;
                            questionModified();
                        }}
                    />
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={(lat, lng) => {
                                if (lat) {
                                    point.geometry.coordinates[1] = lat;
                                }
                                if (lng) {
                                    point.geometry.coordinates[0] = lng;
                                }

                                questionModified();
                            }}
                        />
                        {!$autoSave && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500 mt-2"
                                    onClick={save}
                                >
                                    Save
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const MatchingPointMarker = ({
    point,
}: {
    point: CustomMatchingQuestion["geo"][number];
}) => {
    const $autoSave = useStore(autoSave);
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                // @ts-expect-error This is passed to options, so it is not typed
                isDialog={true}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={(lat, lng) => {
                                if (lat) {
                                    point.geometry.coordinates[1] = lat;
                                }
                                if (lng) {
                                    point.geometry.coordinates[0] = lng;
                                }

                                questionModified();
                            }}
                        />
                        {!$autoSave && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500 mt-2"
                                    onClick={save}
                                >
                                    Save
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const MeasuringPointMarker = ({
    point,
}: {
    point: CustomMeasuringQuestion["geo"]["features"][number];
}) => {
    const $autoSave = useStore(autoSave);
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                // @ts-expect-error This is passed to options, so it is not typed
                isDialog={true}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={(lat, lng) => {
                                if (lat) {
                                    point.geometry.coordinates[1] = lat;
                                }
                                if (lng) {
                                    point.geometry.coordinates[0] = lng;
                                }

                                questionModified();
                            }}
                        />
                        {!$autoSave && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500 mt-2"
                                    onClick={save}
                                >
                                    Save
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Textos de las herramientas de dibujo de Leaflet.
const translateLeafletDraw = () => {
    const d = L.drawLocal;
    d.draw.toolbar.actions = {
        title: t("Cancelar el dibujo"),
        text: t("Cancelar"),
    };
    d.draw.toolbar.finish = {
        title: t("Terminar el dibujo"),
        text: t("Terminar"),
    };
    d.draw.toolbar.undo = {
        title: t("Borrar el último punto"),
        text: t("Deshacer punto"),
    };
    d.draw.toolbar.buttons.marker = t("Añadir un punto");
    d.draw.handlers.polygon.tooltip = {
        start: t("Pulsa para empezar a dibujar."),
        cont: t("Pulsa para seguir dibujando."),
        end: t("Pulsa el primer punto para cerrar la forma."),
    };
    d.draw.handlers.polyline.error = t(
        "<strong>Error:</strong> los bordes no se pueden cruzar.",
    );
    d.draw.handlers.marker.tooltip = {
        start: t("Pulsa en el mapa para poner el punto."),
    };
    d.edit.toolbar.actions = {
        save: { title: t("Guardar los cambios"), text: t("Guardar") },
        cancel: { title: t("Descartar los cambios"), text: t("Cancelar") },
        clearAll: { title: t("Borrar todo"), text: t("Borrar todo") },
    };
    d.edit.toolbar.buttons = {
        edit: t("Editar"),
        editDisabled: t("No hay nada que editar"),
        remove: t("Borrar"),
        removeDisabled: t("No hay nada que borrar"),
    };
    d.edit.handlers.edit.tooltip = {
        text: t("Arrastra los puntos para cambiar la forma."),
        subtext: t("Pulsa cancelar para deshacer los cambios."),
    };
    d.edit.handlers.remove.tooltip = {
        text: t("Pulsa una forma para borrarla."),
    };
};
translateLeafletDraw();

export const PolygonDraw = () => {
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $questions = useStore(questions);

    const featureRef = useRef<any | null>(null);

    let question: Question | undefined;

    if ($drawingQuestionKey === -1) {
        L.drawLocal.draw.toolbar.buttons.polygon = t("Dibuja la zona de juego");
    } else {
        question = $questions.find((q) => q.key === $drawingQuestionKey);

        if (question?.data.drag === false) {
            drawingQuestionKey.set(-1);
        }
        if (question?.id === "matching") {
            L.drawLocal.draw.toolbar.buttons.polygon = t(
                "Dibuja las zonas de la pregunta",
            );
        }
        if (question?.id === "measuring") {
            L.drawLocal.draw.toolbar.buttons.polygon = t(
                "Dibuja las zonas de la pregunta",
            );
        }
    }

    const onChange = () => {
        if (drawingQuestionKey.get() === -1) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(
                geoJSONs,
            ) as FeatureCollection<GeoJSONPolygon | MultiPolygon>;

            mapGeoJSON.set(geoJSON);
            polyGeoJSON.set(geoJSON);
            questions.set([]);
            clearCache(CacheType.ZONE_CACHE);
        } else if (
            question?.id === "tentacles" &&
            question.data.locationType === "custom"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) => {
                const geoJSON = layer.toGeoJSON();
                geoJSON.properties = layer.options.properties;

                if (!geoJSON.properties) {
                    geoJSON.properties = {
                        name: lngLatToText(geoJSON.geometry.coordinates),
                    };
                }

                return geoJSON;
            });
            const geoJSON = turf.featureCollection(geoJSONs);

            question.data.places = _.uniqBy(
                geoJSON.features as CustomTentacleQuestion["places"],
                (x) => x.geometry.coordinates.join(","),
            ); // Sometimes keys are duplicated
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.properties) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
            questionModified();
        } else if (
            question?.id === "matching" &&
            question.data.type === "custom-zone"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.combine(turf.featureCollection(geoJSONs))
                .features[0];

            question.data.geo = geoJSON;
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isSpecial) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
            questionModified();
        } else if (
            question?.id === "matching" &&
            question.data.type === "custom-points"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(geoJSONs);

            question.data.geo = _.uniqBy(
                geoJSON.features as CustomTentacleQuestion["places"],
                (x) => x.geometry.coordinates.join(","),
            ); // Sometimes keys are duplicated
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isDialog) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
            questionModified();
        } else if (
            question?.id === "measuring" &&
            question.data.type === "custom-measure"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(geoJSONs);

            question.data.geo = turf.featureCollection(
                _.uniqBy(
                    geoJSON.features as CustomTentacleQuestion["places"],
                    (x) => x.geometry.coordinates.join(","),
                ),
            ); // Sometimes keys are duplicated
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isSpecial && !layer.options.isDialog) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
            questionModified();
        }
    };

    useEffect(() => {
        if (featureRef.current && $drawingQuestionKey === -1) {
            featureRef.current.clearLayers();
        }
    }, [$drawingQuestionKey]);

    return (
        <FeatureGroup ref={featureRef}>
            {question &&
                question.id === "tentacles" &&
                question.data.locationType === "custom" &&
                question.data.places.map((x) => (
                    <TentacleMarker
                        key={x.geometry.coordinates.join(",")}
                        point={x}
                    />
                ))}
            {question &&
                question.id === "matching" &&
                question.data.type === "custom-points" &&
                question.data.geo.map((x: any) => (
                    <MatchingPointMarker
                        key={x.geometry.coordinates.join(",")}
                        point={x}
                    />
                ))}
            {question &&
                question.id === "measuring" &&
                question.data.type === "custom-measure" &&
                turf
                    .flatten(question.data.geo)
                    .features.filter((x: any) => turf.getType(x) === "Point")
                    .map((x: any) => (
                        <MeasuringPointMarker
                            key={x.geometry.coordinates.join(",")}
                            point={x}
                        />
                    ))}
            {question &&
                question.id === "measuring" &&
                question.data.type === "custom-measure" &&
                turf
                    .flatten(question.data.geo)
                    .features.filter((x: any) => turf.getType(x) === "Polygon")
                    .map((x: any) => (
                        <Polygon
                            key={x.geometry.coordinates.join(",")}
                            positions={swapCoordinates(x.geometry.coordinates)}
                            // @ts-expect-error This is passed to options, so it is not typed
                            isSpecial={true}
                            stroke
                            pathOptions={{ color: "red" }}
                            fill={false}
                        />
                    ))}
            {question &&
                question.id === "measuring" &&
                question.data.type === "custom-measure" &&
                turf
                    .flatten(question.data.geo)
                    .features.filter(
                        (x: any) => turf.getType(x) === "LineString",
                    )
                    .map((x: any) => (
                        <Polyline
                            key={x.geometry.coordinates.join(",")}
                            positions={swapCoordinates(x.geometry.coordinates)}
                            // @ts-expect-error This is passed to options, so it is not typed
                            isSpecial={true}
                            stroke
                            pathOptions={{ color: "red" }}
                            fill={false}
                        />
                    ))}
            {question &&
                question.id === "matching" &&
                question.data.type === "custom-zone" &&
                question.data.geo &&
                (question.data.geo.type === "FeatureCollection"
                    ? turf.flatten(question.data.geo)
                    : turf.flatten(turf.featureCollection([question.data.geo]))
                ).features.map((x: any) => (
                    <Polygon
                        key={JSON.stringify(x)}
                        positions={swapCoordinates(x.geometry.coordinates)}
                        // @ts-expect-error This is passed to options, so it is not typed
                        isSpecial={true}
                        stroke
                        pathOptions={{ color: "red" }}
                        fill={false}
                    />
                ))}
            <EditControl
                position="bottomleft"
                draw={{
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker:
                        question?.id === "tentacles" ||
                        (question?.id === "matching" &&
                            question.data.type === "custom-points") ||
                        question?.id === "measuring"
                            ? true
                            : false,
                    polyline: question?.id === "measuring",
                    polygon:
                        question?.id === "tentacles" ||
                        (question?.id === "matching" &&
                            question.data.type === "custom-points")
                            ? false
                            : {
                                  shapeOptions: { fillOpacity: 0 },
                              },
                }}
                onCreated={onChange}
                onEdited={onChange}
                onDeleted={onChange}
            />
        </FeatureGroup>
    );
};
