/**
 * UI copy for the Nuxt app (nav, buttons, etc.). This is separate from the notes
 * service Fluent/FTL files: those only translate strings the API returns.
 */
import { watch } from "vue";
import deDE from "~/locales/de-DE.json";
import enUK from "~/locales/en-UK.json";
import esES from "~/locales/es-ES.json";

type LocaleId = "en-UK" | "de-DE" | "es-ES";

const BUNDLES: Record<LocaleId, Record<string, string>> = {
	"en-UK": enUK,
	"de-DE": deDE,
	"es-ES": esES,
};

function normalizeLocale(value: string | null | undefined): LocaleId {
	if (value === "de-DE" || value === "es-ES" || value === "en-UK") {
		return value;
	}
	return "en-UK";
}

export function useUiI18n() {
	const langCookie = useCookie<LocaleId>("lang", { default: () => "en-UK" });
	const locale = useState<LocaleId>("ui-locale", () => normalizeLocale(langCookie.value));

	watch(locale, (value) => {
		if (langCookie.value !== value) {
			langCookie.value = value;
		}
	}, { immediate: true });

	watch(langCookie, (value) => {
		const normalized = normalizeLocale(value);
		if (locale.value !== normalized) {
			locale.value = normalized;
		}
	});

	function t(key: string): string {
		const id = normalizeLocale(locale.value);
		return BUNDLES[id]?.[key] ?? BUNDLES["en-UK"][key] ?? key;
	}

	return { t, locale };
}
