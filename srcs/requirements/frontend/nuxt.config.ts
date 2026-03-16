import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: ["@primevue/nuxt-module", "@pinia/nuxt", "@vueuse/nuxt"],
	primevue: {
		options: {
			ripple: true,
		},
		// components: {
		// 	include: "*"
		// }
	},
	css: ["~/assets/base.css"],
	vite: {
		plugins: [tailwindcss() as any],
	},
	future: {
		compatibilityVersion: 4,
	},
});
// https://nuxt.com/modules contains modules
