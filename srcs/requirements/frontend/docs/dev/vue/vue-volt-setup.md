# Vue 3.5+ MVP Development Workflow with Volt UI

Based on current best practices (Vue 3.5+), the typical workflow for creating a **minimal MVP view** focuses on speed and simplicity using **Vite**, the **Composition API** (`<script setup>`), and **Volt UI** for pre-styled, customizable components.

> **Note:** This project uses **custom SSR with Fastify**. Setup instructions below are adapted for SSR compatibility.

---

## Initial Project Setup (One-Time)

Before building views, set up Volt UI in your project:

### 1. Install Dependencies

```bash
# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Volt requirements
npm install tailwindcss-primeui tailwind-merge primevue
```

### 2. Configure Vite

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') }
    ]
  }
});
```

### 3. Configure PrimeVue (Unstyled Mode)

Since this project uses SSR with a factory pattern, PrimeVue must be registered **inside the factory function** to ensure fresh instances per request:

```typescript
// main.ts
import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import App from "./App.vue";
import { createRouter } from "./router";

// NOTE: CSS is NOT imported here - see entry-client.ts

export function createApp(type: "client" | "server") {
  const app = createSSRApp(App);
  const pinia = createPinia();
  const router = createRouter(type);

  app.use(pinia);
  app.use(router);
  app.use(PrimeVue, { unstyled: true });

  return { app, router, pinia };
}
```

```typescript
// entry-client.ts
import "./assets/base.css";  // CSS imported here (client-only)
import { createApp } from "./main";

const { app, router } = createApp("client");

router.isReady().then(() => {
  app.mount("#app");
});
```

**Why this pattern?**
- SSR requires fresh app instances per request to avoid state pollution
- CSS must be imported client-side only to prevent hydration mismatches
- `createSSRApp` enables Vue's SSR hydration mode

### 4. Set Up CSS Variables

Create the base CSS file. This is imported in `entry-client.ts` (not `main.ts`) for SSR compatibility:

```css
/* src/assets/base.css */
@import "tailwindcss";
@import "tailwindcss-primeui";

:root {
  --p-primary-50: #ecfdf5;
  --p-primary-500: #10b981;
  --p-primary-600: #059669;
  --p-primary-700: #047857;
  --p-surface-0: #ffffff;
  --p-surface-100: #f4f4f5;
  --p-surface-200: #e4e4e7;
  --p-surface-700: #3f3f46;
  --p-surface-900: #18181b;
  --p-content-border-radius: 6px;

  --p-primary-color: var(--p-primary-500);
  --p-primary-contrast-color: var(--p-surface-0);
  --p-text-color: var(--p-surface-700);
  --p-text-muted-color: var(--p-surface-500);
}
```

> **SSR Note:** CSS is imported in `entry-client.ts` only. The server renders HTML without styles, and the client applies CSS during hydration. Vite injects the CSS link tag into the HTML automatically.

### 5. Download Volt Components

```bash
# Download components as needed
npx volt-vue add Button
npx volt-vue add InputText
npx volt-vue add Card
npx volt-vue add Dialog
npx volt-vue add Toast

# Or download all at once
npx volt-vue add all
```

---

## Step-by-Step View Development Workflow

When building a specific view for an MVP, follow this strict order to avoid "context switching":

### 1. Scaffold the Template with Volt Components (The "Skeleton")

Write the HTML structure in the `<template>` block first using **Volt components** instead of raw HTML.

```vue
<template>
  <div class="p-6 max-w-md mx-auto">
    <Card>
      <template #title>Create Account</template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <InputText placeholder="you@example.com" fluid />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Password</label>
            <Password placeholder="••••••••" fluid />
          </div>
          <Button label="Sign Up" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from '@/volt/Card.vue';
import InputText from '@/volt/InputText.vue';
import Password from '@/volt/Password.vue';
import Button from '@/volt/Button.vue';
</script>
```

**Why Volt first?** You get a styled, accessible UI immediately without writing CSS. The `fluid` prop makes inputs full-width automatically.

### 2. Define Reactive State (`ref`)

In `<script setup>`, define variables for the inputs you just wrote. Bind them using `v-model`.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Card from '@/volt/Card.vue';
import InputText from '@/volt/InputText.vue';
import Password from '@/volt/Password.vue';
import Button from '@/volt/Button.vue';

// Reactive state
const email = ref('');
const password = ref('');
const isLoading = ref(false);
</script>

<template>
  <div class="p-6 max-w-md mx-auto">
    <Card>
      <template #title>Create Account</template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <InputText v-model="email" placeholder="you@example.com" fluid />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Password</label>
            <Password v-model="password" placeholder="••••••••" fluid />
          </div>
          <Button label="Sign Up" :loading="isLoading" />
        </div>
      </template>
    </Card>
  </div>
</template>
```

### 3. Implement Logic

