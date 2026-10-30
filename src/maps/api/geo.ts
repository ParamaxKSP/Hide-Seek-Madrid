import type { LatLngTuple } from "leaflet";

import { t } from "@/i18n";

import type { APILocations, OpenStreetMap } from "./types";

export const convertToLongLat = (coordinates: LatLngTuple): number[] => {
    return [coordinates[1], coordinates[0]];
};

export const convertToLatLong = (coordinates: number[]): LatLngTuple => {
    return [coordinates[1], coordinates[0]];
};

const LOCATION_NAMES: Partial<Record<APILocations, [string, string]>> = {
    aquarium: ["Acuario", "Acuarios"],
    hospital: ["Hospital", "Hospitales"],
    peak: ["Montaña", "Montañas"],
    museum: ["Museo", "Museos"],
    theme_park: ["Parque de atracciones", "Parques de atracciones"],
    zoo: ["Zoo", "Zoos"],
    cinema: ["Cine", "Cines"],
    library: ["Biblioteca", "Bibliotecas"],
    golf_course: ["Campo de golf", "Campos de golf"],
    consulate: ["Consulado", "Consulados"],
    park: ["Parque", "Parques"],
};

export const prettifyLocation = (
    location: APILocations,
    plural: boolean = false,
): string => {
    const names = LOCATION_NAMES[location];
    return names ? t(names[plural ? 1 : 0]) : String(location);
};

export const determineName = (feature: OpenStreetMap) => {
    const props = feature.properties;
    if (props.osm_type === "R") {
        const parts = [props.name, props.state, props.country].filter(Boolean);
        return parts.join(", ");
    } else {
        const parts = [
            (props as any).housenumber
                ? `${(props as any).housenumber} ${(props as any).street}`
                : (props as any).street,
            (props as any).city,
            (props as any).county,
            props.state,
            props.country,
        ].filter(Boolean);
        return parts.join(", ");
    }
};
