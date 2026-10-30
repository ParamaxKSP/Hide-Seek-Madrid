import { useStore } from "@nanostores/react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    isLoading,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { CATALOG, catalogEntry, CATEGORY_INFO } from "@/maps/catalog";
import type { ManualQuestion } from "@/maps/schema";

import { QuestionCard } from "./base";

/** Preguntas del catálogo que la app no dibuja, agrupadas por categoría. */
const MANUAL_GROUPS = Object.fromEntries(
    Object.entries(CATEGORY_INFO)
        .map(([category, info]) => [
            info.label,
            Object.fromEntries(
                CATALOG.filter((e) => e.category === category && !e.make).map(
                    (e) => [e.id, e.label],
                ),
            ),
        ])
        .filter(([, options]) => Object.keys(options).length > 0),
);

/**
 * Pregunta que la app no dibuja (fotos, «calle o camino», costa…). Solo se
 * apunta para que cuente en el coste, el veto y el randomize.
 */
export const ManualQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: ManualQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const info = CATEGORY_INFO[data.category];
    const label = `${info.label} ${
        $questions
            .filter(
                (q) => q.id === "manual" && q.data.category === data.category,
            )
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    } (sin mapa)`;

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            collapsed={data.collapsed}
            setCollapsed={(collapsed) => {
                data.collapsed = collapsed;
            }}
            locked={!data.drag}
            setLocked={(locked) => questionModified((data.drag = !locked))}
            hidden={data.hidden}
            setHidden={(hidden) => questionModified((data.hidden = hidden))}
        >
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger="Pregunta"
                    groups={MANUAL_GROUPS}
                    value={data.catalogId}
                    onValueChange={(value) => {
                        const entry = catalogEntry(value);
                        if (!entry) return;
                        data.catalogId = entry.id;
                        data.category = entry.category;
                        questionModified();
                    }}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Input
                    className="rounded-md p-2"
                    placeholder="Respuesta (opcional)"
                    value={data.answer}
                    onChange={(e) =>
                        questionModified((data.answer = e.target.value))
                    }
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            <p className="px-2 pb-1 text-xs text-muted-foreground">
                La app no dibuja esta pregunta: solo la apunta para el coste y
                el randomize.
            </p>
        </QuestionCard>
    );
};
