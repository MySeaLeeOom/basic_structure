# Vue 3.5+ MVP Development Guide with Volt UI and Fastify SSR

Building modern Vue applications in 2025 requires mastering a powerful ecosystem: **Vue 3.5's refined reactivity system**, **Volt UI's Tailwind-powered components**, **Vite's lightning-fast tooling**, and **server-side rendering with Fastify**. This guide provides everything you need to ship an MVP rapidly while maintaining production-quality architecture.

Vue 3.5, released September 2024, delivers a **56% reduction in memory usage** and introduces game-changing features like `useTemplateRef()`, reactive props destructuring, and lazy hydration strategies. Combined with Volt UI's 50+ unstyled PrimeVue components and Tailwind CSS v4, you can build performant, accessible interfaces without fighting design constraints. The stack rounds out with Pinia for state management, Vue Router 4 for navigation, and Vitest for testing.

---

## Vue 3.5 transforms how you write components

The September 2024 release brought fundamental improvements to Vue's core. The reactivity system underwent a complete refactor, achieving **up to 10x faster operations** for large, deeply reactive arrays while resolving longstanding SSR issues with stale computed values.

### useTemplateRef replaces the naming convention

Previously, accessing DOM elements required matching variable names to template ref attributes—a source of confusion and bugs. Vue 3.5 introduces `useTemplateRef()` for explicit, type-safe template references:

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'

// String parameter matches template ref attribute - no naming collision
const inputRef = useTemplateRef<HTMLInputElement>('search-input')

onMounted(() => inputRef.value?.focus())
</script>

<template>
  <input ref="search-input" type="text" placeholder="Search..." />
</template>
```

This approach enables template refs inside composables, provides automatic type inference with `@vue/language-tools` 2.1+, and supports dynamic ref bindings. For component refs, use `InstanceType<typeof MyComponent>` or the `ComponentExposed` helper from `vue-component-type-helpers`.

### Reactive props destructuring is now stable

The experimental feature from Vue 3.4 reached stability. You can destructure `defineProps` while retaining full reactivity:

```vue
<script setup lang="ts">
const { count = 0, title = 'Default' } = defineProps<{
  count?: number
  title?: string
}>()

// Watch destructured props via getter
watch(() => count, (newVal) => console.log('Count changed:', newVal))
</script>
```

One caveat: when passing destructured props to composables, wrap them in a getter: `useDebounce(() => count)`.

### SSR-safe unique IDs with useId

Generating unique IDs that remain stable across server and client renders is now trivial:

```vue
<script setup>
import { useId } from 'vue'
const fieldId = useId()
</script>

<template>
  <label :for="fieldId">Email</label>
  <input :id="fieldId" type="email" />
</template>
```

### Watcher cleanup gets first-class support

The new `onWatcherCleanup()` API simplifies aborting stale async operations:

```typescript
import { watch, onWatcherCleanup } from 'vue'

watch(searchQuery, (query) => {
  const controller = new AbortController()
  
  fetch(`/api/search?q=${query}`, { signal: controller.signal })
    .then(handleResults)
  
  onWatcherCleanup(() => controller.abort())
})
```

### Lazy hydration reduces Time-to-Interactive

Vue 3.5 introduces strategies for deferring component hydration until necessary:

```typescript
import { defineAsyncComponent, hydrateOnVisible } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./HeavyChart.vue'),
  hydrate: hydrateOnVisible() // Only hydrates when scrolled into view
})
```

For expected hydration mismatches (like localized dates), use `data-allow-mismatch`:

```html
<span data-allow-mismatch="text">{{ date.toLocaleString() }}</span>
```

---

## Volt UI delivers Tailwind-powered PrimeVue components

Volt UI represents a paradigm shift in component libraries. Rather than importing components from `node_modules`, Volt follows a **code ownership model**—components live in your codebase, fully customizable. Built on PrimeVue's unstyled core and Tailwind CSS v4, it provides **50+ accessible components** implementing the PrimeOne Aura design system.

### Installation requires four dependencies

Start by installing Tailwind CSS integration and PrimeVue:

```bash
npm install primevue tailwindcss-primeui tailwind-merge
```

Configure your main CSS file:

```css
@import "tailwindcss";
@import "tailwindcss-primeui";
```

Set PrimeVue to unstyled mode in your app entry:

```typescript
// main.ts
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import App from './App.vue'

const app = createApp(App)
app.use(PrimeVue, { unstyled: true })
app.mount('#app')
```

Download components via CLI—they install to `@/volt/`:

```bash
npx volt-vue add Button DataTable Dialog Select DatePicker
```

### Component usage follows local registration patterns

```vue
<script setup lang="ts">
import Button from '@/volt/Button.vue'
import InputText from '@/volt/InputText.vue'
import { ref } from 'vue'

const email = ref('')
</script>

<template>
  <InputText v-model="email" placeholder="Enter email" fluid />
  <Button label="Subscribe" @click="handleSubmit" />
