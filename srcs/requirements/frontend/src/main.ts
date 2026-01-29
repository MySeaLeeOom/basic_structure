import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { createRouter } from "./router";

// MUST UNDERSTAND

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App);
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);

	return { app, router, pinia };
}
