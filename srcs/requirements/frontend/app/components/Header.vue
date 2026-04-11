<script lang="ts" setup>
import { computed, ref } from 'vue';
import Toolbar from '@/volt/Toolbar.vue';
import Button from '@/volt/Button.vue';
import Menu from '@/volt/Menu.vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';

const authStore = useAuthStore();
const { t } = useUiI18n();

const avatarMenu = ref<InstanceType<typeof Menu> | null>(null);

const avatarMenuItems = computed(() => [
  { label: `Hello, ${authStore.user?.loginName}!`, disabled: true },
  { separator: true },
  { label: t('nav.home'), command: () => navigateTo('/home') },
  { label: t('nav.notes'), command: () => navigateTo('/notes') },
  { separator: true },
  { label: t('nav.account'), command: () => navigateTo('/profile') },
  { label: t('auth.logout'), command: () => authStore.logout() },
]);

const navItems = computed(() => [
  { to: '/home', label: t('nav.home') },
  { to: '/notes', label: t('nav.notes') },
]);
</script>

<template>
  <Toolbar class="!rounded-none !border-x-0 !border-t-0 dark:!bg-surface-900 dark:!border-surface-700">
    <template #start>
      <div class="flex items-center gap-2">
        <NuxtLink to="/" class="text-xl font-bold text-primary-500 no-underline mr-2">{{ t('nav.brand') }}</NuxtLink>
        <DarkModeToggle />
        <LangSelector />
      </div>
    </template>

    <template #center>
      <nav class="hidden sm:flex gap-1">
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
          <NuxtLink to="/account" class="no-underline text-inherit group hidden sm:block">
            <span v-if="authStore.user?.loginName"
              class="text-sm  font-medium text-muted-color  flex items-center gap-1 group-hover:text-primary-500 transition-colors">
              {{ authStore.user.loginName }}
            </span>
          </NuxtLink>

          <div class="relative">
            <UserAvatar
              :uuid="authStore.user!.id"
              :size="32"
              class="cursor-pointer"
              aria-haspopup="true"
              aria-controls="header_avatar_menu"
              @click="avatarMenu?.toggle($event)"
            />
            <Menu
              id="header_avatar_menu"
              ref="avatarMenu"
              :model="avatarMenuItems"
              :popup="true"
            />
          </div>
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
