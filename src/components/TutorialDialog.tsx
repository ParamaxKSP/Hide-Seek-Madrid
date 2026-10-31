import { useStore } from "@nanostores/react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
    AlertDialog,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { showTutorial, tutorialStep } from "@/lib/context";
import { cn } from "@/lib/utils";

interface TutorialStep {
    title: string;
    content: ReactNode;
    targetSelector?: string; // CSS selector for the element to highlight
    position?: "top" | "bottom" | "center"; // Where to position the dialog relative to target
    isDescription?: boolean;
}

/** Párrafos del tutorial, cada uno traducible. */
const paras = (...texts: string[]) => (
    <>
        {texts.map((text, i) => (
            <p key={i} className={i ? "mt-3" : undefined}>
                {t(text)}
            </p>
        ))}
    </>
);

const tutorialSteps: TutorialStep[] = [
    {
        title: "Bienvenido a Hide+Seek Madrid",
        content: paras(
            "Este mapa sirve para jugar al escondite de Jet Lag: The Game en la Comunidad de Madrid. Apuntas las preguntas que hacéis y el mapa va tachando las zonas donde el escondido ya no puede estar.",
            "Es una adaptación no oficial de JetLagHideAndSeek, con las estaciones de Metro, Metro Ligero y Cercanías, preguntas propias de Madrid y ayudas para la partida (reloj, coste de las preguntas, GPS).",
            "Si ya lo conoces, puedes saltarte el tutorial. Se maneja con las flechas o con los botones de abajo.",
        ),
        position: "center",
    },
    {
        title: "1. Configura la partida",
        content: paras(
            "En «Configuración» eliges el tamaño de la partida (pequeña, mediana o grande) y la zona de juego: toda la Comunidad, el área metropolitana, el municipio de Madrid, la almendra central o una zona hecha por vosotros.",
            "El tamaño decide qué preguntas existen, el radio de las zonas de escondite y el tiempo para esconderse. Puedes guardar tus configuraciones y mandarlas por enlace para que todos juguéis con la misma.",
        ),
        targetSelector: '[data-tutorial-id="config-button"]',
        position: "top",
    },
    {
        title: "2. Zona de juego",
        content: paras(
            "Arriba se ve la zona de juego. Desde aquí puedes buscar un sitio para añadirlo o quitarlo, y con el botón del polígono (abajo a la izquierda del mapa) puedes dibujar una zona a mano.",
        ),
        targetSelector: '[data-tutorial-id="place-picker"]',
        position: "bottom",
    },
    {
        title: "3. Barra de preguntas",
        content: paras(
            "Con este botón se abre la barra de preguntas. Ahí está cada pregunta que hacéis, con su resultado y su coste.",
        ),
        targetSelector: '[data-tutorial-id="left-sidebar-trigger"]',
        position: "bottom",
    },
    {
        title: "4. Añadir preguntas",
        content: paras(
            "«Añadir pregunta» abre la lista de tipos: radar, termómetro, tentáculos, coincidencia y medición, que cambian el mapa, y fotos u otras preguntas sin mapa, que solo cuentan para el coste.",
            "Si marcas «Crear la pregunta en mi ubicación», la pregunta se pone donde estás según el GPS. Si no, en el centro del mapa. También puedes mantener pulsado el mapa para añadir una pregunta en ese punto.",
        ),
        targetSelector: '[data-tutorial-id="add-questions-buttons"]',
        position: "top",
    },
    {
        title: "5. Cada pregunta",
        content: paras(
            "Arriba de cada tarjeta sale cuántas cartas roba el escondido y cuántas se queda. Si repetís una pregunta, el coste se multiplica.",
            "«Veto» la deja sin respuesta y sin cartas; «Randomize» la cambia por otra de la misma categoría que no se haya hecho.",
            "Debajo puedes mover la ubicación (escribiéndola, con el GPS, pegando coordenadas o arrastrando el marcador), elegir la respuesta, compartir la pregunta, borrarla, bloquearla o esconderla del mapa.",
        ),
        position: "center",
    },
    {
        title: "6. Radar y termómetro",
        content: paras(
            "Radar: «¿Estás a menos de X de mí?». Elige la distancia y si la respuesta es dentro o fuera.",
            "Termómetro: los buscadores viajan la distancia de la pregunta y el escondido dice si están más calientes o más fríos. «Empezar aquí (GPS)» marca el inicio, la app te avisa cuando ya has recorrido la distancia en línea recta y «Terminar aquí» marca el final.",
        ),
        position: "center",
    },
    {
        title: "7. Tentáculos",
        content: paras(
            "«De los X que hay a menos de N km de mí, ¿cuál es el más cercano a ti?». Elige el tipo de lugar y, cuando el escondido conteste, el lugar que ha dicho (o «Ninguno dentro»).",
        ),
        position: "center",
    },
    {
        title: "8. Coincidencia y medición",
        content: paras(
            "Coincidencia: «¿Tu X es el mismo que el mío?» (misma línea de tren, mismo municipio o distrito, mismo Mercadona más cercano…).",
            "Medición: «¿Estás más cerca o más lejos que yo de X?» (estaciones, alta velocidad, ríos, aeropuertos, El Corte Inglés…).",
            "Además de las del juego hay categorías propias de Madrid, que están agrupadas aparte en la lista.",
        ),
        position: "center",
    },
    {
        title: "9. Zonas de escondite",
        content: paras(
            "Este botón abre la barra de zonas de escondite: un círculo alrededor de cada estación. Puedes elegir los tipos de estación, el radio, quitar líneas o desactivar estaciones a mano.",
            "Al pulsar una zona se ve qué parte de ella sigue siendo posible según las preguntas.",
        ),
        targetSelector: '[data-tutorial-id="right-sidebar-trigger"]',
        position: "bottom",
    },
    {
        title: "10. Reloj",
        content: paras(
            "El reloj lleva el tiempo de cada ronda: primero el tiempo para esconderse, que no cuenta, y después el del escondido, que se para en pausas, descansos y Move.",
            "Al encontrar al escondido se apuntan las cartas de tiempo que tenga y la tabla dice quién va ganando. Un Move guarda las preguntas hechas hasta ese momento y marca en el mapa dónde estaba el escondido.",
            "Cuando el escondido confirma que habéis llegado a su zona, «Endgame» deja en el mapa solo la zona de su estación. Se puede usar una vez por ronda y queda apuntado.",
        ),
        targetSelector: '[data-tutorial-id="clock-button"]',
        position: "top",
    },
    {
        title: "11. Compartir la partida",
        content: paras(
            "«Compartir» crea un enlace con la zona y todas las preguntas para que los demás buscadores vean lo mismo. Si la partida es muy grande, se descarga como archivo; con «Guardar» y «Abrir» también podéis pasárosla así.",
        ),
        targetSelector: '[data-tutorial-id="share-questions-button"]',
        position: "top",
    },
    {
        title: "12. Opciones y modo escondido",
        content: paras(
            "En «Opciones» están el estilo del mapa, seguir tu posición con el GPS, el guardado automático y el modo escondido.",
            "En modo escondido pones dónde estás y la app contesta sola cada pregunta, para que no te equivoques.",
        ),
        targetSelector: '[data-tutorial-id="option-questions-button"]',
        position: "top",
    },
    {
        title: "Sin cobertura",
        content: paras(
            "Si abres la web una vez con conexión, se guarda en el móvil y funciona sin cobertura: preguntas, estaciones y cálculos. El fondo del mapa solo se ve en las zonas que ya hayas mirado antes.",
            "Los datos vienen de OpenStreetMap y pueden tener algún fallo: si una respuesta no os cuadra, comprobadla a mano.",
        ),
        position: "center",
    },
    {
        title: "¡A jugar!",
        content: paras(
            "Ya está. Puedes volver a este tutorial cuando quieras con el botón «Tutorial».",
        ),
        position: "center",
    },
];

