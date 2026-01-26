# Frontend

## Hot reloading solution for Frontend
### For working with microvervices directly
### Add to docker-compose.yml

services:
  frontend:
    # ... build instructions ...
    volumes:
      - ./srcs/requirements/frontend:/app
      - /app/node_modules # Anonymous volume to protect container-side dependencies

What this means: bind mount this `./srcs/requirements/frontend:/app`

But let this folder be an "anonymous volume" ` - /app/node_modules` managed by Docker, and this it will be ignored in our local folder.
Translation: if I am working on a mac, I don't want mac files to go inside that folder, i need Docker to manage that volume by itself. It is like an exclusion. 

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


TEMPORARY NOTES 
## ARCHITECTURE COMPLEXITY TO RESEARCH

## State Management with Pinia

Centralized store for application state
Modular design
Easy to track state changes
Typescript support

## Routing with vue-router

Clear, nested route configurations
Lazy-loading of route components
Route guards for authentication

## Internationalization with @nuxtjs/i18n

Centralized translation management
Automatic language detection
Easy to add/modify languages

## TypeScript Integration

Type safety
Better developer experience
Catch errors at compile-time

## UI and Styling

Tailwind for rapid UI development
@nuxt/ui for pre-built components
Consistent design system

## Performance Optimization

Nuxt's built-in code splitting
Lazy loading of components
Optimized build process