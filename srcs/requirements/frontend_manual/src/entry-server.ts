import { renderToString } from "vue/server-renderer";
import { createApp } from "./main";
import { useAuthStore } from "./stores/authStore";

export async function render(url: string, cookie: string) {
	const { app, router, pinia } = createApp("server");

	// SSR AUTH CHECK
	// We manually initialize the store and pass the cookie from the request headers
	const authStore = useAuthStore(pinia);
	if (cookie) {
		await authStore.checkAuth(cookie);
	}

	// Push the requested URL to the router
	await router.push(url);
	await router.isReady();

	// Render the app to HTML
	const html = await renderToString(app);

	// DEHYDRATION:
	// We extract the Pinia state (which now contains the fetched notes).
	// We will pass this 'state' string back to server.js,
	// which will inject it into the HTML as window.__INITIAL_STATE__.
	const state = JSON.stringify(pinia.state.value);

	return { html, state };
}
