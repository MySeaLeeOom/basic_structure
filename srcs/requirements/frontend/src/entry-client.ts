import "./assets/base.css"; // CSS imported here (client-only)
import { createApp } from "./main";

const { app, router } = createApp("client");

// Wait for router to be ready (resolve async components) before mounting
router.isReady().then(() => {
	app.mount("#app");
});
