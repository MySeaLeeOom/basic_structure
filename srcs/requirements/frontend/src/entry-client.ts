import { createApp } from "./main";

const { app, router, pinia } = createApp("client");

// HYDRATION:
// The server has already fetched data and rendered the HTML.
// It serialized the Pinia state into window.__INITIAL_STATE__.
// We must initialize our client-side store with this data so it matches the HTML.
// If we don't, the store starts empty, Vue sees "Select a note" (empty state),
// but the HTML has "Test Note" (server state), causing a "Hydration Mismatch".
if (window.__INITIAL_STATE__) {
	pinia.state.value = window.__INITIAL_STATE__;
}

// Wait for router to be ready (resolve async components) before mounting
router.isReady().then(() => {
	app.mount("#app");
});
