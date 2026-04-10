/**
 * UI copy for the Nuxt app (nav, buttons, etc.). This is separate from the notes
 * service Fluent/FTL files: those only translate strings the API returns.
 */
import { watch } from "vue";
import deDE from "~/locales/de-DE.json";
import enUK from "~/locales/en-UK.json";
import esES from "~/locales/es-ES.json";
import ieIE from "~/locales/ie-IE.json";
import elGR from "~/locales/el-GR.json";
import ruRU from "~/locales/ru-RU.json";
import trTR from "~/locales/tr-TR.json";

type LocaleId = "en-UK" | "de-DE" | "es-ES" | "ie-IE" | "tr-TR" | "el-GR" | "ru-RU";

const BUNDLES: Record<LocaleId, Record<string, string>> = {
	"en-UK": enUK,
	"de-DE": deDE,
	"es-ES": esES,
	"ie-IE": ieIE,
	"tr-TR": trTR,
	"el-GR": elGR,
	"ru-RU": ruRU,
};

function normalizeLocale(value: string | null | undefined): LocaleId {
	if (value === "de-DE" || value === "es-ES" || value === "en-UK" || value === "ie-IE" || value === "tr-TR" || value === "el-GR" || value === "ru-RU") {
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
