# Frontend

## Files

- `Dockerfile`: Instructions for a two stage build 
	- Stage 1: Load all the ltools for Vue and Nuxt creating a node_modules folder
	- Stage 2: Take the output of the build process and run this 
  - Expose port 3000 (convention for frontend container to listen on this port)
- `package.json`: tells Node which libraries (Nuxt, Vue, Tailwind) to download
- `nuxt.config.ts`: defines how vue/nuxt communicate with auth and notes
- `.dockerignore`: files that should not be included in the image
- `app.vue`: template for every page
- src/
	- pages/
		- index.vue
	- components/
		- Header.vue
	- layouts/
		- default.vue

- `i18n`: Internationalization protocol
	- the core is a json struct with the language codes 
		and the localized strings
	- there is a createI18n - this is a function of the vue-i18n library that we use in this specific build (in next.js it would be a differnet thing)
	ideally if the localized strings get too many, we would split into different jsons and grab them lazily (we are never going too many string)
	- in main.ts import i18n  from './i18n.ts'
	- in main.ts when creating the app either use a builder pattern .use(i18n) or assign the createApp return to a variable and then call the method app.use(i18n)
		- createApp(App).use(i18n).mount('#app')
		OR
		- ` const app = createApp(App)
			app.use(i18n)
			app.mount('#app')`


- `accessibility`: 