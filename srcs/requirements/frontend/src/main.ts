import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import App from "./App.vue";
import { createRouter } from "./router";
import "./assets/base.css";

// PREV: NOTE: CSS is NOT imported here - see entry-client.ts
// CURRENT: NOTE: CSS is imported here to avoid FOUC during SSR

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App);
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);
	// editing some pass through styles here istead of editing volt components directly
	app.use(PrimeVue, {
		unstyled: true,
		pt: {
			Listbox: {
				pcHiddenSelectedMessage: {
					root: "sr-only",
				},
				hiddenFirstFocusableElement: {
					root: "sr-only",
				},
				hiddenLastFocusableElement: {
					root: "sr-only",
				},
				pcFilterContainer: {
					root: "relative",
				},
			},
		},
	});

	return { app, router, pinia };
}
