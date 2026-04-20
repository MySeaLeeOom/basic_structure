<script setup lang="ts">
import { useUiI18n } from '~/composables/useUiI18n';

const sidebarOpen = defineModel<boolean>('sidebarOpen', { default: true });
const { t } = useUiI18n();
</script>

<template>
  <div class="relative flex flex-col md:flex-row h-full">
    <aside
      v-show="sidebarOpen"
      class="w-full md:w-56 md:shrink-0 bg-surface-50 dark:bg-surface-800 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-700 px-3 py-3 overflow-y-auto min-h-0">
      <slot name="sidebar" />
    </aside>

    <div
      v-if="!sidebarOpen"
      class="absolute top-3 start-3 z-10 flex flex-col gap-1"
    >
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-300 dark:hover:text-surface-200 dark:hover:bg-surface-700 transition-colors"
        :title="t('notes.sidebar.show')"
        @click="sidebarOpen = true"
      >
        <IconBars class="w-4 h-4" />
      </button>
      <slot name="collapsed-actions" />
    </div>

    <main
      class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-surface-200 dark:bg-surface-950 overflow-hidden min-h-0">
      <slot />
    </main>
  </div>
</template>
