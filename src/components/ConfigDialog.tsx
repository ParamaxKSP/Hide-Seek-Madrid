import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    activeConfig,
    applyConfig,
    captureConfig,
    configFileName,
    configFromFile,
    configFromLocation,
    configLink,
    configToFile,
    deleteConfig,
    describeConfig,
    type GameConfig,
    markActive,
    PRESETS,
    refreshActiveArea,
    saveConfig,
    savedConfigs,
    SIZE_INFO,
} from "@/lib/config";
import {
    gameSize,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    questions,
} from "@/lib/context";
import { shareOrFallback } from "@/lib/utils";
import type { GameSize } from "@/maps/catalog";

const download = (name: string, text: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const shareConfig = async (config: GameConfig) => {
    try {
        const link = await configLink(config);
        const result = await shareOrFallback(link);
        if (result === "clipboard")
            toast.success("Enlace copiado: pégalo en el grupo.", {
                autoClose: 2500,
            });
        else if (result === false)
            toast.error(`No se pudo copiar. Enlace: ${link}`);
    } catch (e) {
        toast.error(`No se pudo crear el enlace: ${e}`);
    }
};

const ConfigRow = ({
    config,
    onUse,
    actions,
}: {
    config: GameConfig;
    onUse: () => void;
    actions?: React.ReactNode;
}) => (
    <div className="rounded-md border p-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{config.name}</span>
            <Button size="sm" className="h-7 px-3" onClick={onUse}>
                Usar
            </Button>
        </div>
        {config.description && (
            <span className="text-xs text-muted-foreground">
                {config.description}
            </span>
        )}
        <span className="text-xs">{describeConfig(config)}</span>
        {actions && <div className="flex gap-2 pt-1">{actions}</div>}
    </div>
);

/**
 * Configuraciones de partida: predefinidas, guardadas, compartir por enlace o
 * archivo, y cargar la que llega en un enlace.
 */
export const ConfigDialog = () => {
    const $active = useStore(activeConfig);
    const $saved = useStore(savedConfigs);
    const $gameSize = useStore(gameSize);
    const $isLoading = useStore(isLoading);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<{
        config: GameConfig;
        fromLink?: boolean;
    } | null>(null);
    const [name, setName] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    // La ventana solo existe en el navegador (la barra se genera también en el servidor).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Zona activa calculada con una versión anterior: se recalcula.
    useEffect(() => {
        refreshActiveArea().catch((e) =>
            console.warn("No se pudo recalcular la zona", e),
        );
    }, []);

    // ¿Se ha abierto la app con un enlace de configuración?
    useEffect(() => {
        configFromLocation()
            .then((config) => {
                if (!config) return;
                setPending({ config, fromLink: true });
                setOpen(true);
            })
            .catch(() => toast.error("El enlace de configuración está roto."))
            .finally(() => {
                if (window.location.hash.startsWith("#config="))
                    window.history.replaceState(
                        {},
                        "",
                        window.location.pathname + window.location.search,
                    );
            });
    }, []);

    const use = async (config: GameConfig, fromLink = false) => {
        // Sin isLoading: el mapa no se redibuja mientras está activo.
        setBusy(true);
        try {
            await applyConfig(config);
            if (fromLink) saveConfig(config);
            toast.success(`Configuración «${config.name}» cargada`, {
                autoClose: 2000,
            });
            setPending(null);
            setOpen(false);
        } catch (e) {
            toast.error(`No se pudo cargar la configuración: ${e}`);
        } finally {
            setBusy(false);
        }
    };

    const askToUse = (config: GameConfig) => {
        if (questions.get().length === 0) use(config);
        else setPending({ config });
    };

    const setSize = (size: GameSize) => {
        gameSize.set(size);
        hidingRadius.set(SIZE_INFO[size].hidingRadiusKm);
        hidingRadiusUnits.set("kilometers");
    };

    return (
        <>
            <Button className="shadow-md" onClick={() => setOpen(true)}>
                Configuración
            </Button>
            <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    file.text()
                        .then((text) => {
                            const config = configFromFile(text);
                            saveConfig(config);
                            toast.success(
                                `«${config.name}» añadida a tus configuraciones`,
                            );
                        })
                        .catch(() =>
                            toast.error(
                                "Ese archivo no es una configuración válida.",
                            ),
                        );
                }}
            />
            {mounted && (
                <Dialog
                    open={open}
                    onOpenChange={(o) => {
                        setOpen(o);
                        if (!o) setPending(null);
                    }}
                >
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogTitle>Configuración de partida</DialogTitle>
                        <DialogDescription>
                            Zona, tamaño de partida y estaciones. Todos tenéis
                            que jugar con la misma.
                        </DialogDescription>

                        {pending ? (
                            <div className="flex flex-col gap-3">
                                <p>
                                    {pending.fromLink
                                        ? "Te han pasado esta configuración:"
                                        : "Vas a cargar esta configuración:"}
                                </p>
                                <div className="rounded-md border p-2">
                                    <div className="font-semibold">
                                        {pending.config.name}
                                    </div>
                                    {pending.config.description && (
                                        <div className="text-xs text-muted-foreground">
                                            {pending.config.description}
                                        </div>
                                    )}
                                    <div className="text-xs">
                                        {describeConfig(pending.config)}
                                    </div>
                                </div>
                                {questions.get().length > 0 && (
                                    <p className="text-orange-500 text-sm">
                                        Empieza una partida nueva: se borran las{" "}
                                        {questions.get().length} preguntas
                                        actuales.
                                    </p>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setPending(null)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        disabled={$isLoading || busy}
                                        onClick={() =>
                                            use(
                                                pending.config,
                                                pending.fromLink,
                                            )
                                        }
                                    >
                                        Cargar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 text-sm">
                                <div>
                                    <div className="font-semibold">
                                        Ahora:{" "}
                                        {$active?.name ?? "Toda la Comunidad"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Tamaño de partida (cambia el radio de
                                        las zonas y las preguntas disponibles):
                                    </div>
                                    <ToggleGroup
                                        type="single"
                                        value={$gameSize}
                                        onValueChange={(v) =>
                                            v && setSize(v as GameSize)
                                        }
                                        className="justify-start pt-1"
                                    >
                                        {(
                                            Object.keys(SIZE_INFO) as GameSize[]
                                        ).map((s) => (
                                            <ToggleGroupItem key={s} value={s}>
                                                {SIZE_INFO[s].label}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                </div>

                                <Separator />
                                <div className="font-semibold">
                                    Predefinidas
                                </div>
                                {PRESETS.map((p) => (
                                    <ConfigRow
                                        key={p.id}
                                        config={p}
                                        onUse={() => askToUse(p)}
                                        actions={
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => shareConfig(p)}
                                            >
                                                Compartir enlace
                                            </Button>
                                        }
                                    />
                                ))}

                                <Separator />
                                <div className="font-semibold">
                                    Mis configuraciones
                                </div>
                                {$saved.length === 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        Aún no has guardado ninguna.
                                    </span>
                                )}
                                {$saved.map((c) => (
                                    <ConfigRow
                                        key={c.id}
                                        config={c}
                                        onUse={() => askToUse(c)}
                                        actions={
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() =>
                                                        shareConfig(c)
                                                    }
                                                >
                                                    Compartir enlace
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() =>
                                                        download(
                                                            configFileName(c),
                                                            configToFile(c),
                                                        )
                                                    }
                                                >
                                                    Archivo
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() =>
                                                        deleteConfig(c.id)
                                                    }
                                                >
                                                    Borrar
                                                </Button>
                                            </>
                                        }
                                    />
                                ))}

                                <Separator />
                                <div className="font-semibold">
                                    Guardar la configuración actual
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    Guarda la zona (también la dibujada a mano),
                                    el tamaño, el radio, los tipos de estación y
                                    las líneas y estaciones quitadas.
                                </span>
                                <div className="flex gap-2">
                                    <Input
                                        value={name}
                                        placeholder="Nombre (p. ej. Sur con Cercanías)"
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                    />
                                    <Button
                                        disabled={!name.trim()}
                                        onClick={() => {
                                            try {
                                                const config = captureConfig(
                                                    name.trim(),
                                                );
                                                saveConfig(config);
                                                markActive(config);
                                                setName("");
                                                toast.success(
                                                    `«${config.name}» guardada`,
                                                    { autoClose: 2000 },
                                                );
                                            } catch (e) {
                                                toast.error(
                                                    `No se pudo guardar: ${e}`,
                                                );
                                            }
                                        }}
                                    >
                                        Guardar
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => fileRef.current?.click()}
                                >
                                    Abrir archivo de configuración
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};
