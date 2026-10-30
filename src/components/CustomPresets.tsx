import { useStore } from "@nanostores/react";
import * as React from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import {
    type CustomPreset,
    customPresets,
    deleteCustomPreset,
    saveCustomPreset,
    updateCustomPreset,
} from "@/lib/context";
import { questionModified } from "@/lib/context";

type Props = {
    data: any;
    presetTypeHint: string;
};

const safeClone = (v: any) =>
    typeof structuredClone !== "undefined"
        ? structuredClone(v)
        : JSON.parse(JSON.stringify(v));

const CustomPresets: React.FC<Props> = ({ data, presetTypeHint }) => {
    const $presets = useStore(customPresets);

    const presets = $presets.filter((p) =>
        presetTypeHint ? p.type === presetTypeHint : true,
    );

    const handleSave = async () => {
        const name = window.prompt(t("Nombre de la plantilla"), "");
        if (!name) return;
        const toSave = {
            name,
            type: presetTypeHint || data.type || "custom",
            data: safeClone(data),
        };
        const p = saveCustomPreset(toSave);
        toast.success(t("Plantilla guardada: {name}", { name: p.name }));
    };

    const handleLoad = (preset: CustomPreset) => {
        // copy fields from preset.data into the question data so user can deviate
        const src = safeClone(preset.data);
        Object.keys(src).forEach((k) => {
            (data as any)[k] = src[k];
        });
        // ensure nested objects replaced where appropriate (geo etc)
        questionModified();
        toast.info(t("Plantilla cargada: {name}", { name: preset.name }));
    };

    const handleEdit = (preset: CustomPreset) => {
        const newName = window.prompt(
            t("Nuevo nombre de la plantilla"),
            preset.name,
        );
        if (!newName || newName === preset.name) return;
        updateCustomPreset(preset.id, { name: newName });
        toast.success(t("Plantilla renombrada: {name}", { name: newName }));
    };

    const handleDelete = (preset: CustomPreset) => {
        if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
        deleteCustomPreset(preset.id);
        toast.info(t("Plantilla borrada: {name}", { name: preset.name }));
    };

    const handleShare = async (preset: CustomPreset) => {
        const payload = {
            name: preset.name,
            type: preset.type,
            data: preset.data,
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload));
            toast.success(t("Plantilla copiada al portapapeles"));
        } catch {
            toast.error(t("No se ha podido copiar al portapapeles"));
        }
    };

    const handleApplyFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error(t("El portapapeles está vacío"));
                return;
            }
            const payload = JSON.parse(text);
            if (!payload.data) {
                toast.error(t("Lo del portapapeles no es una plantilla"));
                return;
            }
            const src = safeClone(payload.data);
            Object.keys(src).forEach((k) => {
                (data as any)[k] = src[k];
            });
            questionModified();
            toast.info(
                t("Plantilla aplicada: {name}", {
                    name: payload.name ?? t("del portapapeles"),
                }),
            );
        } catch {
            toast.error(t("No se ha podido leer el portapapeles"));
        }
    };

    return (
        <div className="p-2">
            <div className="flex flex-col sm:flex-row gap-2 [&>*]:w-[50%]">
                <Button onClick={handleSave}>
                    {t("Guardar como plantilla")}
                </Button>
                <Button variant="ghost" onClick={handleApplyFromClipboard}>
                    {t("Aplicar desde el portapapeles")}
                </Button>
            </div>

            {presets.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                    {t("No hay plantillas guardadas.")}
                </div>
            ) : (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                    {presets.map((p) => (
                        <div
                            key={p.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded border p-2"
                        >
                            <div className="flex-1 w-full">
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {new Date(p.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button size="sm" onClick={() => handleLoad(p)}>
                                    {t("Cargar")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(p)}
                                >
                                    {t("Renombrar")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleShare(p)}
                                >
                                    {t("Compartir")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(p)}
                                >
                                    {t("Borrar")}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomPresets;
