import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { questions } from "@/lib/context";

interface Props {
    questionKey: number;
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Si una pregunta falla al dibujarse (datos imposibles, un radio vacío…),
 * solo se sustituye esa tarjeta por un aviso; el resto de la barra sigue
 * funcionando.
 */
export class QuestionErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error("Error en una pregunta:", error);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="m-2 p-3 rounded-md border border-orange-500 text-sm flex flex-col gap-2">
                <p className="text-orange-500 font-semibold">
                    Esta pregunta no se ha podido mostrar.
                </p>
                <p className="text-muted-foreground">
                    Puede que tenga algún dato imposible.
                </p>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => this.setState({ error: null })}
                    >
                        Reintentar
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                            questions.set(
                                questions
                                    .get()
                                    .filter(
                                        (q) => q.key !== this.props.questionKey,
                                    ),
                            )
                        }
                    >
                        Borrar pregunta
                    </Button>
                </div>
            </div>
        );
    }
}
