import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Mall {
    n: string;
    la: number;
    lo: number;
    /** Superficie en m² (0 si no se conoce). */
    a: number;
    /** Incluido ahora en la app. */
    p: boolean;
}

/** Centros conocidos que el filtro de superficie dejó fuera o que faltaban. */
const PROPOSED = [
    "Centro Comercial Príncipe Pío",
    "Centro Comercial Plaza Río 2",
    "Moraleja Green",
    "Centro Comercial Arturo Soria Plaza",
    "Centro Comercial Plaza Éboli",
    "Centro Comercial Alcalá Magna",
    "Centro Comercial Equinoccio",
    "Centro Comercial Gran Vía de Hortaleza",
    "Centro Comercial La Gavia",
    "Centro Comercial Las Rosas",
    "Heron City Madrid",
];

const STORE = "revisionCentros";
const keyOf = (m: Mall) => `${m.n}|${m.la}|${m.lo}`;
const hectares = (a: number) =>
    a > 0 ? `${(a / 10_000).toFixed(1).replace(".", ",")} ha` : "—";

const load = (): Record<string, boolean> => {
    try {
        return JSON.parse(localStorage.getItem(STORE) ?? "{}");
    } catch {
        return {};
    }
};

/**
 * Página para revisar a mano los centros comerciales: marcar cuáles deben
 * estar en la app y copiar los cambios. No toca los datos; los cambios se
 * aplican después en `data-src/base_datos.json`.
 */
export const MallReview = ({ malls }: { malls: Mall[] }) => {
    const [choice, setChoice] = useState<Record<string, boolean>>({});
    const [filter, setFilter] = useState("");
    const [showRest, setShowRest] = useState(false);
    const [copied, setCopied] = useState(false);
    const mapDiv = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const layer = useRef<L.LayerGroup | null>(null);

    useEffect(() => setChoice(load()), []);
    const included = (m: Mall) => choice[keyOf(m)] ?? m.p;
    const toggle = (m: Mall) => {
        const next = { ...choice, [keyOf(m)]: !included(m) };
        if (next[keyOf(m)] === m.p) delete next[keyOf(m)];
        setChoice(next);
        try {
            localStorage.setItem(STORE, JSON.stringify(next));
        } catch {
            // Sin almacenamiento: los cambios duran hasta cerrar la página.
        }
    };

    const groups = useMemo(() => {
        const proposed = PROPOSED.flatMap((n) =>
            malls.filter((m) => m.n === n),
        );
        const current = malls
            .filter((m) => m.p)
            .sort((a, b) => a.n.localeCompare(b.n, "es"));
        const rest = malls
            .filter((m) => !m.p && !PROPOSED.includes(m.n))
            .sort((a, b) => b.a - a.a || a.n.localeCompare(b.n, "es"));
        return { proposed, current, rest };
    }, [malls]);

    const added = malls.filter((m) => !m.p && included(m));
    const removed = malls.filter((m) => m.p && !included(m));
    const total = malls.filter(included).length;
    const summary =
        `Centros comerciales: ${total} en total\n` +
        `Añadir (${added.length}): ${added.map((m) => m.n).join("; ") || "ninguno"}\n` +
        `Quitar (${removed.length}): ${removed.map((m) => m.n).join("; ") || "ninguno"}`;

    useEffect(() => {
        if (!mapDiv.current || map.current) return;
        map.current = L.map(mapDiv.current).setView([40.43, -3.7], 10);
        L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
            {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: "abcd",
                maxZoom: 19,
            },
        ).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
    }, []);

    useEffect(() => {
        const g = layer.current;
        if (!g) return;
        g.clearLayers();
        for (const m of malls) {
            const proposed = PROPOSED.includes(m.n);
            if (!included(m) && !proposed && !showRest) continue;
            L.circleMarker([m.la, m.lo], {
                radius: proposed ? 8 : 6,
                color: included(m) ? "#15803d" : "#9ca3af",
                fillColor: proposed
                    ? "#f59e0b"
                    : included(m)
                      ? "#22c55e"
                      : "#e5e7eb",
                fillOpacity: 0.9,
                weight: 2,
            })
                .bindTooltip(`${m.n} · ${hectares(m.a)}`)
                .on("click", () => toggle(m))
                .addTo(g);
        }
    });

    const focus = (m: Mall) => {
        map.current?.setView([m.la, m.lo], 16);
        // En el móvil el mapa está debajo de la lista.
        if (window.innerWidth < 768)
            mapDiv.current?.scrollIntoView({ behavior: "smooth" });
    };

    const row = (m: Mall) => (
        <li
            key={keyOf(m)}
            className="flex items-center gap-2 py-1 border-b border-slate-700"
        >
            <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={included(m)}
                onChange={() => toggle(m)}
                aria-label={`Incluir ${m.n}`}
            />
            <button
                className="flex-1 text-left hover:underline"
                onClick={() => focus(m)}
            >
                {m.n}
            </button>
            <span className="text-xs text-slate-400 w-16 text-right">
                {hectares(m.a)}
            </span>
        </li>
    );

    const q = filter.trim().toLowerCase();
    const match = (m: Mall) => !q || m.n.toLowerCase().includes(q);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
            <div className="md:w-[420px] p-4 flex flex-col gap-4 md:h-screen md:overflow-y-auto">
                <div>
                    <h1 className="text-2xl font-bold">
                        Revisión: centros comerciales
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                        Marca los que deben estar en la app. Pulsa un nombre
                        para verlo en el mapa. Cuando acabes, copia los cambios
                        y pásamelos. Se guarda en este navegador.
                    </p>
                    <a
                        href={import.meta.env.BASE_URL}
                        className="text-sm text-sky-400 underline"
                    >
                        Volver a la app
                    </a>
                </div>

                <section>
                    <h2 className="font-semibold">
                        Propuestos ({groups.proposed.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                        Conocidos pero fuera por tener menos de 2 ha o por no
                        estar marcados como centro comercial en OpenStreetMap.
                    </p>
                    <ul>{groups.proposed.filter(match).map(row)}</ul>
                </section>

                <section>
                    <h2 className="font-semibold">
                        En la app ahora ({groups.current.length})
                    </h2>
                    <ul>{groups.current.filter(match).map(row)}</ul>
                </section>

                <section>
                    <button
                        className="font-semibold underline"
                        onClick={() => setShowRest(!showRest)}
                    >
                        {showRest ? "Ocultar" : "Ver"} el resto de descartados (
                        {groups.rest.length})
                    </button>
                    {showRest && (
                        <>
                            <input
                                className="w-full mt-2 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                                placeholder="Buscar por nombre"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                            <ul>{groups.rest.filter(match).map(row)}</ul>
                        </>
                    )}
                </section>

                <section className="flex flex-col gap-2 sticky bottom-0 bg-slate-900 pt-2">
                    <textarea
                        readOnly
                        className="w-full h-28 text-xs p-2 rounded bg-slate-800 border border-slate-600"
                        value={summary}
                    />
                    <button
                        className="rounded bg-sky-600 hover:bg-sky-500 px-3 py-2 font-semibold"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(summary);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            } catch {
                                // Sin portapapeles: se puede copiar del cuadro.
                            }
                        }}
                    >
                        {copied ? "Copiado" : "Copiar cambios"}
                    </button>
                </section>
            </div>
            <div ref={mapDiv} className="flex-1 min-h-[60vh] md:h-screen" />
        </div>
    );
};
