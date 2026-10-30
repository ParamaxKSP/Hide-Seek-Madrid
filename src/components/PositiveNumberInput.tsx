import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** «1,5» o «1.5» → 1.5; null si no es un número mayor que cero. */
export const parsePositive = (text: string): number | null => {
    const n = Number(text.trim().replace(",", "."));
    return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Campo para radios y distancias. Mientras se escribe se puede dejar vacío,
 * pero solo se guarda un número mayor que cero; al salir del campo con un
 * valor no válido vuelve al último bueno.
 */
export const PositiveNumberInput = ({
    value,
    onChange,
    disabled,
    className,
}: {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
}) => {
    const [text, setText] = useState(String(value));

    // Si el valor cambia desde fuera (otra pregunta, cargar archivo…), se muestra.
    useEffect(() => {
        if (parsePositive(text) !== value) setText(String(value));
    }, [value]);

    const invalid = parsePositive(text) === null;

    return (
        <Input
            type="text"
            inputMode="decimal"
            className={cn(
                "rounded-md p-2 w-16",
                invalid && "border-orange-500",
                className,
            )}
            value={text}
            disabled={disabled}
            onChange={(e) => {
                setText(e.target.value);
                const n = parsePositive(e.target.value);
                if (n !== null && n !== value) onChange(n);
            }}
            onBlur={() => {
                if (invalid) setText(String(value));
            }}
        />
    );
};
