<script setup lang="ts">
const sidebarOpen = defineModel<boolean>('sidebarOpen', { default: true });
</script>

<template>
  <div class="flex flex-col md:flex-row h-full">
    <aside
      v-show="sidebarOpen"
      class="w-full md:w-56 md:shrink-0 bg-surface-50 dark:bg-surface-800 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-700 px-3 py-3 overflow-y-auto min-h-0">
      <slot name="sidebar" />
    </aside>

    <main
      class="relative flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-surface-200 dark:bg-surface-950 overflow-hidden min-h-0">
      <button
        v-if="!sidebarOpen"
        class="absolute top-3 left-3 z-10 w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-300 dark:hover:text-surface-200 dark:hover:bg-surface-700 transition-colors"
        title="Show sidebar"
        @click="sidebarOpen = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clip-rule="evenodd" />
        </svg>
      </button>
      <slot />
    </main>
  </div>
</template>
