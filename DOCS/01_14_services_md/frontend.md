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
