<script setup lang="ts">
import { ref } from 'vue';
import Popover from '@/volt/Popover.vue';
import IconMushroom from '@/components/icons/IconMushroom.vue';

const popover = ref();

const tips = [
  { icon: 'pi pi-search',     text: 'Ask the AI assistant anything — it uses RAG to search directly through your notes.' },
  { icon: 'pi pi-users',      text: 'Share any note with teammates and edit together in real time.' },
  { icon: 'pi pi-server',     text: 'Fully self-hosted — your data never leaves your infrastructure.' },
  { icon: 'pi pi-file-export',text: 'Export your notes from the account page.' },
];
</script>

<template>
  <button
    class="fixed bottom-16 right-6 z-50 rounded-full p-2 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-lg hover:scale-110 transition-transform duration-150"
    aria-label="App tips"
    @click="popover.toggle($event)"
  >
    <IconMushroom :size="36" />
  </button>

  <Popover ref="popover">
    <ul class="flex flex-col gap-3 min-w-64 max-w-xs">
      <li v-for="tip in tips" :key="tip.text" class="flex items-start gap-3 text-sm">
        <i :class="tip.icon" class="mt-0.5 text-primary-500 shrink-0" />
        <span>{{ tip.text }}</span>
      </li>
    </ul>
  </Popover>
</template>
