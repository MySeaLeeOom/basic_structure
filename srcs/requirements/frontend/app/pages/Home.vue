<script setup lang="ts">
import { computed } from 'vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';

const { t } = useUiI18n();
const authStore = useAuthStore();

const homeGreeting = computed(() => {
  if (authStore.isAuthenticated && authStore.user?.loginName) {
    return t('nav.helloUser', { name: authStore.user.loginName });
  }
  return t('home.greeting');
});
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="section-title">{{ t('home.sidebarTitle') }}</h2>
      <p class="text-muted-color text-sm">{{ t('home.sidebarHint') }}</p>
    </template>

    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4">{{ t('home.title') }}</h1>
      <h2 class="text-lg">{{ homeGreeting }}</h2>
    </div>
  </SidebarLayout>
</template>

