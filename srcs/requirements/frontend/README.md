## Installing dependencies

```
# 1. Initialize the manifest
pnpm init

# 2. Install the Core (The "Blueprint" and "State")
pnpm add vue@latest pinia vue-router@4

# 3. Install the Engine (The Server)
pnpm add fastify @fastify/static @fastify/middie

# 4. Install the Build Tools (The "Compiler")
# We need 'vite' to bundle our code and 'vue-server-renderer' to turn it into HTML strings.
pnpm add -D vite @vitejs/plugin-vue vue-tsc typescript @types/node
pnpm add -D @vue/server-renderer

# 5. Install Styles (The "Paint")
pnpm add -D tailwindcss postcss autoprefixer
# (WE DONT DO THIS FOR TAILWIND 4) # npx tailwindcss init -p
```

## Broad Contepts

### SPA: Single Page Application
Uses 1 html file to show all the pages of the app 

Old Way: Mult-Page Application
Each page is a single html file, 
the browser throws away the old one and loads the new one
If the website had music, the music would stop during the roload.



## Configurations

### Typescript Configs
#### The modern standard: 3 files
- (tsconfig.json): provides the paths in the references attribute
- (tsconfig.app.json): include attribute lists the files that are affected (frontend/vue)
- (tsconfig.node.json): include attribure lists the backend/ssr files

## package.json || pnpm commands to manage it
1. Command: `pnpm install`

2. `"type":"module"`

allows you to use this for example
```
import fastify from 'fastify';
export const myApp = ...
```
instead of this which you would be force to do without that option:
```
const fastify = require('fastify');
module.exports = ...
```

3. 


___



### Debug

There was a little issue loading up esbuild - it is written in GO and needs to be downloaded as a binary for the specific system that we are in. es in esbuild soands for ECMAScript. Vite uses esbuild (it is the "engine") to quickly run the hot reloading stuff. 

Other PNPM Commands:
```
#ingores the lockfile checks and rebuilds
pnpm install --force 
#explicitly rebuilds dependencie (runs post install scripts again aka downloads the specific binaries for dependencies based on your OS):
pnpm rebuild
```

/* "main": "index.js", //do we not need this?*/