</template>
```

### DataTable handles complex data requirements

Volt's DataTable supports pagination, sorting, filtering, virtual scrolling, row selection, and expansion:

```vue
<script setup lang="ts">
import DataTable from '@/volt/DataTable.vue'
import Column from 'primevue/column'
import { FilterMatchMode } from '@primevue/core/api'
import { ref } from 'vue'

const products = ref([/* data */])
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS }
})
</script>

<template>
  <DataTable 
    :value="products" 
    v-model:filters="filters"
    paginator 
    :rows="10"
    sortMode="multiple"
    :globalFilterFields="['name', 'category']"
  >
    <template #header>
      <InputText v-model="filters.global.value" placeholder="Search..." />
    </template>
    <Column field="name" header="Name" sortable />
    <Column field="category" header="Category" sortable />
    <Column field="price" header="Price">
      <template #body="{ data }">{{ formatCurrency(data.price) }}</template>
    </Column>
  </DataTable>
</template>
```

### Theming uses CSS variables and Pass Through

Define your design tokens in CSS variables:

```css
:root {
  --p-primary-500: #10b981;
  --p-primary-600: #059669;
  --p-surface-0: #ffffff;
  --p-surface-900: #18181b;
  --p-content-border-radius: 6px;
}

/* Dark mode via media query or class */
.app-dark {
  --p-primary-color: var(--p-primary-400);
  --p-text-color: var(--p-surface-0);
}
```

Override styles per-instance using the `pt` (Pass Through) attribute:

```vue
<InputText pt:root:class="bg-primary text-primary-contrast" value="Styled" />
```

For global changes, modify the downloaded Volt components directly—they're yours to customize.

---

## Vite configuration optimizes development and production builds

### Project setup with create-vue

Use the official Vue scaffolding tool for a complete setup with TypeScript, Router, Pinia, and testing:

```bash
npm create vue@latest my-app
```

The generated `vite.config.ts` provides a foundation you'll extend:

```typescript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      vue({
        features: {
          propsDestructure: true, // Enabled by default in Vue 3.5+
        },
      }),
      vueDevTools(),
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@stores': path.resolve(__dirname, './src/stores'),
      },
    },
    
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router', 'pinia'],
            'vendor-ui': ['primevue'],
          },
        },
      },
    },
  }
})
```

### Environment variables follow the VITE_ prefix convention

```bash
# .env.development
VITE_API_URL=http://localhost:4000
VITE_DEBUG_MODE=true

# .env.production
VITE_API_URL=https://api.production.com
VITE_DEBUG_MODE=false
```

Access in code via `import.meta.env.VITE_API_URL`. Add TypeScript definitions in `src/vite-env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEBUG_MODE: string
}
```

---

## Server-side rendering with Fastify provides optimal performance

### The universal app factory pattern

Create a factory function that works for both server and client:

```typescript
// src/main.ts
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createRouter } from './router'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  const router = createRouter()
  
  app.use(pinia)
  app.use(router)
  
  return { app, router, pinia }
}
```

The client entry hydrates the server-rendered HTML:

```typescript
// src/entry-client.ts
import { createApp } from './main'

const { app, router, pinia } = createApp()

// Restore Pinia state before mounting
if (window.__PINIA_STATE__) {
  pinia.state.value = window.__PINIA_STATE__
}

router.isReady().then(() => app.mount('#app'))
```

The server entry renders to string and serializes state:

```typescript
// src/entry-server.ts
import { renderToString } from 'vue/server-renderer'
import { createApp } from './main'
import devalue from 'devalue'

export async function render(url: string) {
  const { app, router, pinia } = createApp()
  
  await router.push(url)
  await router.isReady()
  
  const html = await renderToString(app)
  const state = devalue(pinia.state.value) // XSS-safe serialization
  
  return { html, state }
}
```

### Fastify server integration

```typescript
// server.ts
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { render } from './dist/server/entry-server.js'

const fastify = Fastify({ logger: true })
const isProduction = process.env.NODE_ENV === 'production'

// Serve client assets
fastify.register(fastifyStatic, {
  root: new URL('./dist/client', import.meta.url).pathname,
  prefix: '/assets/',
})

// SSR handler
fastify.get('*', async (request, reply) => {
  try {
    const { html, state } = await render(request.url)
    
    const page = `
      <!DOCTYPE html>
      <html>
        <head>
          <script>window.__PINIA_STATE__ = ${state}</script>
        </head>
        <body>
          <div id="app">${html}</div>
          <script type="module" src="/assets/entry-client.js"></script>
        </body>
      </html>
    `
    
    reply.type('text/html').send(page)
  } catch (error) {
    fastify.log.error(error)
    // Graceful fallback to SPA shell
    reply.sendFile('index.html')
  }
})

fastify.listen({ port: 3000 })
```

### SSR-safe component patterns prevent server crashes

Never access browser APIs directly—wrap them in lifecycle hooks or conditional checks:

```vue
<script setup>
import { ref, onMounted } from 'vue'

