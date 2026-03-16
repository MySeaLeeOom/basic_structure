<template>
	<div class="flex flex-col gap-2 mb-4">
		<label v-if="label" class="block font-medium text-surface-900 dark:text-surface-0">
			{{ label }}
		</label>
		<slot />
		<small v-if="help" class="text-surface-500 dark:text-surface-400">
			{{ help }}
		</small>
		<small v-if="error" class="text-red-500 dark:text-red-400">
			{{ error }}
		</small>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	label?: string;
	help?: string;
	error?: string;
}>();
</script>
