import { navigateTo, defineNuxtRouteMiddleware } from "nuxt/app";
import { useAuthStore } from "~/stores/authStore";

export default defineNuxtRouteMiddleware(async (to) => {
	const publicRoutes = ["/login", "/home"];
	if (publicRoutes.includes(to.path)) return;

	const authStore = useAuthStore();
	await authStore.checkAuth();

	if (!authStore.isAuthenticated) {
		return navigateTo("/login");
	}
});
