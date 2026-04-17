<script setup lang="ts">
import Button from '@/volt/Button.vue';

const props = defineProps<{
  error: {
    statusCode: number;
    message: string;
  };
}>();

function handleClearError() {
  clearError({ redirect: '/' });
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950 px-4 text-center">
    <h1 class="text-6xl font-bold text-primary-500 mb-2">{{ error.statusCode }}</h1>
    <p class="text-lg text-surface-600 dark:text-surface-400 mb-6">{{ error.message }}</p>
    <Button label="Go Home" @click="handleClearError" />
  </div>
</template>
