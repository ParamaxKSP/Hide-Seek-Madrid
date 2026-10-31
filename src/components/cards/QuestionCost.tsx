import { useStore } from "@nanostores/react";
import { BanIcon, DicesIcon } from "lucide-react";
import { toast } from "react-toastify";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { roundHistory, roundQuestions } from "@/lib/clock";
import {
    gameSize,
    isLoading,
    questionModified,
    questions,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import {
    availableIn,
    catalogEntry,
    catalogIdOf,
    CATEGORY_INFO,
    categoryOf,
    costMultiplier,
    houseRules,
    randomizeQuestion,
    unaskedEntries,
} from "@/maps/catalog";
import { questionSchema } from "@/maps/schema";

const SIZE_LABEL = { small: "pequeña", medium: "mediana", large: "grande" };

const TIMES = ["", "", "dos", "tres", "cuatro", "cinco", "seis"];

/**
 * Coste de la pregunta (cartas que roba el escondido, multiplicado si se
 * repite) y los powerups que la afectan: veto y randomize.
 */
export const QuestionCost = ({ questionKey }: { questionKey: number }) => {
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const $gameSize = useStore(gameSize);
    useStore(houseRules); // Las listas cambian al activar o quitar las categorías propias.
    // Las preguntas de antes de un Move siguen contando para el coste.
    const $history = useStore(roundHistory);
    const all = roundQuestions($questions, $history);
    const question = $questions.find((q) => q.key === questionKey);
    if (!question) return null;

    const category = categoryOf(question);
    const info = CATEGORY_INFO[category];
    const entry = catalogEntry(catalogIdOf(question));
    const times = costMultiplier(all, questionKey);
    const vetoed = question.data.vetoed;
    const left = unaskedEntries(all, category, $gameSize).length;

    const cost = vetoed
        ? "Vetada: sin respuesta y sin cartas"
        : `El escondido roba ${info.draw} y se queda ${info.keep}` +
          (times > 1
              ? `, ${TIMES[times] ?? `${times}`} veces (×${times}: ${times}.ª vez que se hace)`
              : "");

    return (
        <div className="px-2 pb-2 flex flex-col gap-1 text-xs">
            <div className="text-muted-foreground">
                {info.label}
                {entry ? ` · ${entry.label}` : " · pregunta libre"}
            </div>
            <div
                className={cn(
                    "font-semibold",
                    times > 1 && !vetoed && "text-orange-400",
                    vetoed && "text-red-400",
                )}
            >
                {cost}
            </div>
            {entry && !availableIn(entry, $gameSize) && (
                <div className="text-orange-400">
                    {entry.house && !houseRules.get()
                        ? "Las categorías propias de Madrid están desactivadas en esta partida."
                        : `Esta pregunta no existe en partida ${SIZE_LABEL[$gameSize]}.`}
                </div>
            )}
            {entry?.note && (
                <div className="text-muted-foreground italic">{entry.note}</div>
            )}
            <div className="flex gap-2">
                <Button
                    variant={vetoed ? "destructive" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={$isLoading}
                    onClick={() => {
                        question.data.vetoed = !vetoed;
                        questionModified();
                    }}
                >
                    <BanIcon /> {vetoed ? "Quitar veto" : "Veto"}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={$isLoading || left === 0}
                        >
                            <DicesIcon /> Randomize
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                ¿Usar randomize?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Se sortea otra pregunta de {info.label} que aún
                                no se haya hecho ({left} posibles) y sustituye a
                                esta, en el mismo sitio. La original no cuenta
                                como hecha.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    const result = randomizeQuestion(
                                        all,
                                        questionKey,
                                        Math.random,
                                        $gameSize,
                                    );
                                    if (!result) {
                                        toast.info(
                                            "No queda ninguna pregunta sin hacer en esta categoría.",
                                        );
                                        return;
                                    }
                                    const parsed = questionSchema.parse(
                                        result.question,
                                    );
                                    questions.set(
                                        $questions.map((q) =>
                                            q.key === questionKey ? parsed : q,
                                        ),
                                    );
                                    toast.success(
                                        `Randomize: ahora es «${info.label}: ${result.entry.label}»` +
                                            (result.entry.make
                                                ? ""
                                                : " (la app no la dibuja; respondedla a mano)"),
                                        { autoClose: 6000 },
                                    );
                                }}
                            >
                                Sortear
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};
