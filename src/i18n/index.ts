/**
 * Textos de la interfaz.
 *
 * La app está escrita en español y cada texto pasa por `t()`, con el texto
 * español como clave (como gettext). Para traducirla basta con añadir un
 * diccionario `español → otro idioma` en `DICTIONARIES`; lo que falte en un
 * diccionario se muestra en español.
 *
 *     t("Añadir pregunta")
 *     t("Llevas {km} km", { km: 3 })
 */
const DICTIONARIES: Record<string, Record<string, string>> = {
    es: {},
    // en: { "Añadir pregunta": "Add question", ... },
};

export type Lang = keyof typeof DICTIONARIES;

const pickLang = (): Lang => {
    try {
        const saved = localStorage.getItem("lang");
        if (saved && saved in DICTIONARIES) return saved;
    } catch {
        // Sin almacenamiento (render en el servidor o navegador privado).
    }
    return "es";
};

export const lang: Lang = pickLang();

export const t = (
    text: string,
    params?: Record<string, string | number>,
): string => {
    const out = DICTIONARIES[lang]?.[text] ?? text;
    return params
        ? out.replace(/\{(\w+)\}/g, (m, k) =>
              k in params ? String(params[k]) : m,
          )
        : out;
};
