import { navigateTo, defineNuxtRouteMiddleware } from "nuxt/app";
import { useAuthStore } from "~/stores/authStore";

export default defineNuxtRouteMiddleware(async (to) => {
	const publicRoutes = ["/login", "/home", "/", "/privacy", "/terms"];
	const authStore = useAuthStore();
	await authStore.checkAuth();

	if (!publicRoutes.includes(to.path) && !authStore.isAuthenticated) {
		return navigateTo("/login");
	}
});