const TutorialOverlay = ({
    targetSelector,
    isVisible,
}: {
    targetSelector?: string;
    isVisible: boolean;
}) => {
    const [highlightedElement, setHighlightedElement] =
        useState<Element | null>(null);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!isVisible || !targetSelector) {
                setHighlightedElement(null);
                return;
            }

            setHighlightedElement(
                document.querySelector(targetSelector) || null,
            );
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [targetSelector, isVisible]);

    if (!isVisible) {
        return null;
    }

    const rect = highlightedElement?.getBoundingClientRect();
    const padding = 12;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {highlightedElement && rect ? (
                <div>
                    <div
                        className="absolute transition-all duration-500 ease-out tutorial-highlight-pulse"
                        style={{
                            left: rect.left - padding,
                            top: rect.top - padding,
                            width: rect.width + padding * 2,
                            height: rect.height + padding * 2,
                            boxShadow: `
                                    0 0 0 4px rgba(59, 130, 246, 0.8),
                                    0 0 0 8px rgba(59, 130, 246, 0.4),
                                    0 0 0 9999px rgba(0, 0, 0, 0.6),
                                    0 0 30px rgba(59, 130, 246, 0.6)
                                `,
                            borderRadius: "12px",
                            border: "3px solid rgb(59, 130, 246)",
                            background: "transparent",
                            zIndex: 10000,
                        }}
                    >
                        <div
                            className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400/20 to-purple-400/20"
                            style={{
                                animation: "breathe 3s infinite ease-in-out",
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0 bg-black/60 transition-opacity duration-300" />
            )}
        </div>
    );
};

