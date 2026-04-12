<script setup lang="ts">
const sidebarOpen = defineModel<boolean>('sidebarOpen', { default: true });
</script>

<template>
  <div class="flex flex-col md:flex-row h-full">
    <aside
      class="shrink-0 bg-surface-50 dark:bg-surface-800 md:border-r border-surface-200 dark:border-surface-700 overflow-hidden py-3 transition-[width]"
      :class="sidebarOpen
        ? 'w-full md:w-56 border-b md:border-b-0 px-3 overflow-y-auto min-h-0'
        : 'w-full md:w-10 px-1.5'"
    >
      <slot name="sidebar" />
    </aside>

    <main
      class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-surface-200 dark:bg-surface-950 overflow-hidden min-h-0">
      <slot />
    </main>
  </div>
</template>
