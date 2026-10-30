import { useStore } from "@nanostores/react";
import { Label } from "@radix-ui/react-label";
import * as React from "react";
import { Suspense, use } from "react";

import CustomInitDialog from "@/components/CustomInitDialog";
import { LatitudeLongitude } from "@/components/LatLngPicker";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/i18n";
import {
    customInitPreference,
    drawingQuestionKey,
    gameSize,
    hiderMode,
    isLoading,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import { typeChoices } from "@/maps/catalog";
import { ADMIN_LEVEL_OPTIONS } from "@/maps/madrid-categories";
import {
    determineMeasuringBoundary,
    findAdminZoneInfo,
} from "@/maps/questions/measuring";
import type { MeasuringQuestion } from "@/maps/schema";

import { AltitudeInfo } from "./AltitudeInfo";
import { QuestionCard } from "./base";

export const MeasuringQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: MeasuringQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $gameSize = useStore(gameSize);
    const $customInitPref = useStore(customInitPreference);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const label = `${t("Medición")}
    ${
        $questions
            .filter((q) => q.id === "measuring")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    let questionSpecific = <></>;

    switch (data.type) {
        case "admin-measure":
            questionSpecific = (
                <>
                    <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                        <Select
                            trigger={t("División administrativa")}
                            options={ADMIN_LEVEL_OPTIONS}
                            value={(
                                (data as any).cat?.adminLevel ?? 4
                            ).toString()}
                            onValueChange={(value) => {
                                if (!(data as any).cat) {
                                    (data as any).cat = { adminLevel: 4 };
                                }
                                (data as any).cat.adminLevel = parseInt(
                                    value,
                                ) as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
                                (data as any).cat.zoneName = undefined;
                                questionModified();
                            }}
                            disabled={!data.drag || $isLoading}
                        />
                    </SidebarMenuItem>
                    <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center w-full h-[3rem]">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="animate-spin"
                                    >
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                </div>
                            }
                        >
                            <AdminZoneNameDisplay data={data} />
                        </Suspense>
                    </SidebarMenuItem>
                </>
            );
            break;
        case "altitude":
            questionSpecific = (
                <AltitudeInfo
                    data={data as any}
                    disabled={!data.drag || $isLoading}
                />
            );
            break;
        case "mcdonalds":
        case "seven11":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    {t(
                        "Esta pregunta elimina las zonas de escondite que no cumplen el criterio. Al pulsar una zona se elimina la parte de ella que no lo cumple.",
                    )}
                </span>
            );
            break;
        case "aquarium":
        case "hospital":
        case "peak":
        case "museum":
        case "theme_park":
        case "zoo":
        case "cinema":
        case "library":
        case "golf_course":
        case "consulate":
        case "park":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    {t(
                        "Esta pregunta solo cambia el mapa cuando pulsas una zona en la barra de zonas de escondite.",
                    )}
                </span>
            );
            break;
        case "custom-measure":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="px-2 mb-1 text-center text-orange-500">
                            {t("Para cambiar la pregunta, actívalo:")}
                            <Checkbox
                                className="mx-1 my-1"
                                checked={$drawingQuestionKey === questionKey}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        drawingQuestionKey.set(questionKey);
                                    } else {
                                        drawingQuestionKey.set(-1);
                                    }
                                }}
                                disabled={!data.drag || $isLoading}
                            />
                            {t(
                                "y usa los botones de abajo a la izquierda del mapa.",
                            )}
                        </p>
                        <div className="flex justify-center mb-2">
                            <PresetsDialog
                                data={data}
                                presetTypeHint={data.type}
                            />
                        </div>
                    </>
                );
            }
            break;
    }

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            collapsed={data.collapsed}
            setCollapsed={(collapsed) => {
                data.collapsed = collapsed; // Doesn't trigger a re-render so no need for questionModified
            }}
            locked={!data.drag}
            setLocked={(locked) => questionModified((data.drag = !locked))}
            hidden={data.hidden}
            setHidden={(hidden) => questionModified((data.hidden = hidden))}
        >
            <CustomInitDialog
                open={customDialogOpen}
                onOpenChange={setCustomDialogOpen}
                onBlank={async () => {
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    } else {
                        (data as any).geo.features = [];
                    }
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
                onPrefill={async () => {
                    const boundary = await determineMeasuringBoundary(data);
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    }
                    (data as any).geo.features = boundary ? boundary : [];
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
            />
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger={t("Tipo de pregunta")}
                    {...typeChoices("measuring", $gameSize, data.type)}
                    value={data.type}
                    onValueChange={async (value) => {
                        if (value === "custom-measure") {
                            if ($customInitPref === "ask") {
                                setCustomDialogOpen(true);
                                return;
                            }
                            if ($customInitPref === "blank") {
                                if (!(data as any).geo) {
                                    (data as any).geo = {
                                        type: "FeatureCollection",
                                        features: [],
                                    };
                                } else {
                                    (data as any).geo.features = [];
                                }
                            } else if ($customInitPref === "prefill") {
                                const boundary =
                                    await determineMeasuringBoundary(data);
                                if (!(data as any).geo) {
                                    (data as any).geo = {
                                        type: "FeatureCollection",
                                        features: [],
                                    };
                                }
                                (data as any).geo.features = boundary
                                    ? boundary
                                    : [];
                            }
                            data.type = value;
                            questionModified();
                            return;
                        }
                        if (value === "admin-measure" && !(data as any).cat) {
                            (data as any).cat = { adminLevel: 4 };
                        }
                        data.type = value;
                        questionModified();
                    }}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            {questionSpecific}
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) => {
                    if (lat !== null) {
                        data.lat = lat;
                    }
                    if (lng !== null) {
                        data.lng = lng;
                    }
                    questionModified();
                }}
                disabled={!data.drag || $isLoading}
            />
            <div className="flex gap-2 items-center p-2">
                <Label
                    className={cn(
                        "font-semibold text-lg",
                        $isLoading && "text-muted-foreground",
                    )}
                >
                    {t("Resultado")}
                </Label>
                <ToggleGroup
                    className="grow"
                    type="single"
                    value={data.hiderCloser ? "closer" : "further"}
                    onValueChange={(value: "closer" | "further") =>
                        questionModified(
                            (data.hiderCloser = value === "closer"),
                        )
                    }
                    disabled={!!$hiderMode || !data.drag || $isLoading}
                >
                    <ToggleGroupItem value="further">
                        {t("Escondido más lejos")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="closer">
                        {t("Escondido más cerca")}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </QuestionCard>
    );
};

const AdminZoneNameDisplay = ({ data }: { data: MeasuringQuestion }) => {
    useStore(triggerLocalRefresh);

    const adminLevel = (data as any).cat?.adminLevel ?? 4;
    const zoneInfo = use(findAdminZoneInfo(data.lat, data.lng, adminLevel));

    // Update the zone name in the data
    if (
        zoneInfo &&
        (data as any).cat &&
        (data as any).cat.zoneName !== zoneInfo.name
    ) {
        (data as any).cat.zoneName = zoneInfo.name;
        questionModified();
    }

    if (!zoneInfo) {
        return (
            <div className="flex items-center justify-center w-full h-[3rem] text-muted-foreground text-sm">
                {t("No se ha encontrado la zona")}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full h-[3rem]">
            <Label className="text-xs text-muted-foreground">{t("Zona")}</Label>
            <span className="font-medium text-sm truncate max-w-full">
                {zoneInfo.name}
            </span>
        </div>
    );
};
