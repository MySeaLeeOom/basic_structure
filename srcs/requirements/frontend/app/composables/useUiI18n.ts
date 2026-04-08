/**
 * UI copy for the Nuxt app (nav, buttons, etc.). This is separate from the notes
 * service Fluent/FTL files: those only translate strings the API returns.
 */
import deDE from "~/locales/de-DE.json";
import enUK from "~/locales/en-UK.json";
import esES from "~/locales/es-ES.json";

type LocaleId = "en-UK" | "de-DE" | "es-ES";

const BUNDLES: Record<LocaleId, Record<string, string>> = {
	"en-UK": enUK,
	"de-DE": deDE,
	"es-ES": esES,
};

export function useUiI18n() {
	const lang = useCookie<LocaleId>("lang", { default: () => "en-UK" });

	function t(key: string): string {
		const id = (lang.value as LocaleId) ?? "en-UK";
		return BUNDLES[id]?.[key] ?? BUNDLES["en-UK"][key] ?? key;
	}

	return { t, locale: lang };
}
