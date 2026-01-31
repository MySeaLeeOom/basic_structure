import { renderToString } from "vue/server-renderer";
import { createApp } from "./main";

export async function render(url: string) {
	const { app, router } = createApp("server");

	// Push the requested URL to the router
	await router.push(url);
	await router.isReady();

	// Render the app to HTML
	const html = await renderToString(app);

	return { html };
}