export const TutorialDialog = () => {
    const $showTutorial = useStore(showTutorial);
    const dialogRef = useRef<HTMLDivElement>(null);
    const $tutorialStep = useStore(tutorialStep);

    const handleNext = () => {
        if ($tutorialStep < tutorialSteps.length - 1) {
            tutorialStep.set($tutorialStep + 1);
        }
    };

    const handlePrevious = () => {
        if ($tutorialStep > 0) {
            tutorialStep.set($tutorialStep - 1);
        }
    };
    const handleClose = () => {
        showTutorial.set(false);
    };

    const currentTutorialStep = tutorialSteps[$tutorialStep];

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!$showTutorial || !dialogRef.current) return;

            const dialogElement = dialogRef.current;
            const isMobile = window.innerWidth < 768; // Tailwind md breakpoint
            const maxWidth = isMobile ? window.innerWidth - 40 : 680;

            dialogElement.style.maxWidth = `${maxWidth}px`;
            dialogElement.style.width = "auto";
            dialogElement.style.height = "auto";

            if (!currentTutorialStep.targetSelector) {
                dialogElement.style.position = "fixed";
                dialogElement.style.left = "50%";
                dialogElement.style.top = "50%";
                dialogElement.style.transform = "translate(-50%, -50%)";
                dialogElement.style.right = "auto";
                dialogElement.style.bottom = "auto";
                return;
            }

            const targetElement = document.querySelector(
                currentTutorialStep.targetSelector,
            ) as HTMLElement;

            if (!targetElement) {
                // If target element not found, center the dialog
                dialogElement.style.position = "fixed";
                dialogElement.style.left = "50%";
                dialogElement.style.top = "50%";
                dialogElement.style.transform = "translate(-50%, -50%)";
                dialogElement.style.right = "auto";
                dialogElement.style.bottom = "auto";
                return;
            }

            const rect = targetElement.getBoundingClientRect();
            const position = currentTutorialStep.position || "center";
            const padding = 20;

            // Ensure positioning is set but don't reset transform immediately
            dialogElement.style.position = "fixed";

            const dialogRect = dialogElement.getBoundingClientRect();
            const dialogWidth = Math.min(
                dialogRect.width || 680,
                isMobile ? window.innerWidth - padding * 2 : 680,
            );
            const dialogHeight = dialogRect.height || 400;

            let finalX = 0;
            let finalY = 0;

            // On mobile, use simpler positioning logic
            if (isMobile) {
                // On mobile, always center horizontally and position vertically based on target
                finalX = (window.innerWidth - dialogWidth) / 2;

                switch (position) {
                    case "top": {
                        finalY = Math.max(
                            padding,
                            rect.top - dialogHeight - padding,
                        );
                        // If no space above, move to below
                        if (finalY < padding) {
                            finalY = Math.min(
                                rect.bottom + padding,
                                window.innerHeight - dialogHeight - padding,
                            );
                        }
                        break;
                    }
                    case "bottom": {
                        finalY = Math.min(
                            rect.bottom + padding,
                            window.innerHeight - dialogHeight - padding,
                        );
                        // If no space below, move to above
                        if (
                            finalY + dialogHeight >
                            window.innerHeight - padding
                        ) {
                            finalY = Math.max(
                                padding,
                                rect.top - dialogHeight - padding,
                            );
                        }
                        break;
                    }
                    default:
                        // Center
                        finalY = (window.innerHeight - dialogHeight) / 2;
                        break;
                }

                // Ensure dialog stays within viewport bounds
                finalY = Math.max(
                    padding,
                    Math.min(
                        finalY,
                        window.innerHeight - dialogHeight - padding,
                    ),
                );
            } else {
                // Desktop positioning logic (unchanged)
                switch (position) {
                    case "top": {
                        finalX = Math.max(
                            padding,
                            Math.min(
                                window.innerWidth - dialogWidth - padding,
                                rect.left + rect.width / 2 - dialogWidth / 2,
                            ),
                        );
                        finalY = Math.max(
                            padding,
                            rect.top - dialogHeight - padding,
                        );
                        // If no space above, flip to below
                        if (finalY < padding) {
                            finalY = rect.bottom + padding;
                        }
                        break;
                    }
                    case "bottom": {
                        finalX = Math.max(
                            padding,
                            Math.min(
                                window.innerWidth - dialogWidth - padding,
                                rect.left + rect.width / 2 - dialogWidth / 2,
                            ),
                        );
                        finalY = rect.bottom + padding;
                        // If no space below, flip to above
                        if (
                            finalY + dialogHeight >
                            window.innerHeight - padding
                        ) {
                            finalY = Math.max(
                                padding,
                                rect.top - dialogHeight - padding,
                            );
                        }
                        break;
                    }
                    default:
                        // Center
                        dialogElement.style.left = "50%";
                        dialogElement.style.top = "50%";
                        dialogElement.style.transform = "translate(-50%, -50%)";
                        dialogElement.style.right = "auto";
                        dialogElement.style.bottom = "auto";
                        return;
                }
            }

            // Apply positioning smoothly
            dialogElement.style.transform = "none";
            dialogElement.style.left = `${finalX}px`;
            dialogElement.style.top = `${finalY}px`;
            dialogElement.style.right = "auto";
            dialogElement.style.bottom = "auto";
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [$tutorialStep, $showTutorial]);

    useEffect(() => {
        if (!$showTutorial) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case "ArrowRight":
                case "ArrowDown":
                    event.preventDefault();
                    handleNext();
                    break;
                case "ArrowLeft":
                case "ArrowUp":
                    event.preventDefault();
                    handlePrevious();
                    break;
                case "Escape":
                    event.preventDefault();
                    handleClose();
                    break;
                case "Enter":
                case " ":
                    event.preventDefault();
                    if ($tutorialStep === tutorialSteps.length - 1) {
                        handleClose();
                    } else {
                        handleNext();
                    }
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [$showTutorial, $tutorialStep]);

    return (
        <>
            <TutorialOverlay
                targetSelector={currentTutorialStep.targetSelector}
                isVisible={$showTutorial}
            />
            <AlertDialog open={$showTutorial} onOpenChange={showTutorial.set}>
                <AlertDialogPrimitive.AlertDialogContent
                    ref={dialogRef}
                    className={cn(
                        "fixed z-[10000] grid w-full gap-4 border bg-background p-4 md:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
                        "!max-h-[50vh] overflow-y-auto tutorial-dialog",
                        // Only apply default center positioning for non-targeted steps
                        !currentTutorialStep.targetSelector &&
                            "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] !max-h-[90vh]",
                    )}
                    style={{
                        maxWidth: "min(680px, calc(100vw - 40px))",
                        width: "auto",
                        transition:
                            "left 0.3s ease-out, top 0.3s ease-out, transform 0.3s ease-out",
                    }}
                    data-tutorial-active={$showTutorial}
                >
                    <AlertDialogHeader className="space-y-4">
                        <div className="flex items-center justify-between">
                            <AlertDialogTitle className="text-2xl font-bold text-left">
                                {t(currentTutorialStep.title)}
                            </AlertDialogTitle>
                        </div>

                        <div className="flex space-x-2">
                            {tutorialSteps.map((_, index) => (
                                <div
                                    key={index}
                                    className={`h-2 rounded-full flex-1 ${
                                        index <= $tutorialStep
                                            ? "bg-blue-500"
                                            : "bg-gray-300"
                                    }`}
                                />
                            ))}
                        </div>
                    </AlertDialogHeader>

                    {(currentTutorialStep.isDescription ?? true) ? (
                        <AlertDialogDescription className="text-base leading-relaxed whitespace-pre-line">
                            {currentTutorialStep.content}
                        </AlertDialogDescription>
                    ) : (
                        <div className="text-base leading-relaxed whitespace-pre-line text-muted-foreground">
                            {currentTutorialStep.content}
                        </div>
                    )}

                    <div className="flex flex-col gap-y-2 justify-between items-center pt-4">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="text-sm"
                            >
                                {t("Saltar el tutorial")}
                            </Button>
                            <div className="hidden md:block text-xs text-muted-foreground">
                                {t("Usa las flechas para moverte")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t("{n} de {total}", {
                                    n: $tutorialStep + 1,
                                    total: tutorialSteps.length,
                                })}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                onClick={handlePrevious}
                                disabled={$tutorialStep === 0}
                                className="flex items-center space-x-1"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span>{t("Anterior")}</span>
                            </Button>
                            {$tutorialStep === tutorialSteps.length - 1 ? (
                                <Button
                                    onClick={handleClose}
                                    variant="secondary"
                                >
                                    <span>{t("¡A jugar!")}</span>
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleNext}
                                    className="flex items-center space-x-1"
                                >
                                    <span>{t("Siguiente")}</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </AlertDialogPrimitive.AlertDialogContent>
            </AlertDialog>
        </>
    );
};
