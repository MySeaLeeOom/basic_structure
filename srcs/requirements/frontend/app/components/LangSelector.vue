<script lang="ts" setup>
import { computed, ref } from 'vue';
import Button from '@/volt/Button.vue';
import Menu from '@/volt/Menu.vue';
import { useUiI18n, type LocaleId } from '~/composables/useUiI18n';

const { t, locale } = useUiI18n();
const langMenu = ref<InstanceType<typeof Menu> | null>(null);
const iconButtonClass = '!w-7 !h-7 !p-0 !bg-surface-100 dark:!bg-surface-950 !border-surface-300 dark:!border-surface-600 !text-muted-color hover:!bg-surface-200 dark:hover:!bg-surface-900';

const langMenuItems = computed(() => [
  { label: t('lang.en'), command: () => { locale.value = 'en-UK' as LocaleId; } },
  { label: t('lang.de'), command: () => { locale.value = 'de-DE' as LocaleId; } },
  { label: t('lang.es'), command: () => { locale.value = 'es-ES' as LocaleId; } },
  { label: t('lang.ar'), command: () => { locale.value = 'ar' as LocaleId; } },
]);

function toggle(event: Event) {
  langMenu.value?.toggle(event);
}
</script>

<template>
  <div class="relative">
    <Button
      type="button"
      outlined
      rounded
      :class="iconButtonClass"
      :title="t('lang.change')"
      :aria-label="t('lang.change')"
      aria-haspopup="true"
      aria-controls="lang_menu"
      @click="toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        class="w-4 h-4"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </svg>
    </Button>
    <Menu id="lang_menu" ref="langMenu" :model="langMenuItems" :popup="true" />
  </div>
</template>
