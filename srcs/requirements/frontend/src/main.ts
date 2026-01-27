import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { createRouter } from "./router";

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App); // Changed from createApp to createSSRApp
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);

	return { app, router, pinia };
}

// import { createApp } from 'vue'
// import App from './App.vue'
// import { createRouter } from './router'

// export function setupApp() {
//   const app = createApp(App)
//   const router = createRouter() //why this
//   app.use(router) //explain

//   return { app, router }
// }
