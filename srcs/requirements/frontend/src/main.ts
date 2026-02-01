import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import App from "./App.vue";
import { createRouter } from "./router";

// NOTE: CSS is NOT imported here - see entry-client.ts

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App);
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);
	app.use(PrimeVue, { unstyled: true });

	return { app, router, pinia };
}
