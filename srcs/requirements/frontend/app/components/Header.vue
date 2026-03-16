<script lang="ts" setup>
import Toolbar from '@/volt/Toolbar.vue';
import Button from '@/volt/Button.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/notes', label: 'Notes' },
  { to: '/mindmap', label: 'Mindmap' },
];

async function handleLogout() {
  await authStore.logout();
}

</script>

<template>
  <Toolbar class="!rounded-none !border-x-0 !border-t-0 dark:!bg-surface-900 dark:!border-surface-700">
    <template #start>
      <NuxtLink to="/" class="text-xl font-bold text-primary-500 no-underline mr-4">Mycelium</NuxtLink>
    </template>

    <template #center>
      <nav class="flex gap-1">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to"
          class="px-4 py-2 rounded-md text-sm font-medium text-muted-color hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          active-class="!text-primary-500 bg-surface-100 dark:bg-surface-700">
          {{ item.label }}
        </NuxtLink>
      </nav>
    </template>

    <template #end>
      <div class="flex items-center gap-2">

        <template v-if="authStore.isAuthenticated">
          <NuxtLink to="/profile" class="no-underline text-inherit group">
            <span class="text-sm mr-2 sm:inline flex items-center gap-1 group-hover:text-primary-500 transition-colors"
              v-if="authStore.user?.loginName">
              {{ authStore.user.loginName }}
            </span>
          </NuxtLink>
          <Button label="Logout" size="small" severity="secondary" @click="handleLogout" />
        </template>
        <template v-else>
          <NuxtLink to="/login">
            <Button label="Login" size="small" />
          </NuxtLink>
        </template>
      </div>
    </template>
  </Toolbar>
</template>
