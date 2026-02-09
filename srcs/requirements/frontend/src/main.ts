import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import App from "./App.vue";
import { createRouter } from "./router";

// NOTE: CSS is NOT imported here. It is linked in now index.html to prevent FOUC (Flash of Unstyled Content)

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App);
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);
	// editing some pass through styles here istead of editing volt components directly
	app.use(PrimeVue, {
		unstyled: true,
	});
	app.use(ConfirmationService);

	return { app, router, pinia };
}


