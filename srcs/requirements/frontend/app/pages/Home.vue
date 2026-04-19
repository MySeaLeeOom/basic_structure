<script setup lang="ts">
import { computed } from 'vue';
import Card from '@/volt/Card.vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';
import IconMushroom from '@/components/icons/IconMushroom.vue';

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
  <div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-6">
    <div class="w-full max-w-3xl flex flex-col items-center gap-6">

      <IconMushroom :size="72" />

      <h1 class="text-3xl font-bold text-center">{{ homeGreeting }}</h1>

      <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card class="w-full">
          <template #title>
            <div class="text-xl font-bold">{{ t('home.definition.word') }}</div>
            <div class="text-sm text-muted-color font-normal mt-1">{{ t('home.definition.ipa') }}</div>
          </template>
          <template #content>
            <p class="mb-2">{{ t('home.definition.meaning') }}</p>
            <p class="text-muted-color italic">{{ t('home.definition.metaphor') }}</p>
          </template>
        </Card>

        <Card class="w-full">
          <template #title>{{ t('home.welcome.title') }}</template>
          <template #content>{{ t('home.welcome.body') }}</template>
        </Card>
      </div>

    </div>
  </div>
</template>
