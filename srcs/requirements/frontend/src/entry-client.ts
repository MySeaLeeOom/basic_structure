import { createApp } from "./main";
// import { useAuthStore } from "./stores/authStore";

declare global {
	interface Window {
		__INITIAL_STATE__?: any;
	}
}

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

// const authStore = useAuthStore(pinia);
// // Force an auth check on client-side mount to ensure state is fresh
// if (!authStore.user) {
// 	authStore.checkAuth();
// }

// Wait for router to be ready (resolve async components) before mounting
router.isReady().then(() => {
	app.mount("#app");
});
