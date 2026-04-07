<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import Toolbar from '@/volt/Toolbar.vue';
import Button from '@/volt/Button.vue';
import Menu from '@/volt/Menu.vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';

const authStore = useAuthStore();
const { t, locale } = useUiI18n();
const isDark = ref(true);

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark');
});

function toggleDark() {
  document.documentElement.classList.add('theme-transition');
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300);
}

/** Same cookie key / tags as `noteStore` → `Accept-Language` for the notes API */
function setLocale(tag: 'en-UK' | 'de-DE' | 'es-ES') {
  locale.value = tag;
  if (import.meta.client) {
    window.location.reload();
  }
}

const langMenu = ref<InstanceType<typeof Menu> | null>(null);

function toggleLangMenu(event: Event) {
  langMenu.value?.toggle(event);
}

const langMenuItems = computed(() => [
  {
    label: t('lang.en'),
    command: () => setLocale('en-UK'),
  },
  {
    label: t('lang.de'),
    command: () => setLocale('de-DE'),
  },
  {
    label: t('lang.es'),
    command: () => setLocale('es-ES'),
  },
]);

const navItems = computed(() => [
  { to: '/home', label: t('nav.home') },
  { to: '/notes', label: t('nav.notes') },
]);

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
        <button @click="toggleDark"
          class="p-2 rounded-md text-muted-color hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.061l1.061-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.061l1.061-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.061 1.06l1.06 1.061ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.061 1.06l1.06 1.061Z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clip-rule="evenodd" />
          </svg>
        </button>
        <div class="relative mr-1">
          <Button
            type="button"
            :label="t('lang.select')"
            icon="pi pi-globe"
            icon-pos="left"
            size="small"
            severity="secondary"
            outlined
            aria-haspopup="true"
            aria-controls="lang_menu"
            @click="toggleLangMenu"
          />
          <Menu
            id="lang_menu"
            ref="langMenu"
            :model="langMenuItems"
            :popup="true"
          />
        </div>

        <template v-if="authStore.isAuthenticated">
          <NuxtLink to="/profile" class="no-underline text-inherit group">
            <span class="text-sm mr-2 sm:inline flex items-center gap-1 group-hover:text-primary-500 transition-colors"
              v-if="authStore.user?.loginName">
              {{ authStore.user.loginName }}
            </span>
          </NuxtLink>
          <Button :label="t('auth.logout')" size="small" severity="secondary" @click="handleLogout" />
        </template>
        <template v-else>
          <NuxtLink to="/login">
            <Button :label="t('auth.login')" size="small" />
          </NuxtLink>
        </template>
      </div>
    </template>
  </Toolbar>
</template>
