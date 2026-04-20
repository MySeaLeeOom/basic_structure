<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import Button from '@/volt/Button.vue';
import { useUiI18n } from '~/composables/useUiI18n';

const { t } = useUiI18n();
const isDark = ref(false);
const iconButtonClass = '!w-7 !h-7 !p-0 !bg-surface-100 dark:!bg-surface-950 !border-surface-300 dark:!border-surface-600 !text-muted-color hover:!bg-surface-200 dark:hover:!bg-surface-900';

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
</script>

<template>
  <Button
    type="button"
    outlined
    rounded
    :class="iconButtonClass"
    :title="isDark ? t('nav.light') : t('nav.dark')"
    :aria-label="isDark ? t('nav.light') : t('nav.dark')"
    @click="toggleDark"
  >
    <IconSun v-if="isDark" class="w-4 h-4" />
    <IconMoon v-else class="w-4 h-4" />
  </Button>
</template>
