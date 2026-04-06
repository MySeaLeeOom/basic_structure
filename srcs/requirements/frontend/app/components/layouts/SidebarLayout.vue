<script setup lang="ts">
defineProps<{
  sidebarWidth?: string;
}>();
</script>

<template>
  <div class="flex flex-col md:flex-row h-full">
    <aside
      class="w-full md:w-56 md:shrink-0 bg-surface-50 dark:bg-surface-800 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-700 px-3 py-3 overflow-y-auto min-h-0">
      <slot name="sidebar" />
    </aside>

    <main
      class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-surface-200 dark:bg-surface-950 overflow-hidden min-h-0">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* .flex-1 {
  gap: 1rem;
} */
</style>