Write functions that handle user interactions. **MVP Tip:** Mock async actions to test loading states immediately.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Card from '@/volt/Card.vue';
import InputText from '@/volt/InputText.vue';
import Password from '@/volt/Password.vue';
import Button from '@/volt/Button.vue';
import Message from '@/volt/Message.vue';

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref('');
const success = ref(false);

// Mock API call for MVP
async function handleSignUp() {
  error.value = '';
  isLoading.value = true;
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Basic validation
  if (!email.value.includes('@')) {
    error.value = 'Please enter a valid email';
    isLoading.value = false;
    return;
  }
  
  // Mock success
  success.value = true;
  isLoading.value = false;
}
</script>
```

### 4. Add Visual Feedback with Volt Components

Volt provides built-in states for loading, disabled, and feedback. Use `Message` for errors and `Toast` for notifications.

```vue
<template>
  <div class="p-6 max-w-md mx-auto">
    <Card>
      <template #title>Create Account</template>
      <template #content>
        <div class="flex flex-col gap-4">
          <!-- Success state -->
          <Message v-if="success" severity="success">
            Account created! Check your email.
          </Message>
          
          <!-- Error state -->
          <Message v-if="error" severity="error">
            {{ error }}
          </Message>
          
          <template v-if="!success">
            <div>
              <label class="block text-sm font-medium mb-1">Email</label>
              <InputText 
                v-model="email" 
                placeholder="you@example.com" 
                fluid 
                :disabled="isLoading"
                :invalid="!!error"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Password</label>
              <Password 
                v-model="password" 
                placeholder="••••••••" 
                fluid 
                :disabled="isLoading"
              />
            </div>
            <Button 
              label="Sign Up" 
              :loading="isLoading"
              :disabled="!email || !password"
              @click="handleSignUp"
            />
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
```

---

## MVP "Cheats" & Best Practices with Volt

### Skip the Store (Pinia)
Unless sharing data across 3+ views, keep state local. Volt components handle their own internal state (dropdowns, modals, etc.).

### Use Volt's Built-in Features
Volt components come with common patterns built-in:

```vue
<!-- Loading states are built-in -->
<Button label="Save" :loading="isSaving" />

<!-- Form validation styling -->
<InputText :invalid="hasError" />

<!-- Fluid layout without custom CSS -->
<InputText fluid />
<Select fluid />
```

### Quick Customization with PT (Pass-Through)

For instance-level styling, use the `pt:` shorthand instead of editing component files:

```vue
<!-- Add custom styles to specific instances -->
<Button 
  label="Danger Action" 
  pt:root:class="bg-red-500 hover:bg-red-600"
/>

<!-- Customize input styling -->
<InputText 
  pt:root:class="border-2 border-primary"
/>
```

**Important:** Use `pt:root:class` not `class` — regular `class` has lower precedence and may not apply.

### Use Composables for Reuse

If copying logic, move it to a composable:

```javascript
// composables/useFormValidation.js
import { ref, computed } from 'vue';

export function useFormValidation() {
  const errors = ref({});
  
  const validateEmail = (email) => {
    if (!email.includes('@')) {
      errors.value.email = 'Invalid email';
      return false;
    }
    delete errors.value.email;
    return true;
  };
  
  const hasErrors = computed(() => Object.keys(errors.value).length > 0);
  
  return { errors, validateEmail, hasErrors };
}
```

### Component Selection Guide

| Need | Volt Component | Quick Example |
|------|----------------|---------------|
| Text input | `InputText` | `<InputText v-model="name" />` |
| Password | `Password` | `<Password v-model="pass" />` |
| Dropdown | `Select` | `<Select v-model="choice" :options="opts" />` |
| Checkbox | `Checkbox` | `<Checkbox v-model="agreed" />` |
| Date | `DatePicker` | `<DatePicker v-model="date" />` |
| Primary action | `Button` | `<Button label="Submit" />` |
| Secondary action | `SecondaryButton` | `<SecondaryButton label="Cancel" />` |
| Danger action | `DangerButton` | `<DangerButton label="Delete" />` |
| Feedback | `Message` | `<Message severity="error">Error</Message>` |
| Notifications | `Toast` | Via ToastService |
| Modal | `Dialog` | `<Dialog v-model:visible="show">` |
| Cards/Panels | `Card` | `<Card><template #content>...</template></Card>` |

### Don't Write Custom CSS

With Volt + Tailwind, style everything inline:

```vue
<!-- Layout with Tailwind utilities -->
<div class="flex flex-col gap-4 p-6 max-w-lg mx-auto">
  <!-- Volt handles component styling -->
  <InputText v-model="search" placeholder="Search..." />
  <Button label="Go" />
</div>
```

### Quick Theming (Change Primary Color)

Update CSS variables in `base.css` to match your brand:

