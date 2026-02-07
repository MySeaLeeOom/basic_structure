<script setup lang="ts">
defineProps<{
  sidebarWidth?: string;
}>();
</script>

<template>
  <div class="flex h-[calc(100vh-60px)]">
    <aside
      class="shrink-0 bg-surface-50 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 p-4"
      :style="{ width: sidebarWidth ?? '16rem' }"
    >
      <slot name="sidebar" />
    </aside>

    <main class="flex-1 flex gap-8 p-8 bg-surface-200 dark:bg-surface-950 overflow-auto items-start justify-center">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* .flex-1 {
  gap: 1rem;
} */
</style>
