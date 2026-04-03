<script lang="ts" setup>
import { computed, ref } from 'vue';
import Toolbar from '@/volt/Toolbar.vue';
import Button from '@/volt/Button.vue';
import Menu from '@/volt/Menu.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const { t, locale } = useUiI18n();

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
  { to: '/mindmap', label: t('nav.mindmap') },
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