```css
:root {
  /* Change to blue theme */
  --p-primary-500: #3b82f6;
  --p-primary-600: #2563eb;
  --p-primary-700: #1d4ed8;
}
```

---

## Complete MVP View Example

```vue
<template>
  <div class="min-h-screen bg-surface-50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-user-plus text-primary" />
          Create Account
        </div>
      </template>
      
      <template #content>
        <form @submit.prevent="handleSignUp" class="flex flex-col gap-4">
          <Message v-if="feedback.message" :severity="feedback.type">
            {{ feedback.message }}
          </Message>
          
          <div>
            <label for="email" class="block text-sm font-medium text-muted-color mb-1">
              Email
            </label>
            <InputText 
              id="email"
              v-model="form.email" 
              type="email"
              placeholder="you@example.com" 
              fluid 
              :disabled="isLoading"
            />
          </div>
          
          <div>
            <label for="password" class="block text-sm font-medium text-muted-color mb-1">
              Password
            </label>
            <Password 
              id="password"
              v-model="form.password" 
              placeholder="Min 8 characters" 
              fluid 
              :disabled="isLoading"
              toggleMask
            />
          </div>
          
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.terms" inputId="terms" binary />
            <label for="terms" class="text-sm">
              I agree to the Terms of Service
            </label>
          </div>
          
          <Button 
            type="submit"
            label="Create Account" 
            :loading="isLoading"
            :disabled="!isFormValid"
            class="mt-2"
          />
          
          <p class="text-center text-sm text-muted-color">
            Already have an account? 
            <a href="/login" class="text-primary hover:underline">Sign in</a>
          </p>
        </form>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import Card from '@/volt/Card.vue';
import InputText from '@/volt/InputText.vue';
import Password from '@/volt/Password.vue';
import Button from '@/volt/Button.vue';
import Checkbox from '@/volt/Checkbox.vue';
import Message from '@/volt/Message.vue';

// Form state
const form = reactive({
  email: '',
  password: '',
  terms: false
});

// UI state
const isLoading = ref(false);
const feedback = reactive({ type: '', message: '' });

// Validation
const isFormValid = computed(() => 
  form.email.includes('@') && 
  form.password.length >= 8 && 
  form.terms
);

// Submit handler (mock for MVP)
async function handleSignUp() {
  feedback.message = '';
  isLoading.value = true;
  
  await new Promise(r => setTimeout(r, 1500)); // Simulate API
  
  // Mock success
  feedback.type = 'success';
  feedback.message = 'Account created! Redirecting...';
  isLoading.value = false;
  
  // Simulate redirect
  setTimeout(() => {
    // router.push('/dashboard')
    console.log('Would redirect to dashboard');
  }, 1500);
}
</script>
```

---

## Summary: Volt MVP Workflow

1. **Setup once:** Install Volt dependencies, configure PrimeVue unstyled mode, add CSS variables
2. **Download components:** `npx volt-vue add <ComponentName>` as needed
3. **Build views:** Template first (Volt components) → State (refs) → Logic → Feedback
4. **Style with Tailwind:** Use utility classes for layout, Volt handles component styling
5. **Customize sparingly:** Use `pt:root:class` for quick tweaks, edit component files for global changes

**Key benefits:**
- No CSS files to maintain
- Built-in accessibility (WCAG AA)
- Consistent design out of the box
- Full customization when needed

---

## SSR Considerations

This project uses custom SSR with Fastify. Keep these patterns in mind:

### File Structure

```
src/
├── main.ts           # Factory function (creates fresh app per request)
├── entry-client.ts   # Client hydration + CSS import
├── entry-server.ts   # Server render function
├── assets/
│   └── base.css      # Tailwind + PrimeVue variables
└── volt/             # Downloaded Volt components
```

### Hydration Safety

Ensure server and client render identical HTML. Avoid:

```vue
<!-- ❌ BAD: Different output on server vs client -->
<template>
  <span>{{ Date.now() }}</span>
  <span>{{ Math.random() }}</span>
</template>

<!-- ✅ GOOD: Use onMounted for client-only code -->
<script setup>
import { ref, onMounted } from 'vue';

const windowWidth = ref(0);

onMounted(() => {
  // Safe: only runs on client after hydration
  windowWidth.value = window.innerWidth;
});
</script>
```

### Browser APIs

Use `onMounted` or check for client environment before accessing browser APIs:

```vue
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  // Safe: window, document, localStorage available here
  const token = localStorage.getItem('token');
});
</script>
```

### Volt Components with SSR

Most Volt components work seamlessly with SSR. For components that require browser APIs (like Toast), ensure they're used within `onMounted` or triggered by user actions:

```vue
<script setup>
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';

const toast = useToast();

// ✅ Called by user action (button click) - safe
function showSuccess() {
  toast.add({ severity: 'success', summary: 'Saved!' });
}

// ❌ Don't call toast during SSR render
// toast.add(...) // This would fail on server
</script>
```