const windowWidth = ref(0)

// WRONG: crashes on server
// windowWidth.value = window.innerWidth

// CORRECT: only runs on client
onMounted(() => {
  windowWidth.value = window.innerWidth
})
</script>
```

For components that can't run on the server, create a `ClientOnly` wrapper:

```vue
<!-- components/ClientOnly.vue -->
<script setup>
import { ref, onMounted } from 'vue'

const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>

<template>
  <slot v-if="mounted" />
  <slot v-else name="placeholder">
    <div class="skeleton" />
  </slot>
</template>
```

---

## Project architecture for rapid MVP development

### Feature-based folder structure scales naturally

```
src/
├── modules/
│   ├── auth/
│   │   ├── components/
│   │   ├── composables/useAuth.ts
│   │   ├── stores/auth.ts
│   │   └── routes.ts
│   ├── products/
│   └── checkout/
├── core/
│   ├── components/        # Base/shared components
│   ├── composables/       # Shared composables
│   └── services/api.ts    # API client
├── volt/                   # Volt UI components
├── layouts/
├── router/index.ts
└── main.ts
```

### Pinia stores with the Setup syntax provide TypeScript excellence

```typescript
// stores/products.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/core/services/api'

interface Product {
  id: number
  name: string
  price: number
  category: string
}

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const productsByCategory = computed(() => 
    products.value.reduce((acc, product) => {
      (acc[product.category] ||= []).push(product)
      return acc
    }, {} as Record<string, Product[]>)
  )

  async function fetchProducts() {
    isLoading.value = true
    error.value = null
    try {
      products.value = await api.get<Product[]>('/products')
    } catch (e) {
      error.value = 'Failed to load products'
    } finally {
      isLoading.value = false
    }
  }

  return { products, isLoading, error, productsByCategory, fetchProducts }
})
```

Use `storeToRefs` when destructuring to preserve reactivity:

```vue
<script setup>
import { useProductStore } from '@/stores/products'
import { storeToRefs } from 'pinia'

const store = useProductStore()
const { products, isLoading } = storeToRefs(store)
const { fetchProducts } = store // Actions don't need storeToRefs
</script>
```

### Vue Router with lazy-loaded routes and typed meta

```typescript
// router/index.ts
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/modules/home/views/Home.vue'),
    meta: { title: 'Home', requiresAuth: false },
  },
  {
    path: '/dashboard',
    component: () => import('@/modules/dashboard/views/Dashboard.vue'),
    meta: { title: 'Dashboard', requiresAuth: true },
    children: [
      { path: 'analytics', component: () => import('@/modules/dashboard/views/Analytics.vue') },
    ],
  },
]

export function createRouter() {
  return createRouter({
    history: import.meta.env.SSR ? createMemoryHistory() : createWebHistory(),
    routes,
  })
}
```

Add typed route meta declarations:

```typescript
// router/types.d.ts
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
  }
}
```

---

## Testing with Vitest and Vue Test Utils ensures reliability

### Configuration integrates with Vue seamlessly

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

### Component testing with mocked stores

```typescript
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import ProductList from '../ProductList.vue'

describe('ProductList', () => {
  it('displays products from store', () => {
    const wrapper = mount(ProductList, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              products: {
                products: [{ id: 1, name: 'Test Product', price: 99 }],
                isLoading: false,
              },
            },
          }),
        ],
      },
    })
    
    expect(wrapper.text()).toContain('Test Product')
  })
})
```

---

## Development tooling completes the stack

### ESLint flat config for Vue 3 and TypeScript

```javascript
// eslint.config.mjs
import eslint from '@eslint/js'
import eslintPluginVue from 'eslint-plugin-vue'
import typescriptEslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default typescriptEslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [
      eslint.configs.recommended,
      ...typescriptEslint.configs.recommended,
      ...eslintPluginVue.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: { parser: typescriptEslint.parser },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  eslintConfigPrettier
)
```

### Prettier handles formatting

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "vueIndentScriptAndStyle": true
}
```

---

## Conclusion: A production-ready foundation

This stack delivers everything needed for rapid MVP development. **Vue 3.5's reactivity improvements** eliminate common pain points while new features like `useTemplateRef()` and reactive destructuring make code cleaner. **Volt UI** provides accessible, customizable components without the constraints of pre-styled libraries—you own the code. **Vite** ensures sub-second HMR during development and optimized production builds. **Fastify SSR** delivers fast time-to-first-byte with streaming support and graceful degradation.

The feature-based architecture scales from MVP to production without major refactoring. Pinia's setup stores provide full TypeScript inference. Vue Router's lazy loading keeps initial bundles small. And Vitest catches regressions before they ship.

Start with `npm create vue@latest`, add Volt UI via `npx volt-vue add`, configure your Fastify server, and build. The tooling disappears so you can focus on what matters—shipping features to users.