/**
 * UI copy for the Nuxt app (nav, buttons, etc.). This is separate from the notes
 * service Fluent/FTL files: those only translate strings the API returns.
 */
import { computed, watch } from "vue";
import ar from "~/locales/ar.json";
import deDE from "~/locales/de-DE.json";
import enUK from "~/locales/en-UK.json";
import esES from "~/locales/es-ES.json";

export type LocaleId = "en-UK" | "de-DE" | "es-ES" | "ar";

const BUNDLES: Record<LocaleId, Record<string, string>> = {
	"en-UK": enUK,
	"de-DE": deDE,
	"es-ES": esES,
	"ar": ar,
};

function normalizeLocale(value: string | null | undefined): LocaleId {
	if (value === "de-DE" || value === "es-ES" || value === "en-UK" || value === "ar") {
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

	useHead({
		htmlAttrs: {
			lang: computed(() => locale.value),
			dir: computed(() => (locale.value === "ar" ? "rtl" : "ltr")),
		},
	});

	const isRtl = computed(() => locale.value === "ar");

	function t(key: string): string {
		const id = normalizeLocale(locale.value);
		return BUNDLES[id]?.[key] ?? BUNDLES["en-UK"][key] ?? key;
	}

	return { t, locale, isRtl };
}
