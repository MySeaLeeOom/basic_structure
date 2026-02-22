<script lang="ts" setup>
import { RouterLink } from 'vue-router';
import Toolbar from '@/volt/Toolbar.vue';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/notes', label: 'Notes' },
  { to: '/mindmap', label: 'Mindmap' },
];

</script>

<template>
  <a href="/api/auth/login/github">loginGit</a>
  <Toolbar class="!rounded-none !border-x-0 !border-t-0 dark:!bg-surface-900 dark:!border-surface-700">
    <template #start>
      <RouterLink to="/" class="text-xl font-bold text-primary-500 no-underline">Mycelium</RouterLink>
    </template>
    <template #center>
      <nav class="flex gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-4 py-2 rounded-md text-sm font-medium text-muted-color hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          active-class="!text-primary-500 bg-surface-100 dark:bg-surface-700"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </template>
  </Toolbar>
</template>
