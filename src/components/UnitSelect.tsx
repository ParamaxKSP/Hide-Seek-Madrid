import { t } from "@/i18n";
import type { Units } from "@/maps/schema";

import { Select } from "./ui/select";

export const UnitSelect = ({
    unit,
    onChange,
    disabled,
}: {
    unit: Units;
    onChange: (unit: Units) => void;
    disabled?: boolean;
}) => {
    return (
        <Select
            trigger={t("Unidad")}
            options={{
                kilometers: t("Kilómetros"),
                meters: t("Metros"),
                miles: t("Millas"),
            }}
            disabled={disabled}
            value={unit}
            onValueChange={onChange}
        />
    );
};
