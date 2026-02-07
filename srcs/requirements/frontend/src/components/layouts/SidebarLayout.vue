<script setup lang="ts">
defineProps<{
  sidebarWidth?: string;
}>();
</script>

<template>
  <div class="flex flex-col md:flex-row h-auto md:h-[calc(100vh-60px)]">
    <aside
      class="w-full md:w-64 md:shrink-0 bg-surface-50 dark:bg-surface-800 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-700 p-4">
      <slot name="sidebar" />
    </aside>

    <main
      class="flex-1 flex flex-col md:flex-row gap-4 md:gap-8 p-4 md:p-8 bg-surface-200 dark:bg-surface-950 overflow-auto items-start justify-center">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* .flex-1 {
  gap: 1rem;
} */
</style>
